// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, Utensils, Plus, ChevronLeft, ChevronRight, 
  X, Check, Calendar, Trash2, Disc, Loader2, 
  AlertTriangle, BarChart3, Edit2, Target, TrendingUp, TrendingDown, Info
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDvjWr4zwwbLCaKB0HA8lrJpf_dccx2DPY',
  authDomain: 'food-log-abc32.firebaseapp.com',
  projectId: 'food-log-abc32',
  storageBucket: 'food-log-abc32.firebasestorage.app',
  messagingSenderId: '575042025031',
  appId: '1:575042025031:web:f11b840bb418c3218da362',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => {});

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
  const [dailyGoal, setDailyGoal] = useState(2500);
  
  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddPlate, setShowAddPlate] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [showTargetModal, setShowTargetModal] = useState(false);

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
    onSnapshot(doc(db, `${userPath}/settings/goal`), (doc) => { if (doc.exists()) setDailyGoal(doc.data().value); });
    onSnapshot(collection(db, `${userPath}/foods`), (s) => setFoods(s.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => a.name.localeCompare(b.name))));
    onSnapshot(collection(db, `${userPath}/plates`), (s) => setPhysicalPlates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, `${userPath}/logs`), (s) => { setLogs(s.docs.map(d => ({id: d.id, ...d.data()}))); setIsLoading(false); });
  }, [user]);

  const calculateFoodCalories = (foodId, grams) => {
    const food = foods.find(f => f.id === foodId);
    return food ? (grams / 100) * (food.caloriesPer100g || 0) : 0;
  };

  const getLogStats = (log) => {
    if (log.type === 'food') return calculateFoodCalories(log.itemId, log.amountGrams);
    return (log.ingredients || []).reduce((acc, ing) => acc + calculateFoodCalories(ing.foodId, log.amountGrams * (ing.percentage / 100)), 0);
  };

  const dailyLogs = logs.filter(l => l.date === currentDate);
  const totalCals = dailyLogs.reduce((t, log) => t + getLogStats(log), 0);
  const remaining = dailyGoal - totalCals;

  const efficiencyMetrics = useMemo(() => {
    if (foods.length === 0) return { best: null, worst: null };
    const sorted = [...foods].sort((a, b) => a.caloriesPer100g - b.caloriesPer100g);
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [foods]);

  const AddLogModal = () => {
    const [type, setType] = useState('food');
    const [selectedId, setSelectedId] = useState('');
    const [mealIngredients, setMealIngredients] = useState([{ foodId: '', percentage: '' }]);
    const [usePlate, setUsePlate] = useState(false);
    const [selectedPlateId, setSelectedPlateId] = useState('');
    const [weightInput, setWeightInput] = useState('');
    const plate = physicalPlates.find(p => p.id === selectedPlateId);
    const netWeight = usePlate ? (parseFloat(weightInput || 0) - (plate?.weightGrams || 0)) : parseFloat(weightInput || 0);

    const handleSave = async () => {
      if (netWeight <= 0) return;
      const id = generateId();
      const newLog = { id, date: currentDate, type, amountGrams: netWeight };
      if (type === 'food') newLog.itemId = selectedId;
      else newLog.ingredients = mealIngredients.map(i => ({ foodId: i.foodId, percentage: parseFloat(i.percentage) }));
      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, id), newLog);
      setShowAddLog(false);
    };

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
        <div className="bg-white rounded-t-[32px] p-6 pb-12 overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Log Calories</h2><button onClick={() => setShowAddLog(false)}><X /></button></div>
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button onClick={() => setType('food')} className={`flex-1 py-2 rounded-lg ${type === 'food' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Single</button>
            <button onClick={() => setType('meal')} className={`flex-1 py-2 rounded-lg ${type === 'meal' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Combo</button>
          </div>
          {type === 'food' ? (
            <select className="w-full bg-slate-50 p-4 rounded-xl border mb-4" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Select Food...</option>
              {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          ) : (
            <div className="space-y-2 mb-4">
              {mealIngredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <select className="flex-1 bg-slate-50 p-3 rounded-xl border text-sm" value={ing.foodId} onChange={e => { const n = [...mealIngredients]; n[i].foodId = e.target.value; setMealIngredients(n); }}>
                      <option value="">Food...</option>
                      {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input className="w-20 bg-slate-50 p-3 rounded-xl border text-sm" placeholder="%" value={ing.percentage} onChange={e => { const n = [...mealIngredients]; n[i].percentage = e.target.value; setMealIngredients(n); }}/>
                </div>
              ))}
              <button onClick={() => setMealIngredients([...mealIngredients, {foodId:'', percentage:''}])} className="text-emerald-600 text-xs font-black">+ Add Item</button>
            </div>
          )}
          <div className="bg-slate-50 p-4 rounded-xl border mb-6">
            <div className="flex justify-between items-center mb-4 text-xs font-bold uppercase text-slate-400"><span>Use Plate Weight?</span><input type="checkbox" checked={usePlate} onChange={e => setUsePlate(e.target.checked)} className="w-5 h-5 accent-emerald-600" /></div>
            {usePlate && <select className="w-full bg-white p-3 rounded-lg border mb-3 text-sm" value={selectedPlateId} onChange={e => setSelectedPlateId(e.target.value)}>
                <option value="">Select Plate...</option>
                {physicalPlates.map(p => <option key={p.id} value={p.id}>{p.name} ({p.weightGrams}g)</option>)}
            </select>}
            <input className="w-full bg-white p-4 rounded-xl border font-bold" placeholder="Scale Weight" type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)} />
          </div>
          <button onClick={handleSave} className="w-full bg-emerald-600 text-white font-bold py-5 rounded-2xl shadow-lg">Save {netWeight > 0 ? `${Math.round(netWeight)}g` : ''}</button>
        </div>
      </div>
    );
  };

  const TrendsView = () => {
    const sevenDayData = useMemo(() => {
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const dayCals = logs.filter(l => l.date === ds).reduce((t, l) => t + getLogStats(l), 0);
        result.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), c: dayCals });
      }
      return result;
    }, [logs, foods]);

    const maxCals = Math.max(...sevenDayData.map(d => d.c), 1);

    return (
      <div className="p-6 h-full overflow-y-auto pb-32 bg-slate-50 animate-in fade-in duration-500">
        <h2 className="text-2xl font-black mb-6 text-slate-800">Performance Trends</h2>
        
        {/* Weekly Chart */}
        <div className="bg-white p-6 rounded-3xl border mb-6 shadow-sm">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">7-Day Consistency</h3>
          <div className="flex items-end justify-between h-32 gap-3">
            {sevenDayData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-emerald-500 rounded-t-xl transition-all duration-500" style={{ height: `${(d.c / (maxCals || 1)) * 100}%`, minHeight: '4px' }} />
                <span className="text-[10px] font-bold text-slate-300 uppercase">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calorie Efficiency Section */}
        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-2">Calorie Efficiency</h3>
        <div className="space-y-3 mb-6">
          {efficiencyMetrics.best && (
            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500 p-2 rounded-xl text-white"><TrendingDown size={20} /></div>
                <div>
                  <span className="text-[10px] font-black text-emerald-600 uppercase">Best (Low Density)</span>
                  <div className="font-black text-slate-800">{efficiencyMetrics.best.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-emerald-600">{efficiencyMetrics.best.caloriesPer100g}</div>
                <div className="text-[10px] font-bold text-slate-400">kcal/100g</div>
              </div>
            </div>
          )}
          {efficiencyMetrics.worst && (
            <div className="bg-red-50 border border-red-100 p-5 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-red-500 p-2 rounded-xl text-white"><TrendingUp size={20} /></div>
                <div>
                  <span className="text-[10px] font-black text-red-600 uppercase">Worst (High Density)</span>
                  <div className="font-black text-slate-800">{efficiencyMetrics.worst.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-red-600">{efficiencyMetrics.worst.caloriesPer100g}</div>
                <div className="text-[10px] font-bold text-slate-400">kcal/100g</div>
              </div>
            </div>
          )}
        </div>

        <div onClick={() => setShowTargetModal(true)} className="bg-white p-6 rounded-3xl border shadow-sm flex justify-between items-center active:scale-95 transition-transform cursor-pointer">
           <div className="flex items-center gap-3"><Target className="text-emerald-600"/><span className="font-bold text-slate-700">Daily Target</span></div>
           <span className="font-black text-emerald-600 text-lg">{dailyGoal} kcal</span>
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
          <div className="text-emerald-100 font-bold text-sm mt-2">{remaining > 0 ? `${Math.round(remaining)} Left` : `${Math.round(Math.abs(remaining))} Over`}</div>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-6 overflow-y-auto pb-32 pt-2">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 min-h-full">
          {dailyLogs.length === 0 ? <div className="text-center py-20 text-slate-300 italic text-sm">No entries logged.</div> : (
            <div className="space-y-3">
              {dailyLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 border rounded-2xl">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block truncate">{log.type === 'food' ? (foods.find(f => f.id === log.itemId)?.name) : 'Combo Meal'}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{Math.round(log.amountGrams)}g</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-black text-emerald-600 text-sm">{Math.round(getLogStats(log))} kcal</div>
                    <button onClick={async () => { await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, log.id)); }} className="text-slate-300"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <button onClick={() => setShowAddLog(true)} className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-95 transition-transform z-30"><Plus size={32} /></button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none select-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {isLoading && <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>}
          {activeTab === 'log' && <HomeView />}
          {activeTab === 'foods' && (
            <div className="p-6 h-full overflow-y-auto pb-32">
                <h2 className="text-2xl font-black mb-6 text-slate-800">Registry</h2>
                <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4">+ New Food</button>
                {foods.map(f => (
                    <div key={f.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center mb-2 shadow-sm">
                        <div><span className="font-bold block text-slate-700">{f.name}</span><span className="text-[10px] text-slate-400 font-bold uppercase">{f.caloriesPer100g} kcal/100g</span></div>
                        <div className="flex gap-4">
                          <button onClick={() => setEditingFood(f)} className="text-slate-300"><Edit2 size={18}/></button>
                          <button onClick={async () => { await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/foods`, f.id)); }} className="text-slate-200"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
          )}
          {activeTab === 'trends' && <TrendsView />}
          {activeTab === 'plates' && (
            <div className="p-6 h-full overflow-y-auto pb-32">
                <h2 className="text-2xl font-black mb-6 text-slate-800">Plates</h2>
                <button onClick={() => setShowAddPlate(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4">+ Register Plate</button>
                {physicalPlates.map(p => (
                    <div key={p.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center mb-2 shadow-sm">
                        <span className="font-bold text-slate-700">{p.name}</span>
                        <div className="flex items-center gap-4"><span className="font-black text-emerald-600">{p.weightGrams}g</span><button onClick={async () => { await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/plates`, p.id)); }} className="text-slate-200"><Trash2 size={18}/></button></div>
                    </div>
                ))}
            </div>
          )}
        </div>

        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 z-40 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/4 ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}><Home size={22} /><span className="text-[10px] font-black mt-1 uppercase">Log</span></button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/4 ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}><Utensils size={22} /><span className="text-[10px] font-black mt-1 uppercase">Registry</span></button>
          <button onClick={() => setActiveTab('trends')} className={`flex flex-col items-center w-1/4 ${activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}`}><BarChart3 size={22} /><span className="text-[10px] font-black mt-1 uppercase">Trends</span></button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/4 ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}><Disc size={22} /><span className="text-[10px] font-black mt-1 uppercase">Plates</span></button>
        </div>

        {showAddLog && <AddLogModal />}
        {showTargetModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-xl font-bold mb-6">Set Daily Target</h2>
              <input id="tg-v" className="w-full bg-slate-50 p-4 rounded-xl border mb-8 outline-none font-black text-2xl text-center" type="number" defaultValue={dailyGoal} />
              <div className="flex gap-3">
                <button onClick={() => setShowTargetModal(false)} className="flex-1 bg-slate-100 p-4 rounded-xl font-bold text-slate-400">Cancel</button>
                <button onClick={async () => {
                  const v = document.getElementById('tg-v').value;
                  if (v) { await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/settings/goal`), { value: parseInt(v) }); setShowTargetModal(false); }
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl">Save</button>
              </div>
            </div>
          </div>
        )}
        {(showAddFood || editingFood) && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-[2.5rem] p-8">
              <h2 className="text-xl font-bold mb-6">{editingFood ? 'Edit Food' : 'New Food'}</h2>
              <input id="f-n" className="w-full bg-slate-50 p-4 rounded-xl border mb-3 outline-none" placeholder="Name" defaultValue={editingFood?.name || ''} />
              <input id="f-c" className="w-full bg-slate-50 p-4 rounded-xl border mb-8 outline-none" placeholder="Cals/100g" type="number" defaultValue={editingFood?.caloriesPer100g || ''} />
              <div className="flex gap-3">
                <button onClick={() => { setShowAddFood(false); setEditingFood(null); }} className="flex-1 bg-slate-100 p-4 rounded-xl font-bold text-slate-400 text-sm">Cancel</button>
                <button onClick={async () => {
                  const n = document.getElementById('f-n').value; const c = document.getElementById('f-c').value;
                  if (n && c) {
                    const id = editingFood?.id || generateId();
                    await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/foods`, id), { id, name: n, caloriesPer100g: parseFloat(c) });
                    setShowAddFood(false); setEditingFood(null);
                  }
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl text-sm">Save</button>
              </div>
            </div>
          </div>
        )}
        {showAddPlate && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                <h2 className="text-xl font-bold mb-6">Register Plate</h2>
                <input id="p-n" className="w-full bg-slate-50 p-4 rounded-xl border mb-3 outline-none" placeholder="Plate Name" />
                <input id="p-w" className="w-full bg-slate-50 p-4 rounded-xl border mb-8 outline-none" placeholder="Empty Weight (g)" type="number" />
                <div className="flex gap-3">
                  <button onClick={() => setShowAddPlate(false)} className="flex-1 bg-slate-100 p-4 rounded-xl font-bold text-slate-400 text-sm">Cancel</button>
                  <button onClick={async () => {
                    const n = document.getElementById('p-n').value; const w = document.getElementById('p-w').value;
                    if (n && w) { const id = generateId(); await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/plates`, id), { id, name: n, weightGrams: parseFloat(w) }); setShowAddPlate(false); }
                  }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl text-sm">Save</button>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
