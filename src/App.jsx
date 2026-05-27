import { useState, useEffect } from "react";

const PRATICIENS = ["Dr. Amin", "Dr. Bossioda"];

const TARIFS = {
  "Consultation":                  [500],
  "Extraction adulte":             [1500],
  "Extraction enfant":             [1000],
  "Extraction DDS":                [2500],
  "Chirurgie DDS":                 [12000],
  "Radio":                         [1000],
  "Soin":                          [5000],
  "Detartrage":                    [1000, 2000, 3000, 4000, 5000],
  "Couronne inox":                 [5000],
  "Couronne resine":               [6000],
  "CCM":                           [15000],
  "ZIR":                           [25000],
  "Prothese flexible unilaterale": [9000],
  "Prothese flexible partielle":   [20000, 28000, 36000, 42000],
  "Prothese totale":               [20000, 36000, 42000, 50000, 60000, 80000, 90000],
  "Prothese totale sup":           [10000, 18000, 21000, 25000, 30000, 40000, 45000],
  "Prothese totale inf":           [10000, 18000, 21000, 25000, 30000, 40000, 45000],
};

const STATUTS_RDV = ["Confirme", "En attente", "Present", "Absent", "Annule"];
const MODES_PAIEMENT = ["Especes", "Virement", "Cheque", "CCP", "Baridi Mob", "Dahabia"];

