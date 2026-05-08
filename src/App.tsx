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
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
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
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
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
    const fallbackTimer = setTimeout(() => setIsLoading(false), 3000);
    const foodsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'foods');
    const platesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'plates');
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    let loaders = 3;
    const checkLoaded = () => { loaders--; if (loaders <= 0) { setIsLoading(false); clearTimeout(fallbackTimer); } }
    const unsubFoods = onSnapshot(foodsRef, (s) => { setFoods(s.docs.map(d => ({id: d.id, ...d.data()}))); checkLoaded(); });
    const unsubPlates = onSnapshot(platesRef, (s) => { setPhysicalPlates(s.docs.map(d => ({id: d.id, ...d.data()}))); checkLoaded(); });
    const unsubLogs = onSnapshot(logsRef, (s) => { setLogs(s.docs.map(d => ({id: d.id, ...d.data()}))); checkLoaded(); });
    return () => { clearTimeout(fallbackTimer); unsubFoods(); unsubPlates(); unsubLogs(); };
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
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', id)); } catch (e) { setGlobalError(e.message); }
  };

  const HomeView = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] p-6 pb-12 shadow-md shrink-0">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d.toISOString().split('T')[0]); }} className="p-2"><ChevronLeft size={24} /></button>
          <div className="font-bold">{currentDate === getTodayString() ? 'Today' : currentDate}</div>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d.toISOString().split('T')[0]); }} className="p-2"><ChevronRight size={24} /></button>
        </div>
        <div className="text-center">
          <p className="text-emerald-100 text-sm font-medium uppercase mb-1">Total Consumed</p>
          <div className="flex justify-center items-baseline space-x-1">
            <span className="text-6xl font-black">{Math.round(totalDailyCalories)}</span>
            <span className="text-xl text-emerald-200">kcal</span>
          </div>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-6 overflow-y-auto pb-32">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 min-h-full">
          <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-4">Today's Log</h3>
          {dailyLogs.length === 0 ? <div className="text-center py-20 text-slate-300 italic">No food logged yet.</div> : (
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
                      <span className="font-black text-emerald-600">{Math.round(d.calories)} <span className="text-[10px] font-normal uppercase">kcal</span></span>
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
        
        {globalError && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white px-4 py-3 shadow-md z-[60] flex justify-between items-center">
            <div className="flex items-center space-x-2"><AlertTriangle size={18} /><span className="text-sm font-medium">{globalError}</span></div>
            <button onClick={() => setGlobalError('')} className="p-1"><X size={16} /></button>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden bg-white">
          {isLoading && <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>}
          <div className="h-full w-full">
            {activeTab === 'log' && <HomeView />}
            {activeTab === 'foods' && <FoodsView />}
            {activeTab === 'plates' && <PhysicalPlatesView />}
          </div>
        </div>

        <div className="h-24 bg-white border-t border-slate-100 flex items-center justify-around shrink-0 z-40 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center w-1/3 transition-colors ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Home size={22} /><span className="text-[10px] font-black mt-1">Log</span>
          </button>
          <button onClick={() => setActiveTab('foods')} className={`flex flex-col items-center w-1/3 transition-colors ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}`}>
            <Utensils size={22} /><span className="text-[10px] font-black mt-1">Foods</span>
          </button>
          <button onClick={() => setActiveTab('plates')} className={`flex flex-col items-center w-1/3 transition-colors ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}`}>
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
