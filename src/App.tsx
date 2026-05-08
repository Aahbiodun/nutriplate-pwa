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

const customFirebaseConfig = {
  // PASTE YOUR KEYS HERE
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : customFirebaseConfig;

let app, auth, db;
if (Object.keys(firebaseConfig).length > 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // ENABLE OFFLINE PERSISTENCE
  enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
          console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
      } else if (err.code === 'unimplemented') {
          console.warn("The current browser doesn't support all of the features required to enable persistence");
      }
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

  // --- Auth logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { setUser(u); } 
      else {
        try { await signInAnonymously(auth); } 
        catch (e) { setGlobalError("Offline/Auth Error: " + e.message); }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Data Sync ---
  useEffect(() => {
    if (!user || !db) return;
    const userPath = `artifacts/${appId}/users/${user.uid}`;
    
    // Snapshot listeners work offline by reading from the local cache immediately
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

  // --- Trends View ---
  const TrendsView = () => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const lgs = logs.filter(l => l.date === ds);
      const t = lgs.reduce((acc, l) => {
        const n = getNutrients(l.foodId, l.amountGrams);
        return { c: acc.c + n.c, p: acc.p + n.p };
      }, { c: 0, p: 0 });
      return { label: d.toLocaleDateString(undefined, {weekday: 'short'}), ...t };
    }).reverse();

    return (
      <div className="p-6 space-y-4 pb-32">
        <h2 className="text-xl font-black text-slate-800">Weekly Performance</h2>
        {last7Days.map((day, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border flex justify-between shadow-sm">
            <span className="font-bold text-slate-500">{day.label}</span>
            <div className="text-right">
              <div className="text-emerald-600 font-bold">{Math.round(day.c)} kcal</div>
              <div className="text-xs text-slate-400 font-bold">{Math.round(day.p)}g Protein</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative">
        
        {/* Header */}
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
            <div className="text-5xl font-black">{Math.round(totals.c)}<span className="text-lg ml-1 font-normal opacity-70">kcal</span></div>
            <div className="mt-2 font-bold text-emerald-100">{Math.round(totals.p)}g Protein</div>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-600"/></div>}
          {activeTab === 'log' && (
            <div className="p-6 space-y-3 pb-32">
                {dayLogs.map(l => (
                    <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between border">
                        <span className="font-bold text-slate-700 truncate mr-4">{foods.find(f => f.id === l.foodId)?.name || 'Food'}</span>
                        <span className="font-bold text-emerald-600 shrink-0">{Math.round(getNutrients(l.foodId, l.amountGrams).c)} kcal</span>
                    </div>
                ))}
            </div>
          )}
          {activeTab === 'trends' && <TrendsView />}
          {activeTab === 'foods' && (
             <div className="p-6 space-y-3 pb-32">
                <button onClick={() => setShowAddFood(true)} className="w-full border-2 border-dashed border-slate-200 p-4 rounded-2xl text-slate-400 font-bold">+ Register New Food</button>
                {foods.map(f => (
                    <div key={f.id} className="p-4 bg-white border rounded-2xl flex justify-between">
                        <span className="font-bold text-slate-700">{f.name}</span>
                        <span className="text-xs text-slate-400">{f.proteinPer100g}g P / 100g</span>
                    </div>
                ))}
             </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="h-20 bg-white border-t flex items-center justify-around shrink-0 pb-6">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
        </div>
      </div>
    </div>
  );
}