const fmt   = (n) => Number(n || 0).toLocaleString("fr-DZ") + " DA";
const today = () => new Date().toISOString().split("T")[0];
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function stLoad(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function stSave(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function App() {
  const [page,     setPage]     = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [actes,    setActes]    = useState([]);
  const [factures, setFactures] = useState([]);
  const [rdvs,     setRdvs]     = useState([]);
  const [ctx,      setCtx]      = useState(null);
  const [nav,      setNav]      = useState(false);

  useEffect(() => {
    const p = stLoad("cab_patients"); if (p) setPatients(p);
    const a = stLoad("cab_actes");    if (a) setActes(a);
    const f = stLoad("cab_factures"); if (f) setFactures(f);
    const r = stLoad("cab_rdvs");     if (r) setRdvs(r);
  }, []);

  const upP = (d) => { setPatients(d); stSave("cab_patients", d); };
  const upA = (d) => { setActes(d);    stSave("cab_actes",    d); };
  const upF = (d) => { setFactures(d); stSave("cab_factures", d); };
  const upR = (d) => { setRdvs(d);     stSave("cab_rdvs",     d); };

  const go = (p, c = null) => { setPage(p); if (c !== null) setCtx(c); setNav(false); };

  const TITLES = {
    dashboard:"Tableau de bord", patients:"Patients",
    "patient-detail": ctx ? ctx.nom + " " + ctx.prenom : "Patient",
    "nouveau-patient":"Nouveau Patient", "nouvel-acte":"Nouvel Acte",
    facturation:"Facturation", agenda:"Agenda", "nouveau-rdv":"Nouveau RDV",
  };

  const shared = { patients, actes, factures, rdvs, upP, upA, upF, upR, go, ctx };

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f0f4ff",overflow:"hidden"}}>
      {nav && <div onClick={()=>setNav(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:20}}/>}
      <Sidebar page={page} go={go} open={nav}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <header style={{background:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.08)",flexShrink:0}}>
          <button onClick={()=>setNav(true)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#1a3c5e"}}>☰</button>
          {page!=="dashboard"&&<button onClick={()=>go(page==="patient-detail"||page==="nouvel-acte"||page==="nouveau-patient"?"patients":page==="nouveau-rdv"?"agenda":"dashboard")} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#888"}}>←</button>}
          <h1 style={{margin:0,fontSize:17,fontWeight:700,color:"#1a3c5e"}}>{TITLES[page]||page}</h1>
        </header>
        <main style={{flex:1,overflowY:"auto",padding:16}}>
          {page==="dashboard"       && <Dashboard      {...shared}/>}
          {page==="patients"        && <PatientsList   {...shared}/>}
          {page==="patient-detail"  && <PatientDetail  {...shared}/>}
          {page==="nouveau-patient" && <NouveauPatient {...shared}/>}
          {page==="nouvel-acte"     && <NouvelActe     {...shared}/>}
          {page==="facturation"     && <Facturation    {...shared}/>}
          {page==="agenda"          && <Agenda         {...shared}/>}
          {page==="nouveau-rdv"     && <NouveauRdv     {...shared}/>}
        </main>
      </div>
    </div>
  );
}

function Sidebar({page,go,open}){
  const items=[{id:"dashboard",icon:"📊",label:"Tableau de bord"},{id:"patients",icon:"👥",label:"Patients"},{id:"agenda",icon:"📅",label:"Agenda"},{id:"facturation",icon:"💰",label:"Facturation"}];
  return(
    <aside style={{width:220,background:"linear-gradient(160deg,#0d2a4a 0%,#1a3c5e 100%)",color:"#fff",display:"flex",flexDirection:"column",flexShrink:0,position:open?"fixed":"static",left:0,top:0,bottom:0,zIndex:30,transition:"transform .25s",boxShadow:open?"4px 0 24px rgba(0,0,0,.3)":"none"}}>
      <div style={{padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,.12)"}}>
        <div style={{fontSize:24,fontWeight:800}}>🦷 Cabinet</div>
        <div style={{fontSize:11,color:"#7ab3d8",marginTop:4}}>Dr. Amin &amp; Dr. Bossioda</div>
      </div>
      <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:4}}>
        {items.map(it=>(
          <button key={it.id} onClick={()=>go(it.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",width:"100%",background:page===it.id?"rgba(255,255,255,.18)":"transparent",color:page===it.id?"#fff":"#9dc4e0",fontWeight:page===it.id?700:500,fontSize:14}}>
            <span style={{fontSize:18}}>{it.icon}</span>{it.label}
          </button>
        ))}
      </nav>
      <div style={{padding:"12px 10px 16px"}}>
        <button onClick={()=>go("nouveau-patient")} style={{width:"100%",background:"#22c55e",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,padding:"11px 0",cursor:"pointer"}}>➕ Nouveau patient</button>
      </div>
    </aside>
  );
}

function Dashboard({patients,factures,rdvs,go}){
  const tod=today();
  const rdvAuj=rdvs.filter(r=>r.date===tod);
  const caAuj=factures.filter(f=>f.date===tod).reduce((s,f)=>s+(f.montantPaye||0),0);
  const impayes=factures.reduce((s,f)=>s+(f.resteAPayer||0),0);
  const cards=[
    {label:"Patients",val:patients.length,icon:"👥",bg:"#1a3c5e",fn:()=>go("patients")},
    {label:"RDV aujourd'hui",val:rdvAuj.length,icon:"📅",bg:"#6d28d9",fn:()=>go("agenda")},
    {label:"CA aujourd'hui",val:fmt(caAuj),icon:"💵",bg:"#059669",fn:()=>go("facturation")},
    {label:"Impayes",val:fmt(impayes),icon:"⚠️",bg:"#dc2626",fn:()=>go("facturation")},
  ];
  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {cards.map((c,i)=>(
          <button key={i} onClick={c.fn} style={{background:"#fff",borderRadius:14,padding:"14px 12px",border:"none",cursor:"pointer",textAlign:"left",boxShadow:"0 2px 8px rgba(0,0,0,.07)"}}>
            <div style={{width:38,height:38,borderRadius:10,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:8}}>{c.icon}</div>
            <div style={{fontSize:20,fontWeight:800,color:"#1a3c5e"}}>{c.val}</div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{c.label}</div>
          </button>
        ))}
      </div>
      <Card title="📅 RDV du jour" action={{label:"+ RDV",fn:()=>go("nouveau-rdv")}}>
        {rdvAuj.length===0?<Empty>Aucun rendez-vous aujourd'hui</Empty>
          :rdvAuj.sort((a,b)=>a.heure.localeCompare(b.heure)).map(r=>{
            const p=patients.find(x=>x.id===r.patientId);
            return(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f0f0"}}>
                <span style={{fontFamily:"monospace",fontWeight:800,color:"#1a3c5e",minWidth:42,fontSize:14}}>{r.heure}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{p?p.nom+" "+p.prenom:"—"}</div>
                  <div style={{fontSize:11,color:"#9ca3af"}}>{r.motif} · {r.praticien}</div>
                </div>
                <Pill statut={r.statut}/>
              </div>
            );
          })}
      </Card>
      <div style={{marginTop:12}}>
        <Card title="👤 Patients recents" action={{label:"Voir tous",fn:()=>go("patients")}}>
          {[...patients].reverse().slice(0,5).map(p=>(
            <button key={p.id} onClick={()=>go("patient-detail",p)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:"none",border:"none",padding:"8px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer",textAlign:"left"}}>
              <Avatar name={p.nom}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>{p.nom} {p.prenom}</div>
                <div style={{fontSize:11,color:"#9ca3af"}}>{p.telephone||"Pas de telephone"}</div>
              </div>
              <span style={{color:"#9ca3af"}}>›</span>
            </button>
          ))}
          {patients.length===0&&<Empty>Aucun patient</Empty>}
        </Card>
      </div>
    </div>
  );
}

function PatientsList({patients,go}){
  const [q,setQ]=useState("");
  const filtered=patients.filter(p=>`${p.nom} ${p.prenom} ${p.telephone}`.toLowerCase().includes(q.toLowerCase()));
  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Nom ou telephone..." style={{flex:1,border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",background:"#fff"}}/>
        <Btn onClick={()=>go("nouveau-patient")} color="#1a3c5e">➕ Nouveau</Btn>
      </div>
      <div style={{fontSize:12,color:"#9ca3af",marginBottom:8}}>{filtered.length} patient(s)</div>
      {filtered.length===0?<Empty>{q?"Aucun patient trouve":"Aucun patient enregistre"}</Empty>
        :filtered.map(p=>(
          <button key={p.id} onClick={()=>go("patient-detail",p)} style={{display:"flex",alignItems:"center",gap:12,width:"100%",background:"#fff",border:"none",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,.07)",cursor:"pointer",textAlign:"left"}}>
            <Avatar name={p.nom} size={42}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:"#1a3c5e"}}>{p.nom} {p.prenom}</div>
              <div style={{fontSize:12,color:"#9ca3af"}}>{p.telephone||"Pas de telephone"}</div>
            </div>
            <span style={{color:"#9ca3af",fontSize:20}}>›</span>
          </button>
        ))}
    </div>
  );
}

