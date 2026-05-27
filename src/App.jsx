import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeidktusskhegopcpppw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplaWRrdHVzc2toZWdvcGNwcHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTYyODksImV4cCI6MjA5NTQzMjI4OX0.Rzq8yB04besi2RzjbNKB96C5vO6J5QLS5tWaC3dSuVg"; // ← gardez votre clé ici
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

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

const uid  = () => Math.random().toString(36).slice(2,11) + Date.now().toString(36);
const now  = () => new Date().toISOString().slice(0,10);
const fmt  = (n) => Number(n||0).toLocaleString("fr-DZ") + " DA";

/* ─── HELPERS TRAITEMENT ────────────────────────────────────────────────── */
// Retourne toutes les séances d'un traitementRef dans TOUS les actes
const getAllSessions = (allActes, ref) =>
  allActes.filter(a => (a.traitementRef || a.id) === ref);

// Résumé financier d'un plan de traitement (basé sur TOUTES les séances)
const getTreatSummary = (allActes, ref) => {
  const sessions = getAllSessions(allActes, ref);
  const sorted   = [...sessions].sort((a,b) => (Number(a.seanceNum)||1) - (Number(b.seanceNum)||1));
  const first    = sorted[0] || {};
  const prixTotal  = Number(first.prixTotal || first.prix) || 0;
  const totalVerse = sessions.reduce((s,a) => s + (Number(a.montantVerse)||0), 0);
  // isTermine = au moins une séance a statutClinique = 'termine' (marqué manuellement)
  const isTermine  = sessions.some(s => s.statutClinique === "termine");
  return { first, sorted, prixTotal, totalVerse, reste: Math.max(0, prixTotal - totalVerse), isTermine };
};

