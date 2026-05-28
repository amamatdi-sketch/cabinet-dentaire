import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://jeidktusskhegocpppw.supabase.co";
const SUPABASE_KEY = "VOTRE_CLE_SUPABASE_ICI";   // ← gardez votre clé
const LOGIN_USER   = "admin";                      // ← changez
const LOGIN_PASS   = "cabinet2026";                // ← changez

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [loggedIn, setLoggedIn] = useState(()=>localStorage.getItem("cab_auth")==="1");
  const [praticien,setPraticien]= useState(localStorage.getItem("cab_prat")||"Dr. Amin");
  const [page,     setPage]     = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [actes,    setActes]    = useState([]);
  const [connected,setConnected]= useState(false);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [mData,    setMData]    = useState(null);

  useEffect(()=>{
    if(!loggedIn) return;
    loadAll();
    const ch = db.channel("rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"patients"},()=>loadPatients())
      .on("postgres_changes",{event:"*",schema:"public",table:"actes"},   ()=>loadActes())
      .subscribe(s=>setConnected(s==="SUBSCRIBED"));
    return ()=>db.removeChannel(ch);
  },[loggedIn]);

  const loadAll      = async()=>{ setLoading(true); await Promise.all([loadPatients(),loadActes()]); setLoading(false); };
  const loadPatients = async()=>{ const {data}=await db.from("patients").select("*").order("dateCreation",{ascending:false}); if(data) setPatients(data); };
  const loadActes    = async()=>{ const {data}=await db.from("actes").select("*").order("date",{ascending:false}); if(data) setActes(data); };
  const close        = ()=>{ setModal(null); setMData(null); };

  const deletePatient = async id=>{
    if(!confirm("Supprimer ce patient et toutes ses données ?")) return;
    await db.from("actes").delete().eq("patientId",id);
    await db.from("patients").delete().eq("id",id);
    loadAll();
  };
  const deleteActe = async id=>{
    if(!confirm("Supprimer cet acte ?")) return;
    await db.from("actes").delete().eq("id",id); loadActes();
  };
  const terminateTraitement = async ref=>{
    if(!confirm("Marquer ce traitement comme terminé ?")) return;
    await db.from("actes").update({statut:"terminé"}).eq("traitementRef",ref);
    loadActes();
  };

  if(!loggedIn) return <LoginPage onLogin={(u,p)=>{
    if(u===LOGIN_USER && p===LOGIN_PASS){ localStorage.setItem("cab_auth","1"); setLoggedIn(true); }
    else alert("Identifiants incorrects");
  }}/>;

  const logout=()=>{ localStorage.removeItem("cab_auth"); setLoggedIn(false); };

  const nav=[
    {id:"dashboard",label:"Tableau de bord",icon:"📊"},
    {id:"patients", label:"Patients",        icon:"👥"},
    {id:"actes",    label:"Actes Cliniques", icon:"🦷"},
  ];

  return(
    <div style={S.app}>
      <nav style={S.sidebar}>
        <div style={S.sideTop}>
          <span style={{fontSize:26}}>🦷</span>
          <div><div style={S.siName}>Cabinet Dentaire</div><div style={S.siRole}>{praticien}</div></div>
        </div>
        <select style={S.pratSel} value={praticien} onChange={e=>{setPraticien(e.target.value);localStorage.setItem("cab_prat",e.target.value);}}>
          <option>Dr. Amin</option><option>Dr. Bossioda</option>
        </select>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:4,marginTop:8}}>
          {nav.map(n=>(
            <button key={n.id} style={{...S.navBtn,...(page===n.id?S.navOn:{})}} onClick={()=>setPage(n.id)}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div>
          <div style={{fontSize:11,color:"#475569",padding:"0 8px",marginBottom:6}}>
            <span style={{color:connected?"#22c55e":"#f59e0b"}}>●</span> {connected?"Connecté":"Connexion…"}
          </div>
          <button style={S.logoutBtn} onClick={logout}>🔒 Déconnexion</button>
        </div>
      </nav>

      <main style={S.main}>
        {loading?<div style={S.loader}>⏳ Chargement…</div>:<>
          {page==="dashboard" && <Dashboard patients={patients} actes={actes}/>}
          {page==="patients"  && <PatientsPage patients={patients} actes={actes}
            onNew={()=>setModal("newPat")}
            onEdit={p=>{setModal("editPat");setMData(p);}}
            onDelete={deletePatient}
            onEditVersement={a=>{setModal("editVers");setMData(a);}}
            onTerminate={terminateTraitement}
          />}
          {page==="actes" && <ActesPage patients={patients} actes={actes}
            onNew={()=>setModal("newActe")}
            onDelete={deleteActe}
            onEdit={a=>{setModal("editActe");setMData(a);}}
            onTerminate={terminateTraitement}
          />}
        </>}
      </main>

      {modal==="newPat"   && <PatientModal onClose={close} onSave={async d=>{
            const exists=patients.find(p=>p.nom.toLowerCase()===d.nom.toLowerCase()&&p.prenom.toLowerCase()===d.prenom.toLowerCase());
            if(exists){alert("⚠️ Ce patient existe déjà : "+d.prenom+" "+d.nom);return;}
            await db.from("patients").insert([{...d,id:uid(),dateCreation:now()}]);close();loadPatients();
          }}/>}
      {modal==="editPat"  && mData && <PatientModal patient={mData} onClose={close} onSave={async d=>{await db.from("patients").update(d).eq("id",mData.id);close();loadPatients();}}/>}
      {modal==="newActe"  && <ActeModal patients={patients} actes={actes} praticien={praticien} onClose={close}
        onSave={async list=>{await db.from("actes").insert(list);close();loadActes();}}/>}
      {modal==="editActe" && mData && <EditActeModal acte={mData} onClose={close}
        onSave={async d=>{await db.from("actes").update(d).eq("id",mData.id);close();loadActes();}}/>}
      {modal==="editVers" && mData && <EditVersementModal acte={mData} onClose={close}
        onSave={async v=>{await db.from("actes").update({montantVerse:v}).eq("id",mData.id);close();loadActes();}}/>}
    </div>
  );
}

// ══ LOGIN ══════════════════════════════════════════════════════════════════════
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

// ══ DASHBOARD ══════════════════════════════════════════════════════════════════
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
          {l:"Total Patients",    v:patients.length,                             icon:"👥",c:"#3b82f6"},
          {l:"Actes aujourd'hui", v:actes.filter(a=>a.date===d).length,          icon:"🦷",c:"#10b981"},
          {l:"Recettes du jour",  v:fmt(caAuj),                                  icon:"💵",c:"#f59e0b"},
          {l:"Total Impayés",     v:fmt(totalReste),                             icon:"⚠️",c:"#ef4444"},
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

// ══ PATIENTS ═══════════════════════════════════════════════════════════════════
function PatientsPage({patients,actes,onNew,onEdit,onDelete,onEditVersement,onTerminate}){
  const [search,setSearch]=useState(""); const [selId,setSelId]=useState(null);
  const list=patients.filter(p=>`${p.nom||""} ${p.prenom||""} ${p.telephone||""} ${p.dateNaissance||""}`.toLowerCase().includes(search.toLowerCase()));
  const sel=patients.find(p=>p.id===selId);
  return(
    <div style={S.splitView}>
      <div style={S.leftPane}>
        <div style={S.paneHdr}>
          <h2 style={{...S.pageTitle,margin:0,fontSize:15}}>Patients ({patients.length})</h2>
          <button style={S.btnBlue} onClick={onNew}>+ Nouveau</button>
        </div>
        <input style={S.searchBox} placeholder="🔍 Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={S.scrollList}>
          {list.map(p=>(
            <div key={p.id} style={{...S.patRow,...(selId===p.id?S.patRowOn:{})}} onClick={()=>setSelId(p.id)}>
              <div style={S.avatar}>{p.prenom?.[0]||"?"}{p.nom?.[0]||""}</div>
              <div><div style={S.patName}>{p.prenom} {p.nom}</div><div style={S.patSub}>{p.telephone||"Pas de téléphone"}{p.dateNaissance ? " · "+p.dateNaissance : ""}</div></div>
            </div>
          ))}
          {list.length===0&&<div style={S.empty}>Aucun patient</div>}
        </div>
      </div>
      <div style={S.rightPane}>
        {sel?<PatientFiche patient={sel} actes={actes.filter(a=>a.patientId===sel.id)} allActes={actes}
          onEdit={()=>onEdit(sel)} onDelete={()=>{onDelete(sel.id);setSelId(null);}}
          onEditVersement={onEditVersement} onTerminate={onTerminate}
        />:<div style={S.emptyDetail}>← Sélectionnez un patient</div>}
      </div>
    </div>
  );
}

function PatientFiche({patient,actes,allActes,onEdit,onDelete,onEditVersement,onTerminate}){
  const groups={};
  actes.forEach(a=>{const k=a.traitementRef||a.id;if(!groups[k])groups[k]=[];groups[k].push(a);});
  const refs=Object.keys(groups);

  // Récapitulatif financier
  let totalPlan=0,totalPaye=0;
  refs.forEach(ref=>{ const {netPrice,totalVerse}=getTreatSummary(allActes,ref); totalPlan+=netPrice; totalPaye+=totalVerse; });
  const totalReste=Math.max(0,totalPlan-totalPaye);

  return(
    <div style={S.ficheWrap}>
      <div style={S.ficheHead}>
        <div>
          <h2 style={S.ficheTitle}>{patient.prenom} {patient.nom}</h2>
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

      {/* ══ RÉCAPITULATIF FINANCIER ══ */}
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

            {/* Tableau des séances */}
            <div style={{overflowX:"auto"}}>
              <table style={S.table}>
                <thead>
                  <tr style={{background:"#f1f5f9"}}>
                    {["N°","Date","Étape","Diagnostic","Observations","Versement",""].map(h=>(
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s,i)=>(
                    <tr key={s.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                      <td style={{...S.td,fontWeight:700,color:"#1e40af"}}>S{s.seanceNum||i+1}</td>
                      <td style={S.td}>{s.date}</td>
                      <td style={S.td}>{s.etape||"—"}</td>
                      <td style={{...S.td,color:"#7c3aed"}}>{s.diagnostic||"—"}</td>
                      <td style={{...S.td,color:"#6b7280",fontSize:11}}>{s.observations||"—"}</td>
                      <td style={{...S.td,color:"#16a34a",fontWeight:600}}>+{fmt(s.montantVerse||0)}</td>
                      <td style={S.td}>
                        <button style={S.btnEditSm} onClick={()=>onEditVersement(s)} title="Modifier versement">💳</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={S.treatFoot}>
              Plan: <b>{fmt(prixTotal)}</b>
              {totalRemise>0&&<> | Remise: <b style={{color:"#16a34a"}}>-{fmt(totalRemise)}</b></>}
              {" "}| Net: <b>{fmt(netPrice)}</b>
              {" "}| Payé: <b style={{color:"#16a34a"}}>{fmt(totalVerse)}</b>
              {" "}| Reste: <b style={{color:reste>0?"#ef4444":"#16a34a"}}>{fmt(reste)}</b>
            </div>
            {!termine&&<button style={S.btnTerminer} onClick={()=>onTerminate(ref)}>✅ Marquer comme terminé</button>}
          </div>
        );
      })}
    </div>
  );
}

// ══ PATIENT MODAL ══════════════════════════════════════════════════════════════
function PatientModal({patient,onClose,onSave}){
  const [f,setF]=useState({prenom:patient?.prenom||"",nom:patient?.nom||"",telephone:patient?.telephone||"",dateNaissance:patient?.dateNaissance||"",antecedents:patient?.antecedents||"",traitements:patient?.traitements||"",allergies:patient?.allergies||""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return(
    <Modal title={patient?"Modifier le patient":"Nouveau patient"} onClose={onClose}>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Prénom *</label><input style={S.fInput} value={f.prenom} onChange={e=>set("prenom",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Nom *</label><input style={S.fInput} value={f.nom} onChange={e=>set("nom",e.target.value)}/></div>
      </div>
      <div style={S.fGroup}><label style={S.fLabel}>📞 Téléphone</label><input style={S.fInput} value={f.telephone} onChange={e=>set("telephone",e.target.value)} placeholder="0555 000 000"/></div>
      <div style={S.formRow}><div style={S.fGroup}><label style={S.fLabel}>🎂 Date de naissance</label><input style={S.fInput} type="date" value={f.dateNaissance} onChange={e=>set("dateNaissance",e.target.value)}/></div><div style={S.fGroup}><label style={S.fLabel}>⚠️ Allergies</label><input style={S.fInput} value={f.allergies} onChange={e=>set("allergies",e.target.value)}/></div></div>
      <div style={S.fGroup}><label style={S.fLabel}>🩺 Antécédents</label><textarea style={S.fTextarea} rows={2} value={f.antecedents} onChange={e=>set("antecedents",e.target.value)}/></div>
      <div style={S.fGroup}><label style={S.fLabel}>💊 Traitements en cours</label><textarea style={S.fTextarea} rows={2} value={f.traitements} onChange={e=>set("traitements",e.target.value)}/></div>
      <div style={S.mAct}>
        <button style={S.btnGray} onClick={onClose}>Annuler</button>
        <button style={S.btnBlue} onClick={()=>{if(!f.prenom||!f.nom)return alert("Prénom et Nom requis");onSave(f);}}>💾 Enregistrer</button>
      </div>
    </Modal>
  );
}

// ══ ACTES PAGE ══════════════════════════════════════════════════════════════════
function ActesPage({patients,actes,onNew,onDelete,onEdit,onTerminate}){
  const [filterPat,setFilterPat]=useState("");
  const filtered=actes.filter(a=>!filterPat||a.patientId===filterPat);
  const groups={};
  filtered.forEach(a=>{const k=a.traitementRef||a.id;if(!groups[k])groups[k]=[];groups[k].push(a);});

  return(
    <div>
      <div style={S.pageHdr}>
        <h1 style={S.pageTitle}>Actes Cliniques</h1>
        <button style={S.btnBlue} onClick={onNew}>+ Nouvelle Séance</button>
      </div>
      <select style={S.filterSel} value={filterPat} onChange={e=>setFilterPat(e.target.value)}>
        <option value="">Tous les patients</option>
        {patients.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
      </select>
      {Object.keys(groups).length===0&&<div style={S.empty}>Aucun acte enregistré</div>}
      {Object.entries(groups).map(([ref])=>{
        const {sorted,prixTotal,totalRemise,netPrice,totalVerse,reste,termine}=getTreatSummary(actes,ref);
        const first=sorted[0];
        const patient=patients.find(p=>p.id===first.patientId);
        return(
          <div key={ref} style={{...S.acteCard,...(termine?{borderLeftColor:"#94a3b8"}:{})}}>
            <div style={S.acteCardHd}>
              <div>
                <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6}}>
                  {patient?`${patient.prenom} ${patient.nom}`:"—"}
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

// ══ MODAL NOUVELLE SÉANCE ══════════════════════════════════════════════════════
// Chaque item a ses propres : étape, diagnostic, observations, versement, remise
function ActeModal({patients,actes,praticien,onClose,onSave}){
  const [patientId, setPatientId] = useState("");
  const [date,      setDate]      = useState(now());
  const [items,     setItems]     = useState([]);

  const patActes = actes.filter(a=>a.patientId===patientId);
  const openGroups={};
  patActes.forEach(a=>{const k=a.traitementRef||a.id;if(!openGroups[k])openGroups[k]=[];openGroups[k].push(a);});
  const openList=Object.entries(openGroups).filter(([ref])=>{
    const sessions=getAllSessions(actes,ref);
    return sessions.some(s=>!s.statut||s.statut==="en_cours");
  });

  // Item par défaut
  const newItem = (type) => type==="continuer"
    ? {type:"continuer", ref:"", etape:"", diagnostic:"", observations:"", versement:"", remise:0}
    : {type:"nouveau", typeActe:"Soin", dents:"", quantite:1, prixUnitaire:5000, etape:"", diagnostic:"", observations:"", versement:"", remise:0};

  const updateItem=(i,k,v)=>{
    const ni=[...items]; ni[i]={...ni[i],[k]:v};
    if(k==="typeActe") ni[i].prixUnitaire=TARIFS[v]?.[0]||0;
    setItems(ni);
  };

  const handleSave=()=>{
    if(!patientId) return alert("Sélectionnez un patient");
    if(items.length===0) return alert("Ajoutez au moins un traitement");
    const list=[];
    items.forEach(item=>{
      if(item.type==="continuer"){
        if(!item.ref) return;
        const {first,sorted,prixTotal}=getTreatSummary(actes,item.ref);
        const existFact=sorted.find(s=>s.facturId)?.facturId||null;
        list.push({
          id:uid(), patientId, date, praticien,
          typeActe:first.typeActe, dents:first.dents, quantite:first.quantite||1,
          prixUnitaire:Number(first.prixUnitaire||first.prix)||0,
          prix:prixTotal, prixTotal,
          remise:Number(item.remise)||0,
          traitementRef:item.ref, seanceNum:sorted.length+1,
          etape:item.etape, diagnostic:item.diagnostic, observations:item.observations,
          montantVerse:Number(item.versement)||0,
          facturId:existFact, statut:"en_cours",
        });
      } else {
        const planTotal=item.quantite*item.prixUnitaire;
        list.push({
          id:uid(), patientId, date, praticien,
          typeActe:item.typeActe, dents:item.dents, quantite:item.quantite,
          prixUnitaire:item.prixUnitaire, prix:planTotal, prixTotal:planTotal,
          remise:Number(item.remise)||0,
          traitementRef:uid(), seanceNum:1,
          etape:item.etape, diagnostic:item.diagnostic, observations:item.observations,
          montantVerse:Number(item.versement)||0,
          statut:"en_cours",
        });
      }
    });
    if(list.length===0) return alert("Sélectionnez les traitements");
    onSave(list);
  };

  return(
    <Modal title="Nouvelle Séance Clinique" onClose={onClose} wide>
      {/* Patient + Date */}
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Patient *</label>
          <select style={S.fInput} value={patientId} onChange={e=>{setPatientId(e.target.value);setItems([]);}}>
            <option value="">— Sélectionner —</option>
            {patients.map(p=><option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
        </div>
        <div style={S.fGroup}><label style={S.fLabel}>Date</label>
          <input style={S.fInput} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>
      </div>

      {/* Boutons d'ajout */}
      {patientId&&(
        <div style={S.modeRow}>
          {openList.length>0&&(
            <button style={S.modeBtn} onClick={()=>setItems(it=>[...it,newItem("continuer")])}>
              🔄 Continuer un traitement
            </button>
          )}
          <button style={{...S.modeBtn,...S.modeBtnOn}} onClick={()=>setItems(it=>[...it,newItem("nouveau")])}>
            ✨ Nouveau traitement
          </button>
        </div>
      )}

      {/* Items — chacun avec ses propres champs */}
      {items.map((item,i)=>(
        <div key={i} style={S.itemCard}>
          {/* En-tête item */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={item.type==="continuer"?S.pill("#dbeafe","#1e40af"):S.pill("#ede9fe","#6d28d9")}>
              {item.type==="continuer"?"🔄 Continuer":"✨ Nouveau"}
            </span>
            <button style={S.btnRedSm} onClick={()=>setItems(it=>it.filter((_,idx)=>idx!==i))}>✕ Supprimer</button>
          </div>

          {/* Sélecteur traitement ou nouveau acte */}
          {item.type==="continuer"?(
            <div style={S.fGroup}>
              <label style={S.fLabel}>Traitement à continuer</label>
              <select style={S.fInput} value={item.ref} onChange={e=>updateItem(i,"ref",e.target.value)}>
                <option value="">— Choisir —</option>
                {openList.map(([ref])=>{
                  const {first,sorted,reste}=getTreatSummary(actes,ref);
                  return <option key={ref} value={ref}>{first.typeActe}{first.dents?` Dent ${first.dents}`:""} — Séance {sorted.length+1} — Reste: {fmt(reste)}</option>;
                })}
              </select>
              {item.ref&&(()=>{
                const {prixTotal,totalVerse,reste}=getTreatSummary(actes,item.ref);
                return <div style={{...S.infoChip,marginTop:6}}>Plan: <b>{fmt(prixTotal)}</b> | Payé: <b style={{color:"#16a34a"}}>{fmt(totalVerse)}</b> | <b style={{color:"#ef4444"}}>Reste: {fmt(reste)}</b></div>;
              })()}
            </div>
          ):(
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
              <select style={{...S.fInput,flex:2,minWidth:120}} value={item.typeActe} onChange={e=>updateItem(i,"typeActe",e.target.value)}>
                {TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
              <input style={{...S.fInput,width:75}} placeholder="Dent(s)" value={item.dents} onChange={e=>updateItem(i,"dents",e.target.value)}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <span style={{fontSize:10,color:"#94a3b8"}}>Qté</span>
                <input style={{...S.fInput,width:50,textAlign:"center"}} type="number" min={1} value={item.quantite} onChange={e=>updateItem(i,"quantite",Math.max(1,parseInt(e.target.value)||1))}/>
              </div>
              {TARIFS[item.typeActe]?.length>1?(
                <select style={{...S.fInput,width:115}} value={item.prixUnitaire} onChange={e=>updateItem(i,"prixUnitaire",Number(e.target.value))}>
                  {TARIFS[item.typeActe].map(p=><option key={p} value={p}>{fmt(p)}</option>)}
                </select>
              ):(
                <input style={{...S.fInput,width:115}} type="number" value={item.prixUnitaire} onChange={e=>updateItem(i,"prixUnitaire",Number(e.target.value))}/>
              )}
              <div style={{fontWeight:700,color:"#1e40af",fontSize:13,whiteSpace:"nowrap"}}>{fmt(item.quantite*item.prixUnitaire)}</div>
            </div>
          )}

          {/* ══ Champs propres à CE traitement ══ */}
          <div style={S.formRow}>
            <div style={S.fGroup}>
              <label style={S.fLabel}>Étape / Séance</label>
              <input style={S.fInput} value={item.etape} onChange={e=>updateItem(i,"etape",e.target.value)} placeholder="ex: Préparation, Obturation…"/>
            </div>
            <div style={S.fGroup}>
              <label style={S.fLabel}>🔬 Diagnostic</label>
              <input style={S.fInput} value={item.diagnostic} onChange={e=>updateItem(i,"diagnostic",e.target.value)} placeholder="ex: Pulpite, Abcès…"/>
            </div>
          </div>
          <div style={S.fGroup}>
            <label style={S.fLabel}>Observations</label>
            <textarea style={S.fTextarea} rows={2} value={item.observations} onChange={e=>updateItem(i,"observations",e.target.value)}/>
          </div>
          <div style={S.formRow}>
            <div style={S.fGroup}>
              <label style={S.fLabel}>💳 Versement (DA)</label>
              <input style={S.fInput} type="number" min={0} value={item.versement} onChange={e=>updateItem(i,"versement",e.target.value)} placeholder="0"/>
            </div>
            <div style={S.fGroup}>
              <label style={S.fLabel}>🏷️ Remise (DA)</label>
              <input style={S.fInput} type="number" min={0} value={item.remise} onChange={e=>updateItem(i,"remise",Number(e.target.value))} placeholder="0"/>
            </div>
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

// ══ EDIT ACTE ══════════════════════════════════════════════════════════════════
function EditActeModal({acte,onClose,onSave}){
  const [f,setF]=useState({
    typeActe:acte.typeActe||"Soin", dents:acte.dents||"", quantite:acte.quantite||1,
    prixTotal:acte.prixTotal||acte.prix||0, remise:acte.remise||0,
    etape:acte.etape||"", diagnostic:acte.diagnostic||"",
    observations:acte.observations||"", montantVerse:acte.montantVerse||0, date:acte.date||now(),
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
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
        <div style={S.fGroup}><label style={S.fLabel}>Dent(s)</label><input style={S.fInput} value={f.dents} onChange={e=>set("dents",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>Prix total plan (DA)</label><input style={S.fInput} type="number" value={f.prixTotal} onChange={e=>set("prixTotal",Number(e.target.value))}/></div>
      </div>
      <div style={S.formRow}>
        <div style={S.fGroup}><label style={S.fLabel}>Étape</label><input style={S.fInput} value={f.etape} onChange={e=>set("etape",e.target.value)}/></div>
        <div style={S.fGroup}><label style={S.fLabel}>🔬 Diagnostic</label><input style={S.fInput} value={f.diagnostic} onChange={e=>set("diagnostic",e.target.value)}/></div>
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

// ══ EDIT VERSEMENT ══════════════════════════════════════════════════════════════
function EditVersementModal({acte,onClose,onSave}){
  const [v,setV]=useState(acte.montantVerse||0);
  return(
    <Modal title="Modifier le versement" onClose={onClose}>
      <div style={{...S.infoChip,marginBottom:16}}>
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

// ══ MODAL ══════════════════════════════════════════════════════════════════════
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

// ══ STYLES ══════════════════════════════════════════════════════════════════════
const S={
  app:{display:"flex",height:"100vh",fontFamily:"'Segoe UI',sans-serif",background:"#f1f5f9",overflow:"hidden"},
  sidebar:{width:220,background:"#0f172a",display:"flex",flexDirection:"column",padding:"20px 10px",gap:4,flexShrink:0},
  sideTop:{display:"flex",alignItems:"center",gap:10,padding:"0 8px 16px",borderBottom:"1px solid #1e293b",marginBottom:8},
  siName:{color:"#f1f5f9",fontWeight:700,fontSize:13}, siRole:{color:"#64748b",fontSize:11,marginTop:2},
  pratSel:{padding:"6px 8px",background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer"},
  navBtn:{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left"},
  navOn:{background:"#1e40af",color:"#fff"},
  logoutBtn:{padding:"7px 12px",background:"transparent",border:"1px solid #334155",borderRadius:6,color:"#94a3b8",cursor:"pointer",fontSize:11,width:"100%"},
  main:{flex:1,overflow:"auto",padding:28},
  loader:{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",color:"#94a3b8",fontSize:18},
  loginBg:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f)"},
  loginCard:{background:"#fff",borderRadius:20,padding:"48px 40px",width:360,textAlign:"center",boxShadow:"0 25px 60px rgba(0,0,0,.35)"},
  loginTitle:{fontSize:22,fontWeight:800,color:"#0f172a",margin:"0 0 4px"},
  pageTitle:{fontSize:22,fontWeight:800,color:"#0f172a",margin:"0 0 20px"},
  pageHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16,marginBottom:24},
  statCard:{background:"#fff",borderRadius:12,padding:"18px 20px",display:"flex",alignItems:"center",gap:14,borderLeft:"4px solid",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  statVal:{fontSize:22,fontWeight:800}, statLbl:{fontSize:12,color:"#64748b",marginTop:4},
  splitView:{display:"flex",gap:16,height:"calc(100vh - 80px)"},
  leftPane:{width:265,background:"#fff",borderRadius:12,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.06)",flexShrink:0},
  rightPane:{flex:1,background:"#fff",borderRadius:12,overflow:"auto",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  paneHdr:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 13px 8px"},
  searchBox:{margin:"0 10px 8px",padding:"7px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none"},
  scrollList:{overflow:"auto",flex:1,padding:"0 6px 6px"},
  patRow:{display:"flex",alignItems:"center",gap:10,padding:"9px 8px",borderRadius:8,cursor:"pointer"},
  patRowOn:{background:"#eff6ff"},
  avatar:{width:36,height:36,borderRadius:"50%",background:"#1e40af",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0},
  patName:{fontSize:13,fontWeight:600,color:"#0f172a"}, patSub:{fontSize:11,color:"#94a3b8"},
  emptyDetail:{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#94a3b8",fontSize:15},
  ficheWrap:{padding:22},
  ficheHead:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10},
  ficheTitle:{fontSize:20,fontWeight:800,color:"#0f172a",margin:0},
  infoGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18},
  infoBox:{background:"#f8fafc",borderRadius:8,padding:"9px 13px"},
  infoKey:{fontSize:11,color:"#64748b",marginBottom:3}, infoVal:{fontSize:13,color:"#0f172a",fontWeight:500},
  finSummary:{background:"linear-gradient(135deg,#eff6ff,#f0fdf4)",border:"1px solid #bfdbfe",borderRadius:12,padding:"14px 18px",marginBottom:20},
  finItem:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,.06)",fontSize:14},
  secTitle:{fontSize:15,fontWeight:700,color:"#0f172a",borderBottom:"2px solid #e2e8f0",paddingBottom:8,marginBottom:14},
  treatCard:{background:"#f8fafc",borderRadius:10,padding:"13px 15px",marginBottom:12,border:"1px solid #e2e8f0"},
  treatHead:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8},
  table:{width:"100%",borderCollapse:"collapse",fontSize:12},
  th:{padding:"6px 8px",textAlign:"left",color:"#64748b",fontWeight:700,fontSize:11},
  td:{padding:"7px 8px",color:"#374151",verticalAlign:"middle"},
  treatFoot:{marginTop:8,fontSize:12,color:"#64748b",borderTop:"1px solid #e2e8f0",paddingTop:7},
  btnTerminer:{marginTop:8,padding:"5px 14px",background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600},
  acteCard:{background:"#fff",borderRadius:12,padding:"14px 17px",marginBottom:12,borderLeft:"4px solid #1e40af",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  acteCardHd:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  seanceRow:{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",background:"#f8fafc",borderRadius:6,marginBottom:3,fontSize:12},
  filterSel:{padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,marginBottom:16,outline:"none",background:"#fff"},
  pill:(bg,col)=>({background:bg,color:col,padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}),
  sBadge:{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600},
  itemCard:{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"14px",marginBottom:10},
  infoChip:{padding:"8px 12px",background:"#eff6ff",borderRadius:8,fontSize:12,color:"#1e40af"},
  modeRow:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"},
  modeBtn:{flex:1,padding:"10px",border:"2px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,minWidth:150},
  modeBtnOn:{borderColor:"#1e40af",background:"#eff6ff",color:"#1e40af"},
  btnBlue:{padding:"8px 16px",background:"#1e40af",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"},
  btnGray:{padding:"8px 16px",background:"#f1f5f9",color:"#374151",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:13},
  btnRed:{padding:"8px 14px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600},
  btnRedSm:{padding:"4px 8px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,flexShrink:0},
  btnEditSm:{padding:"4px 8px",background:"#eff6ff",color:"#1e40af",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,flexShrink:0},
  empty:{textAlign:"center",color:"#94a3b8",padding:"28px 0",fontSize:14},
  fGroup:{display:"flex",flexDirection:"column",gap:4,marginBottom:12,flex:1},
  formRow:{display:"flex",gap:12},
  fLabel:{fontSize:12,fontWeight:600,color:"#374151"},
  fInput:{padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",background:"#fff"},
  fTextarea:{padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",resize:"vertical",background:"#fff"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},
  modalBox:{background:"#fff",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.25)"},
  modalHd:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 13px",borderBottom:"1px solid #f1f5f9"},
  modalBd:{padding:"18px 20px",overflow:"auto"},
  mAct:{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16},
};
