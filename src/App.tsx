// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { Home, Utensils, Plus, ChevronLeft, ChevronRight, BarChart3, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, enableIndexedDbPersistence } from 'firebase/firestore';

/ --- Firebase Config ---
const customFirebaseConfig = {
apiKey: 'AIzaSyDvjWr4zwwbLCaKB0HA8lrJpf_dccx2DPY',
  authDomain: 'food-log-abc32.firebaseapp.com',
  projectId: 'food-log-abc32',
  storageBucket: 'food-log-abc32.firebasestorage.app',
  messagingSenderId: '575042025031',
  appId: '1:575042025031:web:f11b840bb418c3218da362',
  measurementId: 'G-BEDGMLCDT8',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// This is the "Magic" that allows saving while you are offline at the gym
enableIndexedDbPersistence(db).catch(() => {});

const appId = 'nutriplate_aahbiodun_stable';

export default function App() {
  const [activeTab, setActiveTab] = useState('log');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState(null);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) setUser(u);
      else await signInAnonymously(auth);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const path = `artifacts/${appId}/users/${user.uid}`;
    
    // These listeners read from your phone's memory first, then sync with cloud
    onSnapshot(collection(db, `${path}/foods`), (s) => {
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    onSnapshot(collection(db, `${path}/logs`), (s) => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
  }, [user]);

  const getNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { c: 0, p: 0 };
    return { c: (grams / 100) * (f.caloriesPer100g || 0), p: (grams / 100) * (f.proteinPer100g || 0) };
  };

  const dayLogs = logs.filter(l => l.date === currentDate);
  const totals = dayLogs.reduce((acc, log) => {
    const n = getNutrients(log.foodId, log.amountGrams);
    return { c: acc.c + n.c, p: acc.p + n.p };
  }, { c: 0, p: 0 });

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      <div className="bg-emerald-600 text-white p-6 pt-10 rounded-b-[2.5rem] shrink-0 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronLeft/></button>
          <span className="font-bold text-xs">{currentDate}</span>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().split('T')[0]); }}><ChevronRight/></button>
        </div>
        <div className="text-center">
          <div className="text-5xl font-black">{Math.round(totals.c)}<span className="text-lg ml-1 font-normal opacity-70">kcal</span></div>
          <div className="mt-1 font-bold text-emerald-100">{Math.round(totals.p)}g Protein</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-32">
        {isLoading && <Loader2 className="animate-spin mx-auto text-emerald-600" />}
        {dayLogs.map(l => (
          <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between border mb-2">
            <span className="font-bold text-slate-700">{foods.find(f => f.id === l.foodId)?.name || 'Food'}</span>
            <span className="font-bold text-emerald-600">{Math.round(getNutrients(l.foodId, l.amountGrams).p)}g P</span>
          </div>
        ))}
      </div>

      <div className="h-20 bg-white border-t flex items-center justify-around shrink-0 pb-4">
        <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
        <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
        <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
      </div>
    </div>
  );
}
