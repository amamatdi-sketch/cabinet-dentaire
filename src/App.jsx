import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG SUPABASE ──────────────────────────────────────────────────────────
// ⚠️  Remplacez VOTRE_CLE_SUPABASE par votre clé anon
// Trouvez-la sur : supabase.com → votre projet → Settings → API → anon public
const SUPABASE_URL = "https://jeidktusskhegocpppw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplaWRrdHVzc2toZWdvcGNwcHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTYyODksImV4cCI6MjA5NTQzMjI4OX0.Rzq8yB04besi2RzjbNKB96C5vO6J5QLS5tWaC3dSuVg";
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TARIFS ───────────────────────────────────────────────────────────────────
const TARIFS = {
  "Consultation":                   [500],
  "Extraction adulte":              [1500],
  "Extraction enfant":              [1000],
  "Extraction DDS":                 [2500],
  "Chirurgie DDS":                  [12000],
  "Radio":                          [1000],
  "Soin":                           [5000],
  "Détartrage":                     [1000, 2000, 3000, 4000, 5000],
  "Couronne inox":                  [5000],
  "Couronne résine":                [6000],
  "CCM":                            [15000],
  "ZIR":                            [25000],
  "Prothèse flexible unilatérale":  [9000],
  "Prothèse flexible partielle":    [20000, 28000, 36000, 42000],
  "Prothèse totale":                [20000, 36000, 42000, 50000, 60000, 80000, 90000],
  "Prothèse totale sup":            [10000, 18000, 21000, 25000, 30000, 40000, 45000],
  "Prothèse totale inf":            [10000, 18000, 21000, 25000, 30000, 40000, 45000],
};
const TYPES = Object.keys(TARIFS);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
const now  = () => new Date().toISOString().slice(0, 10);
const fmt  = (n) => Number(n || 0).toLocaleString("fr-DZ") + " DA";

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [role,      setRole]      = useState(null);
  const [praticien, setPraticien] = useState("Dr. Amin");
  const [page,      setPage]      = useState("dashboard");
  const [patients,  setPatients]  = useState([]);
  const [actes,     setActes]     = useState([]);
  const [factures,  setFactures]  = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [modalData, setModalData] = useState(null);

  /* ── Chargement ── */
  useEffect(() => {
    if (!role) return;
    loadAll();
    const ch = db.channel("rt-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" },  () => loadPatients())
      .on("postgres_changes", { event: "*", schema: "public", table: "actes" },     () => loadActes())
      .on("postgres_changes", { event: "*", schema: "public", table: "factures" },  () => loadFactures())
      .subscribe((s) => setConnected(s === "SUBSCRIBED"));
    return () => db.removeChannel(ch);
  }, [role]);

  const loadAll      = async () => { setLoading(true); await Promise.all([loadPatients(), loadActes(), loadFactures()]); setLoading(false); };
  const loadPatients = async () => { const { data } = await db.from("patients").select("*").order("dateCreation", { ascending: false }); if (data) setPatients(data); };
  const loadActes    = async () => { const { data } = await db.from("actes").select("*").order("date", { ascending: false }); if (data) setActes(data); };
  const loadFactures = async () => { const { data } = await db.from("factures").select("*").order("date", { ascending: false }); if (data) setFactures(data); };

  const closeModal = () => { setModal(null); setModalData(null); };

  /* ── Suppression ── */
  const deletePatient = async (id) => {
    if (!confirm("Supprimer ce patient et toutes ses données ?")) return;
    await db.from("actes").delete().eq("patientId", id);
    await db.from("factures").delete().eq("patientId", id);
    await db.from("patients").delete().eq("id", id);
    loadAll();
  };
  const deleteActe = async (id) => {
    if (!confirm("Supprimer cet acte ?")) return;
    await db.from("actes").delete().eq("id", id);
    loadActes();
  };
  const deleteFacture = async (id) => {
    if (!confirm("Supprimer cette facture ?")) return;
    await db.from("actes").update({ facturId: null }).eq("facturId", id);
    await db.from("factures").delete().eq("id", id);
    loadAll();
  };

  /* ════════════════════════════════════════
     ÉCRAN DE CONNEXION
  ════════════════════════════════════════ */
  if (!role) {
    return (
      <div style={S.loginBg}>
        <div style={S.loginCard}>
          <div style={S.loginEmoji}>🦷</div>
          <h1 style={S.loginTitle}>Cabinet Dr. Amin &amp; Dr. Bossioda</h1>
          <p style={S.loginSub}>Choisissez votre profil</p>
          <div style={S.roleGrid}>
            {[
              { label: "Dr. Amin",     icon: "👨‍⚕️", r: "medecin",   p: "Dr. Amin"    },
              { label: "Dr. Bossioda", icon: "👨‍⚕️", r: "medecin",   p: "Dr. Bossioda"},
              { label: "Assistante",   icon: "👩‍💼", r: "assistante", p: null          },
            ].map(({ label, icon, r, p }) => (
              <button key={label} style={S.roleBtn}
                onClick={() => { setRole(r); if (p) setPraticien(p); setPage("dashboard"); }}>
                <span style={{ fontSize: 32 }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {r === "assistante" ? "Facturation & patients" : "Accès complet"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════
     LAYOUT PRINCIPAL
  ════════════════════════════════════════ */
  const nav = [
    { id: "dashboard",   label: "Tableau de bord", icon: "📊" },
    { id: "patients",    label: "Patients",         icon: "👥" },
    ...(role === "medecin" ? [{ id: "actes", label: "Actes Cliniques", icon: "🦷" }] : []),
    { id: "facturation", label: "Facturation",      icon: "💰" },
  ];

  return (
    <div style={S.app}>
      {/* ── Sidebar ── */}
      <nav style={S.sidebar}>
        <div style={S.sidebarTop}>
          <span style={{ fontSize: 28 }}>🦷</span>
          <div>
            <div style={S.sidebarName}>Cabinet Dentaire</div>
            <div style={S.sidebarRole}>{role === "assistante" ? "Assistante" : praticien}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {nav.map((n) => (
            <button key={n.id}
              style={{ ...S.navBtn, ...(page === n.id ? S.navBtnOn : {}) }}
              onClick={() => setPage(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div>
          <div style={S.connDot}>
            <span style={{ color: connected ? "#22c55e" : "#f59e0b" }}>●</span>
            {connected ? " Connecté" : " Connexion…"}
          </div>
          <button style={S.logoutBtn} onClick={() => setRole(null)}>← Changer de profil</button>
        </div>
      </nav>

      {/* ── Contenu ── */}
      <main style={S.main}>
        {loading ? (
          <div style={S.loader}>⏳ Chargement…</div>
        ) : (
          <>
            {page === "dashboard" && (
              <Dashboard patients={patients} actes={actes} factures={factures} />
            )}
            {page === "patients" && (
              <PatientsPage
                patients={patients} actes={actes} factures={factures} role={role}
                onNew={() => setModal("newPatient")}
                onEdit={(p) => { setModal("editPatient"); setModalData(p); }}
                onDelete={deletePatient}
                onFacture={(pid) => { setModal("newFacture"); setModalData({ patientId: pid }); }}
              />
            )}
            {page === "actes" && role === "medecin" && (
              <ActesPage
                patients={patients} actes={actes}
                onNew={() => setModal("newActe")}
                onDelete={deleteActe}
              />
            )}
            {page === "facturation" && (
              <FacturationPage
                patients={patients} actes={actes} factures={factures} role={role}
                onFacture={(pid) => { setModal("newFacture"); setModalData({ patientId: pid }); }}
                onPayment={(f) => { setModal("payment"); setModalData(f); }}
                onDelete={deleteFacture}
              />
            )}
          </>
        )}
      </main>

      {/* ════ MODALS ════ */}
      {modal === "newPatient" && (
        <PatientModal role={role} onClose={closeModal}
          onSave={async (d) => {
            await db.from("patients").insert([{ ...d, id: uid(), dateCreation: now() }]);
            closeModal(); loadPatients();
          }} />
      )}
      {modal === "editPatient" && modalData && (
        <PatientModal role={role} patient={modalData} onClose={closeModal}
          onSave={async (d) => {
            await db.from("patients").update(d).eq("id", modalData.id);
            closeModal(); loadPatients();
          }} />
      )}
      {modal === "newActe" && (
        <ActeModal patients={patients} actes={actes} praticien={praticien}
          onClose={closeModal}
          onSave={async (list) => {
            await db.from("actes").insert(list);
            closeModal(); loadActes();
          }} />
      )}
      {modal === "newFacture" && modalData && (
        <FactureModal
          patients={patients} actes={actes}
          patientId={modalData.patientId} praticien={praticien}
          onClose={closeModal}
          onSave={async (facture, ids) => {
            const { data } = await db.from("factures").insert([facture]).select();
            if (data?.[0]) await db.from("actes").update({ facturId: data[0].id }).in("id", ids);
            closeModal(); loadAll();
          }} />
      )}
      {modal === "payment" && modalData && (
        <PaymentModal facture={modalData} onClose={closeModal}
          onSave={async (montant, mode) => {
            const newPaye  = (modalData.montantPaye || 0) + montant;
            const newReste = Math.max(0, (modalData.montantNet || 0) - newPaye);
            await db.from("factures").update({
              montantPaye: newPaye,
              resteAPayer: newReste,
              modePaiement: mode,
              statut: newReste <= 0 ? "soldé" : "partiel",
            }).eq("id", modalData.id);
            closeModal(); loadFactures();
          }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TABLEAU DE BORD
══════════════════════════════════════════════════════════ */
function Dashboard({ patients, actes, factures }) {
  const d        = now();
  const actesAuj = actes.filter(a => a.date === d);
  const caAuj    = actesAuj.reduce((s, a) => s + (Number(a.montantVerse) || 0), 0);
  const impayes  = factures.filter(f => f.statut !== "soldé").reduce((s, f) => s + (Number(f.resteAPayer) || 0), 0);

  const cards = [
    { label: "Total Patients",     value: patients.length,  icon: "👥", color: "#3b82f6" },
    { label: "Actes aujourd'hui",  value: actesAuj.length,  icon: "🦷", color: "#10b981" },
    { label: "Recettes du jour",   value: fmt(caAuj),       icon: "💵", color: "#f59e0b" },
    { label: "Total Impayés",      value: fmt(impayes),     icon: "⚠️", color: "#ef4444" },
  ];

  return (
    <div>
      <h1 style={S.pageTitle}>Tableau de bord</h1>
      <div style={S.statsGrid}>
        {cards.map((c) => (
          <div key={c.label} style={{ ...S.statCard, borderLeftColor: c.color }}>
            <span style={{ fontSize: 32 }}>{c.icon}</span>
            <div>
              <div style={{ ...S.statVal, color: c.color }}>{c.value}</div>
              <div style={S.statLbl}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Résumé traitements en cours */}
      <h2 style={{ ...S.pageTitle, fontSize: 16, marginTop: 32 }}>Activité récente</h2>
      {actes.slice(0, 5).map(a => {
        const p = patients.find(x => x.id === a.patientId);
        return (
          <div key={a.id} style={S.recentRow}>
            <span style={S.recentDate}>{a.date}</span>
            <span style={S.recentName}>{p ? `${p.prenom} ${p.nom}` : "—"}</span>
            <span style={S.recentType}>{a.typeActe} {a.dents ? `(D${a.dents})` : ""}</span>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>{fmt(a.montantVerse || 0)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PATIENTS
══════════════════════════════════════════════════════════ */
function PatientsPage({ patients, actes, factures, role, onNew, onEdit, onDelete, onFacture }) {
  const [search,  setSearch]  = useState("");
  const [selId,   setSelId]   = useState(null);

  const list     = patients.filter(p =>
    `${p.nom} ${p.prenom} ${p.telephone || ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const selected = patients.find(p => p.id === selId);

  return (
    <div style={S.splitView}>
      {/* ── Liste ── */}
      <div style={S.leftPane}>
        <div style={S.paneHeader}>
          <h2 style={S.panTitle}>Patients ({patients.length})</h2>
          {role === "medecin" && <button style={S.btnBlue} onClick={onNew}>+ Nouveau</button>}
        </div>
        <input style={S.searchBox} placeholder="🔍 Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={S.scrollList}>
          {list.map(p => (
            <div key={p.id}
              style={{ ...S.patRow, ...(selId === p.id ? S.patRowOn : {}) }}
              onClick={() => setSelId(p.id)}>
              <div style={S.avatar}>{(p.prenom?.[0] || "?")}{(p.nom?.[0] || "")}</div>
              <div>
                <div style={S.patName}>{p.prenom} {p.nom}</div>
                <div style={S.patSub}>{p.telephone || "Pas de téléphone"}</div>
              </div>
            </div>
          ))}
          {list.length === 0 && <div style={S.empty}>Aucun patient trouvé</div>}
        </div>
      </div>

      {/* ── Fiche ── */}
      <div style={S.rightPane}>
        {selected ? (
          <PatientFiche
            patient={selected}
            actes={actes.filter(a => a.patientId === selected.id)}
            factures={factures.filter(f => f.patientId === selected.id)}
            role={role}
            onEdit={() => onEdit(selected)}
            onDelete={() => { onDelete(selected.id); setSelId(null); }}
            onFacture={() => onFacture(selected.id)}
          />
        ) : (
          <div style={S.emptyDetail}>← Sélectionnez un patient</div>
        )}
      </div>
    </div>
  );
}

function PatientFiche({ patient, actes, factures, role, onEdit, onDelete, onFacture }) {
  const actesSansFact = actes.filter(a => !a.facturId);

  /* Regrouper par traitementRef */
  const groups = {};
  actes.forEach(a => {
    const k = a.traitementRef || a.id;
    if (!groups[k]) groups[k] = [];
    groups[k].push(a);
  });

  return (
    <div style={S.ficheWrap}>
      {/* En-tête */}
      <div style={S.ficheHead}>
        <div>
          <h2 style={S.ficheTitle}>{patient.prenom} {patient.nom}</h2>
          <div style={{ color: "#64748b", fontSize: 13 }}>{patient.dateCreation ? `Depuis ${patient.dateCreation}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btnGray}  onClick={onEdit}>✏️ Modifier</button>
          {actesSansFact.length > 0 && role === "medecin" && (
            <button style={S.btnBlue} onClick={onFacture}>🧾 Facturer ({actesSansFact.length})</button>
          )}
          {role === "medecin" && <button style={S.btnRed} onClick={onDelete}>🗑️ Supprimer</button>}
        </div>
      </div>

      {/* Infos médicales */}
      <div style={S.infoGrid}>
        {[
          ["📞 Téléphone",      patient.telephone    || "—"],
          ["⚠️ Allergies",      patient.allergies    || "—"],
          ["🩺 Antécédents",    patient.antecedents  || "—"],
          ["💊 Traitements",    patient.traitements  || "—"],
        ].map(([k, v]) => (
          <div key={k} style={S.infoBox}>
            <div style={S.infoKey}>{k}</div>
            <div style={S.infoVal}>{v}</div>
          </div>
        ))}
      </div>

      {/* Traitements */}
      <h3 style={S.secTitle}>🦷 Historique des traitements</h3>
      {Object.entries(groups).length === 0 && <div style={S.empty}>Aucun acte enregistré</div>}
      {Object.entries(groups).map(([ref, sessions]) => {
        const sorted    = [...sessions].sort((a, b) => (Number(a.seanceNum) || 1) - (Number(b.seanceNum) || 1));
        const first     = sorted[0];
        const prixTotal = Number(first.prixTotal || first.prix) || 0;
        const totalPaye = sessions.reduce((s, a) => s + (Number(a.montantVerse) || 0), 0);
        const reste     = Math.max(0, prixTotal - totalPaye);

        return (
          <div key={ref} style={S.treatCard}>
            <div style={S.treatHead}>
              <div style={S.treatLabel}>
                {first.typeActe}
                {first.dents ? <span style={S.toothBadge}>Dent {first.dents}</span> : null}
                {(first.quantite || 1) > 1 ? <span style={S.qtyBadge}>×{first.quantite}</span> : null}
              </div>
              <span style={{ ...S.statusBadge, background: reste <= 0 ? "#dcfce7" : "#fef9c3", color: reste <= 0 ? "#166534" : "#854d0e" }}>
                {reste <= 0 ? "✅ Soldé" : `⚠️ Reste: ${fmt(reste)}`}
              </span>
            </div>
            <div style={S.sessTable}>
              <div style={S.sessHeader}>
                <span>Séance</span><span>Date</span><span>Étape</span><span>Versement</span><span>Observations</span>
              </div>
              {sorted.map((s, i) => (
                <div key={s.id} style={S.sessRow}>
                  <span style={{ fontWeight: 700, color: "#1e40af" }}>S{s.seanceNum || i + 1}</span>
                  <span>{s.date}</span>
                  <span>{s.etape || "—"}</span>
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>+{fmt(s.montantVerse || 0)}</span>
                  <span style={{ color: "#6b7280", fontSize: 11 }}>{s.observations || "—"}</span>
                </div>
              ))}
            </div>
            <div style={S.treatFoot}>
              Total plan: <b>{fmt(prixTotal)}</b> &nbsp;|&nbsp;
              Payé: <b style={{ color: "#16a34a" }}>{fmt(totalPaye)}</b> &nbsp;|&nbsp;
              Reste: <b style={{ color: reste > 0 ? "#ef4444" : "#16a34a" }}>{fmt(reste)}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL PATIENT (nouveau / modifier)
══════════════════════════════════════════════════════════ */
function PatientModal({ patient, role, onClose, onSave }) {
  const isAsst = role === "assistante";
  const [f, setF] = useState({
    prenom:      patient?.prenom      || "",
    nom:         patient?.nom         || "",
    telephone:   patient?.telephone   || "",
    antecedents: patient?.antecedents || "",
    traitements: patient?.traitements || "",
    allergies:   patient?.allergies   || "",
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  // Assistante : seulement le numéro de téléphone
  if (isAsst) {
    return (
      <Modal title="Ajouter / modifier le téléphone" onClose={onClose}>
        <div style={S.fGroup}>
          <label style={S.fLabel}>📞 Numéro de téléphone</label>
          <input style={S.fInput} value={f.telephone} onChange={e => set("telephone", e.target.value)} placeholder="0555 000 000" />
        </div>
        <div style={S.mActions}>
          <button style={S.btnGray} onClick={onClose}>Annuler</button>
          <button style={S.btnBlue} onClick={() => onSave({ telephone: f.telephone })}>💾 Enregistrer</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={patient ? "Modifier le patient" : "Nouveau patient"} onClose={onClose}>
      <div style={S.formRow}>
        <div style={S.fGroup}>
          <label style={S.fLabel}>Prénom *</label>
          <input style={S.fInput} value={f.prenom} onChange={e => set("prenom", e.target.value)} />
        </div>
        <div style={S.fGroup}>
          <label style={S.fLabel}>Nom *</label>
          <input style={S.fInput} value={f.nom} onChange={e => set("nom", e.target.value)} />
        </div>
      </div>
      <div style={S.fGroup}>
        <label style={S.fLabel}>📞 Téléphone</label>
        <input style={S.fInput} value={f.telephone} onChange={e => set("telephone", e.target.value)} placeholder="0555 000 000" />
      </div>
      <div style={S.fGroup}>
        <label style={S.fLabel}>⚠️ Allergies (pénicilline, latex, AINS…)</label>
        <input style={S.fInput} value={f.allergies} onChange={e => set("allergies", e.target.value)} />
      </div>
      <div style={S.fGroup}>
        <label style={S.fLabel}>🩺 Antécédents médicaux</label>
        <textarea style={S.fTextarea} rows={2} value={f.antecedents} onChange={e => set("antecedents", e.target.value)} />
      </div>
      <div style={S.fGroup}>
        <label style={S.fLabel}>💊 Traitements en cours</label>
        <textarea style={S.fTextarea} rows={2} value={f.traitements} onChange={e => set("traitements", e.target.value)} />
      </div>
      <div style={S.mActions}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={() => {
          if (!f.prenom.trim() || !f.nom.trim()) return alert("Prénom et Nom requis");
          onSave(f);
        }}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   ACTES CLINIQUES
══════════════════════════════════════════════════════════ */
function ActesPage({ patients, actes, onNew, onDelete }) {
  const [filterPat, setFilterPat] = useState("");

  const filtered = actes.filter(a => !filterPat || a.patientId === filterPat);

  const groups = {};
  filtered.forEach(a => {
    const k = a.traitementRef || a.id;
    if (!groups[k]) groups[k] = [];
    groups[k].push(a);
  });

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.pageTitle}>Actes Cliniques</h1>
        <button style={S.btnBlue} onClick={onNew}>+ Nouvelle Séance</button>
      </div>
      <select style={S.filterSel} value={filterPat} onChange={e => setFilterPat(e.target.value)}>
        <option value="">Tous les patients</option>
        {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
      </select>

      {Object.keys(groups).length === 0 && <div style={S.empty}>Aucun acte enregistré</div>}

      {Object.entries(groups).map(([ref, sessions]) => {
        const sorted    = [...sessions].sort((a, b) => (Number(a.seanceNum)||1) - (Number(b.seanceNum)||1));
        const first     = sorted[0];
        const patient   = patients.find(p => p.id === first.patientId);
        const prixTotal = Number(first.prixTotal || first.prix) || 0;
        const totalPaye = sessions.reduce((s, a) => s + (Number(a.montantVerse)||0), 0);
        const reste     = Math.max(0, prixTotal - totalPaye);

        return (
          <div key={ref} style={S.acteCard}>
            <div style={S.acteCardHead}>
              <div>
                <div style={S.actePat}>{patient ? `${patient.prenom} ${patient.nom}` : "—"}</div>
                <div style={S.acteType}>
                  {first.typeActe}
                  {first.dents ? ` — Dent ${first.dents}` : ""}
                  {(first.quantite || 1) > 1 ? ` × ${first.quantite}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1e40af" }}>{fmt(prixTotal)}</div>
                <div style={{ fontSize: 12, color: reste <= 0 ? "#16a34a" : "#d97706", marginTop: 2 }}>
                  {reste <= 0 ? "✅ Soldé" : `Reste: ${fmt(reste)}`}
                </div>
              </div>
            </div>
            {sorted.map((s, i) => (
              <div key={s.id} style={S.acteSeanceRow}>
                <span style={{ fontWeight: 700, color: "#1e40af", width: 28 }}>S{s.seanceNum || i+1}</span>
                <span style={{ color: "#64748b", width: 90 }}>{s.date}</span>
                <span style={{ flex: 1 }}>{s.etape || "—"}</span>
                <span style={{ color: "#64748b", flex: 1, fontSize: 12 }}>{s.observations || ""}</span>
                <span style={{ color: "#16a34a", fontWeight: 700, width: 90, textAlign: "right" }}>+{fmt(s.montantVerse || 0)}</span>
                <button style={S.btnRedSm} onClick={() => onDelete(s.id)}>🗑️</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL NOUVEL ACTE
══════════════════════════════════════════════════════════ */
function ActeModal({ patients, actes, praticien, onClose, onSave }) {
  const [patientId,    setPatientId]    = useState("");
  const [date,         setDate]         = useState(now());
  const [mode,         setMode]         = useState("nouveau");   // 'nouveau' | 'continuer'
  const [selRef,       setSelRef]       = useState("");
  const [etape,        setEtape]        = useState("");
  const [observations, setObservations] = useState("");
  const [versement,    setVersement]    = useState("");
  const [rows,         setRows]         = useState([
    { typeActe: "Consultation", dents: "", quantite: 1, prixUnitaire: 500 }
  ]);

  /* Traitements ouverts (reste > 0) de ce patient */
  const patActes = actes.filter(a => a.patientId === patientId);
  const openGroups = {};
  patActes.forEach(a => {
    const k = a.traitementRef || a.id;
    if (!openGroups[k]) openGroups[k] = [];
    openGroups[k].push(a);
  });
  const openList = Object.entries(openGroups).filter(([, sess]) => {
    const first = sess[0];
    const tot   = Number(first.prixTotal || first.prix) || 0;
    const paye  = sess.reduce((s, a) => s + (Number(a.montantVerse)||0), 0);
    return tot - paye > 0;
  });

  const getInfo = (ref) => {
    const sess = openGroups[ref] || [];
    const sorted = [...sess].sort((a,b) => (Number(a.seanceNum)||1) - (Number(b.seanceNum)||1));
    const first  = sorted[0];
    const tot    = Number(first.prixTotal || first.prix) || 0;
    const paye   = sess.reduce((s, a) => s + (Number(a.montantVerse)||0), 0);
    return { ...first, prixTotal: tot, totalPaye: paye, reste: tot - paye, nextSeance: sess.length + 1 };
  };

  const updateRow = (i, key, val) => {
    const nr = [...rows];
    nr[i] = { ...nr[i], [key]: val };
    if (key === "typeActe") {
      nr[i].prixUnitaire = TARIFS[val]?.[0] || 0;
    }
    setRows(nr);
  };

  const totalSeance = rows.reduce((s, r) => s + r.quantite * r.prixUnitaire, 0);

  const handleSave = () => {
    if (!patientId) return alert("Sélectionnez un patient");

    if (mode === "continuer") {
      if (!selRef) return alert("Sélectionnez un traitement à continuer");
      const info = getInfo(selRef);
      onSave([{
        id: uid(), patientId, date, praticien,
        typeActe:     info.typeActe,
        dents:        info.dents,
        quantite:     info.quantite || 1,
        prixUnitaire: Number(info.prixUnitaire || info.prix) || 0,
        prix:         info.prixTotal,
        prixTotal:    info.prixTotal,
        traitementRef: selRef,
        seanceNum:    info.nextSeance,
        etape,
        observations,
        montantVerse: Number(versement) || 0,
      }]);
    } else {
      // Chaque ligne = un traitement indépendant (ref unique par ligne)
      const newActes = rows.map((row, i) => ({
        id: uid(), patientId, date, praticien,
        typeActe:     row.typeActe,
        dents:        row.dents,
        quantite:     row.quantite,
        prixUnitaire: row.prixUnitaire,
        prix:         row.quantite * row.prixUnitaire,
        prixTotal:    row.quantite * row.prixUnitaire,
        traitementRef: uid(),
        seanceNum:    1,
        etape,
        observations,
        // Le versement est attribué à la première ligne seulement
        montantVerse: i === 0 ? Number(versement) || 0 : 0,
      }));
      onSave(newActes);
    }
  };

  const selInfo = selRef ? getInfo(selRef) : null;

  return (
    <Modal title="Nouvelle Séance Clinique" onClose={onClose} wide>
      {/* Patient + Date */}
      <div style={S.formRow}>
        <div style={S.fGroup}>
          <label style={S.fLabel}>Patient *</label>
          <select style={S.fInput} value={patientId} onChange={e => { setPatientId(e.target.value); setMode("nouveau"); setSelRef(""); }}>
            <option value="">— Sélectionner —</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div style={S.fGroup}>
          <label style={S.fLabel}>Date</label>
          <input style={S.fInput} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {/* Mode: nouveau / continuer */}
      {patientId && (
        <div style={S.modeRow}>
          <button style={{ ...S.modeBtn, ...(mode === "nouveau" ? S.modeBtnOn : {}) }}
            onClick={() => setMode("nouveau")}>
            ✨ Nouveau traitement
          </button>
          {openList.length > 0 && (
            <button style={{ ...S.modeBtn, ...(mode === "continuer" ? S.modeBtnOn : {}) }}
              onClick={() => setMode("continuer")}>
              🔄 Continuer un traitement ({openList.length})
            </button>
          )}
        </div>
      )}

      {/* ── Mode Continuer ── */}
      {mode === "continuer" && patientId && (
        <div style={S.fGroup}>
          <label style={S.fLabel}>Traitement à continuer</label>
          <select style={S.fInput} value={selRef} onChange={e => setSelRef(e.target.value)}>
            <option value="">— Choisir —</option>
            {openList.map(([ref]) => {
              const info = getInfo(ref);
              return (
                <option key={ref} value={ref}>
                  {info.typeActe}{info.dents ? ` Dent ${info.dents}` : ""} — Séance {info.nextSeance} — Reste: {fmt(info.reste)}
                </option>
              );
            })}
          </select>
          {selInfo && (
            <div style={S.infoChip}>
              💡 Total plan: <b>{fmt(selInfo.prixTotal)}</b> &nbsp;|&nbsp;
              Déjà payé: <b style={{ color: "#16a34a" }}>{fmt(selInfo.totalPaye)}</b> &nbsp;|&nbsp;
              <b style={{ color: "#ef4444" }}>Reste: {fmt(selInfo.reste)}</b>
            </div>
          )}
        </div>
      )}

      {/* ── Mode Nouveau : lignes d'actes ── */}
      {mode === "nouveau" && patientId && (
        <div>
          <label style={S.fLabel}>Actes de cette séance</label>
          {rows.map((row, i) => (
            <div key={i} style={S.acteRowWrap}>
              {/* Type d'acte */}
              <select style={{ ...S.fInput, flex: 2, minWidth: 140 }} value={row.typeActe}
                onChange={e => updateRow(i, "typeActe", e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {/* Dents */}
              <input style={{ ...S.fInput, width: 70 }} placeholder="Dent(s)" value={row.dents}
                onChange={e => updateRow(i, "dents", e.target.value)} />
              {/* Quantité */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Qté</span>
                <input style={{ ...S.fInput, width: 50, textAlign: "center" }} type="number" min={1}
                  value={row.quantite} onChange={e => updateRow(i, "quantite", Math.max(1, parseInt(e.target.value)||1))} />
              </div>
              {/* Prix unitaire */}
              {TARIFS[row.typeActe]?.length > 1 ? (
                <select style={{ ...S.fInput, width: 110 }} value={row.prixUnitaire}
                  onChange={e => updateRow(i, "prixUnitaire", Number(e.target.value))}>
                  {TARIFS[row.typeActe].map(p => <option key={p} value={p}>{fmt(p)}</option>)}
                </select>
              ) : (
                <input style={{ ...S.fInput, width: 110 }} type="number" value={row.prixUnitaire}
                  onChange={e => updateRow(i, "prixUnitaire", Number(e.target.value))} />
              )}
              {/* Total ligne */}
              <div style={S.rowTotal}>{fmt(row.quantite * row.prixUnitaire)}</div>
              {rows.length > 1 && (
                <button style={S.btnRedSm} onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}>✕</button>
              )}
            </div>
          ))}
          <button style={S.btnAddLine} onClick={() => setRows(r => [...r, { typeActe: "Consultation", dents: "", quantite: 1, prixUnitaire: 500 }])}>
            + Ajouter un acte à cette séance
          </button>
          <div style={S.totalSeance}>Total séance : {fmt(totalSeance)}</div>
        </div>
      )}

      {/* ── Champs communs ── */}
      {patientId && (
        <>
          <div style={S.formRow}>
            <div style={S.fGroup}>
              <label style={S.fLabel}>Étape / Nom de la séance</label>
              <input style={S.fInput} value={etape} onChange={e => setEtape(e.target.value)} placeholder="ex: Mise en forme, Empreinte…" />
            </div>
            <div style={S.fGroup}>
              <label style={S.fLabel}>💳 Versement ce jour (DA)</label>
              <input style={S.fInput} type="number" min={0} value={versement}
                onChange={e => setVersement(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div style={S.fGroup}>
            <label style={S.fLabel}>Observations cliniques</label>
            <textarea style={S.fTextarea} rows={2} value={observations} onChange={e => setObservations(e.target.value)} />
          </div>
        </>
      )}

      <div style={S.mActions}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={handleSave}>💾 Enregistrer la séance</button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   FACTURATION
══════════════════════════════════════════════════════════ */
function FacturationPage({ patients, actes, factures, role, onFacture, onPayment, onDelete }) {
  const [tab, setTab] = useState("tout");

  const nonFactures = actes.filter(a => !a.facturId);
  const patIds      = [...new Set(nonFactures.map(a => a.patientId))];
  const impayes     = factures.filter(f => f.statut !== "soldé");
  const totalImp    = impayes.reduce((s, f) => s + (Number(f.resteAPayer)||0), 0);

  return (
    <div>
      <h1 style={S.pageTitle}>Facturation</h1>

      {/* Actes non facturés */}
      {patIds.length > 0 && (
        <div style={S.alertBox}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ Actes non encore facturés :</div>
          {patIds.map(pid => {
            const p    = patients.find(x => x.id === pid);
            const acs  = nonFactures.filter(a => a.patientId === pid);
            const tot  = acs.reduce((s, a) => s + (Number(a.prixTotal || a.prix)||0), 0);
            return (
              <div key={pid} style={S.alertRow}>
                <span>{p ? `${p.prenom} ${p.nom}` : "?"} — {acs.length} acte(s) — <b>{fmt(tot)}</b></span>
                <button style={S.btnBlue} onClick={() => onFacture(pid)}>🧾 Facturer</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Onglets */}
      <div style={S.tabs}>
        {[["tout","📄 Toutes les factures"], ["impayes", `⚠️ Impayés (${impayes.length})`]].map(([id, lbl]) => (
          <button key={id} style={{ ...S.tabBtn, ...(tab === id ? S.tabBtnOn : {}) }} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab === "impayes" && (
        <div style={{ ...S.alertBox, background: "#fee2e2", borderColor: "#fecaca", marginBottom: 16 }}>
          Total impayés : <b style={{ color: "#dc2626" }}>{fmt(totalImp)}</b>
        </div>
      )}

      {(tab === "tout" ? factures : impayes).map(f => {
        const p = patients.find(x => x.id === f.patientId);
        const statColor = f.statut === "soldé" ? { bg: "#dcfce7", col: "#166534" }
                        : f.statut === "partiel" ? { bg: "#fef9c3", col: "#854d0e" }
                        : { bg: "#fee2e2", col: "#dc2626" };
        return (
          <div key={f.id} style={S.factCard}>
            <div style={S.factHead}>
              <div>
                <div style={S.factName}>{p ? `${p.prenom} ${p.nom}` : "—"}</div>
                <div style={S.factDate}>{f.date} — {f.praticien} — {f.modePaiement || "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={S.factAmt}>{fmt(f.montantNet)}</div>
                <span style={{ ...S.statusBadge, background: statColor.bg, color: statColor.col }}>
                  {f.statut === "soldé" ? "✅ Soldé" : f.statut === "partiel" ? "⚠️ Partiel" : "❌ Impayé"}
                </span>
              </div>
            </div>
            <div style={S.factDetails}>
              Brut: {fmt(f.montantBrut)} | Remise: {fmt(f.remise)} | Payé: {fmt(f.montantPaye)} | Reste: <b style={{ color: f.resteAPayer > 0 ? "#ef4444" : "#16a34a" }}>{fmt(f.resteAPayer)}</b>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {f.statut !== "soldé" && <button style={S.btnBlue} onClick={() => onPayment(f)}>💳 Paiement</button>}
              <button style={S.btnRed} onClick={() => onDelete(f.id)}>🗑️ Supprimer</button>
            </div>
          </div>
        );
      })}

      {(tab === "tout" ? factures : impayes).length === 0 && (
        <div style={S.empty}>{tab === "impayes" ? "✅ Aucun impayé !" : "Aucune facture"}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL FACTURE
══════════════════════════════════════════════════════════ */
function FactureModal({ patients, actes, patientId, praticien, onClose, onSave }) {
  const patient  = patients.find(p => p.id === patientId);
  const patActes = actes.filter(a => a.patientId === patientId && !a.facturId);
  const [remise,  setRemise]  = useState(0);
  const [acompte, setAcompte] = useState(0);
  const [mode,    setMode]    = useState("Espèces");

  const brut   = patActes.reduce((s, a) => s + (Number(a.prixTotal || a.prix)||0), 0);
  const net    = Math.max(0, brut - Number(remise));
  const reste  = Math.max(0, net - Number(acompte));
  const statut = reste <= 0 ? "soldé" : Number(acompte) > 0 ? "partiel" : "impayé";

  return (
    <Modal title={`Facture — ${patient?.prenom || ""} ${patient?.nom || ""}`} onClose={onClose}>
      {/* Détail des actes */}
      <div style={S.factPreview}>
        {patActes.map(a => (
          <div key={a.id} style={S.factItemRow}>
            <span>{a.typeActe}{a.dents ? ` (Dent ${a.dents})` : ""}{(a.quantite||1) > 1 ? ` ×${a.quantite}` : ""}</span>
            <span>{fmt(a.prixTotal || a.prix || 0)}</span>
          </div>
        ))}
        <div style={S.factDivider} />
        <div style={S.factTotalRow}><span>Total brut</span><b>{fmt(brut)}</b></div>
        <div style={S.factInputRow}>
          <span>Remise (DA)</span>
          <input style={{ ...S.fInput, width: 110, textAlign: "right" }} type="number" min={0}
            value={remise} onChange={e => setRemise(Number(e.target.value))} />
        </div>
        <div style={{ ...S.factTotalRow, fontSize: 16, fontWeight: 800, color: "#1e40af" }}>
          <span>Net à payer</span><b>{fmt(net)}</b>
        </div>
        <div style={S.factInputRow}>
          <span>Acompte / Paiement</span>
          <input style={{ ...S.fInput, width: 110, textAlign: "right" }} type="number" min={0}
            value={acompte} onChange={e => setAcompte(Number(e.target.value))} />
        </div>
        <div style={S.factInputRow}>
          <span>Mode de paiement</span>
          <select style={{ ...S.fInput, width: 130 }} value={mode} onChange={e => setMode(e.target.value)}>
            {["Espèces","Virement","Chèque","CIB"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ ...S.factTotalRow, color: reste > 0 ? "#ef4444" : "#16a34a" }}>
          <span>Reste à payer</span><b>{fmt(reste)}</b>
        </div>
      </div>
      <div style={S.mActions}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={() => onSave({
          id: uid(), patientId, praticien, date: now(),
          montantBrut: brut, remise: Number(remise),
          montantNet: net, montantPaye: Number(acompte),
          resteAPayer: reste, modePaiement: mode, statut,
        }, patActes.map(a => a.id))}>
          💾 Créer la facture
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL PAIEMENT
══════════════════════════════════════════════════════════ */
function PaymentModal({ facture, onClose, onSave }) {
  const [montant, setMontant] = useState(facture.resteAPayer || 0);
  const [mode,    setMode]    = useState("Espèces");
  return (
    <Modal title="Enregistrer un paiement" onClose={onClose}>
      <div style={S.factPreview}>
        <div style={S.factTotalRow}>
          <span>Reste à payer</span>
          <b style={{ color: "#ef4444" }}>{fmt(facture.resteAPayer)}</b>
        </div>
        <div style={S.factInputRow}>
          <span>Montant reçu</span>
          <input style={{ ...S.fInput, width: 130, textAlign: "right" }} type="number" min={0}
            value={montant} onChange={e => setMontant(Number(e.target.value))} />
        </div>
        <div style={S.factInputRow}>
          <span>Mode de paiement</span>
          <select style={{ ...S.fInput, width: 130 }} value={mode} onChange={e => setMode(e.target.value)}>
            {["Espèces","Virement","Chèque","CIB"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div style={S.mActions}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={() => onSave(Number(montant), mode)}>✅ Valider le paiement</button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   MODAL WRAPPER
══════════════════════════════════════════════════════════ */
function Modal({ title, children, onClose, wide }) {
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modalBox, ...(wide ? { maxWidth: 680 } : {}) }}>
        <div style={S.modalHead}>
          <h3 style={S.modalTitle}>{title}</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════ */
const S = {
  /* App shell */
  app:         { display:"flex", height:"100vh", fontFamily:"'Segoe UI',sans-serif", background:"#f1f5f9", overflow:"hidden" },
  sidebar:     { width:220, background:"#0f172a", display:"flex", flexDirection:"column", padding:"20px 10px", gap:4, flexShrink:0 },
  sidebarTop:  { display:"flex", alignItems:"center", gap:10, padding:"0 8px 20px", borderBottom:"1px solid #1e293b", marginBottom:8 },
  sidebarName: { color:"#f1f5f9", fontWeight:700, fontSize:13, lineHeight:1.2 },
  sidebarRole: { color:"#64748b", fontSize:11, marginTop:2 },
  navBtn:      { display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:8, border:"none", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:13, fontWeight:500, textAlign:"left" },
  navBtnOn:    { background:"#1e40af", color:"#fff" },
  connDot:     { fontSize:11, color:"#475569", padding:"0 8px", marginBottom:6 },
  logoutBtn:   { padding:"7px 12px", background:"transparent", border:"1px solid #334155", borderRadius:6, color:"#94a3b8", cursor:"pointer", fontSize:11 },
  main:        { flex:1, overflow:"auto", padding:28 },
  loader:      { display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"#94a3b8", fontSize:18 },

  /* Login */
  loginBg:    { display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"linear-gradient(135deg,#0f172a,#1e3a5f)" },
  loginCard:  { background:"#fff", borderRadius:20, padding:"48px 40px", width:380, textAlign:"center", boxShadow:"0 25px 60px rgba(0,0,0,.35)" },
  loginEmoji: { fontSize:56, marginBottom:12 },
  loginTitle: { fontSize:20, fontWeight:800, color:"#0f172a", margin:"0 0 8px" },
  loginSub:   { color:"#64748b", fontSize:14, marginBottom:32 },
  roleGrid:   { display:"flex", flexDirection:"column", gap:12 },
  roleBtn:    { display:"flex", alignItems:"center", gap:14, padding:"14px 18px", background:"#f8fafc", border:"2px solid #e2e8f0", borderRadius:12, cursor:"pointer", textAlign:"left" },

  /* Dashboard */
  pageTitle:  { fontSize:22, fontWeight:800, color:"#0f172a", margin:"0 0 20px" },
  pageHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 },
  statsGrid:  { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:16, marginBottom:24 },
  statCard:   { background:"#fff", borderRadius:12, padding:"18px 20px", display:"flex", alignItems:"center", gap:14, borderLeft:"4px solid", boxShadow:"0 1px 3px rgba(0,0,0,.06)" },
  statVal:    { fontSize:22, fontWeight:800 },
  statLbl:    { fontSize:12, color:"#64748b", marginTop:4 },
  recentRow:  { display:"grid", gridTemplateColumns:"100px 1fr 1fr 100px", gap:12, padding:"10px 16px", background:"#fff", borderRadius:8, marginBottom:6, fontSize:13, alignItems:"center" },
  recentDate: { color:"#64748b", fontSize:12 },
  recentName: { fontWeight:600, color:"#0f172a" },
  recentType: { color:"#475569" },

  /* Patients split view */
  splitView:   { display:"flex", gap:16, height:"calc(100vh - 80px)" },
  leftPane:    { width:270, background:"#fff", borderRadius:12, display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.06)", flexShrink:0 },
  rightPane:   { flex:1, background:"#fff", borderRadius:12, overflow:"auto", boxShadow:"0 1px 3px rgba(0,0,0,.06)" },
  paneHeader:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 14px 8px" },
  panTitle:    { fontSize:15, fontWeight:700, color:"#0f172a", margin:0 },
  searchBox:   { margin:"0 10px 8px", padding:"7px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, outline:"none" },
  scrollList:  { overflow:"auto", flex:1, padding:"0 6px 6px" },
  patRow:      { display:"flex", alignItems:"center", gap:10, padding:"9px 8px", borderRadius:8, cursor:"pointer" },
  patRowOn:    { background:"#eff6ff" },
  avatar:      { width:36, height:36, borderRadius:"50%", background:"#1e40af", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 },
  patName:     { fontSize:13, fontWeight:600, color:"#0f172a" },
  patSub:      { fontSize:11, color:"#94a3b8" },
  emptyDetail: { display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#94a3b8", fontSize:15 },

  /* Patient fiche */
  ficheWrap:   { padding:24 },
  ficheHead:   { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 },
  ficheTitle:  { fontSize:20, fontWeight:800, color:"#0f172a", margin:0 },
  infoGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24 },
  infoBox:     { background:"#f8fafc", borderRadius:8, padding:"10px 14px" },
  infoKey:     { fontSize:11, color:"#64748b", marginBottom:3 },
  infoVal:     { fontSize:13, color:"#0f172a", fontWeight:500 },
  secTitle:    { fontSize:15, fontWeight:700, color:"#0f172a", borderBottom:"2px solid #e2e8f0", paddingBottom:8, marginBottom:14 },

  /* Treatment cards in fiche */
  treatCard:   { background:"#f8fafc", borderRadius:10, padding:"14px 16px", marginBottom:12, border:"1px solid #e2e8f0" },
  treatHead:   { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  treatLabel:  { fontWeight:700, fontSize:14, color:"#0f172a", display:"flex", alignItems:"center", gap:6 },
  toothBadge:  { background:"#dbeafe", color:"#1e40af", padding:"1px 8px", borderRadius:12, fontSize:11, fontWeight:600 },
  qtyBadge:    { background:"#fef9c3", color:"#854d0e", padding:"1px 8px", borderRadius:12, fontSize:11, fontWeight:600 },
  statusBadge: { padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600 },
  sessTable:   { display:"flex", flexDirection:"column", gap:3 },
  sessHeader:  { display:"grid", gridTemplateColumns:"50px 90px 1fr 90px 1fr", gap:8, padding:"4px 8px", fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase" },
  sessRow:     { display:"grid", gridTemplateColumns:"50px 90px 1fr 90px 1fr", gap:8, padding:"6px 8px", background:"#fff", borderRadius:6, fontSize:12, color:"#374151", alignItems:"center" },
  treatFoot:   { marginTop:10, fontSize:12, color:"#64748b", borderTop:"1px solid #e2e8f0", paddingTop:8 },

  /* Actes page */
  acteCard:      { background:"#fff", borderRadius:12, padding:"16px 18px", marginBottom:12, borderLeft:"4px solid #1e40af", boxShadow:"0 1px 3px rgba(0,0,0,.06)" },
  acteCardHead:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 },
  actePat:       { fontWeight:700, fontSize:14, color:"#0f172a" },
  acteType:      { fontSize:12, color:"#64748b", marginTop:2 },
  acteSeanceRow: { display:"flex", alignItems:"center", gap:10, padding:"6px 8px", background:"#f8fafc", borderRadius:6, marginBottom:3, fontSize:12, color:"#374151" },
  filterSel:     { padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, marginBottom:16, outline:"none", background:"#fff" },

  /* Facturation */
  alertBox:    { background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:16, marginBottom:16 },
  alertRow:    { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #fde68a", fontSize:13 },
  tabs:        { display:"flex", gap:8, marginBottom:20 },
  tabBtn:      { padding:"8px 18px", border:"1px solid #e2e8f0", borderRadius:20, background:"#fff", cursor:"pointer", fontSize:13, fontWeight:500 },
  tabBtnOn:    { background:"#1e40af", color:"#fff", borderColor:"#1e40af" },
  factCard:    { background:"#fff", borderRadius:12, padding:"16px 18px", marginBottom:12, borderLeft:"4px solid #1e40af", boxShadow:"0 1px 3px rgba(0,0,0,.06)" },
  factHead:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 },
  factName:    { fontWeight:700, fontSize:15, color:"#0f172a" },
  factDate:    { fontSize:12, color:"#64748b", marginTop:2 },
  factAmt:     { fontSize:18, fontWeight:800, color:"#1e40af" },
  factDetails: { fontSize:12, color:"#64748b", marginBottom:10 },

  /* Facture modal */
  factPreview:  { background:"#f8fafc", borderRadius:10, padding:"14px 16px", marginBottom:16 },
  factItemRow:  { display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13, color:"#374151" },
  factDivider:  { borderTop:"1px solid #e2e8f0", margin:"8px 0" },
  factTotalRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", fontSize:14, fontWeight:600 },
  factInputRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", fontSize:13 },

  /* Buttons */
  btnBlue:  { padding:"8px 16px", background:"#1e40af", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" },
  btnGray:  { padding:"8px 16px", background:"#f1f5f9", color:"#374151", border:"1px solid #e2e8f0", borderRadius:8, cursor:"pointer", fontSize:13 },
  btnRed:   { padding:"8px 14px", background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 },
  btnRedSm: { padding:"4px 8px", background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, flexShrink:0 },
  btnAddLine: { padding:"6px 14px", background:"#eff6ff", color:"#1e40af", border:"1px dashed #93c5fd", borderRadius:8, cursor:"pointer", fontSize:12, marginTop:8 },
  empty:    { textAlign:"center", color:"#94a3b8", padding:"32px 0", fontSize:14 },

  /* Forms */
  fGroup:    { display:"flex", flexDirection:"column", gap:4, marginBottom:12, flex:1 },
  formRow:   { display:"flex", gap:12 },
  fLabel:    { fontSize:12, fontWeight:600, color:"#374151" },
  fInput:    { padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, outline:"none", background:"#fff" },
  fTextarea: { padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, outline:"none", resize:"vertical", background:"#fff" },

  /* Acte rows in modal */
  acteRowWrap: { display:"flex", gap:8, alignItems:"center", marginBottom:8, background:"#f8fafc", padding:"8px 10px", borderRadius:8, flexWrap:"wrap" },
  rowTotal:    { fontWeight:700, color:"#1e40af", fontSize:13, minWidth:80, textAlign:"right", whiteSpace:"nowrap" },
  totalSeance: { textAlign:"right", fontWeight:800, fontSize:15, color:"#1e40af", padding:"8px 0" },
  modeRow:     { display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" },
  modeBtn:     { flex:1, padding:"10px", border:"2px solid #e2e8f0", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13, fontWeight:500, minWidth:160 },
  modeBtnOn:   { borderColor:"#1e40af", background:"#eff6ff", color:"#1e40af" },
  infoChip:    { marginTop:8, padding:"8px 12px", background:"#eff6ff", borderRadius:8, fontSize:12, color:"#1e40af" },

  /* Modal */
  overlay:    { position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modalBox:   { background:"#fff", borderRadius:16, width:"100%", maxWidth:480, maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,.25)" },
  modalHead:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px 14px", borderBottom:"1px solid #f1f5f9" },
  modalTitle: { fontSize:16, fontWeight:700, color:"#0f172a", margin:0 },
  closeBtn:   { background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#94a3b8" },
  modalBody:  { padding:"20px 22px", overflow:"auto" },
  mActions:   { display:"flex", justifyContent:"flex-end", gap:8, marginTop:16 },
};
