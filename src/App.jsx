import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Dexie from "dexie";

const SUPABASE_URL = "https://jeidktusskhegopcpppw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplaWRrdHVzc2toZWdvcGNwcHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTYyODksImV4cCI6MjA5NTQzMjI4OX0.Rzq8yB04besi2RzjbNKB96C5vO6J5QLS5tWaC3dSuVg";
const LOGIN_USER   = "admin";
const LOGIN_PASS   = "cabinet2026";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const localDB = new Dexie("CabinetDentaire_v1");
localDB.version(1).stores({
  patients:  "id, nom, prenom, dateCreation",
  actes:     "id, patientId, date, traitementRef",
  syncQueue: "++id, tableName, action, timestamp",
});

async function enqueue(tableName, action, payload) {
  await localDB.syncQueue.add({ tableName, action, payload: JSON.stringify(payload), timestamp: Date.now() });
}

async function flushQueue(onProgress) {
  const pending = await localDB.syncQueue.orderBy("timestamp").toArray();
  if (pending.length === 0) return true;
  let done = 0;
  onProgress && onProgress({ active: true, total: pending.length, done });
  for (const op of pending) {
    try {
      const payload = JSON.parse(op.payload);
      if (op.action === "UPSERT") { const { error } = await supabase.from(op.tableName).upsert(payload); if (error) throw error; }
      else if (op.action === "DELETE_ID") { const { error } = await supabase.from(op.tableName).delete().eq("id", payload.id); if (error) throw error; }
      else if (op.action === "DELETE_WHERE") { const { error } = await supabase.from(op.tableName).delete().eq(payload.col, payload.val); if (error) throw error; }
      else if (op.action === "UPDATE_WHERE") { const { error } = await supabase.from(op.tableName).update(payload.updates).eq(payload.col, payload.val); if (error) throw error; }
      await localDB.syncQueue.delete(op.id);
      done++;
      onProgress && onProgress({ active: true, total: pending.length, done });
    } catch (err) { console.error(`Sync error [${op.tableName}/${op.action}]:`, err); }
  }
  onProgress && onProgress({ active: false, total: 0, done: 0 });
  return true;
}

async function pullFromSupabase() {
  try {
    const [{ data: pts, error: e1 }, { data: acts, error: e2 }] = await Promise.all([
      supabase.from("patients").select("*").order("dateCreation", { ascending: false }),
      supabase.from("actes").select("*").order("date", { ascending: false }),
    ]);
    if (e1 || e2) return false;
    if (pts) { await localDB.patients.clear(); if (pts.length > 0) await localDB.patients.bulkPut(pts); }
    if (acts) { await localDB.actes.clear(); if (acts.length > 0) await localDB.actes.bulkPut(acts); }
    return true;
  } catch { return false; }
}

const TARIFS = {
  "Consultation":[500],"Extraction adulte":[1500],"Extraction enfant":[1000],
  "Extraction DDS":[2500],"Chirurgie DDS":[12000],"Radio":[1000],"Soin":[5000],
  "Détartrage":[1000,2000,3000,4000,5000],"Couronne inox":[5000],"Couronne résine":[6000],
  "CCM":[15000],"ZIR":[25000],"Prothèse flexible unilatérale":[9000],
  "Prothèse flexible partielle":[20000,28000,36000,42000],
  "Prothèse totale":[20000,36000,42000,50000,60000,80000,90000],
  "Prothèse totale sup":[10000,18000,21000,25000,30000,40000,45000],
  "Prothèse totale inf":[10000,18000,21000,25000,30000,40000,45000],
};
const TYPES = Object.keys(TARIFS);
const uid  = () => Math.random().toString(36).slice(2,11)+Date.now().toString(36);
const now  = () => new Date().toISOString().slice(0,10);
const fmt  = n  => Number(n||0).toLocaleString("fr-DZ")+" DA";
const patCode = id => "P-" + (id||"").slice(0,6).toUpperCase();
const getAllSessions = (all,ref) => all.filter(a=>(a.traitementRef||a.id)===ref);
const getTreatSummary = (all,ref) => {
  const sessions = getAllSessions(all,ref);
  const sorted   = [...sessions].sort((a,b)=>(Number(a.seanceNum)||1)-(Number(b.seanceNum)||1));
  const first    = sorted[0]||{};
  const prixTotal   = Number(first.prixTotal||first.prix)||0;
  const totalRemise = sessions.reduce((s,a)=>s+(Number(a.remise)||0),0);
  const netPrice    = Math.max(0,prixTotal-totalRemise);
  const totalVerse  = sessions.reduce((s,a)=>s+(Number(a.montantVerse)||0),0);
  const reste       = Math.max(0,netPrice-totalVerse);
  const termine     = sessions.some(s=>s.statut==="terminé");
  return {first,sorted,prixTotal,totalRemise,netPrice,totalVerse,reste,termine};
};

const NAV_H = 56;

