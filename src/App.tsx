// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, Utensils, Plus, ChevronLeft, ChevronRight, 
  Trash2, Loader2, BarChart3, AlertTriangle, X 
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
const MY_PERMANENT_UID = '5D3QzaJfLERycrkJkcOXs9LfFXU2'; // Your recovered profile

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);

  // --- PLATE FEATURE STATE ---
  const [isPlateMode, setIsPlateMode] = useState(false);
  const [plateWeight, setPlateWeight] = useState('');
  const [plateItems, setPlateItems] = useState([{ foodId: '', percentage: '' }, { foodId: '', percentage: '' }]);

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

  // --- Forced Data Sync to your Permanent ID ---
  useEffect(() => {
    if (!user || !db) return;
    
    // Bypassing the anonymous session ID and using your permanent ID
    const userPath = `artifacts/${appId}/users/${MY_PERMANENT_UID}`;
    
    const unsubFoods = onSnapshot(collection(db, `${userPath}/foods`), (s) => {
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubLogs = onSnapshot(collection(db, `${userPath}/logs`), (s) => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    
    return () => { unsubFoods(); unsubLogs(); };
  }, [user]);

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
        
        <div className="bg-emerald-600 text-white p-6 pt-10 rounded-b-[2.5rem] shrink-0 shadow-lg">
          <div className="flex justify-between items-center mb-6">
             <button onClick={() => {
               const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().split('T')[0]);
             }}><ChevronLeft/></button>
             <span className="font-bold text-xs uppercase tracking-widest">{currentDate}</span>
             <button onClick={() => {
               const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().split('T')[0]);
             }}><ChevronRight/></button>
          </div>
          <div className="text-center">
            <div className="text-6xl font-black">{Math.round(totals.c)}<span className="text-lg ml-1 font-normal opacity-70">kcal</span></div>
            <div className="mt-2 bg-emerald-700/40 inline-block px-5 py-1.5 rounded-full text-sm font-bold border border-emerald-500/30">
              {Math.round(totals.p)}g Protein
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
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
                      <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between border items-center">
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
                               // Force delete from permanent ID
                               if (user) await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, l.id));
                             }} className="text-slate-300"><Trash2 size={16}/></button>
                          </div>
                      </div>
                    );
                })}
            </div>
          )}

          {activeTab === 'foods' && (
             <div className="p-6 space-y-3 pb-32">
                <h2 className="text-2xl font-black text-slate-800 mb-4">Registry</h2>
                <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 transition-colors">+ Add New Food</button>
                {foods.map(f => (
                    <div key={f.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center shadow-sm">
                        <span className="font-bold text-slate-700">{f.name}</span>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-500">{f.caloriesPer100g} kcal</div>
                          <div className="text-[10px] font-bold text-emerald-600 uppercase">{f.proteinPer100g}g Protein</div>
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
                     <div key={i} className="bg-white p-5 rounded-3xl border flex justify-between shadow-sm">
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

        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
        </div>

        {showAddFood && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8">
              <h2 className="text-2xl font-black mb-6">Register Food</h2>
              <input placeholder="Name" className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" id="fn" />
              <input placeholder="Cals / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" id="fc" />
              <input placeholder="Protein / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-6 outline-none" id="fp" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl">Cancel</button>
                <button onClick={async () => {
                  const name = document.getElementById('fn').value;
                  const cals = document.getElementById('fc').value;
                  const prot = document.getElementById('fp').value;
                  if (!name || !cals || !user) return;
                  const id = Math.random().toString(36).substr(2, 9);
                  
                  // Force save to permanent ID
                  await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, id), {
                    id, name, 
                    caloriesPer100g: parseFloat(cals),
                    proteinPer100g: parseFloat(prot || 0)
                  });
                  setShowAddFood(false);
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* --- PLATE SELECTION MODAL --- */}
        {showAddLog && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-black mb-6">Log weight</h2>
              
              {/* The Plate Toggle */}
              <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-2xl">
                <button 
                  className={`flex-1 py-2 font-bold rounded-xl text-sm transition-colors ${!isPlateMode ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
                  onClick={() => setIsPlateMode(false)}
                >Single Food</button>
                <button 
                  className={`flex-1 py-2 font-bold rounded-xl text-sm transition-colors ${isPlateMode ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
                  onClick={() => setIsPlateMode(true)}
                >Build a Plate</button>
              </div>

              {!isPlateMode ? (
                /* SINGLE FOOD MODE */
                <>
                  <select className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" id="lf">
                    <option value="">Select Food...</option>
                    {/* Alphabetically sorted dropdown */}
                    {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input placeholder="Grams" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-6 outline-none" id="lg" />
                </>
              ) : (
                /* BUILD A PLATE MODE */
                <>
                  <input 
                    placeholder="Total Plate Weight (Grams)" 
                    type="number" 
                    className="w-full bg-slate-100 rounded-2xl p-4 mb-4 outline-none font-bold text-emerald-600" 
                    value={plateWeight}
                    onChange={e => setPlateWeight(e.target.value)} 
                  />
                  <div className="space-y-3 mb-4">
                    {plateItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <select 
                          className="flex-1 bg-slate-100 rounded-2xl p-3 outline-none text-sm"
                          value={item.foodId}
                          onChange={e => {
                            const newItems = [...plateItems];
                            newItems[index].foodId = e.target.value;
                            setPlateItems(newItems);
                          }}
                        >
                          <option value="">Food {index + 1}...</option>
                          {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <input 
                          placeholder="%" 
                          type="number" 
                          className="w-20 bg-slate-100 rounded-2xl p-3 outline-none text-center text-sm font-bold"
                          value={item.percentage}
                          onChange={e => {
                            const newItems = [...plateItems];
                            newItems[index].percentage = e.target.value;
                            setPlateItems(newItems);
                          }}
                        />
                        {index > 1 && (
                          <button onClick={() => {
                            const newItems = plateItems.filter((_, i) => i !== index);
                            setPlateItems(newItems);
                          }} className="text-slate-400 p-2 hover:text-red-500 transition-colors"><X size={16}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setPlateItems([...plateItems, { foodId: '', percentage: '' }])}
                    className="w-full text-xs font-bold text-emerald-600 mb-6 py-3 border-2 border-dashed border-emerald-100 rounded-xl hover:bg-emerald-50 transition-colors"
                  >
                    + Add another food to plate
                  </button>
                </>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowAddLog(false); setIsPlateMode(false); }} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl">Cancel</button>
                <button onClick={async () => {
                  if (!user) return;
                  
                  if (!isPlateMode) {
                    // Save Single Food
                    const fId = document.getElementById('lf').value;
                    const gms = document.getElementById('lg').value;
                    if (!fId || !gms) return;
                    const id = Math.random().toString(36).substr(2, 9);
                    await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, id), {
                      id, foodId: fId, amountGrams: parseFloat(gms), date: currentDate
                    });
                  } else {
                    // Save Plate
                    const totalW = parseFloat(plateWeight);
                    if (!totalW || totalW <= 0) {
                        alert("Please enter a valid total weight for the plate.");
                        return;
                    }
                    const totalPct = plateItems.reduce((sum, item) => sum + (parseFloat(item.percentage) || 0), 0);
                    if (Math.abs(totalPct - 100) > 0.1) {
                        alert(`Your percentages must equal exactly 100%. They currently equal ${totalPct}%.`);
                        return;
                    }
                    
                    // Log each item based on its percentage of the total plate weight
                    for (const item of plateItems) {
                        if (item.foodId && parseFloat(item.percentage) > 0) {
                            const id = Math.random().toString(36).substr(2, 9);
                            const calculatedGrams = (parseFloat(item.percentage) / 100) * totalW;
                            await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, id), {
                                id, 
                                foodId: item.foodId, 
                                amountGrams: parseFloat(calculatedGrams.toFixed(1)), 
                                date: currentDate
                            });
                        }
                    }
                    // Reset plate state for next time
                    setPlateWeight('');
                    setPlateItems([{ foodId: '', percentage: '' }, { foodId: '', percentage: '' }]);
                  }
                  
                  setShowAddLog(false);
                  setIsPlateMode(false);
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl">Log</button>
              </div>
            </div>
          </div>
        )}

        <button onClick={() => setShowAddLog(true)} className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center z-30"><Plus/></button>
      </div>
    </div>
  );
}
