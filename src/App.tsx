// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { 
  Home, Utensils, Plus, ChevronLeft, ChevronRight, 
  X, Check, Calendar, Trash2, Disc, Loader2, 
  AlertTriangle, BarChart3, Flame, Lightbulb
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

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
}

// STABLE ID: Hardcoded to ensure data persistence
const appId = 'nutriplate_aahbiodun_stable'; 

const getTodayString = () => new Date().toISOString().split('T')[0];
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(getTodayString());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [foods, setFoods] = useState([]);
  const [physicalPlates, setPhysicalPlates] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddPhysicalPlate, setShowAddPhysicalPlate] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const userPath = `artifacts/${appId}/users/${user.uid}`;
    const unsubFoods = onSnapshot(collection(db, `${userPath}/foods`), (s) => setFoods(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubPlates = onSnapshot(collection(db, `${userPath}/plates`), (s) => setPhysicalPlates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubLogs = onSnapshot(collection(db, `${userPath}/logs`), (s) => {
        setLogs(s.docs.map(d => ({id: d.id, ...d.data()})));
        setIsLoading(false);
    });
    return () => { unsubFoods(); unsubPlates(); unsubLogs(); };
  }, [user]);

  const calculateFoodCalories = (foodId, grams) => {
    const food = foods.find(f => f.id === foodId);
    return food ? (grams / 100) * (food.caloriesPer100g || 0) : 0;
  };

  const getLogStats = (log) => {
    if (log.type === 'food') return calculateFoodCalories(log.itemId, log.amountGrams);
    return (log.ingredients || []).reduce((acc, ing) => {
      return acc + calculateFoodCalories(ing.foodId, log.amountGrams * (ing.percentage / 100));
    }, 0);
  };

  const dailyLogs = logs.filter(l => l.date === currentDate);
  const totalCals = dailyLogs.reduce((t, log) => t + getLogStats(log), 0);

  // --- Modal Components ---
  const AddLogModal = () => {
    const [type, setType] = useState('food');
    const [selectedId, setSelectedId] = useState('');
    const [mealIngredients, setMealIngredients] = useState([{ foodId: '', percentage: '' }]);
    const [usePlate, setUsePlate] = useState(false);
    const [selectedPlateId, setSelectedPlateId] = useState('');
    const [weightInput, setWeightInput] = useState('');

    const plate = physicalPlates.find(p => p.id === selectedPlateId);
    const netAmount = usePlate ? (parseFloat(weightInput || 0) - (plate?.weightGrams || 0)) : parseFloat(weightInput || 0);

    const handleSave = async () => {
      if (netAmount <= 0) return;
      const id = generateId();
      const newLog = { id, date: currentDate, type, amountGrams: netAmount };
      if (type === 'food') newLog.itemId = selectedId;
      else newLog.ingredients = mealIngredients.map(i => ({ foodId: i.foodId, percentage: parseFloat(i.percentage) }));
      
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', id), newLog);
      setShowAddLog(false);
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
        <div className="bg-white rounded-t-[32px] p-6 pb-12 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Log Calories</h2>
            <button onClick={() => setShowAddLog(false)}><X /></button>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button onClick={() => setType('food')} className={`flex-1 py-2 rounded-lg ${type === 'food' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Single Item</button>
            <button onClick={() => setType('meal')} className={`flex-1 py-2 rounded-lg ${type === 'meal' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Combo Meal</button>
          </div>
          <div className="space-y-4">
            {type === 'food' ? (
              <select className="w-full bg-slate-50 p-4 rounded-xl border" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <option value="">Select Food...</option>
                {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            ) : (
              <div className="space-y-2">
                {mealIngredients.map((ing, i) => (
                  <div key={i} className="flex gap-2">
                    <select className="flex-1 bg-slate-50 p-3 rounded-xl border text-sm" value={ing.foodId} onChange={e => {
                        const n = [...mealIngredients]; n[i].foodId = e.target.value; setMealIngredients(n);
                    }}>
                        <option value="">Food...</option>
                        {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input className="w-20 bg-slate-50 p-3 rounded-xl border text-sm" placeholder="%" value={ing.percentage} onChange={e => {
                        const n = [...mealIngredients]; n[i].percentage = e.target.value; setMealIngredients(n);
                    }}/>
                  </div>
                ))}
                <button onClick={() => setMealIngredients([...mealIngredients, {foodId:'', percentage:''}])} className="text-emerald-600 text-xs font-bold">+ Add Ingredient</button>
              </div>
            )}
            <div className="bg-slate-50 p-4 rounded-xl border">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold uppercase text-slate-400">Plate Deduction</span>
                    <input type="checkbox" checked={usePlate} onChange={e => setUsePlate(e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                </div>
                {usePlate && (
                    <select className="w-full bg-white p-3 rounded-lg border mb-3 text-sm" value={selectedPlateId} onChange={e => setSelectedPlateId(e.target.value)}>
                        <option value="">Select Plate...</option>
                        {physicalPlates.map(p => <option key={p.id} value={p.id}>{p.name} ({p.weightGrams}g)</option>)}
                    </select>
                )}
                <input className="w-full bg-white p-4 rounded-xl border font-bold" placeholder={usePlate ? "Gross Weight on Scale" : "Actual Food Weight"} value={weightInput} onChange={e => setWeightInput(e.target.value)} />
            </div>
            <button onClick={handleSave} className="w-full bg-emerald-600 text-white font-bold py-5 rounded-2xl shadow-lg active:scale-95 transition-transform">Log {netAmount > 0 ? `${Math.round(netAmount)}g` : 'Meal'}</button>
          </div>
        </div>
      </div>
    );
  };

  const AddFoodModal = () => {
    const [n, setN] = useState('');
    const [c, setC] = useState('');
    const save = async () => {
        if (!n || !c) return;
        const id = generateId();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'foods', id), { id, name: n, caloriesPer100g: parseFloat(c) });
        setShowAddFood(false);
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                <h2 className="text-xl font-bold mb-6">Register New Food</h2>
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-3 outline-none" placeholder="Food Name" value={n} onChange={e => setN(e.target.value)} />
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-8 outline-none" placeholder="Calories per 100g" type="number" value={c} onChange={e => setC(e.target.value)} />
                <div className="flex gap-3">
                  <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 p-4 rounded-xl font-bold text-slate-400">Cancel</button>
                  <button onClick={save} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl">Save</button>
                </div>
            </div>
        </div>
    );
  };

  const AddPlateModal = () => {
    const [n, setN] = useState('');
    const [w, setW] = useState('');
    const save = async () => {
        if (!n || !w) return;
        const id = generateId();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plates', id), { id, name: n, weightGrams: parseFloat(w) });
        setShowAddPhysicalPlate(false);
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                <h2 className="text-xl font-bold mb-6">Register Plate</h2>
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-3 outline-none" placeholder="Plate Name" value={n} onChange={e => setN(e.target.value)} />
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-8 outline-none" placeholder="Empty Weight (g)" type="number" value={w} onChange={e => setW(e.target.value)} />
                <div className="flex gap-3">
                  <button onClick={() => setShowAddPhysicalPlate(false)} className="flex-1 bg-slate-100 p-4 rounded-xl font-bold text-slate-400">Cancel</button>
                  <button onClick={save} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl">Save</button>
                </div>
            </div>
        </div>
    );
  };

  const HomeView = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] p-6 pb-12 shadow-md shrink-0">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronLeft size={24} /></button>
          <div className="font-bold text-[10px] uppercase tracking-widest">{currentDate}</div>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronRight size={24} /></button>
        </div>
        <div className="text-center">
          <div className="text-6xl font-black">{Math.round(totalCals)}<span className="text-xl font-normal ml-1 opacity-60">kcal</span></div>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-6 overflow-y-auto pb-32">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 min-h-full">
          <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-4">Daily Entries</h3>
          {dailyLogs.length === 0 ? <div className="text-center py-20 text-slate-300 italic text-sm">No calories logged.</div> : (
            <div className="space-y-3">
              {dailyLogs.map(log => {
                const s = getLogStats(log);
                return (
                  <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">{log.type === 'food' ? (foods.find(f => f.id === log.itemId)?.name) : 'Combined Meal'}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{Math.round(log.amountGrams)}g</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-black text-emerald-600 text-sm">{Math.round(s)} kcal</div>
                      <button onClick={async () => { await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, log.id)); }} className="text-slate-300 hover:text-red-400"><Trash2 size={18} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <button onClick={() => setShowAddLog(true)} className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-transform z-30"><Plus size={32} /></button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none select-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative overflow-hidden">
        <div className="flex-1 relative overflow-hidden bg-white">
          {isLoading && <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>}
          <div className="h-full w-full">
            {activeTab === 'log' && <HomeView />}
            {activeTab === 'foods' && (
                <div className="p-6 h-full overflow-y-auto pb-32">
                    <h2 className="text-2xl font-black mb-6">Food Registry</h2>
                    <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4 hover:bg-slate-50 transition-colors">+ New Food</button>
                    {foods.map(f => (
                        <div key={f.id} className="p-4 bg-slate-50 rounded-2xl border mb-2 flex justify-between">
                            <span className="font-bold">{f.name}</span>
                            <span className="text-xs text-slate-400 font-bold">{f.caloriesPer100g} kcal/100g</span>
                        </div>
                    ))}
                </div>
            )}
            {activeTab === 'trends' && (
               <div className="p-6 h-full overflow-y-auto pb-32 bg-slate-50">
                  <h2 className="text-2xl font-black mb-6">Calorie Trends</h2>
                  <div className="bg-white p-6 rounded-3xl border mb-6 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">7-Day Consistency</h3>
                    <div className="flex items-end justify-between h-32 gap-3">
                      {[...Array(7)].map((_, i) => {
                        const d = new Date(); d.setDate(d.getDate() - (6-i));
                        const ds = d.toISOString().split('T')[0];
                        const dayCals = logs.filter(l => l.date === ds).reduce((t, l) => t + getLogStats(l), 0);
                        const h = Math.min((dayCals / 3000) * 100, 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full bg-emerald-500 rounded-t-xl" style={{ height: `${h}%`, minHeight: '4px' }} />
                            <span className="text-[10px] font-bold text-slate-300 uppercase">{d.toLocaleDateString(undefined, {weekday: 'short'})}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                      <Lightbulb size={18} />
                      <span className="font-black text-[10px] uppercase tracking-widest">Consistency Fact</span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">Using a dedicated scale for physical plates reduces log errors by over 20% compared to eye-balling portions.</p>
                  </div>
               </div>
            )}
            {activeTab === 'plates' && (
                <div className="p-6 h-full overflow-y-auto pb-32">
                    <h2 className="text-2xl font-black mb-6">My Plates</h2>
                    <button onClick={() => setShowAddPhysicalPlate(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4">+ Register Plate</button>
                    {physicalPlates.map(p => (
                        <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border mb-2 flex justify-between items-center">
                            <span className="font-bold">{p.name}</span>
                            <span className="font-black text-emerald-600">{p.weightGrams}g</span>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>

        <div className="h-24 bg-white border-t border-slate-100 flex items-center justify-around shrink-0 z-40 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/4 ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Home size={22} /><span className="text-[10px] font-black mt-1 uppercase tracking-widest">Log</span>
          </button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/4 ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Utensils size={22} /><span className="text-[10px] font-black mt-1 uppercase tracking-widest">Foods</span>
          </button>
          <button onClick={() => setActiveTab('trends')} className={`flex flex-col items-center w-1/4 ${activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <BarChart3 size={22} /><span className="text-[10px] font-black mt-1 uppercase tracking-widest">Trends</span>
          </button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/4 ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Disc size={22} /><span className="text-[10px] font-black mt-1 uppercase tracking-widest">Plates</span>
          </button>
        </div>

        {showAddLog && <AddLogModal />}
        {showAddFood && <AddFoodModal />}
        {showAddPhysicalPlate && <AddPlateModal />}
      </div>
    </div>
  );
}
