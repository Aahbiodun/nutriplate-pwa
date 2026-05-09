// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, Utensils, Plus, ChevronLeft, ChevronRight, 
  Trash2, Loader2, BarChart3, AlertTriangle, X, Edit2, Target 
} from 'lucide-react';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, 
  deleteDoc, enableIndexedDbPersistence 
} from 'firebase/firestore';

// --- Firebase Config ---
const customFirebaseConfig = {
  apiKey: 'AIzaSyDvjWr4zwwbLCaKB0HA8lrJpf_dccx2DPY',
  authDomain: 'food-log-abc32.firebaseapp.com',
  projectId: 'food-log-abc32',
  storageBucket: 'food-log-abc32.firebasestorage.app',
  messagingSenderId: '575042025031',
  appId: '1:575042025031:web:f11b840bb418c3218da362',
  measurementId: 'G-BEDGMLCDT8',
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : customFirebaseConfig;

// Initialize Firebase
let app, auth, db;
if (Object.keys(firebaseConfig).length > 0) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);

  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      console.warn("Persistence failed:", err.code);
    });
  }
}

// --- THE PERMANENT DATA LINK ---
const appId = 'nutriplate_aahbiodun_stable'; 
const MY_PERMANENT_UID = '5D3QzaJfLERycrkJkcOXs9LfFXU2'; 

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data States
  const [foods, setFoods] = useState([]);
  const [plates, setPlates] = useState([]); 
  const [logs, setLogs] = useState([]);
  
  // Goal States
  const [calorieTarget, setCalorieTarget] = useState(2500); // Default Target
  const [showTargetModal, setShowTargetModal] = useState(false);
  
  // Modal States
  const [showAddFood, setShowAddFood] = useState(false);
  const [editingFood, setEditingFood] = useState(null); 
  const [showAddPlate, setShowAddPlate] = useState(false); 
  const [showAddLog, setShowAddLog] = useState(false);

  // Logging States
  const [isCombo, setIsCombo] = useState(false);
  const [scaleWeight, setScaleWeight] = useState(''); 
  const [selectedPlate, setSelectedPlate] = useState(''); 
  const [singleFoodId, setSingleFoodId] = useState('');
  const [comboItems, setComboItems] = useState([{ foodId: '', percentage: '' }, { foodId: '', percentage: '' }]);

  useEffect(() => {
    if (!auth) return;
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) { 
        setUser(u); 
      } else {
        try { 
          const cred = await signInAnonymously(auth); 
          setUser(cred.user);
        } catch (e) { 
          console.error("Auth error:", e); 
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    const userPath = `artifacts/${appId}/users/${MY_PERMANENT_UID}`;
    
    const unsubFoods = onSnapshot(collection(db, `${userPath}/foods`), (s) => {
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubPlates = onSnapshot(collection(db, `${userPath}/plates`), (s) => {
      setPlates(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubLogs = onSnapshot(collection(db, `${userPath}/logs`), (s) => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    // Sync Goals
    const unsubSettings = onSnapshot(doc(db, `${userPath}/settings/goals`), (d) => {
      if (d.exists() && d.data().calorieTarget) {
        setCalorieTarget(d.data().calorieTarget);
      }
    });
    
    return () => { unsubFoods(); unsubPlates(); unsubLogs(); unsubSettings(); };
  }, [user, db]);

  const getNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { c: 0, p: 0 };
    return { 
        c: (grams / 100) * (f.caloriesPer100g || 0), 
        p: (grams / 100) * (f.proteinPer100g || 0) 
    };
  };

  const dayLogs = useMemo(() => logs.filter(l => l.date === currentDate), [logs, currentDate]);
  
  const totals = useMemo(() => dayLogs.reduce((acc, log) => {
    const n = getNutrients(log.foodId, log.amountGrams);
    return { c: acc.c + n.c, p: acc.p + n.p };
  }, { c: 0, p: 0 }), [dayLogs, foods]);

  const remainingCals = calorieTarget - Math.round(totals.c);

  if (Object.keys(firebaseConfig).length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-10 text-center bg-slate-900 text-white">
        <div>
          <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
          <h2 className="text-xl font-bold">Config Missing</h2>
          <p className="opacity-70">Please paste your Firebase keys into the code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none select-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative overflow-hidden">
        
        {/* Header Dashboard */}
        <div className="bg-emerald-600 text-white p-6 pt-10 rounded-b-[2.5rem] shrink-0 shadow-lg z-10">
          <div className="flex justify-between items-center mb-6">
             <button onClick={() => {
               const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().split('T')[0]);
             }}><ChevronLeft/></button>
             
             {/* Date & Target Settings Button */}
             <div 
               onClick={() => setShowTargetModal(true)} 
               className="flex items-center gap-2 cursor-pointer hover:bg-emerald-500/50 px-3 py-1.5 rounded-full transition-colors"
             >
                <span className="font-bold text-xs uppercase tracking-widest">{currentDate}</span>
                <Target size={14} className="text-emerald-200" />
             </div>

             <button onClick={() => {
               const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().split('T')[0]);
             }}><ChevronRight/></button>
          </div>
          
          <div className="text-center">
            {/* Calories / Target */}
            <div className="flex justify-center items-baseline gap-1">
              <span className="text-6xl font-black">{Math.round(totals.c)}</span>
              <span className="text-2xl font-bold text-emerald-200 opacity-80">/{calorieTarget}</span>
            </div>
            
            {/* Badges: Protein & Remaining Balance */}
            <div className="mt-4 flex justify-center gap-2">
              <div className="bg-emerald-700/40 px-4 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/30 shadow-sm">
                {Math.round(totals.p)}g Protein
              </div>
              <div className={`px-4 py-1.5 rounded-xl text-xs font-bold border shadow-sm transition-colors ${
                remainingCals >= 0 
                  ? 'bg-emerald-700/40 border-emerald-500/30 text-white' 
                  : 'bg-red-500/90 border-red-400 text-white shadow-red-500/30'
              }`}>
                {Math.abs(remainingCals)} kcal {remainingCals >= 0 ? 'Left' : 'Over'}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {isLoading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-600"/></div>}
          
          {activeTab === 'log' && (
            <div className="p-6 space-y-3 pb-32">
                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">History</h3>
                {dayLogs.length === 0 && !isLoading && (
                   <div className="text-center p-6 text-slate-400 text-sm">No entries for this date.</div>
                )}
                {dayLogs.map(l => {
                    const food = foods.find(f => f.id === l.foodId);
                    const n = getNutrients(l.foodId, l.amountGrams);
                    return (
                      <div key={l.id} className="p-4 bg-white rounded-2xl flex justify-between border border-slate-100 items-center shadow-sm">
                          <div>
                            <span className="font-bold text-slate-700 block">{food?.name || 'Unknown Food'}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{l.amountGrams}g</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="text-right">
                                <div className="text-emerald-600 font-bold text-sm">{Math.round(n.c)} kcal</div>
                                <div className="text-[10px] font-bold text-slate-400">{Math.round(n.p)}g P</div>
                             </div>
                             <button onClick={async () => {
                               if (user) await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, l.id));
                             }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                          </div>
                      </div>
                    );
                })}
            </div>
          )}

          {activeTab === 'foods' && (
             <div className="p-6 space-y-3 pb-32">
                <h2 className="text-2xl font-black text-slate-800 mb-4">Registry</h2>
                
                {/* Add Buttons */}
                <div className="flex gap-2 mb-6">
                  <button onClick={() => setShowAddFood(true)} className="flex-1 border-2 border-dashed border-slate-200 p-3 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-100 transition-colors">+ Add Food</button>
                  <button onClick={() => setShowAddPlate(true)} className="flex-1 border-2 border-dashed border-slate-200 p-3 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-100 transition-colors">+ Add Plate</button>
                </div>

                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2 mt-4">My Foods</h3>
                {foods.length === 0 && <div className="text-xs text-slate-400">No foods registered.</div>}
                {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                    <div key={f.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm group">
                        <div>
                          <span className="font-bold text-slate-700 block">{f.name}</span>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[10px] font-bold text-slate-400">{f.caloriesPer100g} kcal</span>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">{f.proteinPer100g}g P</span>
                          </div>
                        </div>
                        
                        {/* EDIT & DELETE CONTROLS */}
                        <div className="flex items-center gap-3">
                          <button onClick={() => setEditingFood(f)} className="text-slate-300 hover:text-emerald-600 transition-colors p-1"><Edit2 size={16}/></button>
                          <button onClick={async () => {
                            if (window.confirm(`Delete ${f.name} from your registry?`)) {
                               await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, f.id));
                            }
                          }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}

                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2 mt-8">My Plates</h3>
                {plates.length === 0 && <div className="text-xs text-slate-400">No plates registered.</div>}
                {plates.map(p => (
                    <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                        <span className="font-bold text-slate-700">{p.name}</span>
                        <div className="flex items-center gap-4">
                            <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{p.weight}g</div>
                            <button onClick={async () => {
                                if (window.confirm(`Delete plate ${p.name}?`)) {
                                   await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/plates`, p.id));
                                }
                            }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
             </div>
          )}

          {activeTab === 'trends' && (
            <div className="p-6 space-y-4 pb-32">
               <h2 className="text-2xl font-black text-slate-800 mb-4">Weekly Trends</h2>
               {[...Array(7)].map((_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - i);
                  const ds = d.toISOString().split('T')[0];
                  const lgs = logs.filter(l => l.date === ds);
                  const t = lgs.reduce((acc, l) => {
                     const n = getNutrients(l.foodId, l.amountGrams);
                     return { c: acc.c + n.c, p: acc.p + n.p };
                  }, { c: 0, p: 0 });
                  return (
                     <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between shadow-sm">
                        <span className="font-black text-slate-800">{d.toLocaleDateString(undefined, {weekday: 'short'})}</span>
                        <div className="text-right font-bold">
                           <div className="text-emerald-600">{Math.round(t.c)} kcal</div>
                           <div className="text-xs text-slate-400">{Math.round(t.p)}g Protein</div>
                        </div>
                     </div>
                  );
               })}
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
        </div>

        {/* --- MODALS --- */}

        {/* Modal: Set Calorie Target */}
        {showTargetModal && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black mb-2">Daily Goal</h2>
              <p className="text-xs text-slate-400 mb-6 font-bold leading-relaxed">Set your calorie target for your body recomposition.</p>
              <input 
                placeholder="Target (e.g. 2500)" 
                type="number" 
                defaultValue={calorieTarget}
                className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500 transition-colors text-emerald-600 font-bold" 
                id="ct" 
              />
              <div className="flex gap-3">
                <button onClick={() => setShowTargetModal(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={async () => {
                  const target = document.getElementById('ct').value;
                  if (!target || !user) return;
                  await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/settings`, 'goals'), {
                    calorieTarget: parseFloat(target)
                  }, { merge: true });
                  setShowTargetModal(false);
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">Save</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal: Add Food */}
        {showAddFood && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black mb-6">Register Food</h2>
              <input placeholder="Name" className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="fn" />
              <input placeholder="Cals / 100g" type="number" className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="fc" />
              <input placeholder="Protein / 100g" type="number" className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="fp" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={async () => {
                  const name = document.getElementById('fn').value;
                  const cals = document.getElementById('fc').value;
                  const prot = document.getElementById('fp').value;
                  if (!name || !cals || !user) return;
                  const id = Math.random().toString(36).substr(2, 9);
                  await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, id), {
                    id, name, caloriesPer100g: parseFloat(cals), proteinPer100g: parseFloat(prot || 0)
                  });
                  setShowAddFood(false);
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Edit Food */}
        {editingFood && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black mb-6">Edit Food</h2>
              <input placeholder="Name" defaultValue={editingFood.name} className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="efn" />
              <input placeholder="Cals / 100g" type="number" defaultValue={editingFood.caloriesPer100g} className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="efc" />
              <input placeholder="Protein / 100g" type="number" defaultValue={editingFood.proteinPer100g} className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="efp" />
              <div className="flex gap-3">
                <button onClick={() => setEditingFood(null)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={async () => {
                  const name = document.getElementById('efn').value;
                  const cals = document.getElementById('efc').value;
                  const prot = document.getElementById('efp').value;
                  if (!name || !cals || !user) return;
                  await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, editingFood.id), {
                    id: editingFood.id, name, caloriesPer100g: parseFloat(cals), proteinPer100g: parseFloat(prot || 0)
                  });
                  setEditingFood(null);
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">Update</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Plate */}
        {showAddPlate && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-black mb-2">Register Plate</h2>
              <p className="text-xs text-slate-400 mb-6 font-bold leading-relaxed">Save physical bowls/plates so the app can automatically deduct their weight.</p>
              <input placeholder="Plate Name (e.g. Big Bowl)" className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="pn" />
              <input placeholder="Empty Weight (Grams)" type="number" className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="pw" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddPlate(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={async () => {
                  const name = document.getElementById('pn').value;
                  const wght = document.getElementById('pw').value;
                  if (!name || !wght || !user) return;
                  const id = Math.random().toString(36).substr(2, 9);
                  await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/plates`, id), {
                    id, name, weight: parseFloat(wght)
                  });
                  setShowAddPlate(false);
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* OPTIMIZED LOGGING MODAL */}
        {showAddLog && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 max-h-[95vh] overflow-y-auto shadow-2xl">
              <h2 className="text-2xl font-black mb-5 text-center">Log Food</h2>
              
              {/* Step 1: Sleek Scale Input Container */}
              <div className="bg-slate-50 p-5 rounded-3xl mb-5 border border-slate-100">
                <div className="mb-4">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">1. Scale Weight (g)</label>
                  <input 
                      placeholder="0" 
                      type="number" 
                      className="w-full bg-white rounded-2xl p-4 outline-none border border-slate-200 font-black text-3xl text-emerald-600 transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center shadow-sm" 
                      value={scaleWeight}
                      onChange={e => setScaleWeight(e.target.value)} 
                  />
                </div>
                
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">2. Deduct Plate</label>
                  <select 
                      className="w-full bg-white rounded-2xl p-4 outline-none border border-slate-200 text-sm font-bold text-slate-700 transition-all focus:border-emerald-500 shadow-sm"
                      value={selectedPlate}
                      onChange={e => setSelectedPlate(e.target.value)}
                  >
                      <option value="">No Plate (0g deduction)</option>
                      {plates.map(p => <option key={p.id} value={p.id}>{p.name} (-{p.weight}g)</option>)}
                  </select>
                </div>
              </div>

              {/* Step 2: Sleek Segmented Toggle */}
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">3. Allocation</label>
              <div className="flex p-1 bg-slate-100 rounded-2xl mb-5">
                <button 
                  className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all duration-300 ${!isCombo ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                  onClick={() => setIsCombo(false)}
                >Single Food</button>
                <button 
                  className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all duration-300 ${isCombo ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                  onClick={() => setIsCombo(true)}
                >Combo (%)</button>
              </div>

              {/* Step 3: Minimal Food Selection */}
              {!isCombo ? (
                <div className="mb-6">
                  <select 
                      className="w-full bg-slate-50 rounded-2xl p-4 outline-none border border-slate-100 font-bold text-slate-700 focus:border-emerald-500 transition-all shadow-sm"
                      value={singleFoodId}
                      onChange={e => setSingleFoodId(e.target.value)}
                  >
                    <option value="">Select Food...</option>
                    {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                  {comboItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select 
                        className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 outline-none text-sm font-bold text-slate-700 focus:border-emerald-500 shadow-sm"
                        value={item.foodId}
                        onChange={e => {
                          const newItems = [...comboItems];
                          newItems[index].foodId = e.target.value;
                          setComboItems(newItems);
                        }}
                      >
                        <option value="">Food {index + 1}...</option>
                        {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <input 
                        placeholder="%" 
                        type="number" 
                        className="w-20 bg-white border border-slate-200 rounded-2xl p-3 outline-none text-center text-sm font-black text-emerald-600 focus:border-emerald-500 shadow-sm"
                        value={item.percentage}
                        onChange={e => {
                          const newItems = [...comboItems];
                          newItems[index].percentage = e.target.value;
                          setComboItems(newItems);
                        }}
                      />
                      {index > 1 && (
                        <button onClick={() => {
                          const newItems = comboItems.filter((_, i) => i !== index);
                          setComboItems(newItems);
                        }} className="text-slate-300 p-2 hover:text-red-500 transition-colors"><X size={16}/></button>
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={() => setComboItems([...comboItems, { foodId: '', percentage: '' }])}
                    className="w-full text-xs font-bold text-emerald-600 py-3 mt-2 border-2 border-dashed border-emerald-100 rounded-xl hover:bg-emerald-50 transition-colors"
                  >
                    + Add food to combo
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button onClick={() => { 
                  setShowAddLog(false); 
                  setScaleWeight('');
                  setSelectedPlate('');
                }} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                
                <button onClick={async () => {
                  if (!user) return;
                  
                  // 1. Calculate Actual Net Food Weight
                  const rawWeight = parseFloat(scaleWeight);
                  if (!rawWeight || rawWeight <= 0) {
                      alert("Please enter a valid scale weight."); return;
                  }
                  
                  let plateDeduction = 0;
                  if (selectedPlate) {
                      const p = plates.find(x => x.id === selectedPlate);
                      if (p) plateDeduction = p.weight;
                  }
                  
                  const actualNetWeight = rawWeight - plateDeduction;
                  if (actualNetWeight <= 0) {
                      alert(`Error: The plate (${plateDeduction}g) is heavier than the total scale weight (${rawWeight}g).`); return;
                  }

                  // 2. Distribute the Weight
                  if (!isCombo) {
                    if (!singleFoodId) { alert("Please select a food."); return; }
                    const id = Math.random().toString(36).substr(2, 9);
                    await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, id), {
                      id, foodId: singleFoodId, amountGrams: parseFloat(actualNetWeight.toFixed(1)), date: currentDate
                    });
                  } else {
                    const totalPct = comboItems.reduce((sum, item) => sum + (parseFloat(item.percentage) || 0), 0);
                    if (Math.abs(totalPct - 100) > 0.1) {
                        alert(`Percentages must equal 100%. They currently equal ${totalPct}%.`); return;
                    }
                    
                    for (const item of comboItems) {
                        if (item.foodId && parseFloat(item.percentage) > 0) {
                            const id = Math.random().toString(36).substr(2, 9);
                            const calculatedGrams = (parseFloat(item.percentage) / 100) * actualNetWeight;
                            await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, id), {
                                id, foodId: item.foodId, amountGrams: parseFloat(calculatedGrams.toFixed(1)), date: currentDate
                            });
                        }
                    }
                  }
                  
                  setScaleWeight('');
                  setSelectedPlate('');
                  setSingleFoodId('');
                  setComboItems([{ foodId: '', percentage: '' }, { foodId: '', percentage: '' }]);
                  setShowAddLog(false);
                  
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">Log Food</button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Action Button */}
        <button onClick={() => setShowAddLog(true)} className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-[0_10px_25px_rgba(5,150,105,0.4)] flex items-center justify-center z-30 hover:scale-105 transition-transform"><Plus/></button>
      </div>
    </div>
  );
}