export default function App() {
  const [loggedIn,   setLoggedIn]   = useState(()=>localStorage.getItem("cab_auth")==="1");
  const [praticien,  setPraticien]  = useState(localStorage.getItem("cab_prat")||"Dr. Amin");
  const [page,       setPage]       = useState("dashboard");
  const [patients,   setPatients]   = useState([]);
  const [actes,      setActes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [mData,      setMData]      = useState(null);
  const [isOnline,   setIsOnline]   = useState(navigator.onLine);
  const [syncState,  setSyncState]  = useState({ active: false, total: 0, done: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync,   setLastSync]   = useState(null);
  const [showSyncToast, setShowSyncToast] = useState(false);
  const syncTimerRef = useRef(null);

  const loadLocal = async () => {
    const [pts, acts] = await Promise.all([
      localDB.patients.orderBy("dateCreation").reverse().toArray(),
      localDB.actes.orderBy("date").reverse().toArray(),
    ]);
    setPatients(pts); setActes(acts);
  };
  const refreshPendingCount = async () => { const count = await localDB.syncQueue.count(); setPendingCount(count); };

  const syncWithServer = async () => {
    if (!navigator.onLine) return;
    try {
      await flushQueue(state => setSyncState(state));
      await pullFromSupabase();
      await loadLocal();
      await refreshPendingCount();
      setLastSync(new Date().toLocaleTimeString("fr-DZ"));
      setShowSyncToast(true);
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => setShowSyncToast(false), 3000);
    } catch (err) { console.error("syncWithServer error:", err); }
  };

  useEffect(() => {
    if (!loggedIn) return;
    (async () => {
      setLoading(true);
      await loadLocal();
      setLoading(false);
      await refreshPendingCount();
      if (navigator.onLine) await syncWithServer();
    })();
  }, [loggedIn]);

  useEffect(() => {
    const handleOnline  = async () => { setIsOnline(true);  await syncWithServer(); };
    const handleOffline = ()        => { setIsOnline(false); };
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  useEffect(() => {
    if (!loggedIn || !isOnline) return;
    const ch = supabase.channel("rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"patients"},async ()=>{ await pullFromSupabase(); await loadLocal(); })
      .on("postgres_changes",{event:"*",schema:"public",table:"actes"},   async ()=>{ await pullFromSupabase(); await loadLocal(); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loggedIn, isOnline]);

  const close = () => { setModal(null); setMData(null); };

  const savePatient = async (data) => {
    await localDB.patients.put(data);
    if (isOnline) { await supabase.from("patients").upsert(data); } else { await enqueue("patients", "UPSERT", data); }
    await refreshPendingCount(); await loadLocal();
  };
  const saveActes = async (list) => {
    await localDB.actes.bulkPut(list);
    if (isOnline) { await supabase.from("actes").upsert(list); } else { for (const a of list) await enqueue("actes", "UPSERT", a); }
    await refreshPendingCount(); await loadLocal();
  };
  const updateActe = async (id, data) => {
    await localDB.actes.update(id, data);
    if (isOnline) { await supabase.from("actes").update(data).eq("id", id); }
    else { const existing = await localDB.actes.get(id); await enqueue("actes", "UPSERT", { ...existing, ...data }); }
    await refreshPendingCount(); await loadLocal();
  };
  const deletePatient = async (id) => {
    if (!confirm("Supprimer ce patient et toutes ses données ?")) return;
    await localDB.actes.where("patientId").equals(id).delete();
    await localDB.patients.delete(id);
    if (isOnline) { await supabase.from("actes").delete().eq("patientId", id); await supabase.from("patients").delete().eq("id", id); }
    else { await enqueue("actes", "DELETE_WHERE", { col:"patientId", val:id }); await enqueue("patients", "DELETE_ID", { id }); }
    await refreshPendingCount(); await loadLocal();
  };
  const deleteActe = async (id) => {
    if (!confirm("Supprimer cet acte ?")) return;
    await localDB.actes.delete(id);
    if (isOnline) { await supabase.from("actes").delete().eq("id", id); } else { await enqueue("actes", "DELETE_ID", { id }); }
    await refreshPendingCount(); await loadLocal();
  };
  const terminateTraitement = async (ref) => {
    if (!confirm("Marquer ce traitement comme terminé ?")) return;
    await localDB.actes.where("traitementRef").equals(ref).modify({ statut:"terminé" });
    if (isOnline) { await supabase.from("actes").update({ statut:"terminé" }).eq("traitementRef", ref); }
    else { await enqueue("actes", "UPDATE_WHERE", { col:"traitementRef", val:ref, updates:{ statut:"terminé" } }); }
    await refreshPendingCount(); await loadLocal();
  };

  if (!loggedIn) return (
    <LoginPage onLogin={(u,p)=>{
      if (u===LOGIN_USER && p===LOGIN_PASS) { localStorage.setItem("cab_auth","1"); setLoggedIn(true); }
      else alert("Identifiants incorrects");
    }}/>
  );

  const logout = () => { localStorage.removeItem("cab_auth"); setLoggedIn(false); };

  const nav = [
    {id:"dashboard", label:"Tableau de bord", icon:"📊"},
    {id:"patients",  label:"Patients",         icon:"👥"},
    {id:"actes",     label:"Actes Cliniques",  icon:"🦷"},
    {id:"compta",    label:"Comptabilité",     icon:"📈"},
  ];

  return (
    <div style={S.app}>
      {!isOnline && (
        <div style={S.offlineBanner}>
          📴 Mode hors-ligne — Données sauvegardées localement
          {pendingCount > 0 && <span style={S.pendingBadge}>{pendingCount} en attente</span>}
        </div>
      )}
      {syncState.active && (
        <div style={S.syncBanner}>🔄 Synchronisation… {syncState.done}/{syncState.total}</div>
      )}
      {showSyncToast && (
        <div style={S.syncToast}>✅ Synchronisé — {lastSync}</div>
      )}

      <nav style={S.topNav}>
        <div style={S.navLogo}>
          <span style={{fontSize:22}}>🦷</span>
          <div style={S.navTitle}>Cabinet Dentaire</div>
        </div>
        <div style={S.navLinks}>
          {nav.map(n=>(
            <button key={n.id} style={{...S.navLink,...(page===n.id?S.navLinkOn:{})}} onClick={()=>setPage(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div style={S.navRight}>
          <select style={S.pratSel} value={praticien} onChange={e=>{setPraticien(e.target.value);localStorage.setItem("cab_prat",e.target.value);}}>
            <option>Dr. Amin</option>
            <option>Dr. Bossioda</option>
          </select>
          <div style={S.statusChip}>
            <span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:isOnline?"#22c55e":"#ef4444",boxShadow:isOnline?"0 0 5px #22c55e":"0 0 5px #ef4444"}}/>
            <span style={{color:isOnline?"#22c55e":"#ef4444",fontSize:11,fontWeight:600}}>{isOnline?"En ligne":"Hors-ligne"}</span>
            {pendingCount > 0 && <span style={{background:"#f59e0b",color:"#fff",borderRadius:10,padding:"0 6px",fontSize:10,fontWeight:700}}>{pendingCount}</span>}
          </div>
          {isOnline && <button style={S.syncBtn} onClick={syncWithServer} disabled={syncState.active}>{syncState.active?"⏳":"🔄"}</button>}
          <button style={S.logoutBtn} onClick={logout}>🔒</button>
        </div>
      </nav>

      <main style={S.main}>
        {loading ? <div style={S.loader}>⏳ Chargement…</div> : <>
          {page==="dashboard" && <div style={{flex:1,overflow:"auto",padding:"12px 16px"}}><Dashboard patients={patients} actes={actes}/></div>}
          {page==="patients"  && (
            <PatientsPage patients={patients} actes={actes}
              onNew={()=>setModal("newPat")}
              onEdit={p=>{setModal("editPat");setMData(p);}}
              onDelete={deletePatient}
              onEditVersement={a=>{setModal("editVers");setMData(a);}}
              onTerminate={terminateTraitement}
            />
          )}
          {page==="actes" && (
            <div style={{flex:1,overflow:"auto",padding:"12px 16px"}}>
              <ActesPage patients={patients} actes={actes}
                onNew={()=>setModal("newActe")}
                onDelete={deleteActe}
                onEdit={a=>{setModal("editActe");setMData(a);}}
                onTerminate={terminateTraitement}
              />
            </div>
          )}
          {page==="compta" && (
            <ComptaPage patients={patients} actes={actes}/>
          )}
        </>}
      </main>

      {modal==="newPat" && (
        <PatientModal onClose={close} onSave={async d=>{
          const exists = patients.find(p=>p.nom.toLowerCase()===d.nom.toLowerCase()&&p.prenom.toLowerCase()===d.prenom.toLowerCase());
          if (exists) { alert("⚠️ Ce patient existe déjà : "+d.nom+" "+d.prenom); return; }
          await savePatient({ ...d, id:uid(), dateCreation:now() }); close();
        }}/>
      )}
      {modal==="editPat" && mData && <PatientModal patient={mData} onClose={close} onSave={async d=>{ await savePatient({ ...mData, ...d }); close(); }}/>}
      {modal==="newActe" && <ActeModal patients={patients} actes={actes} praticien={praticien} onClose={close} onSave={async list=>{ await saveActes(list); close(); }}/>}
      {modal==="editActe" && mData && <EditActeModal acte={mData} onClose={close} onSave={async d=>{ await updateActe(mData.id, d); close(); }}/>}
      {modal==="editVers" && mData && <EditVersementModal acte={mData} onClose={close} onSave={async v=>{ await updateActe(mData.id, { montantVerse:v }); close(); }}/>}
    </div>
  );
}

function LoginPage({onLogin}){
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [show,setShow]=useState(false);
  return(
    <div style={S.loginBg}>
      <div style={S.loginCard}>
        <div style={{fontSize:56,marginBottom:8}}>🦷</div>
        <h1 style={S.loginTitle}>Cabinet Dentaire</h1>
        <p style={{color:"#64748b",fontSize:13,marginBottom:4}}>Dr. Amin &amp; Dr. Bossioda</p>
        <p style={{color:"#94a3b8",fontSize:12,marginBottom:28}}>Connectez-vous pour accéder</p>
        <div style={S.fGroup}><label style={S.fLabel}>👤 Nom d'utilisateur</label>
          <input style={S.fInput} value={u} onChange={e=>setU(e.target.value)} placeholder="admin" onKeyDown={e=>e.key==="Enter"&&onLogin(u,p)}/>
        </div>
        <div style={S.fGroup}><label style={S.fLabel}>🔑 Mot de passe</label>
          <div style={{position:"relative"}}>
            <input style={{...S.fInput,width:"100%",boxSizing:"border-box",paddingRight:40}} type={show?"text":"password"} value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin(u,p)}/>
            <button style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8"}} onClick={()=>setShow(!show)}>{show?"🙈":"👁️"}</button>
          </div>
        </div>
        <button style={{...S.btnBlue,width:"100%",padding:"12px",fontSize:15,marginTop:8}} onClick={()=>onLogin(u,p)}>→ Connexion</button>
        <p style={{color:"#94a3b8",fontSize:11,marginTop:16}}>Modifiez les identifiants dans GitHub (App.jsx lignes 7-8)</p>
      </div>
    </div>
  );
}

function Dashboard({patients,actes}){
  const d=now();
  const caAuj=actes.filter(a=>a.date===d).reduce((s,a)=>s+(Number(a.montantVerse)||0),0);
  const refs=[...new Set(actes.map(a=>a.traitementRef||a.id))];
  const totalReste=refs.reduce((s,ref)=>s+getTreatSummary(actes,ref).reste,0);
  return(
    <div>
      <h1 style={S.pageTitle}>Tableau de bord</h1>
      <div style={S.statsGrid}>
        {[
          {l:"Total Patients",    v:patients.length,                    icon:"👥",c:"#3b82f6"},
          {l:"Actes aujourd'hui", v:actes.filter(a=>a.date===d).length, icon:"🦷",c:"#10b981"},
          {l:"Recettes du jour",  v:fmt(caAuj),                         icon:"💵",c:"#f59e0b"},
          {l:"Total Impayés",     v:fmt(totalReste),                    icon:"⚠️",c:"#ef4444"},
        ].map(x=>(
          <div key={x.l} style={{...S.statCard,borderLeftColor:x.c}}>
            <span style={{fontSize:28}}>{x.icon}</span>
            <div><div style={{...S.statVal,color:x.c}}>{x.v}</div><div style={S.statLbl}>{x.l}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientsPage({patients,actes,onNew,onEdit,onDelete,onEditVersement,onTerminate}){
  const [search,setSearch]=useState("");
  const [selId,setSelId]=useState(null);
  const list=patients.filter(p=>{
    const q=search.toLowerCase();
    return `${p.nom||""} ${p.prenom||""} ${p.telephone||""} ${patCode(p.id)}`.toLowerCase().includes(q);
  });
  const sel=patients.find(p=>p.id===selId);
  return(
    <div style={S.splitView}>
      <div style={S.leftPane}>
        <div style={S.paneHdr}>
          <h2 style={{margin:0,fontSize:14,fontWeight:700,color:"#0f172a"}}>Patients ({patients.length})</h2>
          <button style={S.btnBlue} onClick={onNew}>+ Nouveau</button>
        </div>
        <input style={S.searchBox} placeholder="🔍 Nom, prénom, ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={S.scrollList}>
          {list.map(p=>(
            <div key={p.id} style={{...S.patRow,...(selId===p.id?S.patRowOn:{})}} onClick={()=>setSelId(p.id)}>
              <div style={S.avatar}>{p.nom?.[0]||"?"}{p.prenom?.[0]||""}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={S.patName}>{p.nom} {p.prenom}</div>
                <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
                  <span style={{background:"#e0e7ff",color:"#3730a3",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,fontFamily:"monospace"}}>{patCode(p.id)}</span>
                  <span style={S.patSub}>{p.telephone||"—"}</span>
                </div>
              </div>
            </div>
          ))}
          {list.length===0&&<div style={S.empty}>Aucun patient</div>}
        </div>
      </div>
      <div style={S.rightPane}>
        {sel
          ? <PatientFiche patient={sel} actes={actes.filter(a=>a.patientId===sel.id)} allActes={actes}
              onEdit={()=>onEdit(sel)} onDelete={()=>{onDelete(sel.id);setSelId(null);}}
              onEditVersement={onEditVersement} onTerminate={onTerminate}
            />
          : <div style={S.emptyDetail}>← Sélectionnez un patient</div>
        }
      </div>
    </div>
  );
}

function PatientFiche({patient,actes,allActes,onEdit,onDelete,onEditVersement,onTerminate}){
  const groups={};
  actes.forEach(a=>{const k=a.traitementRef||a.id;if(!groups[k])groups[k]=[];groups[k].push(a);});
  const refs=Object.keys(groups);
  let totalPlan=0,totalPaye=0;
  refs.forEach(ref=>{ const {netPrice,totalVerse}=getTreatSummary(allActes,ref); totalPlan+=netPrice; totalPaye+=totalVerse; });
  const totalReste=Math.max(0,totalPlan-totalPaye);
  return(
    <div style={S.ficheWrap}>
      <div style={S.ficheHead}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
            <h2 style={S.ficheTitle}>{patient.nom} {patient.prenom}</h2>
            <span style={{background:"#e0e7ff",color:"#3730a3",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,fontFamily:"monospace"}}>{patCode(patient.id)}</span>
          </div>
          <div style={{color:"#64748b",fontSize:12}}>{patient.dateCreation?`Depuis ${patient.dateCreation}`:""}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={S.btnGray} onClick={onEdit}>✏️ Modifier</button>
          <button style={S.btnRed}  onClick={onDelete}>🗑️ Supprimer</button>
        </div>
      </div>
      <div style={S.infoGrid}>
        {[["📞 Téléphone",patient.telephone||"—"],["🎂 Naissance",patient.dateNaissance||"—"],["⚠️ Allergies",patient.allergies||"—"],
          ["🩺 Antécédents",patient.antecedents||"—"],["💊 Traitements",patient.traitements||"—"]].map(([k,v])=>(
          <div key={k} style={S.infoBox}><div style={S.infoKey}>{k}</div><div style={S.infoVal}>{v}</div></div>
        ))}
      </div>
      {refs.length>0&&(
        <div style={S.finSummary}>
          <div style={S.finItem}><span>💰 Total des soins</span><b style={{color:"#1e40af"}}>{fmt(totalPlan)}</b></div>
          <div style={S.finItem}><span>✅ Total payé</span><b style={{color:"#16a34a"}}>{fmt(totalPaye)}</b></div>
          <div style={{...S.finItem,borderBottom:"none"}}><span>⚠️ Reste à payer</span><b style={{color:totalReste>0?"#ef4444":"#16a34a"}}>{fmt(totalReste)}</b></div>
        </div>
      )}
      <h3 style={S.secTitle}>🦷 Historique des traitements</h3>
      {refs.length===0&&<div style={S.empty}>Aucun acte enregistré</div>}
      {refs.map(ref=>{
        const {sorted,prixTotal,totalRemise,netPrice,totalVerse,reste,termine}=getTreatSummary(allActes,ref);
        const first=sorted[0];
        return(
          <div key={ref} style={{...S.treatCard,...(termine?{opacity:.75}:{})}}>
            <div style={S.treatHead}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:14}}>{first.typeActe}</span>
                {first.dents&&<span style={S.pill("#dbeafe","#1e40af")}>Dent {first.dents}</span>}
                {(first.quantite||1)>1&&<span style={S.pill("#fef9c3","#854d0e")}>×{first.quantite}</span>}
                {termine&&<span style={S.pill("#f0fdf4","#166534")}>✅ Terminé</span>}
              </div>
              <span style={{...S.sBadge,background:reste<=0?"#dcfce7":"#fef9c3",color:reste<=0?"#166534":"#854d0e"}}>
                {reste<=0?"✅ Soldé":`⚠️ Reste: ${fmt(reste)}`}
              </span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={S.table}>
                <thead><tr style={{background:"#f1f5f9"}}>
                  {["N°","Date","Diagnostic","Étape","Observations","Versement",""].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sorted.map((s,i)=>(
                    <tr key={s.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                      <td style={{...S.td,fontWeight:700,color:"#1e40af"}}>S{s.seanceNum||i+1}</td>
                      <td style={S.td}>{s.date}</td>
                      <td style={{...S.td,color:"#7c3aed"}}>{s.diagnostic||"—"}</td>
                      <td style={S.td}>{s.etape||"—"}</td>
                      <td style={{...S.td,color:"#6b7280",fontSize:11}}>{s.observations||"—"}</td>
                      <td style={{...S.td,color:"#16a34a",fontWeight:600}}>+{fmt(s.montantVerse||0)}</td>
                      <td style={S.td}><button style={S.btnEditSm} onClick={()=>onEditVersement(s)}>💳</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={S.treatFoot}>
              Plan: <b>{fmt(prixTotal)}</b>
              {totalRemise>0&&<> | Remise: <b style={{color:"#16a34a"}}>-{fmt(totalRemise)}</b></>}
              {" "}| Net: <b>{fmt(netPrice)}</b> | Payé: <b style={{color:"#16a34a"}}>{fmt(totalVerse)}</b> | Reste: <b style={{color:reste>0?"#ef4444":"#16a34a"}}>{fmt(reste)}</b>
            </div>
            {!termine&&<button style={S.btnTerminer} onClick={()=>onTerminate(ref)}>✅ Marquer comme terminé</button>}
          </div>
        );
      })}
    </div>
  );
}

function PatientModal({patient,onClose,onSave}){
  const [f,setF]=useState({prenom:patient?.prenom||"",nom:patient?.nom||"",telephone:patient?.telephone||"",dateNaissance:patient?.dateNaissance||"",antecedents:patient?.antecedents||"",traitements:patient?.traitements||"",allergies:patient?.allergies||""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return(
    <Modal title={patient?"Modifier le patient":"Nouveau patient"} onClose={onClose}>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Nom *</label><input style={S.fInput} value={f.nom} onChange={e=>set("nom",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Prénom *</label><input style={S.fInput} value={f.prenom} onChange={e=>set("prenom",e.target.value)}/></div>
      </div>
      <div style={S.fGroup}><label style={S.fLabel}>📞 Téléphone</label><input style={S.fInput} value={f.telephone} onChange={e=>set("telephone",e.target.value)} placeholder="0555 000 000"/></div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>🎂 Date de naissance</label><input style={S.fInput} type="date" value={f.dateNaissance} onChange={e=>set("dateNaissance",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>⚠️ Allergies</label><input style={S.fInput} value={f.allergies} onChange={e=>set("allergies",e.target.value)}/></div>
      </div>
      <div style={S.fGroup}><label style={S.fLabel}>🩺 Antécédents</label><textarea style={S.fTextarea} rows={2} value={f.antecedents} onChange={e=>set("antecedents",e.target.value)}/></div>
      <div style={S.fGroup}><label style={S.fLabel}>💊 Traitements en cours</label><textarea style={S.fTextarea} rows={2} value={f.traitements} onChange={e=>set("traitements",e.target.value)}/></div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>{if(!f.prenom||!f.nom)return alert("Prénom et Nom requis");onSave(f);}}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

function ActesPage({patients,actes,onNew,onDelete,onEdit,onTerminate}){
  const [search,setSearch]=useState("");
  const q=search.toLowerCase().trim();
  const matchedPatIds=q ? new Set(patients.filter(p=>`${p.nom||""} ${p.prenom||""} ${patCode(p.id)}`.toLowerCase().includes(q)).map(p=>p.id)) : null;
  const filtered=actes.filter(a=>!matchedPatIds||matchedPatIds.has(a.patientId));
  const groups={};
  filtered.forEach(a=>{const k=a.traitementRef||a.id;if(!groups[k])groups[k]=[];groups[k].push(a);});
  return(
    <div>
      <div style={S.pageHdr}>
        <h1 style={S.pageTitle}>Actes Cliniques</h1>
        <button style={S.btnBlue} onClick={onNew}>+ Nouvelle Séance</button>
      </div>
      <input style={{...S.searchBox,margin:"0 0 12px",width:"100%",maxWidth:380,boxSizing:"border-box",fontSize:13}} placeholder="🔍 Rechercher par nom, prénom ou ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
      {Object.keys(groups).length===0&&<div style={S.empty}>{q?"Aucun résultat pour « "+search+" »":"Aucun acte enregistré"}</div>}
      {Object.entries(groups).map(([ref])=>{
        const {sorted,prixTotal,totalRemise,netPrice,totalVerse,reste,termine}=getTreatSummary(actes,ref);
        const first=sorted[0];
        const patient=patients.find(p=>p.id===first.patientId);
        return(
          <div key={ref} style={{...S.acteCard,...(termine?{borderLeftColor:"#94a3b8"}:{})}}>
            <div style={S.acteCardHd}>
              <div>
                <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6}}>
                  {patient?`${patient.nom} ${patient.prenom}`:"—"}
                  {patient&&<span style={{background:"#e0e7ff",color:"#3730a3",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,fontFamily:"monospace"}}>{patCode(patient.id)}</span>}
                  {termine&&<span style={S.pill("#f1f5f9","#64748b")}>Terminé</span>}
                </div>
                <div style={{fontSize:12,color:"#64748b"}}>{first.typeActe}{first.dents?` — Dent ${first.dents}`:""}{(first.quantite||1)>1?` × ${first.quantite}`:""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:15,color:"#1e40af"}}>{fmt(netPrice)}</div>
                <div style={{fontSize:11,color:reste<=0?"#16a34a":"#d97706"}}>{reste<=0?"✅ Soldé":`Reste: ${fmt(reste)}`}</div>
              </div>
            </div>
            {sorted.map((s,i)=>(
              <div key={s.id} style={S.seanceRow}>
                <span style={{fontWeight:700,color:"#1e40af",width:26,flexShrink:0}}>S{s.seanceNum||i+1}</span>
                <span style={{color:"#64748b",width:86,flexShrink:0}}>{s.date}</span>
                <span style={{flex:1}}>{s.etape||"—"}</span>
                {s.diagnostic&&<span style={{color:"#7c3aed",fontSize:11,flex:1}}>🔬 {s.diagnostic}</span>}
                <span style={{color:"#16a34a",fontWeight:700,width:80,textAlign:"right",flexShrink:0}}>+{fmt(s.montantVerse||0)}</span>
                {s.remise>0&&<span style={{color:"#f59e0b",fontSize:11,flexShrink:0}}>-{fmt(s.remise)}</span>}
                <button style={S.btnEditSm} onClick={()=>onEdit(s)}>✏️</button>
                <button style={S.btnRedSm}  onClick={()=>onDelete(s.id)}>🗑️</button>
              </div>
            ))}
            {!termine&&<button style={S.btnTerminer} onClick={()=>onTerminate(ref)}>✅ Marquer comme terminé</button>}
          </div>
        );
      })}
    </div>
  );
}

function ActeModal({patients,actes,praticien,onClose,onSave}){
  const [patientId,setPatientId]=useState("");
  const [patSearch,setPatSearch]=useState("");
  const [showSugg,setShowSugg]=useState(false);
  const [date,setDate]=useState(now());
  const [items,setItems]=useState([]);
  const selectedPat=patients.find(p=>p.id===patientId);
  const suggestions=patSearch.trim() ? patients.filter(p=>`${p.nom||""} ${p.prenom||""} ${patCode(p.id)}`.toLowerCase().includes(patSearch.toLowerCase())) : patients.slice(0,8);
  const selectPatient=(p)=>{ setPatientId(p.id); setPatSearch(`${p.nom} ${p.prenom}`); setShowSugg(false); setItems([]); };
  const patActes=actes.filter(a=>a.patientId===patientId);
  const openGroups={};
  patActes.forEach(a=>{const k=a.traitementRef||a.id;if(!openGroups[k])openGroups[k]=[];openGroups[k].push(a);});
  const openList=Object.entries(openGroups).filter(([ref])=>{ const sessions=getAllSessions(actes,ref); return sessions.some(s=>!s.statut||s.statut==="en_cours"); });
  const newItem=(type)=>type==="continuer"
    ?{type:"continuer",ref:"",etape:"",diagnostic:"",observations:"",versement:"",remise:0}
    :{type:"nouveau",typeActe:"Soin",dents:"",quantite:1,prixUnitaire:5000,etape:"",diagnostic:"",observations:"",versement:"",remise:0};
  const updateItem=(i,k,v)=>{ const ni=[...items]; ni[i]={...ni[i],[k]:v}; if(k==="typeActe") ni[i].prixUnitaire=TARIFS[v]?.[0]||0; setItems(ni); };
  const handleSave=()=>{
    if(!patientId) return alert("Sélectionnez un patient");
    if(items.length===0) return alert("Ajoutez au moins un traitement");
    const list=[];
    items.forEach(item=>{
      if(item.type==="continuer"){
        if(!item.ref) return;
        const {first,sorted,prixTotal}=getTreatSummary(actes,item.ref);
        const existFact=sorted.find(s=>s.facturId)?.facturId||null;
        list.push({id:uid(),patientId,date,praticien,typeActe:first.typeActe,dents:first.dents,quantite:first.quantite||1,prixUnitaire:Number(first.prixUnitaire||first.prix)||0,prix:prixTotal,prixTotal,remise:Number(item.remise)||0,traitementRef:item.ref,seanceNum:sorted.length+1,etape:item.etape,diagnostic:item.diagnostic,observations:item.observations,montantVerse:Number(item.versement)||0,facturId:existFact,statut:"en_cours"});
      } else {
        const planTotal=item.quantite*item.prixUnitaire;
        list.push({id:uid(),patientId,date,praticien,typeActe:item.typeActe,dents:item.dents,quantite:item.quantite,prixUnitaire:item.prixUnitaire,prix:planTotal,prixTotal:planTotal,remise:Number(item.remise)||0,traitementRef:uid(),seanceNum:1,etape:item.etape,diagnostic:item.diagnostic,observations:item.observations,montantVerse:Number(item.versement)||0,statut:"en_cours"});
      }
    });
    if(list.length===0) return alert("Sélectionnez les traitements");
    onSave(list);
  };
  return(
    <Modal title="Nouvelle Séance Clinique" onClose={onClose} wide>
      <div style={S.formRow}>
        <div style={{...S.fGroup,position:"relative"}}>
          <label style={S.fLabel}>Patient *</label>
          <input style={{...S.fInput,borderColor:selectedPat?"#1e40af":"#e2e8f0"}} placeholder="🔍 Rechercher par nom, prénom ou ID…" value={patSearch}
            onChange={e=>{setPatSearch(e.target.value);setPatientId("");setShowSugg(true);setItems([]);}}
            onFocus={()=>setShowSugg(true)} onBlur={()=>setTimeout(()=>setShowSugg(false),180)} autoComplete="off"/>
          {selectedPat&&<span style={{position:"absolute",right:10,top:32,background:"#e0e7ff",color:"#3730a3",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,fontFamily:"monospace"}}>{patCode(selectedPat.id)}</span>}
          {showSugg&&suggestions.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:200,maxHeight:200,overflowY:"auto",marginTop:2}}>
              {suggestions.map(p=>(
                <div key={p.id} style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:13}}
                  onMouseDown={()=>selectPatient(p)} onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:"#1e40af",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{p.nom?.[0]||"?"}{p.prenom?.[0]||""}</div>
                  <div>
                    <div style={{fontWeight:600,color:"#0f172a"}}>{p.nom} {p.prenom}</div>
                    <div style={{fontSize:11,color:"#94a3b8",display:"flex",gap:6}}><span style={{fontFamily:"monospace",color:"#3730a3",fontWeight:700}}>{patCode(p.id)}</span>{p.telephone&&<span>{p.telephone}</span>}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showSugg&&patSearch.trim()&&suggestions.length===0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#94a3b8",zIndex:200,marginTop:2}}>Aucun patient trouvé</div>
          )}
        </div>
        <div style={S.fGroup}><label style={S.fLabel}>Date</label><input style={S.fInput} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      </div>
      {patientId&&(
        <div style={S.modeRow}>
          {openList.length>0&&<button style={S.modeBtn} onClick={()=>setItems(it=>[...it,newItem("continuer")])}>🔄 Continuer un traitement</button>}
          <button style={{...S.modeBtn,...S.modeBtnOn}} onClick={()=>setItems(it=>[...it,newItem("nouveau")])}>✨ Nouveau traitement</button>
        </div>
      )}
      {items.map((item,i)=>(
        <div key={i} style={S.itemCard}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={item.type==="continuer"?S.pill("#dbeafe","#1e40af"):S.pill("#ede9fe","#6d28d9")}>{item.type==="continuer"?"🔄 Continuer":"✨ Nouveau"}</span>
            <button style={S.btnRedSm} onClick={()=>setItems(it=>it.filter((_,idx)=>idx!==i))}>✕ Supprimer</button>
          </div>
          {item.type==="continuer"?(
            <div style={S.fGroup}>
              <label style={S.fLabel}>Traitement à continuer</label>
              <select style={S.fInput} value={item.ref} onChange={e=>updateItem(i,"ref",e.target.value)}>
                <option value="">— Choisir —</option>
                {openList.map(([ref])=>{const {first,sorted,reste}=getTreatSummary(actes,ref);return <option key={ref} value={ref}>{first.typeActe}{first.dents?` Dent ${first.dents}`:""} — Séance {sorted.length+1} — Reste: {fmt(reste)}</option>;})}
              </select>
              {item.ref&&(()=>{const {prixTotal,totalVerse,reste}=getTreatSummary(actes,item.ref);return <div style={{...S.infoChip,marginTop:6}}>Plan: <b>{fmt(prixTotal)}</b> | Payé: <b style={{color:"#16a34a"}}>{fmt(totalVerse)}</b> | <b style={{color:"#ef4444"}}>Reste: {fmt(reste)}</b></div>;})()}
            </div>
          ):(
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
              <select style={{...S.fInput,flex:2,minWidth:120}} value={item.typeActe} onChange={e=>updateItem(i,"typeActe",e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select>
              <input style={{...S.fInput,width:75}} placeholder="Dent(s)" value={item.dents} onChange={e=>updateItem(i,"dents",e.target.value)}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <span style={{fontSize:10,color:"#94a3b8"}}>Qté</span>
                <input style={{...S.fInput,width:50,textAlign:"center"}} type="number" min={1} value={item.quantite} onChange={e=>updateItem(i,"quantite",Math.max(1,parseInt(e.target.value)||1))}/>
              </div>
              {TARIFS[item.typeActe]?.length>1
                ?<select style={{...S.fInput,width:115}} value={item.prixUnitaire} onChange={e=>updateItem(i,"prixUnitaire",Number(e.target.value))}>{TARIFS[item.typeActe].map(p=><option key={p} value={p}>{fmt(p)}</option>)}</select>
                :<input style={{...S.fInput,width:115}} type="number" value={item.prixUnitaire} onChange={e=>updateItem(i,"prixUnitaire",Number(e.target.value))}/>
              }
              <div style={{fontWeight:700,color:"#1e40af",fontSize:13,whiteSpace:"nowrap"}}>{fmt(item.quantite*item.prixUnitaire)}</div>
            </div>
          )}
            <div style={S.formRow}>
            <div style={S.fGroup}><label style={S.fLabel}>🔬 Diagnostic</label><input style={S.fInput} value={item.diagnostic} onChange={e=>updateItem(i,"diagnostic",e.target.value)} placeholder="ex: Pulpite…"/></div>
            <div style={S.fGroup}><label style={S.fLabel}>Étape / Séance</label><input style={S.fInput} value={item.etape} onChange={e=>updateItem(i,"etape",e.target.value)} placeholder="ex: Préparation…"/></div>
            </div>
          <div style={S.fGroup}><label style={S.fLabel}>Observations</label><textarea style={S.fTextarea} rows={2} value={item.observations} onChange={e=>updateItem(i,"observations",e.target.value)}/></div>
          <div style={S.formRow}>
            <div style={S.fGroup}><label style={S.fLabel}>💳 Versement (DA)</label><input style={S.fInput} type="number" min={0} value={item.versement} onChange={e=>updateItem(i,"versement",e.target.value)} placeholder="0"/></div>
            <div style={S.fGroup}><label style={S.fLabel}>🏷️ Remise (DA)</label><input style={S.fInput} type="number" min={0} value={item.remise} onChange={e=>updateItem(i,"remise",Number(e.target.value))} placeholder="0"/></div>
          </div>
        </div>
      ))}
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={handleSave}>💾 Enregistrer la séance</button>
      </div>
    </Modal>
  );
}

function EditActeModal({acte,onClose,onSave}){
  const [f,setF]=useState({typeActe:acte.typeActe||"Soin",dents:acte.dents||"",quantite:acte.quantite||1,prixTotal:acte.prixTotal||acte.prix||0,remise:acte.remise||0,etape:acte.etape||"",diagnostic:acte.diagnostic||"",observations:acte.observations||"",montantVerse:acte.montantVerse||0,date:acte.date||now()});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return(
    <Modal title="Modifier la séance" onClose={onClose}>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Type d'acte</label><select style={S.fInput} value={f.typeActe} onChange={e=>set("typeActe",e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div style={S.fGroup}><label style={S.fLabel}>Date</label><input style={S.fInput} type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></div>
      </div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Dent(s)</label><input style={S.fInput} value={f.dents} onChange={e=>set("dents",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Prix total plan (DA)</label><input style={S.fInput} type="number" value={f.prixTotal} onChange={e=>set("prixTotal",Number(e.target.value))}/></div>
      </div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>🔬 Diagnostic</label><input style={S.fInput} value={f.diagnostic} onChange={e=>set("diagnostic",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Étape</label><input style={S.fInput} value={f.etape} onChange={e=>set("etape",e.target.value)}/></div>
      </div>
      <div style={S.fGroup}><label style={S.fLabel}>Observations</label><textarea style={S.fTextarea} rows={2} value={f.observations} onChange={e=>set("observations",e.target.value)}/></div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>💳 Versement (DA)</label><input style={S.fInput} type="number" min={0} value={f.montantVerse} onChange={e=>set("montantVerse",Number(e.target.value))}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>🏷️ Remise (DA)</label><input style={S.fInput} type="number" min={0} value={f.remise} onChange={e=>set("remise",Number(e.target.value))}/></div>
      </div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>onSave({...f,prix:f.prixTotal})}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

function EditVersementModal({acte,onClose,onSave}){
  const [v,setV]=useState(acte.montantVerse||0);
  return(
    <Modal title="Modifier le versement" onClose={onClose}>
      <div style={{padding:"8px 12px",background:"#eff6ff",borderRadius:8,fontSize:12,color:"#1e40af",marginBottom:16}}>
        S{acte.seanceNum||"?"} — {acte.date} — {acte.typeActe} {acte.dents?`Dent ${acte.dents}`:""}
      </div>
      <div style={S.fGroup}>
        <label style={S.fLabel}>💳 Montant versé (DA)</label>
        <input style={{...S.fInput,fontSize:20,fontWeight:800,textAlign:"center",padding:"14px"}} type="number" min={0} value={v} onChange={e=>setV(Number(e.target.value))}/>
      </div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>onSave(Number(v))}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

function ComptaPage({patients,actes}){
  const todayStr=now();
  const [periode,setPeriode]=useState("mois");
  const [dateDebut,setDateDebut]=useState(todayStr.slice(0,7)+"-01");
  const [dateFin,setDateFin]=useState(todayStr);
  const [praticienFilter,setPraticienFilter]=useState("Tous");

  const getRange=p=>{
    const d=new Date(todayStr);
    if(p==="jour") return {debut:todayStr,fin:todayStr};
    if(p==="semaine"){const d7=new Date(d);d7.setDate(d.getDate()-6);return{debut:d7.toISOString().slice(0,10),fin:todayStr};}
    if(p==="mois") return{debut:todayStr.slice(0,7)+"-01",fin:todayStr};
    if(p==="annee") return{debut:todayStr.slice(0,4)+"-01-01",fin:todayStr};
    return{debut:dateDebut,fin:dateFin};
  };
  const {debut,fin}=getRange(periode);

  const filtered=actes.filter(a=>{
    const inRange=a.date>=debut&&a.date<=fin;
    const inPrat=praticienFilter==="Tous"||a.praticien===praticienFilter;
    return inRange&&inPrat;
  });

  const uniquePatients=new Set(filtered.map(a=>a.patientId)).size;
  const totalActes=filtered.length;
  const totalEncaisse=filtered.reduce((s,a)=>s+(Number(a.montantVerse)||0),0);

  const refs=[...new Set(filtered.map(a=>a.traitementRef||a.id))];
  const totalReste=refs.reduce((s,ref)=>s+getTreatSummary(actes,ref).reste,0);

  const byType={};
  filtered.forEach(a=>{
    const t=a.typeActe||"Autre";
    if(!byType[t])byType[t]={count:0,encaisse:0};
    byType[t].count++;
    byType[t].encaisse+=Number(a.montantVerse)||0;
  });
  const typeRows=Object.entries(byType).sort((a,b)=>b[1].encaisse-a[1].encaisse);
  const maxEncaisse=typeRows.length>0?Math.max(...typeRows.map(([,v])=>v.encaisse)):1;

  const byPrat={};
  filtered.forEach(a=>{
    const pr=a.praticien||"—";
    if(!byPrat[pr])byPrat[pr]={count:0,encaisse:0};
    byPrat[pr].count++;
    byPrat[pr].encaisse+=Number(a.montantVerse)||0;
  });

  const presets=[
    {id:"jour",    label:"Aujourd'hui"},
    {id:"semaine", label:"7 derniers jours"},
    {id:"mois",    label:"Ce mois"},
    {id:"annee",   label:"Cette année"},
    {id:"custom",  label:"✏️ Personnalisé"},
  ];
  const periodLabel=presets.find(p=>p.id===periode)?.label||"";

  return(
    <div style={{flex:1,overflow:"auto",padding:"12px 16px"}}>
      <div style={S.pageHdr}>
        <h1 style={S.pageTitle}>📈 Comptabilité</h1>
        <select style={S.pratSel2} value={praticienFilter} onChange={e=>setPraticienFilter(e.target.value)}>
          <option value="Tous">👥 Tous les praticiens</option>
          <option value="Dr. Amin">Dr. Amin</option>
          <option value="Dr. Bossioda">Dr. Bossioda</option>
        </select>
      </div>

      <div style={S.periodBar}>
        {presets.map(p=>(
          <button key={p.id} style={{...S.periodBtn,...(periode===p.id?S.periodBtnOn:{})}} onClick={()=>setPeriode(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {periode==="custom"&&(
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{...S.fGroup,marginBottom:0,flex:"none"}}>
            <label style={S.fLabel}>📅 Du</label>
            <input style={S.fInput} type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)}/>
          </div>
          <div style={{...S.fGroup,marginBottom:0,flex:"none"}}>
            <label style={S.fLabel}>📅 Au</label>
            <input style={S.fInput} type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)}/>
          </div>
          <div style={{padding:"7px 12px",background:"#eff6ff",borderRadius:7,fontSize:12,color:"#1e40af",fontWeight:600,border:"1px solid #bfdbfe"}}>
            {debut} → {fin}
          </div>
        </div>
      )}

      <div style={S.statsGrid}>
        {[
          {l:"Patients vus",       v:uniquePatients,       icon:"👥",c:"#3b82f6"},
          {l:"Séances réalisées",  v:totalActes,           icon:"🦷",c:"#10b981"},
          {l:"CA encaissé",        v:fmt(totalEncaisse),   icon:"💵",c:"#f59e0b"},
          {l:"Reste à encaisser",  v:fmt(totalReste),      icon:"⚠️",c:"#ef4444"},
        ].map(x=>(
          <div key={x.l} style={{...S.statCard,borderLeftColor:x.c}}>
            <span style={{fontSize:28}}>{x.icon}</span>
            <div><div style={{...S.statVal,color:x.c}}>{x.v}</div><div style={S.statLbl}>{x.l}</div></div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14,marginBottom:14}}>
        <div style={S.comptaCard}>
          <h3 style={S.secTitle}>🦷 Répartition par type d'acte</h3>
          {typeRows.length===0&&<div style={S.empty}>Aucun acte sur cette période</div>}
          {typeRows.map(([type,{count,encaisse}])=>(
            <div key={type} style={S.comptaRow}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#0f172a"}}>{type}</span>
                <span style={{fontSize:11,color:"#64748b",textAlign:"right"}}>
                  <b style={{color:"#64748b"}}>{count} acte{count>1?"s":""}</b>
                  {" · "}<b style={{color:"#1e40af"}}>{fmt(encaisse)}</b>
                </span>
              </div>
              <div style={S.barBg}>
                <div style={{...S.barFill,width:maxEncaisse>0?`${Math.round((encaisse/maxEncaisse)*100)}%`:"0%"}}/>
              </div>
            </div>
          ))}
        </div>

        <div style={S.comptaCard}>
          <h3 style={S.secTitle}>👨‍⚕️ Par praticien</h3>
          {Object.entries(byPrat).length===0&&<div style={S.empty}>Aucun acte sur cette période</div>}
          {Object.entries(byPrat).map(([prat,{count,encaisse}])=>(
            <div key={prat} style={{...S.finItem,padding:"10px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"#1e40af",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>
                  {prat.replace("Dr. ","").slice(0,2)}
                </div>
                <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{prat}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#1e40af"}}>{fmt(encaisse)}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{count} séance{count>1?"s":""}</div>
              </div>
            </div>
          ))}
          {Object.keys(byPrat).length>1&&(
            <div style={{marginTop:10,paddingTop:8,borderTop:"2px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>Total</span>
              <span style={{fontSize:14,fontWeight:800,color:"#f59e0b"}}>{fmt(totalEncaisse)}</span>
            </div>
          )}
        </div>
      </div>

      <div style={S.comptaCard}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <h3 style={{...S.secTitle,marginBottom:0,borderBottom:"none"}}>
            📋 Détail des séances — {periodLabel}{periode==="custom"?` (${debut} → ${fin})`:""}
          </h3>
          <span style={{background:"#e0e7ff",color:"#3730a3",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700}}>
            {filtered.length} séance{filtered.length>1?"s":""}
          </span>
        </div>
        <div style={{borderBottom:"2px solid #e2e8f0",marginBottom:10}}/>
        {filtered.length===0&&<div style={S.empty}>Aucune séance enregistrée sur cette période</div>}
        {filtered.length>0&&(
          <div style={{overflowX:"auto"}}>
            <table style={S.table}>
              <thead>
                <tr style={{background:"#f1f5f9"}}>
                  {["Date","Patient","Type d'acte","Dent(s)","Étape","Praticien","Versement"].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>{
                  const pat=patients.find(p=>p.id===a.patientId);
                  return(
                    <tr key={a.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                      <td style={{...S.td,whiteSpace:"nowrap",color:"#64748b"}}>{a.date}</td>
                      <td style={S.td}>
                        <span style={{fontWeight:600,color:"#0f172a"}}>{pat?`${pat.nom} ${pat.prenom}`:"—"}</span>
                        {pat&&<div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>{patCode(pat.id)}</div>}
                      </td>
                      <td style={{...S.td,fontWeight:600}}>{a.typeActe||"—"}</td>
                      <td style={S.td}>{a.dents||"—"}</td>
                      <td style={{...S.td,color:"#7c3aed",fontSize:11}}>{a.etape||"—"}</td>
                      <td style={S.td}>{a.praticien||"—"}</td>
                      <td style={{...S.td,color:"#16a34a",fontWeight:800,textAlign:"right",whiteSpace:"nowrap"}}>{fmt(a.montantVerse||0)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0fdf4"}}>
                  <td colSpan={6} style={{...S.td,textAlign:"right",fontWeight:700,color:"#374151",fontSize:13}}>Total encaissé :</td>
                  <td style={{...S.td,color:"#16a34a",fontWeight:800,fontSize:15,textAlign:"right",whiteSpace:"nowrap"}}>{fmt(totalEncaisse)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({title,children,onClose,wide}){
  return(
    <div style={S.overlay}>
      <div style={{...S.modalBox,...(wide?{maxWidth:700}:{})}}>
        <div style={S.modalHd}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#0f172a",margin:0}}>{title}</h3>
          <button style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#94a3b8"}} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBd}>{children}</div>
      </div>
    </div>
  );
}

const S={
  app:{display:"flex",flexDirection:"column",height:"100vh",fontFamily:"'Segoe UI',sans-serif",background:"#f1f5f9",overflow:"hidden"},
  topNav:{height:NAV_H,minHeight:NAV_H,maxHeight:NAV_H,background:"#0f172a",display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0,borderBottom:"1px solid #1e293b",zIndex:100},
  navLogo:{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginRight:8},
  navTitle:{color:"#f1f5f9",fontWeight:700,fontSize:13,whiteSpace:"nowrap"},
  navLinks:{display:"flex",alignItems:"center",gap:2,flex:1},
  navLink:{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:"none",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:12,fontWeight:500,whiteSpace:"nowrap",height:36},
  navLinkOn:{background:"#1e40af",color:"#fff"},
  navRight:{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:"auto"},
  pratSel:{padding:"4px 8px",background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer",height:30},
  statusChip:{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#1e293b",borderRadius:20,height:26},
  syncBtn:{padding:"4px 10px",background:"#0ea5e9",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,height:28},
  logoutBtn:{padding:"4px 10px",background:"transparent",border:"1px solid #334155",borderRadius:6,color:"#94a3b8",cursor:"pointer",fontSize:11,height:28,whiteSpace:"nowrap"},
  offlineBanner:{background:"#ef4444",color:"#fff",textAlign:"center",padding:"5px 16px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexShrink:0},
  syncBanner:{background:"#1e40af",color:"#fff",textAlign:"center",padding:"4px 16px",fontSize:11,flexShrink:0},
  syncToast:{position:"fixed",bottom:20,right:20,background:"#16a34a",color:"#fff",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,.2)",zIndex:9999},
  pendingBadge:{background:"rgba(255,255,255,.25)",padding:"1px 7px",borderRadius:10,fontSize:11},
  main:{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"},
  loader:{display:"flex",alignItems:"center",justifyContent:"center",flex:1,color:"#94a3b8",fontSize:18},
  loginBg:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f)"},
  loginCard:{background:"#fff",borderRadius:20,padding:"48px 40px",width:360,textAlign:"center",boxShadow:"0 25px 60px rgba(0,0,0,.35)"},
  loginTitle:{fontSize:22,fontWeight:800,color:"#0f172a",margin:"0 0 4px"},
  pageTitle:{fontSize:20,fontWeight:800,color:"#0f172a",margin:"0 0 16px"},
  pageHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:14,marginBottom:20},
  statCard:{background:"#fff",borderRadius:12,padding:"16px 18px",display:"flex",alignItems:"center",gap:12,borderLeft:"4px solid",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  statVal:{fontSize:20,fontWeight:800},statLbl:{fontSize:12,color:"#64748b",marginTop:3},
  splitView:{display:"flex",gap:12,flex:1,overflow:"hidden",padding:"12px 16px"},
  leftPane:{width:255,background:"#fff",borderRadius:10,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.06)",flexShrink:0},
  rightPane:{flex:1,background:"#fff",borderRadius:10,overflow:"auto",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  paneHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px 6px"},
  searchBox:{margin:"0 8px 6px",padding:"6px 10px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:12,outline:"none"},
  scrollList:{overflow:"auto",flex:1,padding:"0 5px 5px"},
  patRow:{display:"flex",alignItems:"center",gap:8,padding:"8px 7px",borderRadius:7,cursor:"pointer"},
  patRowOn:{background:"#eff6ff"},
  avatar:{width:34,height:34,borderRadius:"50%",background:"#1e40af",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0},
  patName:{fontSize:13,fontWeight:600,color:"#0f172a"},patSub:{fontSize:11,color:"#94a3b8"},
  emptyDetail:{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#94a3b8",fontSize:14},
  ficheWrap:{padding:"14px 18px"},
  ficheHead:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8},
  ficheTitle:{fontSize:18,fontWeight:800,color:"#0f172a",margin:0},
  infoGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12},
  infoBox:{background:"#f8fafc",borderRadius:7,padding:"7px 11px"},
  infoKey:{fontSize:11,color:"#64748b",marginBottom:2},infoVal:{fontSize:13,color:"#0f172a",fontWeight:500},
  finSummary:{background:"linear-gradient(135deg,#eff6ff,#f0fdf4)",border:"1px solid #bfdbfe",borderRadius:10,padding:"10px 14px",marginBottom:14},
  finItem:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(0,0,0,.06)",fontSize:13},
  secTitle:{fontSize:14,fontWeight:700,color:"#0f172a",borderBottom:"2px solid #e2e8f0",paddingBottom:6,marginBottom:10,marginTop:4},
  treatCard:{background:"#f8fafc",borderRadius:9,padding:"11px 13px",marginBottom:10,border:"1px solid #e2e8f0"},
  treatHead:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6},
  table:{width:"100%",borderCollapse:"collapse",fontSize:12},
  th:{padding:"5px 7px",textAlign:"left",color:"#64748b",fontWeight:700,fontSize:11},
  td:{padding:"6px 7px",color:"#374151",verticalAlign:"middle"},
  treatFoot:{marginTop:6,fontSize:11,color:"#64748b",borderTop:"1px solid #e2e8f0",paddingTop:5},
  btnTerminer:{marginTop:6,padding:"4px 12px",background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600},
  acteCard:{background:"#fff",borderRadius:10,padding:"12px 15px",marginBottom:10,borderLeft:"4px solid #1e40af",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  acteCardHd:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8},
  seanceRow:{display:"flex",alignItems:"center",gap:6,padding:"5px 7px",background:"#f8fafc",borderRadius:5,marginBottom:2,fontSize:12},
  filterSel:{padding:"7px 10px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:12,marginBottom:12,outline:"none",background:"#fff"},
  pill:(bg,col)=>({background:bg,color:col,padding:"2px 7px",borderRadius:10,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}),
  sBadge:{padding:"2px 9px",borderRadius:18,fontSize:11,fontWeight:600},
  itemCard:{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:9,padding:"12px",marginBottom:8},
  infoChip:{padding:"7px 11px",background:"#eff6ff",borderRadius:7,fontSize:12,color:"#1e40af"},
  modeRow:{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"},
  modeBtn:{flex:1,padding:"9px",border:"2px solid #e2e8f0",borderRadius:7,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:500,minWidth:140},
  modeBtnOn:{borderColor:"#1e40af",background:"#eff6ff",color:"#1e40af"},
  btnBlue:{padding:"7px 14px",background:"#1e40af",color:"#fff",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"},
  btnGray:{padding:"7px 14px",background:"#f1f5f9",color:"#374151",border:"1px solid #e2e8f0",borderRadius:7,cursor:"pointer",fontSize:12},
  btnRed:{padding:"7px 12px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600},
  btnRedSm:{padding:"3px 7px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,flexShrink:0},
  btnEditSm:{padding:"3px 7px",background:"#eff6ff",color:"#1e40af",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,flexShrink:0},
  empty:{textAlign:"center",color:"#94a3b8",padding:"24px 0",fontSize:13},
  fGroup:{display:"flex",flexDirection:"column",gap:4,marginBottom:10,flex:1},
  formRow:{display:"flex",gap:10},
  fLabel:{fontSize:12,fontWeight:600,color:"#374151"},
  fInput:{padding:"7px 11px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,outline:"none",background:"#fff"},
  fTextarea:{padding:"7px 11px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,outline:"none",resize:"vertical",background:"#fff"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},
  modalBox:{background:"#fff",borderRadius:14,width:"100%",maxWidth:480,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.25)"},
  modalHd:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px 11px",borderBottom:"1px solid #f1f5f9"},
  modalBd:{padding:"16px 18px",overflow:"auto"},
  mAct:{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14},
  comptaCard:{background:"#fff",borderRadius:10,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,.06)",marginBottom:14},
  comptaRow:{marginBottom:12},
  barBg:{height:7,background:"#e2e8f0",borderRadius:4,overflow:"hidden"},
  barFill:{height:"100%",background:"linear-gradient(90deg,#1e40af,#60a5fa)",borderRadius:4,transition:"width .4s ease"},
  periodBar:{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"},
  periodBtn:{padding:"6px 15px",border:"1.5px solid #e2e8f0",borderRadius:20,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:500,color:"#64748b",transition:"all .15s"},
  periodBtnOn:{borderColor:"#1e40af",background:"#1e40af",color:"#fff",fontWeight:700},
  pratSel2:{padding:"6px 10px",background:"#f1f5f9",color:"#374151",border:"1px solid #e2e8f0",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer",height:32},
};
