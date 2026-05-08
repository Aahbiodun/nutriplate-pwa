// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { 
  Home, Utensils, Plus, ChevronLeft, ChevronRight, 
  X, Check, Calendar, Trash2, Disc, Loader2, 
  BarChart3, AlertTriangle 
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, setDoc, 
  deleteDoc, enableIndexedDbPersistence 
} from 'firebase/firestore';

// --- Firebase Setup ---
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

let app, auth, db;
if (Object.keys(firebaseConfig).length > 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  enableIndexedDbPersistence(db).catch((err) => {
      console.warn("Persistence error:", err.code);
  });
}

const appId = 'nutri-plate-v6'; 

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [plates, setPlates] = useState([]);
  
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddPlate, setShowAddPlate] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { setUser(u); } 
      else {
        try { await signInAnonymously(auth); } 
        catch (e) { console.error(e); }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const userPath = `artifacts/${appId}/users/${user.uid}`;
    
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

    return () => { unsubFoods(); unsubPlates(); unsubLogs(); };
  }, [user]);

  const getNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { c: 0, p: 0 };
    return { 
        c: (grams / 100) * (f.caloriesPer100g || 0), 
        p: (grams / 100) * (f.proteinPer100g || 0) 
    };
  };

  const getLogStats = (log) => {
    if (log.type === 'single') return getNutrients(log.foodId, log.netWeight);
    return (log.ingredients || []).reduce((acc, ing) => {
      const n = getNutrients(ing.foodId, log.netWeight * (ing.percentage / 100));
      return { c: acc.c + n.c, p: acc.p + n.p };
    }, { c: 0, p: 0 });
  };

  const dayLogs = logs.filter(l => l.date === currentDate);
  const totals = dayLogs.reduce((acc, log) => {
    const stats = getLogStats(log);
    return { c: acc.c + stats.c, p: acc.p + stats.p };
  }, { c: 0, p: 0 });

  // --- Add Log Modal (Combined & Plate Logic) ---
  const AddLogModal = () => {
    const [logType, setLogType] = useState('single');
    const [selectedFoodId, setSelectedFoodId] = useState('');
    const [ingredients, setIngredients] = useState([{ foodId: '', percentage: 0 }]);
    const [grossWeight, setGrossWeight] = useState('');
    const [selectedPlateId, setSelectedPlateId] = useState('');
    const [usePlate, setUsePlate] = useState(false);

    const plate = plates.find(p => p.id === selectedPlateId);
    const netWeight = usePlate ? (parseFloat(grossWeight) - (plate?.weight || 0)) : parseFloat(grossWeight);

    const save = async () => {
      const id = Math.random().toString(36).substr(2, 9);
      const data = {
        id, date: currentDate, type: logType, netWeight,
        ...(logType === 'single' ? { foodId: selectedFoodId } : { ingredients })
      };
      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, id), data);
      setShowAddLog(false);
    };

    return (
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end">
        <div className="bg-white w-full rounded-t-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black">Log Entry</h2>
            <button onClick={()=>setShowAddLog(false)}><X/></button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
             <button onClick={()=>setLogType('single')} className={`flex-1 p-3 rounded-xl font-bold text-sm ${logType === 'single' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Single</button>
             <button onClick={()=>setLogType('combo')} className={`flex-1 p-3 rounded-xl font-bold text-sm ${logType === 'combo' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Combo</button>
          </div>

          {logType === 'single' ? (
            <select className="w-full bg-slate-100 rounded-2xl p-4 mb-4" value={selectedFoodId} onChange={e=>setSelectedFoodId(e.target.value)}>
              <option value="">Select Food...</option>
              {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          ) : (
            <div className="space-y-2 mb-4">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <select className="flex-1 bg-slate-100 rounded-xl p-3 text-sm" value={ing.foodId} onChange={e => {
                    const newIngs = [...ingredients]; newIngs[i].foodId = e.target.value; setIngredients(newIngs);
                  }}>
                    <option value="">Food...</option>
                    {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input placeholder="%" type="number" className="w-20 bg-slate-100 rounded-xl p-3 text-sm" value={ing.percentage} onChange={e => {
                    const newIngs = [...ingredients]; newIngs[i].percentage = parseFloat(e.target.value); setIngredients(newIngs);
                  }} />
                </div>
              ))}
              <button onClick={()=>setIngredients([...ingredients, {foodId:'', percentage:0}])} className="text-emerald-600 font-bold text-xs">+ Add Food</button>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-slate-500">Use Plate Weight?</span>
              <input type="checkbox" checked={usePlate} onChange={e=>setUsePlate(e.target.checked)} className="w-5 h-5 accent-emerald-600" />
            </div>
            {usePlate && (
              <select className="w-full bg-white border p-3 rounded-xl mb-4 text-sm" value={selectedPlateId} onChange={e=>setSelectedPlateId(e.target.value)}>
                <option value="">Select Plate...</option>
                {plates.map(p => <option key={p.id} value={p.id}>{p.name} ({p.weight}g)</option>)}
              </select>
            )}
            <input placeholder={usePlate ? "Gross Weight on Scale" : "Actual Food Weight"} type="number" className="w-full bg-white border p-4 rounded-xl outline-none font-bold" value={grossWeight} onChange={e=>setGrossWeight(e.target.value)} />
          </div>

          <button onClick={save} className="w-full bg-emerald-600 text-white font-black p-5 rounded-3xl shadow-lg">Save {netWeight > 0 ? `${Math.round(netWeight)}g` : ''}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none select-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-600 text-white p-6 pt-10 rounded-b-[2.5rem] shrink-0 shadow-lg">
          <div className="flex justify-between items-center mb-6">
             <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronLeft/></button>
             <span className="font-bold text-xs uppercase tracking-widest">{currentDate}</span>
             <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronRight/></button>
          </div>
          <div className="text-center">
            <div className="text-6xl font-black">{Math.round(totals.c)}<span className="text-lg ml-1 font-normal opacity-70">kcal</span></div>
            <div className="mt-2 font-bold text-emerald-100">{Math.round(totals.p)}g Protein</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'log' && (
            <div className="p-6 space-y-3 pb-32">
              {dayLogs.map(l => (
                <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between border border-slate-100">
                  <div className="truncate mr-4">
                    <span className="font-bold text-slate-700 block">{l.type === 'single' ? (foods.find(f => f.id === l.foodId)?.name) : 'Combo Meal'}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{Math.round(l.netWeight)}g Net</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 block text-sm">{Math.round(getLogStats(l).c)} kcal</span>
                    <span className="text-[10px] font-bold text-slate-400">{Math.round(getLogStats(l).p)}g P</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'foods' && (
             <div className="p-6 space-y-3 pb-32">
                <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 transition-colors">+ New Food</button>
                {foods.map(f => (
                    <div key={f.id} className="p-4 bg-white border rounded-2xl flex justify-between shadow-sm">
                        <span className="font-bold text-slate-700">{f.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 text-right">{f.caloriesPer100g} kcal/100g<br/>{f.proteinPer100g}g P/100g</span>
                    </div>
                ))}
             </div>
          )}

          {activeTab === 'plates' && (
            <div className="p-6 space-y-3 pb-32">
               <button onClick={() => setShowAddPlate(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold">+ Register Plate</button>
               {plates.map(p => (
                   <div key={p.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center shadow-sm">
                       <div className="flex items-center gap-3"><Disc className="text-slate-300"/><span className="font-bold text-slate-700">{p.name}</span></div>
                       <span className="font-black text-emerald-600">{p.weight}g</span>
                   </div>
               ))}
            </div>
          )}

          {activeTab === 'trends' && (
             <div className="p-6 space-y-4 h-full overflow-y-auto pb-32">
                <h2 className="text-2xl font-black text-slate-800 mb-6">Trends</h2>
                {[...Array(7)].map((_, i) => {
                   const d = new Date(); d.setDate(d.getDate() - i);
                   const ds = d.toISOString().split('T')[0];
                   const lgs = logs.filter(l => l.date === ds);
                   const t = lgs.reduce((acc, l) => {
                      const s = getLogStats(l);
                      return { c: acc.c + s.c, p: acc.p + s.p };
                   }, { c: 0, p: 0 });
                   return (
                      <div key={i} className="bg-white p-5 rounded-3xl border flex justify-between shadow-sm">
                         <div>
                            <span className="font-black text-slate-800 block">{d.toLocaleDateString(undefined, {weekday: 'short'})}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{ds}</span>
                         </div>
                         <div className="text-right">
                            <div className="text-emerald-600 font-bold text-lg">{Math.round(t.c)} kcal</div>
                            <div className="text-xs text-slate-500 font-bold">{Math.round(t.p)}g Protein</div>
                         </div>
                      </div>
                   );
                })}
             </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
          <button onClick={() => setActiveTab('plates')} className={activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}><Disc/></button>
        </div>

        {showAddFood && <AddFoodModal />}
        {showAddLog && <AddLogModal />}
        {showAddPlate && <AddPlateModal />}
      </div>
    </div>
  );
}
