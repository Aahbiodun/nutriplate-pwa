// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { 
  Home, Utensils, Plus, ChevronLeft, ChevronRight, 
  X, Check, Calendar, Trash2, Disc, Loader2, 
  AlertTriangle, BarChart3, Flame, Lightbulb, Edit2
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// --- Firebase Setup ---
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

// CRITICAL: DO NOT CHANGE THIS ID. IT PROTECTS YOUR EXISTING ENTRIES.
const appId = 'nutriplate_aahbiodun_stable'; 
const CALORIE_GOAL = 2500; 

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
  const [editingFood, setEditingFood] = useState(null);

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
    onSnapshot(collection(db, `${userPath}/foods`), (s) => setFoods(s.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, `${userPath}/plates`), (s) => setPhysicalPlates(s.docs.map(d => ({id: d.id, ...d.data()}))));
    onSnapshot(collection(db, `${userPath}/logs`), (s) => {
        setLogs(s.docs.map(d => ({id: d.id, ...d.data()})));
        setIsLoading(false);
    });
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
  const remaining = CALORIE_GOAL - totalCals;

  const HomeView = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] p-6 pb-12 shadow-md shrink-0">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronLeft/></button>
          <div className="font-bold text-[10px] uppercase tracking-widest">{currentDate}</div>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronRight/></button>
        </div>
        <div className="text-center space-y-2">
          <div className="text-6xl font-black">{Math.round(totalCals)}<span className="text-lg font-normal ml-1 opacity-60">kcal</span></div>
          <div className="text-emerald-100 font-bold text-sm">
            {remaining > 0 ? `${Math.round(remaining)} Remaining` : `${Math.round(Math.abs(remaining))} Over Goal`}
          </div>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-6 overflow-y-auto pb-32">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 min-h-full">
          {dailyLogs.length === 0 ? <div className="text-center py-20 text-slate-300 italic text-sm">No entries.</div> : (
            <div className="space-y-3">
              {dailyLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block truncate">{log.type === 'food' ? (foods.find(f => f.id === log.itemId)?.name) : 'Combo Meal'}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{Math.round(log.amountGrams)}g</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-black text-emerald-600 text-sm">{Math.round(getLogStats(log))} kcal</div>
                    <button onClick={async () => { await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/logs`, log.id)); }} className="text-slate-300"><Trash2 size={18} /></button>
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
                <h2 className="text-2xl font-black mb-6">Food Registry</h2>
                <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold mb-4">+ New Food</button>
                {foods.map(f => (
                    <div key={f.id} className="p-4 bg-slate-50 rounded-2xl border mb-2 flex justify-between items-center">
                        <div>
                          <span className="font-bold block">{f.name}</span>
                          <span className="text-xs text-slate-400 font-bold uppercase">{f.caloriesPer100g} kcal/100g</span>
                        </div>
                        <div className="flex gap-4">
                          <button onClick={() => setEditingFood(f)} className="text-slate-300"><Edit2 size={18}/></button>
                          <button onClick={async () => { await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/foods`, f.id)); }} className="text-red-300"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
          )}
          {activeTab === 'trends' && (
            <div className="p-6 h-full overflow-y-auto pb-32 bg-slate-50">
                <h2 className="text-2xl font-black mb-6">Trends</h2>
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                  <div className="flex items-end justify-between h-32 gap-3">
                    {[...Array(7)].map((_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (6-i));
                      const ds = d.toISOString().split('T')[0];
                      const dayCals = logs.filter(l => l.date === ds).reduce((t, l) => t + getLogStats(l), 0);
                      const h = Math.min((dayCals / CALORIE_GOAL) * 100, 100);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div className="w-full bg-emerald-500 rounded-t-xl" style={{ height: `${h}%`, minHeight: '4px' }} />
                          <span className="text-[10px] font-bold text-slate-300 uppercase">{d.toLocaleDateString(undefined, {weekday: 'short'})}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
            </div>
          )}
          {activeTab === 'plates' && (
            <div className="p-6 h-full overflow-y-auto pb-32">
                <h2 className="text-2xl font-black mb-6">Plates</h2>
                {physicalPlates.map(p => (
                    <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border mb-2 flex justify-between items-center">
                        <span className="font-bold">{p.name}</span>
                        <span className="font-black text-emerald-600">{p.weightGrams}g</span>
                    </div>
                ))}
            </div>
          )}
        </div>

        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/4 ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Home size={22} /><span className="text-[10px] font-black mt-1 uppercase">Log</span>
          </button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/4 ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Utensils size={22} /><span className="text-[10px] font-black mt-1 uppercase">Foods</span>
          </button>
          <button onClick={() => setActiveTab('trends')} className={`flex flex-col items-center w-1/4 ${activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <BarChart3 size={22} /><span className="text-[10px] font-black mt-1 uppercase">Trends</span>
          </button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/4 ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Disc size={22} /><span className="text-[10px] font-black mt-1 uppercase">Plates</span>
          </button>
        </div>

        {/* Edit/Add Food Modal */}
        {(showAddFood || editingFood) && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-xl font-bold mb-6">{editingFood ? 'Edit Food' : 'New Food'}</h2>
              <input id="food-n" className="w-full bg-slate-50 p-4 rounded-xl border mb-3 outline-none" placeholder="Name" defaultValue={editingFood?.name || ''} />
              <input id="food-c" className="w-full bg-slate-50 p-4 rounded-xl border mb-8 outline-none" placeholder="Cals/100g" type="number" defaultValue={editingFood?.caloriesPer100g || ''} />
              <div className="flex gap-3">
                <button onClick={() => { setShowAddFood(false); setEditingFood(null); }} className="flex-1 bg-slate-100 p-4 rounded-xl font-bold text-slate-400">Cancel</button>
                <button onClick={async () => {
                  const n = document.getElementById('food-n').value; const c = document.getElementById('food-c').value;
                  if (n && c) {
                    const id = editingFood?.id || generateId();
                    await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/foods`, id), { id, name: n, caloriesPer100g: parseFloat(c) });
                    setShowAddFood(false); setEditingFood(null);
                  }
                }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-xl">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