// ─── APP ──────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!role) return;
    loadAll();
    const ch = db.channel("rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"patients"}, ()=>loadPatients())
      .on("postgres_changes",{event:"*",schema:"public",table:"actes"},    ()=>loadActes())
      .on("postgres_changes",{event:"*",schema:"public",table:"factures"}, ()=>loadFactures())
      .subscribe(s => setConnected(s==="SUBSCRIBED"));
    return () => db.removeChannel(ch);
  }, [role]);

  const loadAll      = async () => { setLoading(true); await Promise.all([loadPatients(),loadActes(),loadFactures()]); setLoading(false); };
  const loadPatients = async () => { const {data} = await db.from("patients").select("*").order("dateCreation",{ascending:false}); if(data) setPatients(data); };
  const loadActes    = async () => { const {data} = await db.from("actes").select("*").order("date",{ascending:false}); if(data) setActes(data); };
  const loadFactures = async () => { const {data} = await db.from("factures").select("*").order("date",{ascending:false}); if(data) setFactures(data); };
  const close        = () => { setModal(null); setModalData(null); };

  const deletePatient = async id => {
    if (!confirm("Supprimer ce patient et toutes ses données ?")) return;
    await db.from("actes").delete().eq("patientId",id);
    await db.from("factures").delete().eq("patientId",id);
    await db.from("patients").delete().eq("id",id);
    loadAll();
  };
  const deleteActe = async id => {
    if (!confirm("Supprimer cet acte ?")) return;
    await db.from("actes").delete().eq("id",id); loadActes();
  };
  const deleteFacture = async id => {
    if (!confirm("Supprimer cette facture ?")) return;
    await db.from("actes").update({facturId:null}).eq("facturId",id);
    await db.from("factures").delete().eq("id",id); loadAll();
  };
  // Marquer manuellement un traitement comme terminé
  const terminerTraitement = async (ref) => {
    if (!confirm("Marquer ce traitement comme terminé ?\n(Il n'apparaîtra plus dans 'Continuer')")) return;
    await db.from("actes").update({ statutClinique: "termine" }).eq("traitementRef", ref);
    loadActes();
  };
  const rouvrirTraitement = async (ref) => {
    await db.from("actes").update({ statutClinique: "en_cours" }).eq("traitementRef", ref);
    loadActes();
  };

  // ─── LOGIN ────────────────────────────────────────────────────────────
  if (!role) return (
    <div style={S.loginBg}>
      <div style={S.loginCard}>
        <div style={{fontSize:56,marginBottom:12}}>🦷</div>
        <h1 style={S.loginTitle}>Cabinet Dr. Amin &amp; Dr. Bossioda</h1>
        <p style={{color:"#64748b",fontSize:14,marginBottom:32}}>Choisissez votre profil</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[{l:"Dr. Amin",ic:"👨‍⚕️",r:"medecin",p:"Dr. Amin"},{l:"Dr. Bossioda",ic:"👨‍⚕️",r:"medecin",p:"Dr. Bossioda"},{l:"Assistante",ic:"👩‍💼",r:"assistante",p:null}].map(x=>(
            <button key={x.l} style={S.roleBtn} onClick={()=>{setRole(x.r);if(x.p)setPraticien(x.p);setPage("dashboard");}}>
              <span style={{fontSize:28}}>{x.ic}</span>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:700,fontSize:15}}>{x.l}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{x.r==="assistante"?"Facturation & patients":"Accès complet"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── LAYOUT ───────────────────────────────────────────────────────────
  const nav = [
    {id:"dashboard",label:"Tableau de bord",icon:"📊"},
    {id:"patients",label:"Patients",icon:"👥"},
    ...(role==="medecin"?[{id:"actes",label:"Actes Cliniques",icon:"🦷"}]:[]),
    {id:"facturation",label:"Facturation",icon:"💰"},
  ];

  return (
    <div style={S.app}>
      <nav style={S.sidebar}>
        <div style={S.sidebarTop}>
          <span style={{fontSize:26}}>🦷</span>
          <div><div style={S.sidebarName}>Cabinet Dentaire</div><div style={S.sidebarRole}>{role==="assistante"?"Assistante":praticien}</div></div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
          {nav.map(n=>(
            <button key={n.id} style={{...S.navBtn,...(page===n.id?S.navBtnOn:{})}} onClick={()=>setPage(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div>
          <div style={{fontSize:11,color:"#475569",padding:"0 8px",marginBottom:6}}>
            <span style={{color:connected?"#22c55e":"#f59e0b"}}>●</span> {connected?"Connecté":"Connexion…"}
          </div>
          <button style={S.logoutBtn} onClick={()=>setRole(null)}>← Changer de profil</button>
        </div>
      </nav>

      <main style={S.main}>
        {loading ? <div style={S.loader}>⏳ Chargement…</div> : <>
          {page==="dashboard"    && <Dashboard patients={patients} actes={actes} factures={factures}/>}
          {page==="patients"     && <PatientsPage patients={patients} actes={actes} factures={factures} role={role}
            onNew={()=>setModal("newPatient")}
            onEdit={p=>{setModal("editPatient");setModalData(p);}}
            onDelete={deletePatient}
            onFacture={pid=>{setModal("newFacture");setModalData({patientId:pid});}}
          />}
          {page==="actes" && role==="medecin" && <ActesPage patients={patients} actes={actes}
            onNew={()=>setModal("newActe")}
            onDelete={deleteActe}
            onEdit={a=>{setModal("editActe");setModalData(a);}}
          />}
          {page==="facturation" && <FacturationPage patients={patients} actes={actes} factures={factures} role={role}
            onFacture={pid=>{setModal("newFacture");setModalData({patientId:pid});}}
            onPayment={f=>{setModal("payment");setModalData(f);}}
            onEditFacture={f=>{setModal("editFacture");setModalData(f);}}
            onDelete={deleteFacture}
          />}
        </>}
      </main>

      {/* MODALS */}
      {modal==="newPatient"  && <PatientModal role={role} onClose={close} onSave={async d=>{await db.from("patients").insert([{...d,id:uid(),dateCreation:now()}]);close();loadPatients();}}/>}
      {modal==="editPatient" && modalData && <PatientModal role={role} patient={modalData} onClose={close} onSave={async d=>{await db.from("patients").update(d).eq("id",modalData.id);close();loadPatients();}}/>}

      {modal==="newActe" && <ActeModal patients={patients} actes={actes} praticien={praticien} onClose={close}
        onSave={async list=>{await db.from("actes").insert(list);close();loadActes();}}
      />}

      {modal==="editActe" && modalData && <EditActeModal acte={modalData} allActes={actes} onClose={close}
        onSave={async d=>{await db.from("actes").update(d).eq("id",modalData.id);close();loadActes();loadFactures();}}
      />}

      {modal==="newFacture" && modalData && <FactureModal patients={patients} actes={actes} patientId={modalData.patientId} praticien={praticien} onClose={close}
        onSave={async (facture,refs)=>{
          const {data} = await db.from("factures").insert([facture]).select();
          if(data?.[0]) {
            // Marquer TOUTES les séances de chaque traitementRef comme facturées
            for(const ref of refs) {
              await db.from("actes").update({facturId:data[0].id}).eq("traitementRef",ref).is("facturId",null);
            }
          }
          close();loadAll();
        }}
      />}

      {modal==="editFacture" && modalData && <EditFactureModal facture={modalData} onClose={close}
        onSave={async d=>{await db.from("factures").update(d).eq("id",modalData.id);close();loadFactures();}}
      />}

      {modal==="payment" && modalData && <PaymentModal facture={modalData} onClose={close}
        onSave={async(montant,mode)=>{
          const newPaye  = (modalData.montantPaye||0)+montant;
          const newReste = Math.max(0,(modalData.montantNet||0)-newPaye);
          await db.from("factures").update({montantPaye:newPaye,resteAPayer:newReste,modePaiement:mode,statut:newReste<=0?"soldé":"partiel"}).eq("id",modalData.id);
          close();loadFactures();
        }}
      />}
    </div>
  );
}

/* ══ DASHBOARD ══════════════════════════════════════════════════════════════ */
function Dashboard({patients,actes,factures}){
  const d=now();
  const caAuj = actes.filter(a=>a.date===d).reduce((s,a)=>s+(Number(a.montantVerse)||0),0);
  const impayes = factures.filter(f=>f.statut!=="soldé").reduce((s,f)=>s+(Number(f.resteAPayer)||0),0);
  return(
    <div>
      <h1 style={S.pageTitle}>Tableau de bord</h1>
      <div style={S.statsGrid}>
        {[
          {l:"Total Patients",     v:patients.length,         icon:"👥",c:"#3b82f6"},
          {l:"Actes aujourd'hui",  v:actes.filter(a=>a.date===d).length, icon:"🦷",c:"#10b981"},
          {l:"Recettes du jour",   v:fmt(caAuj),              icon:"💵",c:"#f59e0b"},
          {l:"Total Impayés",      v:fmt(impayes),            icon:"⚠️",c:"#ef4444"},
        ].map(x=>(
          <div key={x.l} style={{...S.statCard,borderLeftColor:x.c}}>
            <span style={{fontSize:30}}>{x.icon}</span>
            <div><div style={{...S.statVal,color:x.c}}>{x.v}</div><div style={S.statLbl}>{x.l}</div></div>
          </div>
        ))}
      </div>
      <h2 style={{fontSize:15,fontWeight:700,color:"#0f172a",margin:"24px 0 12px"}}>Activité récente</h2>
      {actes.slice(0,6).map(a=>{
        const p=patients.find(x=>x.id===a.patientId);
        return(
          <div key={a.id} style={S.recentRow}>
            <span style={{color:"#64748b",fontSize:12}}>{a.date}</span>
            <span style={{fontWeight:600}}>{p?`${p.prenom} ${p.nom}`:"—"}</span>
            <span style={{color:"#475569"}}>{a.typeActe}{a.dents?` (D${a.dents})`:""}</span>
            <span style={{color:"#16a34a",fontWeight:700}}>{fmt(a.montantVerse||0)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ══ PATIENTS ═══════════════════════════════════════════════════════════════ */
function PatientsPage({patients,actes,factures,role,onNew,onEdit,onDelete,onFacture}){
  const [search,setSearch]=useState(""); const [selId,setSelId]=useState(null);
  const list=patients.filter(p=>`${p.nom} ${p.prenom} ${p.telephone||""}`.toLowerCase().includes(search.toLowerCase()));
  const sel=patients.find(p=>p.id===selId);
  return(
    <div style={S.splitView}>
      <div style={S.leftPane}>
        <div style={S.paneHdr}><h2 style={{...S.pageTitle,margin:0,fontSize:15}}>Patients ({patients.length})</h2>{role==="medecin"&&<button style={S.btnBlue} onClick={onNew}>+ Nouveau</button>}</div>
        <input style={S.searchBox} placeholder="🔍 Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={S.scrollList}>
          {list.map(p=>(
            <div key={p.id} style={{...S.patRow,...(selId===p.id?S.patRowOn:{})}} onClick={()=>setSelId(p.id)}>
              <div style={S.avatar}>{p.prenom?.[0]||"?"}{p.nom?.[0]||""}</div>
              <div><div style={S.patName}>{p.prenom} {p.nom}</div><div style={S.patSub}>{p.telephone||"Pas de téléphone"}</div></div>
            </div>
          ))}
          {list.length===0&&<div style={S.empty}>Aucun patient trouvé</div>}
        </div>
      </div>
      <div style={S.rightPane}>
        {sel ? <PatientFiche patient={sel} actes={actes.filter(a=>a.patientId===sel.id)} allActes={actes} factures={factures.filter(f=>f.patientId===sel.id)} role={role}
          onEdit={()=>onEdit(sel)} onDelete={()=>{onDelete(sel.id);setSelId(null);}} onFacture={()=>onFacture(sel.id)}
        /> : <div style={S.emptyDetail}>← Sélectionnez un patient</div>}
      </div>
    </div>
  );
}

function PatientFiche({patient,actes,allActes,factures,role,onEdit,onDelete,onFacture}){
  const nonFact=actes.filter(a=>!a.facturId);
  const groups={};
  actes.forEach(a=>{const k=a.traitementRef||a.id;if(!groups[k])groups[k]=[];groups[k].push(a);});
  return(
    <div style={S.ficheWrap}>
      <div style={S.ficheHead}>
        <div>
          <h2 style={S.ficheTitle}>{patient.prenom} {patient.nom}</h2>
          <div style={{color:"#64748b",fontSize:12}}>{patient.dateCreation?`Depuis ${patient.dateCreation}`:""}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={S.btnGray} onClick={onEdit}>✏️ Modifier</button>
          {nonFact.length>0&&role==="medecin"&&<button style={S.btnBlue} onClick={onFacture}>🧾 Facturer ({nonFact.length})</button>}
          {role==="medecin"&&<button style={S.btnRed} onClick={onDelete}>🗑️ Supprimer</button>}
        </div>
      </div>
      <div style={S.infoGrid}>
        {[["📞 Téléphone",patient.telephone||"—"],["⚠️ Allergies",patient.allergies||"—"],["🩺 Antécédents",patient.antecedents||"—"],["💊 Traitements",patient.traitements||"—"]].map(([k,v])=>(
          <div key={k} style={S.infoBox}><div style={S.infoKey}>{k}</div><div style={S.infoVal}>{v}</div></div>
        ))}
      </div>
      <h3 style={S.secTitle}>🦷 Historique des traitements</h3>
      {Object.keys(groups).length===0&&<div style={S.empty}>Aucun acte enregistré</div>}
      {Object.entries(groups).map(([ref,sessions])=>{
        const {sorted,prixTotal,totalVerse,reste}=getTreatSummary(allActes,ref);
        const first=sorted[0];
        return(
          <div key={ref} style={S.treatCard}>
            <div style={S.treatHead}>
              <div style={{fontWeight:700,fontSize:14,color:"#0f172a",display:"flex",alignItems:"center",gap:6}}>
                {first.typeActe}
                {first.dents&&<span style={S.pill("#dbeafe","#1e40af")}>Dent {first.dents}</span>}
                {(first.quantite||1)>1&&<span style={S.pill("#fef9c3","#854d0e")}>×{first.quantite}</span>}
              </div>
              <span style={S.statusBadge(reste<=0)}>
                {reste<=0?"✅ Soldé":`⚠️ Reste: ${fmt(reste)}`}
              </span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <div style={S.sessHdr}><span>Séance</span><span>Date</span><span>Étape</span><span>Versement</span><span>Observations</span></div>
              {sorted.map((s,i)=>(
                <div key={s.id} style={S.sessRow}>
                  <span style={{fontWeight:700,color:"#1e40af"}}>S{s.seanceNum||i+1}</span>
                  <span>{s.date}</span>
                  <span>{s.etape||"—"}</span>
                  <span style={{color:"#16a34a",fontWeight:600}}>+{fmt(s.montantVerse||0)}</span>
                  <span style={{color:"#6b7280",fontSize:11}}>{s.observations||"—"}</span>
                </div>
              ))}
            </div>
            <div style={S.treatFoot}>
              Plan: <b>{fmt(prixTotal)}</b> | Payé: <b style={{color:"#16a34a"}}>{fmt(totalVerse)}</b> | Reste: <b style={{color:reste>0?"#ef4444":"#16a34a"}}>{fmt(reste)}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══ PATIENT MODAL ══════════════════════════════════════════════════════════ */
function PatientModal({patient,role,onClose,onSave}){
  const isAsst=role==="assistante";
  const [f,setF]=useState({prenom:patient?.prenom||"",nom:patient?.nom||"",telephone:patient?.telephone||"",antecedents:patient?.antecedents||"",traitements:patient?.traitements||"",allergies:patient?.allergies||""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  if(isAsst) return(
    <Modal title="Modifier le téléphone" onClose={onClose}>
      <div style={S.fGroup}><label style={S.fLabel}>📞 Numéro de téléphone</label><input style={S.fInput} value={f.telephone} onChange={e=>set("telephone",e.target.value)} placeholder="0555 000 000"/></div>
      <div style={S.mAct}><button style={S.btnGray} onClick={onClose}>Annuler</button><button style={S.btnBlue} onClick={()=>onSave({telephone:f.telephone})}>💾 Enregistrer</button></div>
    </Modal>
  );
  return(
    <Modal title={patient?"Modifier le patient":"Nouveau patient"} onClose={onClose}>
      <div style={S.formRow}><div style={S.fGroup}><label style={S.fLabel}>Prénom *</label><input style={S.fInput} value={f.prenom} onChange={e=>set("prenom",e.target.value)}/></div><div style={S.fGroup}><label style={S.fLabel}>Nom *</label><input style={S.fInput} value={f.nom} onChange={e=>set("nom",e.target.value)}/></div></div>
      <div style={S.fGroup}><label style={S.fLabel}>📞 Téléphone</label><input style={S.fInput} value={f.telephone} onChange={e=>set("telephone",e.target.value)} placeholder="0555 000 000"/></div>
      <div style={S.fGroup}><label style={S.fLabel}>⚠️ Allergies</label><input style={S.fInput} value={f.allergies} onChange={e=>set("allergies",e.target.value)}/></div>
      <div style={S.fGroup}><label style={S.fLabel}>🩺 Antécédents médicaux</label><textarea style={S.fTextarea} rows={2} value={f.antecedents} onChange={e=>set("antecedents",e.target.value)}/></div>
      <div style={S.fGroup}><label style={S.fLabel}>💊 Traitements en cours</label><textarea style={S.fTextarea} rows={2} value={f.traitements} onChange={e=>set("traitements",e.target.value)}/></div>
      <div style={S.mAct}><button style={S.btnGray} onClick={onClose}>Annuler</button><button style={S.btnBlue} onClick={()=>{if(!f.prenom||!f.nom)return alert("Prénom et Nom requis");onSave(f);}}>💾 Enregistrer</button></div>
    </Modal>
  );
}

/* ══ ACTES PAGE ═════════════════════════════════════════════════════════════ */
function ActesPage({patients,actes,onNew,onDelete,onEdit}){
  const [filterPat,setFilterPat]=useState("");
  const filtered=actes.filter(a=>!filterPat||a.patientId===filterPat);
  const groups={};
  filtered.forEach(a=>{const k=a.traitementRef||a.id;if(!groups[k])groups[k]=[];groups[k].push(a);});
  return(
    <div>
      <div style={S.pageHdr}><h1 style={S.pageTitle}>Actes Cliniques</h1><button style={S.btnBlue} onClick={onNew}>+ Nouvelle Séance</button></div>
      <select style={S.filterSel} value={filterPat} onChange={e=>setFilterPat(e.target.value)}>
        <option value="">Tous les patients</option>
        {patients.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
      </select>
      {Object.keys(groups).length===0&&<div style={S.empty}>Aucun acte enregistré</div>}
      {Object.entries(groups).map(([ref,sessions])=>{
        const {sorted,prixTotal,totalVerse,reste}=getTreatSummary(actes,ref);
        const first=sorted[0];
        const patient=patients.find(p=>p.id===first.patientId);
        return(
          <div key={ref} style={S.acteCard}>
            <div style={S.acteCardHd}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{patient?`${patient.prenom} ${patient.nom}`:"—"}</div>
                <div style={{fontSize:12,color:"#64748b"}}>{first.typeActe}{first.dents?` — Dent ${first.dents}`:""}{(first.quantite||1)>1?` × ${first.quantite}`:""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:16,color:"#1e40af"}}>{fmt(prixTotal)}</div>
                <div style={{fontSize:12,color:reste<=0?"#16a34a":"#d97706"}}>{reste<=0?"✅ Soldé":`Reste: ${fmt(reste)}`}</div>
              </div>
            </div>
            {sorted.map((s,i)=>(
              <div key={s.id} style={S.seanceRow}>
                <span style={{fontWeight:700,color:"#1e40af",width:28}}>S{s.seanceNum||i+1}</span>
                <span style={{color:"#64748b",width:90}}>{s.date}</span>
                <span style={{flex:1}}>{s.etape||"—"}</span>
                <span style={{color:"#6b7280",flex:1,fontSize:12}}>{s.observations||""}</span>
                <span style={{color:"#16a34a",fontWeight:700,width:85,textAlign:"right"}}>+{fmt(s.montantVerse||0)}</span>
                <button style={S.btnEditSm} onClick={()=>onEdit(s)}>✏️</button>
                <button style={S.btnRedSm}  onClick={()=>onDelete(s.id)}>🗑️</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ══ EDIT ACTE MODAL ════════════════════════════════════════════════════════ */
function EditActeModal({acte,allActes,onClose,onSave}){
  const [f,setF]=useState({
    typeActe:    acte.typeActe    ||"Consultation",
    dents:       acte.dents       ||"",
    quantite:    acte.quantite    ||1,
    prixUnitaire:acte.prixUnitaire||acte.prix||0,
    prixTotal:   acte.prixTotal   ||acte.prix||0,
    etape:       acte.etape       ||"",
    observations:acte.observations||"",
    montantVerse:acte.montantVerse ||0,
    date:        acte.date        ||now(),
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  // Recalcule prixTotal si quantite ou prixUnitaire change
  const prixCalc = f.quantite * f.prixUnitaire;

  return(
    <Modal title="Modifier la séance" onClose={onClose}>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Type d'acte</label>
          <select style={S.fInput} value={f.typeActe} onChange={e=>set("typeActe",e.target.value)}>
            {TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={S.fGroup}><label style={S.fLabel}>Date</label><input style={S.fInput} type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></div>
      </div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Dent(s)</label><input style={S.fInput} value={f.dents} onChange={e=>set("dents",e.target.value)} placeholder="ex: 16"/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Quantité</label><input style={S.fInput} type="number" min={1} value={f.quantite} onChange={e=>set("quantite",Number(e.target.value)||1)}/></div>
      </div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Prix unitaire (DA)</label><input style={S.fInput} type="number" value={f.prixUnitaire} onChange={e=>set("prixUnitaire",Number(e.target.value))}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Prix total plan (DA)</label><input style={S.fInput} type="number" value={f.prixTotal} onChange={e=>set("prixTotal",Number(e.target.value))} placeholder={fmt(prixCalc)}/></div>
      </div>
      <div style={S.fGroup}><label style={S.fLabel}>Étape / Nom de la séance</label><input style={S.fInput} value={f.etape} onChange={e=>set("etape",e.target.value)}/></div>
      <div style={S.fGroup}><label style={S.fLabel}>💳 Versement de cette séance (DA)</label><input style={S.fInput} type="number" min={0} value={f.montantVerse} onChange={e=>set("montantVerse",Number(e.target.value))}/></div>
      <div style={S.fGroup}><label style={S.fLabel}>Observations</label><textarea style={S.fTextarea} rows={2} value={f.observations} onChange={e=>set("observations",e.target.value)}/></div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>onSave({...f,prix:f.prixTotal})}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

/* ══ NOUVEL ACTE MODAL ══════════════════════════════════════════════════════ */
function ActeModal({patients,actes,praticien,onClose,onSave}){
  const [patientId,setPatientId]=useState("");
  const [date,setDate]=useState(now());
  const [mode,setMode]=useState("nouveau");
  const [selRef,setSelRef]=useState("");
  const [etape,setEtape]=useState("");
  const [observations,setObservations]=useState("");
  const [versement,setVersement]=useState("");
  const [rows,setRows]=useState([{typeActe:"Consultation",dents:"",quantite:1,prixUnitaire:500}]);

  const patActes=actes.filter(a=>a.patientId===patientId);
  const openGroups={};
  patActes.forEach(a=>{const k=a.traitementRef||a.id;if(!openGroups[k])openGroups[k]=[];openGroups[k].push(a);});
  const openList=Object.entries(openGroups).filter(([ref])=>{const s=getTreatSummary(actes,ref);return s.reste>0;});

  const updateRow=(i,k,v)=>{
    const nr=[...rows]; nr[i]={...nr[i],[k]:v};
    if(k==="typeActe") nr[i].prixUnitaire=TARIFS[v]?.[0]||0;
    setRows(nr);
  };
  const totalSeance=rows.reduce((s,r)=>s+r.quantite*r.prixUnitaire,0);

  const handleSave=()=>{
    if(!patientId) return alert("Sélectionnez un patient");
    if(mode==="continuer"){
      if(!selRef) return alert("Sélectionnez un traitement");
      const {first,sorted,prixTotal}=getTreatSummary(actes,selRef);
      // Vérifier si ce traitement est déjà facturé
      const existingFacturId=sorted.find(s=>s.facturId)?.facturId||null;
      onSave([{
        id:uid(),patientId,date,praticien,
        typeActe:first.typeActe, dents:first.dents, quantite:first.quantite||1,
        prixUnitaire:Number(first.prixUnitaire||first.prix)||0,
        prix:prixTotal, prixTotal,
        traitementRef:selRef, seanceNum:sorted.length+1,
        etape, observations, montantVerse:Number(versement)||0,
        facturId:existingFacturId, // hérite du facturId si déjà facturé
      }]);
    } else {
      const newActes=rows.map((row,i)=>({
        id:uid(),patientId,date,praticien,
        typeActe:row.typeActe, dents:row.dents, quantite:row.quantite,
        prixUnitaire:row.prixUnitaire, prix:row.quantite*row.prixUnitaire,
        prixTotal:row.quantite*row.prixUnitaire,
        traitementRef:uid(), seanceNum:1,
        etape, observations,
        montantVerse:i===0?Number(versement)||0:0,
      }));
      onSave(newActes);
    }
  };

  const selInfo=selRef?getTreatSummary(actes,selRef):null;

  return(
    <Modal title="Nouvelle Séance Clinique" onClose={onClose} wide>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Patient *</label>
          <select style={S.fInput} value={patientId} onChange={e=>{setPatientId(e.target.value);setMode("nouveau");setSelRef("");}}>
            <option value="">— Sélectionner —</option>
            {patients.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div style={S.fGroup}><label style={S.fLabel}>Date</label><input style={S.fInput} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      </div>

      {patientId&&(
        <div style={S.modeRow}>
          <button style={{...S.modeBtn,...(mode==="nouveau"?S.modeBtnOn:{})}} onClick={()=>setMode("nouveau")}>✨ Nouveau traitement</button>
          {openList.length>0&&<button style={{...S.modeBtn,...(mode==="continuer"?S.modeBtnOn:{})}} onClick={()=>setMode("continuer")}>🔄 Continuer ({openList.length})</button>}
        </div>
      )}

      {mode==="continuer"&&patientId&&(
        <div style={S.fGroup}>
          <label style={S.fLabel}>Traitement à continuer</label>
          <select style={S.fInput} value={selRef} onChange={e=>setSelRef(e.target.value)}>
            <option value="">— Choisir —</option>
            {openList.map(([ref])=>{
              const {first,sorted,reste}=getTreatSummary(actes,ref);
              return <option key={ref} value={ref}>{first.typeActe}{first.dents?` Dent ${first.dents}`:""} — Séance {sorted.length+1} — Reste: {fmt(reste)}</option>;
            })}
          </select>
          {selInfo&&<div style={S.infoChip}>💡 Total: <b>{fmt(selInfo.prixTotal)}</b> | Payé: <b style={{color:"#16a34a"}}>{fmt(selInfo.totalVerse)}</b> | <b style={{color:"#ef4444"}}>Reste: {fmt(selInfo.reste)}</b></div>}
        </div>
      )}

      {mode==="nouveau"&&patientId&&(
        <div>
          <label style={S.fLabel}>Actes de cette séance</label>
          {rows.map((row,i)=>(
            <div key={i} style={S.acteRowWrap}>
              <select style={{...S.fInput,flex:2,minWidth:130}} value={row.typeActe} onChange={e=>updateRow(i,"typeActe",e.target.value)}>
                {TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
              <input style={{...S.fInput,width:70}} placeholder="Dent(s)" value={row.dents} onChange={e=>updateRow(i,"dents",e.target.value)}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <span style={{fontSize:10,color:"#94a3b8"}}>Qté</span>
                <input style={{...S.fInput,width:50,textAlign:"center"}} type="number" min={1} value={row.quantite} onChange={e=>updateRow(i,"quantite",Math.max(1,parseInt(e.target.value)||1))}/>
              </div>
              {TARIFS[row.typeActe]?.length>1?(
                <select style={{...S.fInput,width:110}} value={row.prixUnitaire} onChange={e=>updateRow(i,"prixUnitaire",Number(e.target.value))}>
                  {TARIFS[row.typeActe].map(p=><option key={p} value={p}>{fmt(p)}</option>)}
                </select>
              ):(
                <input style={{...S.fInput,width:110}} type="number" value={row.prixUnitaire} onChange={e=>updateRow(i,"prixUnitaire",Number(e.target.value))}/>
              )}
              <div style={S.rowTotal}>{fmt(row.quantite*row.prixUnitaire)}</div>
              {rows.length>1&&<button style={S.btnRedSm} onClick={()=>setRows(r=>r.filter((_,idx)=>idx!==i))}>✕</button>}
            </div>
          ))}
          <button style={S.btnAddLine} onClick={()=>setRows(r=>[...r,{typeActe:"Consultation",dents:"",quantite:1,prixUnitaire:500}])}>+ Ajouter un acte</button>
          <div style={S.totalSeance}>Total séance : {fmt(totalSeance)}</div>
        </div>
      )}

      {patientId&&(
        <>
          <div style={S.formRow}>
            <div style={S.fGroup}><label style={S.fLabel}>Étape / Nom de la séance</label><input style={S.fInput} value={etape} onChange={e=>setEtape(e.target.value)} placeholder="ex: Mise en forme, Empreinte…"/></div>
            <div style={S.fGroup}><label style={S.fLabel}>💳 Versement ce jour (DA)</label><input style={S.fInput} type="number" min={0} value={versement} onChange={e=>setVersement(e.target.value)} placeholder="0"/></div>
          </div>
          <div style={S.fGroup}><label style={S.fLabel}>Observations</label><textarea style={S.fTextarea} rows={2} value={observations} onChange={e=>setObservations(e.target.value)}/></div>
        </>
      )}

      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={handleSave}>💾 Enregistrer la séance</button>
      </div>
    </Modal>
  );
}

/* ══ FACTURATION PAGE ═══════════════════════════════════════════════════════ */
function FacturationPage({patients,actes,factures,role,onFacture,onPayment,onEditFacture,onDelete}){
  const [tab,setTab]=useState("tout");

  // ── Calcul des traitements non encore facturés ──
  // On groupe par patient → traitementRef
  // Un traitement est "non facturé" si au moins une séance n'a pas de facturId
  // ET si le reste à payer > 0
  const unfacturedTreatsByPatient={};
  const treatRefs={};
  actes.forEach(a=>{
    const ref=a.traitementRef||a.id;
    if(!treatRefs[ref]) treatRefs[ref]=[];
    treatRefs[ref].push(a);
  });
  Object.entries(treatRefs).forEach(([ref,sessions])=>{
    const hasUnfactured=sessions.some(s=>!s.facturId);
    if(!hasUnfactured) return;
    const {prixTotal,totalVerse,reste}=getTreatSummary(actes,ref);
    if(reste<=0) return; // déjà tout payé via versements directs
    const pid=sessions[0].patientId;
    if(!unfacturedTreatsByPatient[pid]) unfacturedTreatsByPatient[pid]={refs:[],totalReste:0,nbActes:0};
    unfacturedTreatsByPatient[pid].refs.push(ref);
    unfacturedTreatsByPatient[pid].totalReste+=reste;
    unfacturedTreatsByPatient[pid].nbActes+=sessions.filter(s=>!s.facturId).length;
  });

  const impayes=factures.filter(f=>f.statut!=="soldé");
  const totalImp=impayes.reduce((s,f)=>s+(Number(f.resteAPayer)||0),0);

  return(
    <div>
      <h1 style={S.pageTitle}>Facturation</h1>

      {Object.keys(unfacturedTreatsByPatient).length>0&&(
        <div style={S.alertBox}>
          <div style={{fontWeight:700,marginBottom:8}}>⚠️ Traitements à facturer :</div>
          {Object.entries(unfacturedTreatsByPatient).map(([pid,info])=>{
            const p=patients.find(x=>x.id===pid);
            return(
              <div key={pid} style={S.alertRow}>
                <span>{p?`${p.prenom} ${p.nom}`:"?"} — {info.nbActes} séance(s) — Reste: <b>{fmt(info.totalReste)}</b></span>
                <button style={S.btnBlue} onClick={()=>onFacture(pid)}>🧾 Facturer</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={S.tabs}>
        {[["tout","📄 Toutes les factures"],[`impayes`,`⚠️ Impayés (${impayes.length})`]].map(([id,lbl])=>(
          <button key={id} style={{...S.tabBtn,...(tab===id?S.tabBtnOn:{})}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {tab==="impayes"&&<div style={{...S.alertBox,background:"#fee2e2",borderColor:"#fecaca",marginBottom:16}}>Total impayés : <b style={{color:"#dc2626"}}>{fmt(totalImp)}</b></div>}

      {(tab==="tout"?factures:impayes).map(f=>{
        const p=patients.find(x=>x.id===f.patientId);
        const sc=f.statut==="soldé"?{bg:"#dcfce7",col:"#166534"}:f.statut==="partiel"?{bg:"#fef9c3",col:"#854d0e"}:{bg:"#fee2e2",col:"#dc2626"};
        return(
          <div key={f.id} style={S.factCard}>
            <div style={S.factHd}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{p?`${p.prenom} ${p.nom}`:"—"}</div>
                <div style={{fontSize:12,color:"#64748b"}}>{f.date} — {f.praticien} — {f.modePaiement||"—"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#1e40af"}}>{fmt(f.montantNet)}</div>
                <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:sc.bg,color:sc.col}}>
                  {f.statut==="soldé"?"✅ Soldé":f.statut==="partiel"?"⚠️ Partiel":"❌ Impayé"}
                </span>
              </div>
            </div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>
              Brut: {fmt(f.montantBrut)} | Remise: {fmt(f.remise)} | Payé: {fmt(f.montantPaye)} | Reste: <b style={{color:f.resteAPayer>0?"#ef4444":"#16a34a"}}>{fmt(f.resteAPayer)}</b>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {f.statut!=="soldé"&&<button style={S.btnBlue} onClick={()=>onPayment(f)}>💳 Paiement</button>}
              <button style={S.btnGray} onClick={()=>onEditFacture(f)}>✏️ Modifier</button>
              <button style={S.btnRed}  onClick={()=>onDelete(f.id)}>🗑️ Supprimer</button>
            </div>
          </div>
        );
      })}
      {(tab==="tout"?factures:impayes).length===0&&<div style={S.empty}>{tab==="impayes"?"✅ Aucun impayé !":"Aucune facture"}</div>}
    </div>
  );
}

/* ══ FACTURE MODAL ══════════════════════════════════════════════════════════ */
function FactureModal({patients,actes,patientId,praticien,onClose,onSave}){
  const patient=patients.find(p=>p.id===patientId);

  // Trouver tous les traitementRefs non facturés pour ce patient
  const patActes=actes.filter(a=>a.patientId===patientId&&!a.facturId);
  const treatRefs=[...new Set(patActes.map(a=>a.traitementRef||a.id))];

  // Pour chaque traitement, calculer le reste à payer (en tenant compte de TOUTES les séances)
  const treatLines=treatRefs.map(ref=>{
    const {first,prixTotal,totalVerse,reste}=getTreatSummary(actes,ref);
    return {ref, typeActe:first.typeActe, dents:first.dents, quantite:first.quantite||1, prixTotal, totalVerse, reste};
  }).filter(t=>t.reste>0); // seulement ceux qui ont encore un solde

  // Brut = somme des restes par traitement
  const brutCalcule=treatLines.reduce((s,t)=>s+t.reste,0);

  const [remise,setRemise]=useState(0);
  const [acompte,setAcompte]=useState(0);
  const [mode,setMode]=useState("Espèces");

  const net=Math.max(0,brutCalcule-Number(remise));
  const reste=Math.max(0,net-Number(acompte));
  const statut=reste<=0?"soldé":Number(acompte)>0?"partiel":"impayé";

  if(treatLines.length===0) return(
    <Modal title="Facturation" onClose={onClose}>
      <div style={S.empty}>✅ Tous les traitements de ce patient sont déjà soldés via les versements.</div>
      <div style={S.mAct}><button style={S.btnGray} onClick={onClose}>Fermer</button></div>
    </Modal>
  );

  return(
    <Modal title={`Facture — ${patient?.prenom||""} ${patient?.nom||""}`} onClose={onClose}>
      <div style={S.factPreview}>
        <div style={{fontWeight:700,fontSize:12,color:"#64748b",marginBottom:8,textTransform:"uppercase"}}>Détail des traitements</div>
        {treatLines.map((t,i)=>(
          <div key={i} style={S.factItemRow}>
            <span>{t.typeActe}{t.dents?` (D${t.dents})`:""}{t.quantite>1?` ×${t.quantite}`:""}</span>
            <span style={{color:"#6b7280",fontSize:12}}>Plan: {fmt(t.prixTotal)} | Versé: {fmt(t.totalVerse)}</span>
            <b style={{color:"#0f172a"}}>{fmt(t.reste)}</b>
          </div>
        ))}
        <div style={S.factDivider}/>
        <div style={S.factTotalRow}><span>Total à facturer</span><b>{fmt(brutCalcule)}</b></div>
        <div style={S.factInpRow}><span>Remise (DA)</span><input style={{...S.fInput,width:110,textAlign:"right"}} type="number" min={0} value={remise} onChange={e=>setRemise(Number(e.target.value))}/></div>
        <div style={{...S.factTotalRow,fontSize:16,fontWeight:800,color:"#1e40af"}}><span>Net à payer</span><b>{fmt(net)}</b></div>
        <div style={S.factInpRow}><span>Acompte / Paiement</span><input style={{...S.fInput,width:110,textAlign:"right"}} type="number" min={0} value={acompte} onChange={e=>setAcompte(Number(e.target.value))}/></div>
        <div style={S.factInpRow}><span>Mode de paiement</span>
          <select style={{...S.fInput,width:130}} value={mode} onChange={e=>setMode(e.target.value)}>
            {["Espèces","Virement","Chèque","CIB"].map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={{...S.factTotalRow,color:reste>0?"#ef4444":"#16a34a"}}><span>Reste à payer</span><b>{fmt(reste)}</b></div>
      </div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>onSave({
          id:uid(),patientId,praticien,date:now(),
          montantBrut:brutCalcule, remise:Number(remise),
          montantNet:net, montantPaye:Number(acompte),
          resteAPayer:reste, modePaiement:mode, statut,
        }, treatLines.map(t=>t.ref))}>
          💾 Créer la facture
        </button>
      </div>
    </Modal>
  );
}

/* ══ EDIT FACTURE MODAL ═════════════════════════════════════════════════════ */
function EditFactureModal({facture,onClose,onSave}){
  const [remise,setRemise]=useState(facture.remise||0);
  const [mode,setMode]=useState(facture.modePaiement||"Espèces");
  const newNet=Math.max(0,(facture.montantBrut||0)-Number(remise));
  const newReste=Math.max(0,newNet-(facture.montantPaye||0));
  return(
    <Modal title="Modifier la facture" onClose={onClose}>
      <div style={S.factPreview}>
        <div style={S.factTotalRow}><span>Total brut</span><b>{fmt(facture.montantBrut)}</b></div>
        <div style={S.factInpRow}><span>Remise (DA)</span><input style={{...S.fInput,width:110,textAlign:"right"}} type="number" min={0} value={remise} onChange={e=>setRemise(Number(e.target.value))}/></div>
        <div style={{...S.factTotalRow,color:"#1e40af"}}><span>Net à payer</span><b>{fmt(newNet)}</b></div>
        <div style={S.factTotalRow}><span>Déjà payé</span><b style={{color:"#16a34a"}}>{fmt(facture.montantPaye)}</b></div>
        <div style={{...S.factTotalRow,color:newReste>0?"#ef4444":"#16a34a"}}><span>Nouveau reste</span><b>{fmt(newReste)}</b></div>
        <div style={S.factInpRow}><span>Mode de paiement</span>
          <select style={{...S.fInput,width:130}} value={mode} onChange={e=>setMode(e.target.value)}>
            {["Espèces","Virement","Chèque","CIB"].map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>onSave({
          remise:Number(remise), montantNet:newNet,
          resteAPayer:newReste, modePaiement:mode,
          statut:newReste<=0?"soldé":(facture.montantPaye>0?"partiel":"impayé"),
        })}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

/* ══ PAYMENT MODAL ══════════════════════════════════════════════════════════ */
function PaymentModal({facture,onClose,onSave}){
  const [montant,setMontant]=useState(facture.resteAPayer||0);
  const [mode,setMode]=useState("Espèces");
  return(
    <Modal title="Enregistrer un paiement" onClose={onClose}>
      <div style={S.factPreview}>
        <div style={S.factTotalRow}><span>Reste à payer</span><b style={{color:"#ef4444"}}>{fmt(facture.resteAPayer)}</b></div>
        <div style={S.factInpRow}><span>Montant reçu</span><input style={{...S.fInput,width:130,textAlign:"right"}} type="number" min={0} value={montant} onChange={e=>setMontant(Number(e.target.value))}/></div>
        <div style={S.factInpRow}><span>Mode de paiement</span>
          <select style={{...S.fInput,width:130}} value={mode} onChange={e=>setMode(e.target.value)}>
            {["Espèces","Virement","Chèque","CIB"].map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>onSave(Number(montant),mode)}>✅ Valider</button>
      </div>
    </Modal>
  );
}

/* ══ MODAL WRAPPER ══════════════════════════════════════════════════════════ */
function Modal({title,children,onClose,wide}){
  return(
    <div style={S.overlay}>
      <div style={{...S.modalBox,...(wide?{maxWidth:680}:{})}}>
        <div style={S.modalHd}><h3 style={{fontSize:16,fontWeight:700,color:"#0f172a",margin:0}}>{title}</h3><button style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94a3b8"}} onClick={onClose}>✕</button></div>
        <div style={S.modalBd}>{children}</div>
      </div>
    </div>
  );
}

/* ══ STYLES ═════════════════════════════════════════════════════════════════ */
const S={
  app:{display:"flex",height:"100vh",fontFamily:"'Segoe UI',sans-serif",background:"#f1f5f9",overflow:"hidden"},
  sidebar:{width:220,background:"#0f172a",display:"flex",flexDirection:"column",padding:"20px 10px",gap:4,flexShrink:0},
  sidebarTop:{display:"flex",alignItems:"center",gap:10,padding:"0 8px 20px",borderBottom:"1px solid #1e293b",marginBottom:8},
  sidebarName:{color:"#f1f5f9",fontWeight:700,fontSize:13},
  sidebarRole:{color:"#64748b",fontSize:11,marginTop:2},
  navBtn:{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left"},
  navBtnOn:{background:"#1e40af",color:"#fff"},
  logoutBtn:{padding:"7px 12px",background:"transparent",border:"1px solid #334155",borderRadius:6,color:"#94a3b8",cursor:"pointer",fontSize:11},
  main:{flex:1,overflow:"auto",padding:28},
  loader:{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",color:"#94a3b8",fontSize:18},
  loginBg:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f)"},
  loginCard:{background:"#fff",borderRadius:20,padding:"48px 40px",width:380,textAlign:"center",boxShadow:"0 25px 60px rgba(0,0,0,.35)"},
  loginTitle:{fontSize:20,fontWeight:800,color:"#0f172a",margin:"0 0 8px"},
  roleBtn:{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"#f8fafc",border:"2px solid #e2e8f0",borderRadius:12,cursor:"pointer",textAlign:"left"},
  pageTitle:{fontSize:22,fontWeight:800,color:"#0f172a",margin:"0 0 20px"},
  pageHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16,marginBottom:24},
  statCard:{background:"#fff",borderRadius:12,padding:"18px 20px",display:"flex",alignItems:"center",gap:14,borderLeft:"4px solid",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  statVal:{fontSize:22,fontWeight:800},
  statLbl:{fontSize:12,color:"#64748b",marginTop:4},
  recentRow:{display:"grid",gridTemplateColumns:"100px 1fr 1fr 100px",gap:12,padding:"10px 16px",background:"#fff",borderRadius:8,marginBottom:6,fontSize:13,alignItems:"center"},
  splitView:{display:"flex",gap:16,height:"calc(100vh - 80px)"},
  leftPane:{width:270,background:"#fff",borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.06)",flexShrink:0},
  rightPane:{flex:1,background:"#fff",borderRadius:12,overflow:"auto",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  paneHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 14px 8px"},
  searchBox:{margin:"0 10px 8px",padding:"7px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none"},
  scrollList:{overflow:"auto",flex:1,padding:"0 6px 6px"},
  patRow:{display:"flex",alignItems:"center",gap:10,padding:"9px 8px",borderRadius:8,cursor:"pointer"},
  patRowOn:{background:"#eff6ff"},
  avatar:{width:36,height:36,borderRadius:"50%",background:"#1e40af",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0},
  patName:{fontSize:13,fontWeight:600,color:"#0f172a"},
  patSub:{fontSize:11,color:"#94a3b8"},
  emptyDetail:{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#94a3b8",fontSize:15},
  ficheWrap:{padding:24},
  ficheHead:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12},
  ficheTitle:{fontSize:20,fontWeight:800,color:"#0f172a",margin:0},
  infoGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24},
  infoBox:{background:"#f8fafc",borderRadius:8,padding:"10px 14px"},
  infoKey:{fontSize:11,color:"#64748b",marginBottom:3},
  infoVal:{fontSize:13,color:"#0f172a",fontWeight:500},
  secTitle:{fontSize:15,fontWeight:700,color:"#0f172a",borderBottom:"2px solid #e2e8f0",paddingBottom:8,marginBottom:14},
  treatCard:{background:"#f8fafc",borderRadius:10,padding:"14px 16px",marginBottom:12,border:"1px solid #e2e8f0"},
  treatHead:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  pill:(bg,col)=>({background:bg,color:col,padding:"1px 8px",borderRadius:12,fontSize:11,fontWeight:600}),
  statusBadge:ok=>({padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:ok?"#dcfce7":"#fef9c3",color:ok?"#166534":"#854d0e"}),
  sessHdr:{display:"grid",gridTemplateColumns:"50px 90px 1fr 90px 1fr",gap:8,padding:"4px 8px",fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase"},
  sessRow:{display:"grid",gridTemplateColumns:"50px 90px 1fr 90px 1fr",gap:8,padding:"6px 8px",background:"#fff",borderRadius:6,fontSize:12,color:"#374151",alignItems:"center"},
  treatFoot:{marginTop:10,fontSize:12,color:"#64748b",borderTop:"1px solid #e2e8f0",paddingTop:8},
  acteCard:{background:"#fff",borderRadius:12,padding:"16px 18px",marginBottom:12,borderLeft:"4px solid #1e40af",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  acteCardHd:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  seanceRow:{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"#f8fafc",borderRadius:6,marginBottom:3,fontSize:12},
  filterSel:{padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,marginBottom:16,outline:"none",background:"#fff"},
  alertBox:{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:16,marginBottom:16},
  alertRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #fde68a",fontSize:13},
  tabs:{display:"flex",gap:8,marginBottom:20},
  tabBtn:{padding:"8px 18px",border:"1px solid #e2e8f0",borderRadius:20,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500},
  tabBtnOn:{background:"#1e40af",color:"#fff",borderColor:"#1e40af"},
  factCard:{background:"#fff",borderRadius:12,padding:"16px 18px",marginBottom:12,borderLeft:"4px solid #1e40af",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  factHd:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8},
  factPreview:{background:"#f8fafc",borderRadius:10,padding:"14px 16px",marginBottom:16},
  factItemRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",fontSize:13,borderBottom:"1px solid #e2e8f0",gap:8},
  factDivider:{borderTop:"2px solid #e2e8f0",margin:"8px 0"},
  factTotalRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",fontSize:14,fontWeight:600},
  factInpRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",fontSize:13},
  btnBlue:{padding:"8px 16px",background:"#1e40af",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"},
  btnGray:{padding:"8px 16px",background:"#f1f5f9",color:"#374151",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:13},
  btnRed:{padding:"8px 14px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600},
  btnRedSm:{padding:"4px 8px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,flexShrink:0},
  btnEditSm:{padding:"4px 8px",background:"#eff6ff",color:"#1e40af",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,flexShrink:0},
  btnAddLine:{padding:"6px 14px",background:"#eff6ff",color:"#1e40af",border:"1px dashed #93c5fd",borderRadius:8,cursor:"pointer",fontSize:12,marginTop:8},
  empty:{textAlign:"center",color:"#94a3b8",padding:"32px 0",fontSize:14},
  fGroup:{display:"flex",flexDirection:"column",gap:4,marginBottom:12,flex:1},
  formRow:{display:"flex",gap:12},
  fLabel:{fontSize:12,fontWeight:600,color:"#374151"},
  fInput:{padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",background:"#fff"},
  fTextarea:{padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",resize:"vertical",background:"#fff"},
  acteRowWrap:{display:"flex",gap:8,alignItems:"center",marginBottom:8,background:"#f8fafc",padding:"8px 10px",borderRadius:8,flexWrap:"wrap"},
  rowTotal:{fontWeight:700,color:"#1e40af",fontSize:13,minWidth:80,textAlign:"right",whiteSpace:"nowrap"},
  totalSeance:{textAlign:"right",fontWeight:800,fontSize:15,color:"#1e40af",padding:"8px 0"},
  modeRow:{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"},
  modeBtn:{flex:1,padding:"10px",border:"2px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,minWidth:160},
  modeBtnOn:{borderColor:"#1e40af",background:"#eff6ff",color:"#1e40af"},
  infoChip:{marginTop:8,padding:"8px 12px",background:"#eff6ff",borderRadius:8,fontSize:12,color:"#1e40af"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},
  modalBox:{background:"#fff",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.25)"},
  modalHd:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px 14px",borderBottom:"1px solid #f1f5f9"},
  modalBd:{padding:"20px 22px",overflow:"auto"},
  mAct:{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16},
};
