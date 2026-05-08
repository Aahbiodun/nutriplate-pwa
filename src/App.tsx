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
  AlertTriangle
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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

  useEffect(() => {
    if (!isFirebaseConfigured) { setIsLoading(false); return; }
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        setGlobalError("Authentication Failed: " + error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isFirebaseConfigured) { setIsLoading(false); return; }
    setIsLoading(true);
    const foodsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'foods');
    const platesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'plates');
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    
    const unsubFoods = onSnapshot(foodsRef, (s) => setFoods(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubPlates = onSnapshot(platesRef, (s) => setPhysicalPlates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubLogs = onSnapshot(logsRef, (s) => {
        setLogs(s.docs.map(d => ({id: d.id, ...d.data()})));
        setIsLoading(false);
    });
    return () => { unsubFoods(); unsubPlates(); unsubLogs(); };
  }, [user]);

  const calculateFoodCalories = (foodId, grams) => {
    const food = foods.find(f => f.id === foodId);
    return food ? (grams / 100) * food.caloriesPer100g : 0;
  };

  const getLogDetails = (log) => {
    if (log.type === 'food') {
      const food = foods.find(f => f.id === log.itemId);
      return { name: food?.name || 'Unknown Food', calories: calculateFoodCalories(log.itemId, log.amountGrams), subtitle: `${log.amountGrams}g item` };
    }
    const calories = (log.ingredients || []).reduce((t, ing) => t + calculateFoodCalories(ing.foodId, log.amountGrams * (ing.percentage / 100)), 0);
    return { name: 'Combined Meal', calories, subtitle: `${log.amountGrams}g combo` };
  };

  const dailyLogs = logs.filter(l => l.date === currentDate);
  const totalDailyCalories = dailyLogs.reduce((t, log) => t + getLogDetails(log).calories, 0);

  const deleteLog = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', id));
  };

  // --- Modals ---
  const AddLogModal = () => {
    const [type, setType] = useState('food');
    const [selectedId, setSelectedId] = useState('');
    const [mealIngredients, setMealIngredients] = useState([{ foodId: '', percentage: '' }]);
    const [usePlate, setUsePlate] = useState(false);
    const [selectedPlateId, setSelectedPlateId] = useState('');
    const [weightInput, setWeightInput] = useState('');

    const plate = physicalPlates.find(p => p.id === selectedPlateId);
    const netAmount = usePlate ? (parseFloat(weightInput) - (plate?.weightGrams || 0)) : parseFloat(weightInput);

    const handleSave = async () => {
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
            <h2 className="text-xl font-bold">Log Food</h2>
            <button onClick={() => setShowAddLog(false)}><X /></button>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button onClick={() => setType('food')} className={`flex-1 py-2 rounded-lg ${type === 'food' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Single</button>
            <button onClick={() => setType('meal')} className={`flex-1 py-2 rounded-lg ${type === 'meal' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Combo</button>
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
                    <select className="flex-1 bg-slate-50 p-3 rounded-xl border" value={ing.foodId} onChange={e => {
                        const n = [...mealIngredients]; n[i].foodId = e.target.value; setMealIngredients(n);
                    }}>
                        <option value="">Food...</option>
                        {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input className="w-20 bg-slate-50 p-3 rounded-xl border" placeholder="%" value={ing.percentage} onChange={e => {
                        const n = [...mealIngredients]; n[i].percentage = e.target.value; setMealIngredients(n);
                    }}/>
                  </div>
                ))}
                <button onClick={() => setMealIngredients([...mealIngredients, {foodId:'', percentage:''}])} className="text-emerald-600 text-sm font-bold">+ Add</button>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold">Use Plate?</span>
                    <input type="checkbox" checked={usePlate} onChange={e => setUsePlate(e.target.checked)} />
                </div>
                {usePlate && (
                    <select className="w-full bg-white p-3 rounded-lg border mb-3" value={selectedPlateId} onChange={e => setSelectedPlateId(e.target.value)}>
                        <option value="">Select Plate...</option>
                        {physicalPlates.map(p => <option key={p.id} value={p.id}>{p.name} ({p.weightGrams}g)</option>)}
                    </select>
                )}
                <input className="w-full bg-white p-4 rounded-xl border font-bold" placeholder="Weight on Scale" value={weightInput} onChange={e => setWeightInput(e.target.value)} />
            </div>

            <button onClick={handleSave} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg">Save {netAmount > 0 ? `${netAmount}g` : ''}</button>
          </div>
        </div>
      </div>
    );
  };

  const AddFoodModal = () => {
    const [n, setN] = useState('');
    const [c, setC] = useState('');
    const save = async () => {
        const id = generateId();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'foods', id), { id, name: n, caloriesPer100g: parseFloat(c) });
        setShowAddFood(false);
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-3xl p-8 shadow-2xl">
                <h2 className="text-xl font-bold mb-6">Register Food</h2>
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-3" placeholder="Name" value={n} onChange={e => setN(e.target.value)} />
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-6" placeholder="Calories per 100g" value={c} onChange={e => setC(e.target.value)} />
                <button onClick={save} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl">Save</button>
            </div>
        </div>
    );
  };

  const AddPhysicalPlateModal = () => {
    const [n, setN] = useState('');
    const [w, setW] = useState('');
    const save = async () => {
        const id = generateId();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plates', id), { id, name: n, weightGrams: parseFloat(w) });
        setShowAddPhysicalPlate(false);
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-3xl p-8 shadow-2xl">
                <h2 className="text-xl font-bold mb-6">Register Plate</h2>
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-3" placeholder="Name" value={n} onChange={e => setN(e.target.value)} />
                <input className="w-full bg-slate-50 p-4 rounded-xl border mb-6" placeholder="Weight (grams)" value={w} onChange={e => setW(e.target.value)} />
                <button onClick={save} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl">Save</button>
            </div>
        </div>
    );
  };

  const HomeView = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] p-6 pb-12 shadow-md shrink-0">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]); }} className="p-2"><ChevronLeft size={24} /></button>
          <div className="font-bold uppercase tracking-widest text-xs">{currentDate}</div>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]); }} className="p-2"><ChevronRight size={24} /></button>
        </div>
        <div className="text-center">
          <div className="text-6xl font-black">{Math.round(totalDailyCalories)}<span className="text-xl font-normal ml-1">kcal</span></div>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-6 overflow-y-auto pb-32">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 min-h-full">
          <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-4">Meal Log</h3>
          {dailyLogs.length === 0 ? <div className="text-center py-20 text-slate-300 italic text-sm">No food logged.</div> : (
            <div className="space-y-3">
              {dailyLogs.map(log => {
                const d = getLogDetails(log);
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-bold text-slate-800 truncate">{d.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{d.subtitle}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="font-black text-emerald-600">{Math.round(d.calories)} kcal</span>
                      <button onClick={() => deleteLog(log.id)} className="text-slate-300"><Trash2 size={18} /></button>
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
                    <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4">+ New Food</button>
                    {foods.map(f => (
                        <div key={f.id} className="p-4 bg-slate-50 rounded-2xl border mb-2 flex justify-between">
                            <span className="font-bold">{f.name}</span>
                            <span className="text-xs text-slate-400 font-bold">{f.caloriesPer100g} kcal/100g</span>
                        </div>
                    ))}
                </div>
            )}
            {activeTab === 'plates' && (
                <div className="p-6 h-full overflow-y-auto pb-32">
                    <h2 className="text-2xl font-black mb-6">My Plates</h2>
                    <button onClick={() => setShowAddPhysicalPlate(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4">+ New Plate</button>
                    {physicalPlates.map(p => (
                        <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border mb-2 flex justify-between items-center">
                            <span className="font-bold">{p.name}</span>
                            <span className="text-emerald-600 font-black">{p.weightGrams}g</span>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>

        <div className="h-24 bg-white border-t border-slate-100 flex items-center justify-around shrink-0 z-40 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/3 ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Home size={22} /><span className="text-[10px] font-black mt-1">Log</span>
          </button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/3 ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Utensils size={22} /><span className="text-[10px] font-black mt-1">Foods</span>
          </button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/3 ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Disc size={22} /><span className="text-[10px] font-black mt-1">Plates</span>
          </button>
        </div>

        {showAddLog && <AddLogModal />}
        {showAddFood && <AddFoodModal />}
        {showAddPhysicalPlate && <AddPhysicalPlateModal />}
      </div>
    </div>
  );
}
