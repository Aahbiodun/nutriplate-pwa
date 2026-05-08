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
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

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
const isFirebaseConfigured = Object.keys(firebaseConfig).length > 0;

let app, auth, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
const appId = 'nutri-plate-v4'; 

export default function App() {
  const [activeTab, setActiveTab] = useState('log'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');

  const [foods, setFoods] = useState([]);
  const [physicalPlates, setPhysicalPlates] = useState([]);
  const [logs, setLogs] = useState([]);

  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);

  // --- Auth Session Recovery ---
  useEffect(() => {
    if (!isFirebaseConfigured) { setIsLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
        } catch (e) {
          setGlobalError("Connection Error: " + e.message);
          setIsLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Data Subscription ---
  useEffect(() => {
    if (!user || !db) return;
    setIsLoading(true);

    const userPath = `artifacts/${appId}/users/${user.uid}`;
    
    const unsubFoods = onSnapshot(collection(db, `${userPath}/foods`), (s) => {
      setFoods(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPlates = onSnapshot(collection(db, `${userPath}/plates`), (s) => {
      setPhysicalPlates(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLogs = onSnapshot(collection(db, `${userPath}/logs`), (s) => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (err) => {
      setGlobalError("Sync Error: " + err.message);
      setIsLoading(false);
    });

    return () => { unsubFoods(); unsubPlates(); unsubLogs(); };
  }, [user]);

  // --- Calculations ---
  const getNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { c: 0, p: 0 };
    return { c: (grams / 100) * (f.calories || 0), p: (grams / 100) * (f.protein || 0) };
  };

  const dayLogs = logs.filter(l => l.date === currentDate);
  const totals = dayLogs.reduce((acc, log) => {
    const n = getNutrients(log.foodId, log.grams);
    return { c: acc.c + n.c, p: acc.p + n.p };
  }, { c: 0, p: 0 });

  // --- Render Logic (UI Fixes) ---
  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative">
        
        {/* Header */}
        <div className="bg-emerald-600 text-white p-6 pt-10 rounded-b-[2.5rem] shrink-0 shadow-lg">
          <div className="flex justify-between items-center mb-6">
             <button onClick={() => {
               const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().split('T')[0]);
             }}><ChevronLeft/></button>
             <span className="font-bold text-sm uppercase tracking-widest">{currentDate}</span>
             <button onClick={() => {
               const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().split('T')[0]);
             }}><ChevronRight/></button>
          </div>
          <div className="text-center">
            <div className="text-5xl font-black">{Math.round(totals.c)}<span className="text-lg ml-1 font-normal opacity-70">kcal</span></div>
            <div className="mt-2 text-emerald-100 font-bold">{Math.round(totals.p)}g Protein</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-32">
          {isLoading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-600"/></div>}
          {globalError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs mb-4">{globalError}</div>}
          
          <div className="space-y-3">
            {dayLogs.map(l => (
              <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between border border-slate-100">
                <span className="font-bold text-slate-700">{foods.find(f => f.id === l.foodId)?.name || 'Food'}</span>
                <span className="font-bold text-emerald-600">{Math.round(getNutrients(l.foodId, l.grams).c)} kcal</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nav */}
        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home/></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils/></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3/></button>
          <button onClick={() => setActiveTab('plates')} className={activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-300'}><Disc/></button>
        </div>

        <button onClick={() => setShowAddFood(true)} className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center"><Plus/></button>
      </div>
    </div>
  );
}