function PatientDetail({patients,actes,factures,ctx,go}){
  const [tab,setTab]=useState("dossier");
  const patient=patients.find(p=>p.id===ctx?.id)||ctx;
  if(!patient) return <Empty>Patient introuvable</Empty>;
  const pA=actes.filter(a=>a.patientId===patient.id);
  const pF=factures.filter(f=>f.patientId===patient.id);
  const tPaye=pF.reduce((s,f)=>s+(f.montantPaye||0),0);
  const tReste=pF.reduce((s,f)=>s+(f.resteAPayer||0),0);
  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563eb)",borderRadius:16,padding:"18px 16px",marginBottom:12,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800}}>{patient.nom[0]}</div>
          <div>
            <div style={{fontSize:20,fontWeight:800}}>{patient.nom} {patient.prenom}</div>
            <div style={{fontSize:13,opacity:.8}}>{patient.telephone||"Pas de telephone"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{l:"Actes",v:pA.length,c:"#a5f3fc"},{l:"Paye",v:fmt(tPaye),c:"#86efac"},{l:"Reste",v:fmt(tReste),c:tReste>0?"#fca5a5":"#86efac"}].map((s,i)=>(
            <div key={i} style={{flex:1,background:"rgba(255,255,255,.13)",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.8}}>{s.l}</div>
              <div style={{fontSize:13,fontWeight:800,color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Btn onClick={()=>go("nouvel-acte",patient)} color="#1a3c5e" full>🦷 Acte</Btn>
        <Btn onClick={()=>go("facturation",patient)} color="#059669" full>💰 Facturer</Btn>
        <Btn onClick={()=>go("nouveau-rdv",patient)} color="#6d28d9" full>📅 RDV</Btn>
      </div>
      <div style={{display:"flex",background:"#e5e7eb",borderRadius:12,padding:4,marginBottom:12}}>
        {[{id:"dossier",label:"Dossier"},{id:"actes",label:"Actes ("+pA.length+")"},{id:"factures",label:"Factures ("+pF.length+")"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"8px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:tab===t.id?"#fff":"transparent",color:tab===t.id?"#1a3c5e":"#6b7280",boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.1)":"none"}}>{t.label}</button>
        ))}
      </div>
      {tab==="dossier"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {label:"Antecedents medicaux",key:"antecedents"},
            {label:"Traitements en cours",key:"traitements"},
            {label:"Allergies",key:"allergies"},
            {label:"Dents traitees",key:"dents"},
            {label:"Diagnostic dentaire",key:"diagnostic"},
            {label:"Traitement propose",key:"traitementPropose"},
            {label:"Etape du traitement",key:"etape"},
            {label:"Observations",key:"observations"},
          ].map((f,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:12,padding:"10px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:4}}>{f.label}</div>
              <div style={{fontSize:13,color:patient[f.key]?"#1a3c5e":"#d1d5db"}}>{patient[f.key]||"—"}</div>
            </div>
          ))}
        </div>
      )}
      {tab==="actes"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {pA.length===0?<Empty>Aucun acte enregistre</Empty>
            :[...pA].reverse().map(a=>(
              <div key={a.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:700,color:"#1a3c5e",fontSize:14}}>{a.typeActe}</div>
                    <div style={{fontSize:11,color:"#9ca3af"}}>{a.date} · {a.praticien}</div>
                    {a.dents&&<div style={{fontSize:12,color:"#4b5563",marginTop:3}}>Dent(s) : {a.dents}</div>}
                    {a.diagnostic&&<div style={{fontSize:12,color:"#4b5563"}}>Diag : {a.diagnostic}</div>}
                    {a.etape&&<div style={{fontSize:12,color:"#4b5563"}}>Etape : {a.etape}</div>}
                    {a.observations&&<div style={{fontSize:11,color:"#6b7280",marginTop:4,fontStyle:"italic"}}>{a.observations}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,color:"#059669",fontSize:14}}>{fmt(a.prix)}</div>
                    <div style={{fontSize:10,color:a.facturId?"#9ca3af":"#f59e0b",marginTop:2}}>{a.facturId?"Facture":"Non facture"}</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
      {tab==="factures"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {pF.length===0?<Empty>Aucune facture</Empty>
            :[...pF].reverse().map(f=>(
              <div key={f.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>{f.id}</div>
                    <div style={{fontSize:11,color:"#9ca3af"}}>{f.date} · {f.praticien}</div>
                  </div>
                  <Pill statut={f.statut}/>
                </div>
                <div style={{display:"flex",gap:12,fontSize:12}}>
                  <span>Total : <b>{fmt(f.montantNet)}</b></span>
                  <span style={{color:"#059669"}}>Paye : <b>{fmt(f.montantPaye)}</b></span>
                  {f.resteAPayer>0&&<span style={{color:"#dc2626"}}>Reste : <b>{fmt(f.resteAPayer)}</b></span>}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function NouveauPatient({patients,upP,go}){
  const [f,setF]=useState({nom:"",prenom:"",telephone:"",antecedents:"",traitements:"",allergies:"",dents:"",diagnostic:"",traitementPropose:"",etape:"",observations:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=()=>{
    if(!f.nom.trim()){alert("Le nom est obligatoire");return;}
    const p={id:uid(),...f,nom:f.nom.toUpperCase().trim(),prenom:f.prenom.trim(),dateCreation:today()};
    upP([...patients,p]);
    go("patient-detail",p);
  };
  return(
    <div style={{maxWidth:560,margin:"0 auto"}}>
      <Section title="Identite">
        <Field label="Nom *" value={f.nom} onChange={v=>set("nom",v)} placeholder="BENALI"/>
        <Field label="Prenom" value={f.prenom} onChange={v=>set("prenom",v)} placeholder="Mohamed"/>
        <Field label="Telephone" value={f.telephone} onChange={v=>set("telephone",v)} type="tel" placeholder="0555 000 000"/>
      </Section>
      <Section title="Antecedents medicaux">
        <Field label="Antecedents" value={f.antecedents} onChange={v=>set("antecedents",v)} multi placeholder="Diabete, HTA..."/>
        <Field label="Traitements en cours" value={f.traitements} onChange={v=>set("traitements",v)} multi placeholder="Medicaments..."/>
        <Field label="Allergies" value={f.allergies} onChange={v=>set("allergies",v)} multi placeholder="Penicilline, latex..."/>
      </Section>
      <Section title="Informations dentaires">
        <Field label="Dents traitees (numerotees)" value={f.dents} onChange={v=>set("dents",v)} placeholder="ex: 16, 26, 36"/>
        <Field label="Diagnostic dentaire" value={f.diagnostic} onChange={v=>set("diagnostic",v)} multi/>
        <Field label="Traitement propose" value={f.traitementPropose} onChange={v=>set("traitementPropose",v)} multi/>
        <Field label="Etape du traitement" value={f.etape} onChange={v=>set("etape",v)} placeholder="ex: Seance 1/3"/>
        <Field label="Observations" value={f.observations} onChange={v=>set("observations",v)} multi/>
      </Section>
      <Btn onClick={submit} color="#1a3c5e" full lg>Enregistrer le patient</Btn>
    </div>
  );
}

function NouvelActe({patients,actes,upA,ctx,go}){
  const first=Object.keys(TARIFS)[0];
  const [f,setF]=useState({patientId:ctx?.id||"",date:today(),praticien:PRATICIENS[0],typeActe:first,prix:TARIFS[first][0],dents:"",diagnostic:"",traitementPropose:"",etape:"",observations:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const onType=(t)=>{set("typeActe",t);set("prix",TARIFS[t][0]);};
  const submit=()=>{
    if(!f.patientId){alert("Selectionnez un patient");return;}
    upA([...actes,{id:uid(),...f,facturId:null}]);
    go("patient-detail",patients.find(p=>p.id===f.patientId));
  };
  const opts=TARIFS[f.typeActe]||[];
  return(
    <div style={{maxWidth:560,margin:"0 auto"}}>
      <Section title="Acte clinique">
        <Select label="Patient *" value={f.patientId} onChange={v=>set("patientId",v)} options={[{value:"",label:"Selectionner un patient..."},...patients.map(p=>({value:p.id,label:p.nom+" "+p.prenom}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="Date" value={f.date} onChange={v=>set("date",v)} type="date"/>
          <Select label="Praticien" value={f.praticien} onChange={v=>set("praticien",v)} options={PRATICIENS.map(p=>({value:p,label:p}))}/>
        </div>
        <Select label="Type d'acte *" value={f.typeActe} onChange={onType} options={Object.keys(TARIFS).map(t=>({value:t,label:t}))}/>
        <div>
          <label style={lbl}>Prix</label>
          {opts.length>1
            ?<select value={f.prix} onChange={e=>set("prix",Number(e.target.value))} style={inp}>{opts.map(p=><option key={p} value={p}>{p.toLocaleString()} DA</option>)}</select>
            :<div style={{...inp,background:"#f0fdf4",color:"#059669",fontWeight:700,display:"flex",alignItems:"center"}}>{fmt(f.prix)}</div>
          }
        </div>
        <Field label="Dent(s) concernee(s)" value={f.dents} onChange={v=>set("dents",v)} placeholder="ex: 16, 26"/>
        <Field label="Diagnostic" value={f.diagnostic} onChange={v=>set("diagnostic",v)} multi/>
        <Field label="Traitement propose" value={f.traitementPropose} onChange={v=>set("traitementPropose",v)} multi/>
        <Field label="Etape" value={f.etape} onChange={v=>set("etape",v)} placeholder="ex: Seance 2/3"/>
        <Field label="Observations" value={f.observations} onChange={v=>set("observations",v)} multi/>
      </Section>
      <Btn onClick={submit} color="#1a3c5e" full lg>Enregistrer l'acte</Btn>
    </div>
  );
}

function Facturation({patients,actes,factures,upA,upF,ctx,go}){
  const [mode,setMode]=useState("creer");
  const [patId,setPatId]=useState(ctx?.id||"");
  const [praticien,setPrat]=useState(PRATICIENS[0]);
  const [remise,setRemise]=useState(0);
  const [acompte,setAcomp]=useState(0);
  const [modePay,setModePay]=useState(MODES_PAIEMENT[0]);
  const [factId,setFactId]=useState("");
  const [payAjout,setPayAjout]=useState(0);
  const patient=patients.find(p=>p.id===patId);
  const nf=actes.filter(a=>a.patientId===patId&&!a.facturId);
  const tb=nf.reduce((s,a)=>s+(a.prix||0),0);
  const tn=Math.max(0,tb-remise);
  const re=Math.max(0,tn-acompte);
  const st=re<=0?"Solde":acompte>0?"Partiel":"Impaye";
  const creer=()=>{
    if(!patId){alert("Selectionnez un patient");return;}
    if(nf.length===0){alert("Aucun acte non facture");return;}
    const id="FAC-"+Date.now().toString().slice(-6);
    upF([...factures,{id,patientId:patId,date:today(),praticien,montantBrut:tb,remise,montantNet:tn,montantPaye:acompte,resteAPayer:re,modePaiement:modePay,statut:st}]);
    upA(actes.map(a=>a.patientId===patId&&!a.facturId?{...a,facturId:id}:a));
    alert("Facture "+id+" creee\nStatut: "+st+"\nReste: "+fmt(re));
    if(patient) go("patient-detail",patient);
  };
  const payer=()=>{
    const f=factures.find(x=>x.id===factId);
    if(!f){alert("Facture introuvable");return;}
    if(payAjout<=0){alert("Montant invalide");return;}
    const np=(f.montantPaye||0)+payAjout;
    const nr=Math.max(0,f.montantNet-np);
    upF(factures.map(x=>x.id===factId?{...x,montantPaye:np,resteAPayer:nr,statut:nr<=0?"Solde":"Partiel"}:x));
    alert("Paiement enregistre\nTotal paye: "+fmt(np)+"\nReste: "+fmt(nr));
    setFactId("");setPayAjout(0);
  };
  const impayes=factures.filter(f=>f.resteAPayer>0).map(f=>({...f,nom:(()=>{const p=patients.find(x=>x.id===f.patientId);return p?p.nom+" "+p.prenom:"?";})()}));
  return(
    <div style={{maxWidth:560,margin:"0 auto"}}>
      <div style={{display:"flex",background:"#e5e7eb",borderRadius:12,padding:4,marginBottom:12}}>
        {[{id:"creer",label:"Creer"},{id:"payer",label:"Paiement"},{id:"impayes",label:"Impayes"}].map(t=>(
          <button key={t.id} onClick={()=>setMode(t.id)} style={{flex:1,padding:"8px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:mode===t.id?"#fff":"transparent",color:mode===t.id?"#1a3c5e":"#6b7280",boxShadow:mode===t.id?"0 1px 4px rgba(0,0,0,.1)":"none"}}>{t.label}</button>
        ))}
      </div>
      {mode==="creer"&&(
        <Section title="Nouvelle Facture">
          <Select label="Patient *" value={patId} onChange={setPatId} options={[{value:"",label:"Selectionner..."},...patients.map(p=>({value:p.id,label:p.nom+" "+p.prenom}))]}/>
          {patId&&<>
            <Select label="Praticien" value={praticien} onChange={setPrat} options={PRATICIENS.map(p=>({value:p,label:p}))}/>
            {nf.length>0
              ?<div style={{background:"#f8fafc",borderRadius:10,padding:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:8}}>Actes a facturer ({nf.length})</div>
                  {nf.map(a=><div key={a.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span>{a.typeActe}{a.dents?" ("+a.dents+")":""}</span><b>{fmt(a.prix)}</b></div>)}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,borderTop:"1px solid #e5e7eb",paddingTop:8,marginTop:4}}><span>Total brut</span><span>{fmt(tb)}</span></div>
                </div>
              :<div style={{background:"#fff7ed",borderRadius:10,padding:10,fontSize:13,color:"#c2410c"}}>Tous les actes deja factures</div>
            }
            <Field label="Remise (DA)" value={remise} onChange={v=>setRemise(Number(v))} type="number"/>
            <Field label="Acompte aujourd'hui (DA)" value={acompte} onChange={v=>setAcomp(Number(v))} type="number"/>
            <Select label="Mode de paiement" value={modePay} onChange={setModePay} options={MODES_PAIEMENT.map(m=>({value:m,label:m}))}/>
            <div style={{background:"#f0fdf4",borderRadius:10,padding:12,fontSize:13}}>
              <Row l="Montant brut" r={fmt(tb)}/>
              {remise>0&&<Row l="Remise" r={"-"+fmt(remise)} color="#f59e0b"/>}
              <Row l="Net a payer" r={fmt(tn)} bold border/>
              <Row l="Paye" r={fmt(acompte)} color="#059669"/>
              <Row l="Reste" r={fmt(re)} color={re>0?"#dc2626":"#059669"} bold/>
              <div style={{textAlign:"center",marginTop:8}}><Pill statut={st}/></div>
            </div>
          </>}
          <Btn onClick={creer} color="#059669" full lg>Creer la facture</Btn>
        </Section>
      )}
      {mode==="payer"&&(
        <Section title="Enregistrer un paiement">
          <Select label="Facture impayee" value={factId} onChange={setFactId} options={[{value:"",label:"Selectionner..."},...factures.filter(f=>f.resteAPayer>0).map(f=>{const p=patients.find(x=>x.id===f.patientId);return{value:f.id,label:f.id+" — "+(p?p.nom+" "+p.prenom:"?")+" — "+fmt(f.resteAPayer)};})]}/> 
          {factId&&(()=>{const f=factures.find(x=>x.id===factId);return f?<div style={{background:"#fef2f2",borderRadius:10,padding:12,fontSize:13}}><Row l="Net a payer" r={fmt(f.montantNet)}/><Row l="Deja paye" r={fmt(f.montantPaye)} color="#059669"/><Row l="Reste" r={fmt(f.resteAPayer)} color="#dc2626" bold/></div>:null;})()}
          <Field label="Montant du paiement (DA)" value={payAjout} onChange={v=>setPayAjout(Number(v))} type="number"/>
          <Btn onClick={payer} color="#059669" full lg>Enregistrer</Btn>
        </Section>
      )}
      {mode==="impayes"&&(
        <Section title="Soldes impayes">
          {impayes.length===0?<div style={{textAlign:"center",color:"#059669",padding:16,fontWeight:700}}>Aucun impaye !</div>
            :<>
              <div style={{background:"#fef2f2",borderRadius:10,padding:10,textAlign:"center",fontWeight:800,color:"#dc2626",fontSize:15,marginBottom:8}}>Total : {fmt(impayes.reduce((s,f)=>s+f.resteAPayer,0))}</div>
              {impayes.map(f=><div key={f.id} style={{background:"#fff",borderRadius:10,padding:"10px 12px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}><div><div style={{fontWeight:700,fontSize:13}}>{f.nom}</div><div style={{fontSize:11,color:"#9ca3af"}}>{f.id} · {f.date}</div></div><div style={{fontWeight:800,color:"#dc2626",fontSize:14}}>{fmt(f.resteAPayer)}</div></div>)}
            </>
          }
        </Section>
      )}
    </div>
  );
}

function Agenda({patients,rdvs,upR,go}){
  const [date,setDate]=useState(today());
  const duJour=rdvs.filter(r=>r.date===date).sort((a,b)=>a.heure.localeCompare(b.heure));
  const updStatut=(id,s)=>upR(rdvs.map(r=>r.id===id?{...r,statut:s}:r));
  const del=(id)=>{if(window.confirm("Supprimer ce RDV ?")) upR(rdvs.filter(r=>r.id!==id));};
  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{flex:1,border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 14px",fontSize:14,background:"#fff",outline:"none"}}/>
        <Btn onClick={()=>go("nouveau-rdv")} color="#6d28d9">+ RDV</Btn>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:"#6b7280",marginBottom:8}}>{duJour.length} RDV · {new Date(date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
      {duJour.length===0?<Empty>Aucun rendez-vous ce jour</Empty>
        :duJour.map(r=>{
          const p=patients.find(x=>x.id===r.patientId);
          return(
            <div key={r.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{textAlign:"center",minWidth:46}}>
                  <div style={{fontSize:17,fontWeight:800,color:"#1a3c5e",fontFamily:"monospace"}}>{r.heure}</div>
                  <div style={{fontSize:10,color:"#9ca3af"}}>{r.duree}min</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:"#1a3c5e"}}>{p?p.nom+" "+p.prenom:"Patient inconnu"}</div>
                  <div style={{fontSize:12,color:"#6b7280"}}>{r.motif}</div>
                  <div style={{fontSize:11,color:"#9ca3af"}}>{r.praticien}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                  <select value={r.statut} onChange={e=>updStatut(r.id,e.target.value)} style={{border:"none",borderRadius:20,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",background:r.statut==="Present"?"#dcfce7":r.statut==="Absent"?"#fee2e2":r.statut==="Annule"?"#f3f4f6":"#dbeafe",color:r.statut==="Present"?"#15803d":r.statut==="Absent"?"#b91c1c":r.statut==="Annule"?"#4b5563":"#1d4ed8"}}>
                    {STATUTS_RDV.map(s=><option key={s}>{s}</option>)}
                  </select>
                  <button onClick={()=>del(r.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#fca5a5"}}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function NouveauRdv({patients,rdvs,upR,ctx,go}){
  const [f,setF]=useState({patientId:ctx?.id||"",date:today(),heure:"09:00",duree:30,motif:"",praticien:PRATICIENS[0],statut:"Confirme",notes:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=()=>{
    if(!f.patientId){alert("Selectionnez un patient");return;}
    if(!f.motif.trim()){alert("Le motif est obligatoire");return;}
    upR([...rdvs,{id:uid(),...f}]);
    go("agenda");
  };
  return(
    <div style={{maxWidth:560,margin:"0 auto"}}>
      <Section title="Nouveau Rendez-vous">
        <Select label="Patient *" value={f.patientId} onChange={v=>set("patientId",v)} options={[{value:"",label:"Selectionner un patient..."},...patients.map(p=>({value:p.id,label:p.nom+" "+p.prenom}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="Date" value={f.date} onChange={v=>set("date",v)} type="date"/>
          <Field label="Heure" value={f.heure} onChange={v=>set("heure",v)} type="time"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Select label="Duree" value={f.duree} onChange={v=>set("duree",Number(v))} options={[15,20,30,45,60,90].map(d=>({value:d,label:d+" min"}))}/>
          <Select label="Praticien" value={f.praticien} onChange={v=>set("praticien",v)} options={PRATICIENS.map(p=>({value:p,label:p}))}/>
        </div>
        <Field label="Motif *" value={f.motif} onChange={v=>set("motif",v)} placeholder="Ex: Composite 16, Extraction..."/>
        <Field label="Notes" value={f.notes} onChange={v=>set("notes",v)} multi/>
      </Section>
      <Btn onClick={submit} color="#6d28d9" full lg>Enregistrer le RDV</Btn>
    </div>
  );
}

function Section({title,children}){
  return(
    <div style={{background:"#fff",borderRadius:14,padding:"14px 14px 10px",boxShadow:"0 1px 4px rgba(0,0,0,.07)",marginBottom:12}}>
      {title&&<div style={{fontWeight:700,fontSize:13,color:"#1a3c5e",borderBottom:"1px solid #f0f0f0",paddingBottom:8,marginBottom:12}}>{title}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>{children}</div>
    </div>
  );
}

const lbl={display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4};
const inp={width:"100%",border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 12px",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff"};

function Field({label,value,onChange,type="text",multi,placeholder}){
  return(
    <div>
      <label style={lbl}>{label}</label>
      {multi
        ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={2} style={{...inp,resize:"vertical"}}/>
        :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={inp}/>
      }
    </div>
  );
}

function Select({label,value,onChange,options}){
  return(
    <div>
      {label&&<label style={lbl}>{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)} style={inp}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Btn({onClick,color="#1a3c5e",full,lg,children}){
  return(
    <button onClick={onClick} style={{background:color,color:"#fff",border:"none",borderRadius:10,cursor:"pointer",padding:lg?"13px 16px":"9px 14px",fontSize:lg?15:13,fontWeight:700,width:full?"100%":"auto",boxShadow:"0 2px 8px "+color+"55",marginTop:lg?4:0}}>{children}</button>
  );
}

function Avatar({name,size=36}){
  const colors=["#1a3c5e","#059669","#6d28d9","#dc2626","#d97706"];
  const bg=colors[name.charCodeAt(0)%colors.length];
  return <div style={{width:size,height:size,minWidth:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:size*.4}}>{name[0]}</div>;
}

function Pill({statut}){
  const map={"Solde":{bg:"#dcfce7",c:"#15803d"},"Partiel":{bg:"#ffedd5",c:"#c2410c"},"Impaye":{bg:"#fee2e2",c:"#b91c1c"},"Present":{bg:"#dcfce7",c:"#15803d"},"Absent":{bg:"#fee2e2",c:"#b91c1c"},"Annule":{bg:"#f3f4f6",c:"#6b7280"},"Confirme":{bg:"#dbeafe",c:"#1d4ed8"},"En attente":{bg:"#fef9c3",c:"#a16207"}};
  const s=map[statut]||{bg:"#f3f4f6",c:"#6b7280"};
  return <span style={{background:s.bg,color:s.c,fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20}}>{statut}</span>;
}

function Row({l,r,color,bold,border}){
  return <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:bold?800:400,color:color||"#1a3c5e",borderTop:border?"1px solid #d1fae5":undefined,paddingTop:border?6:0,marginTop:border?4:0}}><span>{l}</span><span>{r}</span></div>;
}

function Card({title,action,children}){
  return(
    <div style={{background:"#fff",borderRadius:14,padding:"14px 14px 10px",boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1a3c5e"}}>{title}</div>
        {action&&<button onClick={action.fn} style={{background:"none",border:"none",color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer"}}>{action.label}</button>}
      </div>
      {children}
    </div>
  );
}

function Empty({children}){
  return <div style={{background:"#fff",borderRadius:12,padding:32,textAlign:"center",color:"#9ca3af",fontSize:14}}>{children}</div>;
}
