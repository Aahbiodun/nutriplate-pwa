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
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Setup ---
const customFirebaseConfig = {
  // PASTE YOUR FIREBASE KEYS HERE
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'nutri-app-v2';

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

  // --- Auth ---
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

  // --- Data Sync ---
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

  // --- Calculations ---
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
    const stats = getLogStats(l);
    return { calories: acc.calories + stats.calories, protein: acc.protein + stats.protein };
  }, { calories: 0, protein: 0 });

  // --- Views ---
  const HomeView = () => (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] p-6 pb-10 shadow-lg relative z-10">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { 
            const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]);
          }}><ChevronLeft /></button>
          <div className="font-bold">{currentDate === getTodayString() ? 'Today' : currentDate}</div>
          <button onClick={() => {
            const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]);
          }}><ChevronRight /></button>
        </div>
        <div className="text-center">
          <div className="text-5xl font-black mb-1">{Math.round(dayTotals.calories)}<span className="text-lg font-normal ml-1">kcal</span></div>
          <div className="bg-emerald-700/50 inline-block px-4 py-1 rounded-full text-sm font-bold">
            {Math.round(dayTotals.protein)}g Protein
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 -mt-4 pb-32">
        <div className="bg-white rounded-3xl shadow-xl p-4 min-h-full">
          <h3 className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-4">Daily Logs</h3>
          {dailyLogs.map(log => {
            const s = getLogStats(log);
            const food = foods.find(f => f.id === log.itemId);
            return (
              <div key={log.id} className="flex justify-between items-center p-3 mb-2 bg-slate-50 rounded-2xl group">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800">{log.type === 'food' ? food?.name : 'Custom Meal'}</span>
                  <span className="text-xs text-slate-400">{log.amountGrams}g</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-emerald-600 font-bold">{Math.round(s.calories)} kcal</div>
                    <div className="text-[10px] font-bold text-slate-400">{Math.round(s.protein)}g P</div>
                  </div>
                  <button onClick={() => deleteLog(log.id)} className="text-red-300 p-1"><Trash2 size={16}/></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={() => setShowAddLog(true)} className="absolute bottom-24 right-6 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-transform"><Plus size={32}/></button>
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
        <h2 className="text-2xl font-black text-slate-800 mb-6">Trends</h2>
        <div className="space-y-4">
          {history.map((h, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <div className="font-black text-slate-800">{h.label}</div>
                <div className="text-xs text-slate-400">{h.date}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-600">{Math.round(h.c)} kcal</div>
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
          <h2 className="text-2xl font-black mb-6">New Food</h2>
          <input placeholder="Name" className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" value={n} onChange={e=>setN(e.target.value)} />
          <input placeholder="Calories / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-3 outline-none" value={c} onChange={e=>setC(e.target.value)} />
          <input placeholder="Protein / 100g" type="number" className="w-full bg-slate-100 rounded-2xl p-4 mb-6 outline-none" value={p} onChange={e=>setP(e.target.value)} />
          <div className="flex gap-3">
            <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl">Cancel</button>
            <button onClick={save} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl">Save</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-slate-900 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full max-w-[400px] bg-white relative flex flex-col shadow-2xl overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'log' && <HomeView />}
          {activeTab === 'foods' && <FoodsView />}
          {activeTab === 'trends' && <TrendsView />}
          {activeTab === 'plates' && <PhysicalPlatesView />}
        </div>
        
        <div className="h-20 bg-white border-t border-slate-100 flex items-center justify-around pb-safe shrink-0">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/4 ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}><Home size={20} /><span className="text-[10px] font-bold mt-1">Log</span></button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/4 ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}><Utensils size={20} /><span className="text-[10px] font-bold mt-1">Foods</span></button>
          <button onClick={() => setActiveTab('trends')} className={`flex flex-col items-center w-1/4 ${activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}`}><BarChart3 size={20} /><span className="text-[10px] font-bold mt-1">Trends</span></button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/4 ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}><Disc size={20} /><span className="text-[10px] font-bold mt-1">Plates</span></button>
        </div>

        {showAddFood && <AddFoodModal />}
        {/* ... (Other Modals) ... */}
      </div>
    </div>
  );
}
