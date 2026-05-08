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

  // ENABLE OFFLINE PERSISTENCE
  enableIndexedDbPersistence(db).catch((err) => {
      console.warn("Persistence error:", err.code);
  });
}

const appId = 'nutri-plate-v5'; 

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);

  // --- Auth Session Recovery ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { setUser(u); } 
      else {
        try { await signInAnonymously(auth); } 
        catch (e) { setGlobalError("Connection Error: " + e.message); }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Data Sync ---
  useEffect(() => {
    if (!user || !db) return;
    const userPath = `artifacts/${appId}/users/${user.uid}`;
    
    const unsubFoods = onSnapshot(collection(db, `${userPath}/foods`), (s) => {
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLogs = onSnapshot(collection(db, `${userPath}/logs`), (s) => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    return () => { unsubFoods(); unsubLogs(); };
  }, [user]);

  // --- Calculations ---
  const getNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { c: 0, p: 0 };
    return { 
        c: (grams / 100) * (f.caloriesPer100g || 0), 
        p: (grams / 100) * (f.proteinPer100g || 0) 
    };
  };

  const dayLogs = logs.filter(l => l.date === currentDate);
  const totals = dayLogs.reduce((acc, log) => {
    const n = getNutrients(log.foodId, log.amountGrams);
    return { c: acc.c + n.c, p: acc.p + n.p };
  }, { c: 0, p: 0 });

  const deleteLog = async (id) => {
    await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, id));
  };

  // --- Sub-Views ---
  const HomeView = () => (
    <div className="flex flex-col h-full bg-white">
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

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-4">Daily Logs</h3>
        {dayLogs.map(l => (
          <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between border border-slate-100 mb-3">
            <div>
              <span className="font-bold text-slate-700 block">{foods.find(f => f.id === l.foodId)?.name || 'Food'}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">{l.amountGrams}g</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="font-bold text-emerald-600 block text-sm">{Math.round(getNutrients(l.foodId, l.amountGrams).c)} kcal</span>
                <span className="text-[10px] font-bold text-slate-400">{Math.round(getNutrients(l.foodId, l.amountGrams).p)}g P</span>
              </div>
              <button onClick={() => deleteLog(l.id)} className="text-slate-300"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setShowAddLog(true)} className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-transform z-30"><Plus size={32}/></button>
    </div>
  );

  const AddLogModal = () => {
    const [foodId, setFoodId] = useState('');
    const [grams, setGrams] = useState('');
    const save = async () => {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, id), {
        foodId, amountGrams: parseFloat(grams), date: currentDate, id
      });
      setShowAddLog(false);
    };
    return (
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
          <h2 className="text-2xl font-black mb-6">Log Food</h2>
          <select className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" value={foodId} onChange={e=>setFoodId(e.target.value)}>
            <option value="">Select Food...</option>
            {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input placeholder="Weight (grams)" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-6 outline-none" value={grams} onChange={e=>setGrams(e.target.value)} />
          <div className="flex gap-3">
            <button onClick={() => setShowAddLog(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl">Cancel</button>
            <button onClick={save} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl">Log</button>
          </div>
        </div>
      </div>
    );
  };

  const AddFoodModal = () => {
    const [n, setN] = useState('');
    const [c, setC] = useState('');
    const [p, setP] = useState('');
    const save = async () => {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/foods`, id), {
        id, name: n, caloriesPer100g: parseFloat(c), proteinPer100g: parseFloat(p)
      });
      setShowAddFood(false);
    };
    return (
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
          <h2 className="text-2xl font-black mb-6">New Food</h2>
          <input placeholder="Name" className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" value={n} onChange={e=>setN(e.target.value)} />
          <input placeholder="Cals / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" value={c} onChange={e=>setC(e.target.value)} />
          <input placeholder="Protein / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-6 outline-none" value={p} onChange={e=>setP(e.target.value)} />
          <div className="flex gap-3">
            <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl">Cancel</button>
            <button onClick={save} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl">Register</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none select-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative overflow-hidden">
        
        <div className="flex-1 relative overflow-hidden bg-white">
          {isLoading && <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>}
          
          <div className="h-full w-full">
             {activeTab === 'log' && <HomeView />}
             {activeTab === 'foods' && (
                <div className="p-6 space-y-3 h-full overflow-y-auto pb-32">
                   <h2 className="text-2xl font-black text-slate-800 mb-6">Food Registry</h2>
                   <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 transition-colors">+ Register New Food</button>
                   {foods.map(f => (
                       <div key={f.id} className="p-4 bg-white border rounded-2xl flex justify-between shadow-sm">
                           <span className="font-bold text-slate-700">{f.name}</span>
                           <span className="text-[10px] font-bold text-slate-400 text-right">{f.caloriesPer100g} kcal/100g<br/>{f.proteinPer100g}g P/100g</span>
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
                         const n = getNutrients(l.foodId, l.amountGrams);
                         return { c: acc.c + n.c, p: acc.p + n.p };
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
        </div>
        
        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
        </div>

        {showAddFood && <AddFoodModal />}
        {showAddLog && <AddLogModal />}
      </div>
    </div>
  );
}
