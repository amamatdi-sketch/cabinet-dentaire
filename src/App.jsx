import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-io'; // Remplacez par votre import exact si besoin

// Configuration Supabase (remplacée automatiquement par vos variables ou à durcir)
const SUPABASE_URL = "https://jeidktusskhegocpppw.supabase.co";
const SUPABASE_KEY = "VOTRE_CLE_ANON_SUPABASE"; // Pensez à remettre votre clé anon ici
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARIFS = {
  "Consultation": 500,
  "Extraction adulte": 1500,
  "Extraction enfant": 1000,
  "Extraction DDS": 2500,
  "Chirurgie DDS": 12000,
  "Radio": 1000,
  "Soin": 5000,
  "Détartrage": 2000, // Prix moyen modifiable
  "Couronne inox": 5000,
  "Couronne résine": 6000,
  "CCM": 15000,
  "ZIR": 25000,
  "Prothèse flexible unilatérale": 9000,
  "Prothèse flexible partielle": 20000,
  "Prothèse totale": 36000
};

export default function App() {
  // Gestion des rôles : 'praticien' ou 'assistante'
  const [role, setRole] = useState('praticien'); 
  const [currentTab, setCurrentTab] = useState('patients');
  
  const [patients, setPatients] = useState([]);
  const [actes, setActes] = useState([]);
  const [factures, setFactures] = useState([]);
  
  // États de recherche et sélection
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Formulaires
  const [patientForm, setPatientForm] = useState({ id: '', nom: '', prenom: '', telephone: '', antecedents: '', traitements: '', allergies: '' });
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  
  // Panier d'actes pour la séance en cours
  const [seanceActes, setSeanceActes] = useState([]);
  const [selectedActeIdPourPoursuite, setSelectedActeIdPourPoursuite] = useState('');
  const [noteSeance, setNoteSeance] = useState('');
  const [versementSeance, setVersementSeance] = useState(0);

  useEffect(() => {
    fetchData();
    // Synchro Realtime Supabase
    const sysPatients = supabase.channel('table-db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchData()).subscribe();
    const sysActes = supabase.channel('table-db-changes2').on('postgres_changes', { event: '*', schema: 'public', table: 'actes' }, () => fetchData()).subscribe();
    const sysFactures = supabase.channel('table-db-changes3').on('postgres_changes', { event: '*', schema: 'public', table: 'factures' }, () => fetchData()).subscribe();
    return () => {
      supabase.removeChannel(sysPatients);
      supabase.removeChannel(sysActes);
      supabase.removeChannel(sysFactures);
    };
  }, []);

  const fetchData = async () => {
    const p = await supabase.from('patients').select('*').order('nom');
    const a = await supabase.from('actes').select('*').order('date', { ascending: false });
    const f = await supabase.from('factures').select('*').order('date', { ascending: false });
    if(p.data) setPatients(p.data);
    if(a.data) setActes(a.data);
    if(f.data) setFactures(f.data);
  };

  // --- ACTIONS PATIENTS ---
  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (isEditingPatient) {
      await supabase.from('patients').update({
        nom: patientForm.nom, prenom: patientForm.prenom, telephone: patientForm.telephone,
        antecedents: patientForm.antecedents, traitements: patientForm.traitements, allergies: patientForm.allergies
      }).eq('id', patientForm.id);
    } else {
      const newId = crypto.randomUUID();
      await supabase.from('patients').insert([{ ...patientForm, id: newId, dateCreation: new Date().toLocaleDateString() }]);
    }
    setPatientForm({ id: '', nom: '', prenom: '', telephone: '', antecedents: '', traitements: '', allergies: '' });
    setIsEditingPatient(false);
    fetchData();
  };

  const handleDeletePatient = async (id) => {
    if(window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce patient, ses actes et ses factures ?")) {
      await supabase.from('actes').delete().eq('patientId', id);
      await supabase.from('factures').delete().eq('patientId', id);
      await supabase.from('patients').delete().eq('id', id);
      setSelectedPatient(null);
      fetchData();
    }
  };

  // --- AJOUT LIGNE ACTE (PANIER) ---
  const ajouterActeAuPanier = (typeActe) => {
    const prixU = TARIFS[typeActe] || 0;
    const nouvelActe = {
      id: crypto.randomUUID(),
      typeActe,
      prixUnit: prixU,
      quantite: 1,
      dents: '',
      statut_acte: 'En cours'
    };
    setSeanceActes([...seanceActes, nouvelActe]);
  };

  const updatePanierItem = (id, field, value) => {
    setSeanceActes(seanceActes.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // --- VALIDER TOUTE LA SÉANCE (PRATICIEN) ---
  const validerSeance = async () => {
    if (!selectedPatient) return;

    let totalSeance = 0;

    // 1. Cas d'un nouveau traitement ou traitement combiné
    if (seanceActes.length > 0) {
      for (let item of seanceActes) {
        const montantTotalActe = item.prixUnit * item.quantite;
        totalSeance += montantTotalActe;

        await supabase.from('actes').insert([{
          id: item.id,
          patientId: selectedPatient.id,
          date: new Date().toLocaleDateString(),
          praticien: 'Dr Amin/Bossioda',
          typeActe: item.typeActe,
          prix: montantTotalActe,
          quantite: item.quantite,
          dents: item.dents,
          observations: noteSeance,
          statut_acte: item.statut_acte,
          versement: versementSeance, // Le versement s'applique au total clinique
          reste_a_payer: montantTotalActe - versementSeance
        }]);
      }
    } 
    // 2. Cas de la poursuite d'un acte existant
    else if (selectedActeIdPourPoursuite) {
      const acteParent = actes.find(a => a.id === selectedActeIdPourPoursuite);
      const historiquePrecedent = actes.filter(a => a.parent_acte_id === acteParent.id || a.id === acteParent.id);
      
      // Calcul du reste réel avant cette séance
      const totalPayeAssocie = historiquePrecedent.reduce((acc, curr) => acc + (curr.versement || 0), 0);
      const restePrec = acteParent.prix - totalPayeAssocie;

      const nouveauReste = restePrec - versementSeance;

      await supabase.from('actes').insert([{
        id: crypto.randomUUID(),
        patientId: selectedPatient.id,
        date: new Date().toLocaleDateString(),
        praticien: 'Dr Amin/Bossioda',
        typeActe: `Suivi: ${acteParent.typeActe}`,
        prix: acteParent.prix,
        parent_acte_id: acteParent.id,
        dents: acteParent.dents,
        observations: noteSeance,
        versement: versementSeance,
        reste_a_payer: nouveauReste,
        statut_acte: nouveauReste <= 0 ? 'Terminé' : 'En cours'
      }]);

      // Mettre à jour le statut du parent si terminé
      if (nouveauReste <= 0) {
        await supabase.from('actes').update({ statut_acte: 'Terminé' }).eq('id', acteParent.id);
      }
    }

    // Réinitialisation
    setSeanceActes([]);
    setSelectedActeIdPourPoursuite('');
    setNoteSeance('');
    setVersementSeance(0);
    fetchData();
  };

  const handleDeleteActe = async (id) => {
    if(window.confirm("Supprimer cet acte ?")) {
      await supabase.from('actes').delete().eq('id', id);
      fetchData();
    }
  };

  // --- FILTRAGE PATIENTS ---
  const filteredPatients = patients.filter(p => 
    `${p.nom} ${p.prenom} ${p.telephone}`.toLowerCase().includes(search.toLowerCase())
  );

  // Actes en cours du patient sélectionné (pour pouvoir les poursuivre)
  const actesEnCoursDuPatient = selectedPatient 
    ? actes.filter(a => a.patientId === selectedPatient.id && a.statut_acte === 'En cours' && !a.parent_acte_id)
    : [];

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Navbar Rapide Rôles */}
      <header className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">🦷 Cabinet Dentaire — Gestion Simplifiée</h1>
        <div className="flex gap-2 bg-blue-800 p-1 rounded">
          <button onClick={() => setRole('praticien')} className={`px-3 py-1 rounded text-xs font-bold transition ${role === 'praticien' ? 'bg-white text-blue-950 shadow' : 'text-gray-300'}`}>👨‍⚕️ Praticien</button>
          <button onClick={() => setRole('assistante')} className={`px-3 py-1 rounded text-xs font-bold transition ${role === 'assistante' ? 'bg-white text-blue-950 shadow' : 'text-gray-300'}`}>👩‍💼 Assistante</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLONNE DE GAUCHE : RECHERCHE & LISTE PATIENTS */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-3">👥 Patients</h2>
          <input 
            type="text" 
            placeholder="🔍 Rechercher nom, prénom, tél..." 
            className="w-full p-2 border border-gray-300 rounded-lg mb-4 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Formulaire d'ajout rapide (Praticien & Assistante autorisés pour le Tél) */}
          <form onSubmit={handleSavePatient} className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-bold text-blue-900 mb-2">{isEditingPatient ? "✏️ Modifier le Patient" : "➕ Nouveau Patient"}</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="text" placeholder="Nom" required disabled={role === 'assistante' && isEditingPatient} className="p-2 border border-gray-300 rounded text-sm bg-white" value={patientForm.nom} onChange={e => setPatientForm({...patientForm, nom: e.target.value})}/>
              <input type="text" placeholder="Prénom" required disabled={role === 'assistante' && isEditingPatient} className="p-2 border border-gray-300 rounded text-sm bg-white" value={patientForm.prenom} onChange={e => setPatientForm({...patientForm, prenom: e.target.value})}/>
            </div>
            <input type="text" placeholder="N° Téléphone" className="w-full p-2 border border-gray-300 rounded text-sm mb-2" value={patientForm.telephone} onChange={e => setPatientForm({...patientForm, telephone: e.target.value})}/>
            
            {role === 'praticien' && (
              <>
                <input type="text" placeholder="Antécédents médicaux" className="w-full p-2 border border-gray-300 rounded text-sm mb-2" value={patientForm.antecedents} onChange={e => setPatientForm({...patientForm, antecedents: e.target.value})}/>
                <input type="text" placeholder="Allergies (Ex: Pénicilline)" className="w-full p-2 border border-gray-300 rounded text-sm mb-2" value={patientForm.allergies} onChange={e => setPatientForm({...patientForm, allergies: e.target.value})}/>
              </>
            )}

            <div className="flex gap-2">
              <button type="submit" className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded shadow hover:bg-blue-700">Enregistrer</button>
              {isEditingPatient && <button type="button" onClick={() => { setIsEditingPatient(false); setPatientForm({ id: '', nom: '', prenom: '', telephone: '', antecedents: '', traitements: '', allergies: '' }); }} className="bg-gray-400 text-white text-xs px-2 rounded">Annuler</button>}
            </div>
          </form>

          {/* Liste des patients */}
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {filteredPatients.map(p => (
              <div 
                key={p.id} 
                onClick={() => { setSelectedPatient(p); setSeanceActes([]); }}
                className={`p-3 cursor-pointer transition flex justify-between items-center ${selectedPatient?.id === p.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}
              >
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{p.nom.toUpperCase()} {p.prenom}</h4>
                  <p className="text-xs text-gray-500">{p.telephone || '🚫 Pas de téléphone'}</p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setPatientForm(p); setIsEditingPatient(true); }} className="text-gray-500 hover:text-blue-600 text-sm px-1">✏️</button>
                  {role === 'praticien' && (
                    <button onClick={() => handleDeletePatient(p.id)} className="text-gray-400 hover:text-red-600 text-sm px-1">🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLONNE CENTRALE & DROITE : CLINIQUE & SUIVI FINANCIER */}
        <div className="md:col-span-2 space-y-6">
          {selectedPatient ? (
            <>
              {/* FICHE DOSSIER UNIQUE DU PATIENT SELECTIONNE */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-800 rounded-full">Dossier Actif</span>
                    <h2 className="text-2xl font-black text-gray-900 mt-1">{selectedPatient.nom.toUpperCase()} {selectedPatient.prenom}</h2>
                    <p className="text-sm text-gray-600">📱 Tél: {selectedPatient.telephone || 'Non renseigné'}</p>
                  </div>
                  <div className="text-right bg-red-50 p-2 rounded-lg border border-red-100">
                    <p className="text-xs text-red-700 font-bold">Reste Global Dû</p>
                    <p className="text-lg font-black text-red-600">
                      {actes.filter(a => a.patientId === selectedPatient.id).reduce((acc, curr) => acc + (curr.reste_a_payer || 0), 0)} DA
                    </p>
                  </div>
                </div>

                {/* Bloc Santé */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50/60 border border-amber-100 rounded-lg text-sm mb-4">
                  <div>⚠️ <span className="font-bold text-amber-900">Antécédents :</span> {selectedPatient.antecedents || 'Néant'}</div>
                  <div>❌ <span className="font-bold text-red-900">Allergies :</span> <span className="text-red-700 font-bold">{selectedPatient.allergies || 'Aucune connue'}</span></div>
                </div>

                <hr className="my-4"/>

                {/* ESPACE PRATICIEN : INSERTION DES SOINS & SÉANCES */}
                {role === 'praticien' ? (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="text-sm font-black text-gray-800 mb-3 uppercase tracking-wider">🛠️ Nouvelle intervention clinique</h3>
                    
                    {/* Choix 1 : Commencer de nouveaux actes */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1">1. Ajouter un ou plusieurs actes à la séance :</label>
                      <select 
                        onChange={(e) => { if(e.target.value) ajouterActeAuPanier(e.target.value); e.target.value = ''; }}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm"
                      >
                        <option value="">-- Sélectionner l'acte à ajouter --</option>
                        {Object.keys(TARIFS).map(name => (
                          <option key={name} value={name}>{name} ({TARIFS[name]} DA)</option>
                        ))}
                      </select>
                    </div>

                    {/* Affichage du panier d'actes en cours de sélection */}
                    {seanceActes.length > 0 && (
                      <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 space-y-2">
                        <p className="text-xs font-bold text-blue-900">Actes combinés programmés :</p>
                        {seanceActes.map(item => (
                          <div key={item.id} className="flex flex-wrap gap-2 items-center justify-between text-xs bg-gray-50 p-2 rounded">
                            <span className="font-bold text-gray-800">{item.typeActe}</span>
                            <div className="flex gap-2 items-center">
                              <input type="text" placeholder="Dents" className="w-12 p-1 border border-gray-300 rounded text-center" value={item.dents} onChange={e => updatePanierItem(item.id, 'dents', e.target.value)}/>
                              <label>Qté:</label>
                              <input type="number" min="1" className="w-10 p-1 border border-gray-300 rounded text-center" value={item.quantite} onChange={e => updatePanierItem(item.id, 'quantite', parseInt(e.target.value) || 1)}/>
                              <span className="font-black text-blue-700">{item.prixUnit * item.quantite} DA</span>
                              <button onClick={() => setSeanceActes(seanceActes.filter(x => x.id !== item.id))} className="text-red-500 font-bold ml-1">✖</button>
                            </div>
                          </div>
                        ))}
                        <div className="text-right text-xs font-black text-gray-700">Total actes : {seanceActes.reduce((acc, c) => acc + (c.prixUnit * c.quantite), 0)} DA</div>
                      </div>
                    )}

                    {/* Choix 2 : Continuer un acte existant */}
                    {actesEnCoursDuPatient.length > 0 && seanceActes.length === 0 && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <label className="block text-xs font-bold text-blue-900 mb-1">OU : Poursuivre un traitement multi-séance en cours</label>
                        <select 
                          className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm"
                          value={selectedActeIdPourPoursuite}
                          onChange={e => setSelectedActeIdPourPoursuite(e.target.value)}
                        >
                          <option value="">-- Choisir le soin à continuer --</option>
                          {actesEnCoursDuPatient.map(act => {
                            const hist = actes.filter(a => a.parent_acte_id === act.id || a.id === act.id);
                            const totalPaye = hist.reduce((acc, curr) => acc + (curr.versement || 0), 0);
                            const reste = act.prix - totalPaye;
                            return (
                              <option key={act.id} value={act.id}>
                                {act.typeActe} (Dent {act.dents || '?'}) — Reste à payer : {reste} DA
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Bloc Observations & Règlement Séance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Observations / Étape clinique</label>
                        <textarea 
                          placeholder="Ex: Pose du pansement, limage..." 
                          className="w-full p-2 border border-gray-300 rounded text-xs bg-white h-16"
                          value={noteSeance}
                          onChange={e => setNoteSeance(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Versement immédiat du Patient (DA)</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border border-gray-300 rounded text-sm bg-white font-bold text-green-700"
                          value={versementSeance}
                          onChange={e => setVersementSeance(parseInt(e.target.value) || 0)}
                        />
                        <button 
                          onClick={validerSeance}
                          disabled={seanceActes.length === 0 && !selectedActeIdPourPoursuite}
                          className="w-full mt-2 bg-green-600 text-white font-bold py-2 rounded shadow hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-xs uppercase"
                        >
                          💾 Enregistrer la Séance
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // VISION COMPTE ASSISTANTE : FACTURATION UNIQUEMENT
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-black text-blue-950 mb-2">💵 Mode Encaissement Assistante</h3>
                    <p className="text-xs text-gray-600 mb-3">Sélectionnez une séance ou un acte en cours dans l'historique ci-dessous pour ajouter un versement complémentaire.</p>
                  </div>
                )}

                {/* FIL D'ACTUALITÉ CHRONOLOGIQUE (HISTORIQUE) */}
                <div className="mt-6">
                  <h3 className="text-sm font-black text-gray-800 mb-3 uppercase tracking-wider">📜 Historique Clinique & Financier</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {actes.filter(a => a.patientId === selectedPatient.id).length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Aucun acte enregistré pour le moment.</p>
                    ) : (
                      actes.filter(a => a.patientId === selectedPatient.id).map(act => (
                        <div key={act.id} className={`p-3 rounded-lg border text-xs transition ${act.parent_acte_id ? 'bg-gray-50 border-gray-200 ml-6' : 'bg-white border-gray-300'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <div>
                              <span className="text-gray-400 font-mono mr-2">{act.date}</span>
                              <span className="font-bold text-gray-900 text-sm">{act.typeActe}</span>
                              {act.dents && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-700 font-bold rounded">D: {act.dents}</span>}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${act.statut_acte === 'Terminé' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {act.statut_acte}
                            </span>
                          </div>

                          {act.observations && (
                            <p className="text-gray-600 italic bg-gray-100 p-1.5 rounded my-1">Note : {act.observations}</p>
                          )}

                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-gray-200 text-gray-700">
                            <div>
                              {!act.parent_acte_id && <span>Prix Total Acte : <strong>{act.prix} DA</strong> | </span>}
                              <span>Versé à cette séance : <strong className="text-green-700">+{act.versement || 0} DA</strong></span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black">Reste dû : <span className={act.reste_a_payer > 0 ? 'text-red-600' : 'text-green-600'}>{act.reste_a_payer || 0} DA</span></span>
                              
                              {/* L'assistante peut aussi encaisser directement un reliquat */}
                              {role === 'assistante' && act.reste_a_payer > 0 && (
                                <button 
                                  onClick={async () => {
                                    const mt = parseInt(window.prompt(`Entrez le montant versé par le patient pour cet acte (Reste max: ${act.reste_a_payer} DA) :`));
                                    if(mt > 0) {
                                      const nvReste = act.reste_a_payer - mt;
                                      await supabase.from('actes').update({ versement: (act.versement || 0) + mt, reste_a_payer: nvReste, statut_acte: nvReste <= 0 ? 'Terminé' : 'En cours' }).eq('id', act.id);
                                      fetchData();
                                    }
                                  }} 
                                  className="bg-blue-600 text-white font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-700 shadow"
                                >
                                  💰 Encaisser
                                </button>
                              )}

                              {role === 'praticien' && (
                                <button onClick={() => handleDeleteActe(act.id)} className="text-gray-400 hover:text-red-600 text-sm">🗑️</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200 text-gray-400">
              🗂️ Sélectionnez un patient dans la colonne de gauche pour afficher son dossier complet, gérer ses soins multi-séances et suivre sa facturation.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
