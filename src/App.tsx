// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Utensils, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  Calendar,
  Trash2,
  Disc,
  Loader2,
  BarChart3,
  AlertTriangle
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Setup ---
const customFirebaseConfig = {
  // PASTE YOUR FIREBASE KEYS HERE FROM THE FIREBASE CONSOLE
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : customFirebaseConfig;

const isFirebaseConfigured = Object.keys(firebaseConfig).length > 0;

let app, auth, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'nutri-app-v3';

// --- Helpers ---
const getTodayString = () => new Date().toISOString().split('T')[0];
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(getTodayString());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');

  const [foods, setFoods] = useState([]);
  const [physicalPlates, setPhysicalPlates] = useState([]);
  const [logs, setLogs] = useState([]);

  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddPhysicalPlate, setShowAddPhysicalPlate] = useState(false);

  // --- Auth & Session ---
  useEffect(() => {
    if (!isFirebaseConfigured) { setIsLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { setUser(u); } 
      else {
        try { await signInAnonymously(auth); } 
        catch (e) { setGlobalError("Auth Error: " + e.message); }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Data Sync ---
  useEffect(() => {
    if (!user || !isFirebaseConfigured) { setIsLoading(false); return; }
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 3000);

    const unsubFoods = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'foods'), (s) => {
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPlates = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'plates'), (s) => {
      setPhysicalPlates(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'), (s) => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
      clearTimeout(timeout);
    });

    return () => { unsubFoods(); unsubPlates(); unsubLogs(); };
  }, [user]);

  // --- Nutrition Math ---
  const calcNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { calories: 0, protein: 0 };
    return {
      calories: (grams / 100) * (f.caloriesPer100g || 0),
      protein: (grams / 100) * (f.proteinPer100g || 0)
    };
  };

  const getLogStats = (log) => {
    if (log.type === 'food') return calcNutrients(log.itemId, log.amountGrams);
    return (log.ingredients || []).reduce((acc, ing) => {
      const nutrients = calcNutrients(ing.foodId, log.amountGrams * (ing.percentage / 100));
      return { calories: acc.calories + nutrients.calories, protein: acc.protein + nutrients.protein };
    }, { calories: 0, protein: 0 });
  };

  const dailyLogs = logs.filter(l => l.date === currentDate);
  const dayTotals = dailyLogs.reduce((acc, l) => {
    const s = getLogStats(l);
    return { calories: acc.calories + stats.calories, protein: acc.protein + stats.protein };
  }, { calories: 0, protein: 0 });

  const deleteLog = async (id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', id)); } 
    catch (e) { setGlobalError("Delete failed: " + e.message); }
  };

  // --- Views ---
  const HomeView = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] p-6 pb-12 shadow-lg shrink-0">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronLeft /></button>
          <div className="font-bold">{currentDate === getTodayString() ? 'Today' : currentDate}</div>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronRight /></button>
        </div>
        <div className="text-center">
          <div className="text-6xl font-black">{Math.round(dayTotals.calories)}<span className="text-xl font-normal ml-1">kcal</span></div>
          <div className="mt-2 bg-emerald-700/40 inline-block px-5 py-1.5 rounded-full text-sm font-bold border border-emerald-500/30">
            {Math.round(dayTotals.protein)}g Protein
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-4">Meal History</h3>
        {dailyLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-300 italic text-sm">No food logged for this day</div>
        ) : (
          dailyLogs.map(log => {
            const s = getLogStats(log);
            const food = foods.find(f => f.id === log.itemId);
            return (
              <div key={log.id} className="flex justify-between items-center p-4 mb-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                  <div className="font-bold text-slate-800">{log.type === 'food' ? food?.name : 'Combined Meal'}</div>
                  <div className="text-xs text-slate-400 font-medium">{log.amountGrams}g</div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-emerald-600 font-bold text-sm">{Math.round(s.calories)} kcal</div>
                    <div className="text-[10px] font-bold text-slate-400">{Math.round(s.protein)}g P</div>
                  </div>
                  <button onClick={() => deleteLog(log.id)} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={18}/></button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <button onClick={() => setShowAddLog(true)} className="fixed bottom-24 right-6 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-transform z-30"><Plus size={32}/></button>
    </div>
  );

  const TrendsView = () => {
    const history = [];
    for(let i=0; i<7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const lgs = logs.filter(l => l.date === ds);
      const totals = lgs.reduce((acc, l) => {
        const s = getLogStats(l);
        return { c: acc.c + s.calories, p: acc.p + s.protein };
      }, { c: 0, p: 0 });
      history.push({ date: ds, ...totals, label: d.toLocaleDateString(undefined, { weekday: 'short' }) });
    }

    return (
      <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto pb-32">
        <h2 className="text-2xl font-black text-slate-800 mb-6">Historical Trends</h2>
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <div className="font-black text-slate-800">{h.label}</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">{h.date}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-600 text-lg">{Math.round(h.c)} <span className="text-[10px] font-normal">kcal</span></div>
                <div className="text-xs font-bold text-slate-500">{Math.round(h.p)}g Protein</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const AddFoodModal = () => {
    const [n, setN] = useState('');
    const [c, setC] = useState('');
    const [p, setP] = useState('');
    const save = async () => {
      const nf = { id: generateId(), name: n, caloriesPer100g: parseFloat(c), proteinPer100g: parseFloat(p) };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'foods', nf.id), nf);
      setShowAddFood(false);
    };
    return (
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
          <h2 className="text-2xl font-black mb-6 text-slate-800">New Food</h2>
          <div className="space-y-3 mb-8">
            <input placeholder="Food Name" className="w-full bg-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={n} onChange={e=>setN(e.target.value)} />
            <input placeholder="Calories / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={c} onChange={e=>setC(e.target.value)} />
            <input placeholder="Protein / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={p} onChange={e=>setP(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-500">Cancel</button>
            <button onClick={save} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl shadow-lg shadow-emerald-200">Save</button>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Layout ---
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center overflow-hidden overscroll-none select-none">
      
      {globalError && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white px-4 py-3 shadow-md z-[60] flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{globalError}</span>
          </div>
          <button onClick={() => setGlobalError('')} className="p-1"><X size={16} /></button>
        </div>
      )}

      <div className="w-full h-full max-w-[450px] bg-white relative flex flex-col overflow-hidden">
        
        <div className="flex-1 relative overflow-hidden bg-white">
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center">
              <Loader2 className="animate-spin text-emerald-600" size={40} />
            </div>
          )}
          
          <div className="h-full w-full">
             {activeTab === 'log' && <HomeView />}
             {activeTab === 'foods' && (
               <div className="h-full flex flex-col p-6 overflow-y-auto pb-32">
                 <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-black text-slate-800">Registry</h2>
                   <button onClick={()=>setShowAddFood(true)} className="bg-emerald-50 text-emerald-600 p-2 rounded-xl"><Plus size={20}/></button>
                 </div>
                 {foods.map(f => (
                   <div key={f.id} className="bg-white p-4 mb-3 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                     <span className="font-bold text-slate-700">{f.name}</span>
                     <div className="text-right text-[10px] font-bold text-slate-400">
                        <div>{f.caloriesPer100g} kcal/100g</div>
                        <div>{f.proteinPer100g}g P/100g</div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
             {activeTab === 'trends' && <TrendsView />}
             {activeTab === 'plates' && (
               <div className="h-full flex flex-col p-6 overflow-y-auto pb-32">
                  <h2 className="text-2xl font-black text-slate-800 mb-6">My Plates</h2>
                  {physicalPlates.map(p => (
                    <div key={p.id} className="bg-white p-4 mb-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Disc size={20} className="text-slate-300"/>
                        <span className="font-bold text-slate-700">{p.name}</span>
                      </div>
                      <span className="font-bold text-emerald-600">{p.weightGrams}g</span>
                    </div>
                  ))}
               </div>
             )}
          </div>
        </div>
        
        <div className="h-24 bg-white border-t border-slate-100 flex items-center justify-around shrink-0 z-40 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/4 transition-colors ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Home size={22} />
            <span className="text-[10px] font-black mt-1">Log</span>
          </button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/4 transition-colors ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Utensils size={22} />
            <span className="text-[10px] font-black mt-1">Registry</span>
          </button>
          <button onClick={() => setActiveTab('trends')} className={`flex flex-col items-center w-1/4 transition-colors ${activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <BarChart3 size={22} />
            <span className="text-[10px] font-black mt-1">Trends</span>
          </button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/4 transition-colors ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Disc size={22} />
            <span className="text-[10px] font-black mt-1">Plates</span>
          </button>
        </div>

        {showAddFood && <AddFoodModal />}
      </div>
    </div>
  );
}
