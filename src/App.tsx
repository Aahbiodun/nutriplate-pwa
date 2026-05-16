// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Home, Utensils, Plus, ChevronLeft, ChevronRight,
  Trash2, Loader2, BarChart3, AlertTriangle, X, Edit2,
  Settings, Calendar as CalendarIcon, Search, Clock, Scale, ArrowDown
} from 'lucide-react';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, onSnapshot, doc, setDoc,
  deleteDoc, enableIndexedDbPersistence
} from 'firebase/firestore';

// --- Firebase Config ---
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
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => console.warn("Persistence failed:", err.code));
  }
}

const appId = 'nutriplate_aahbiodun_stable';
const MY_PERMANENT_UID = '5D3QzaJfLERycrkJkcOXs9LfFXU2';

// ============ HELPERS ============
const getTodayIso = () => new Date().toISOString().split('T')[0];
const getIsoOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatFriendlyDate = (iso) => {
  if (iso === getTodayIso()) return 'Today';
  if (iso === getIsoOffset(-1)) return 'Yesterday';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const buildCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }
  return cells;
};

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);

// ============ APP ============
export default function App() {
  const [activeTab, setActiveTab] = useState('log');
  const [currentDate, setCurrentDate] = useState(getTodayIso());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [foods, setFoods] = useState([]);
  const [plates, setPlates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [calorieTarget, setCalorieTarget] = useState(2500);
  const [maintenanceCalories, setMaintenanceCalories] = useState(null);

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [showAddPlate, setShowAddPlate] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [foodPicker, setFoodPicker] = useState(null); // { type: 'single' } | { type: 'combo', index: number } | { type: 'edit' }
  const [foodSearch, setFoodSearch] = useState('');

  // Calendar view month
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Trends chart mode
  const [chartMode, setChartMode] = useState('calories');

  // Log modal state
  const [isCombo, setIsCombo] = useState(false);
  const [scaleWeight, setScaleWeight] = useState('');
  const [selectedPlate, setSelectedPlate] = useState('');
  const [singleFoodId, setSingleFoodId] = useState('');
  const [comboItems, setComboItems] = useState([{ foodId: '', percentage: '' }, { foodId: '', percentage: '' }]);

  // Auth
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) setUser(u);
      else {
        try { const cred = await signInAnonymously(auth); setUser(cred.user); }
        catch (e) { console.error("Auth error:", e); }
      }
    });
    return () => unsub();
  }, []);

  // Data sync
  useEffect(() => {
    if (!user || !db) return;
    const userPath = `artifacts/${appId}/users/${MY_PERMANENT_UID}`;
    const unsubFoods = onSnapshot(collection(db, `${userPath}/foods`), s => setFoods(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPlates = onSnapshot(collection(db, `${userPath}/plates`), s => setPlates(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubLogs = onSnapshot(collection(db, `${userPath}/logs`), s => {
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    const unsubSettings = onSnapshot(doc(db, `${userPath}/settings/goals`), d => {
      if (d.exists()) {
        if (d.data().calorieTarget) setCalorieTarget(d.data().calorieTarget);
        if (d.data().maintenanceCalories) setMaintenanceCalories(d.data().maintenanceCalories);
      }
    });
    return () => { unsubFoods(); unsubPlates(); unsubLogs(); unsubSettings(); };
  }, [user]);

  // ============ COMPUTED ============
  const getNutrients = (foodId, grams) => {
    const f = foods.find(x => x.id === foodId);
    if (!f) return { c: 0, p: 0 };
    return { c: (grams / 100) * (f.caloriesPer100g || 0), p: (grams / 100) * (f.proteinPer100g || 0) };
  };

  const dayLogs = useMemo(() => logs.filter(l => l.date === currentDate), [logs, currentDate]);
  const totals = useMemo(() => dayLogs.reduce((acc, l) => {
    const n = getNutrients(l.foodId, l.amountGrams);
    return { c: acc.c + n.c, p: acc.p + n.p };
  }, { c: 0, p: 0 }), [dayLogs, foods]);
  const remainingCals = calorieTarget - Math.round(totals.c);

  // Week data for chart + banner
  const weekData = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const iso = getIsoOffset(-i);
      const d = new Date(iso + 'T00:00:00');
      const dlogs = logs.filter(l => l.date === iso);
      const t = dlogs.reduce((acc, l) => {
        const n = getNutrients(l.foodId, l.amountGrams);
        return { c: acc.c + n.c, p: acc.p + n.p };
      }, { c: 0, p: 0 });
      arr.push({
        date: iso,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
        calories: t.c,
        protein: t.p,
        tracked: dlogs.length > 0,
      });
    }
    return arr;
  }, [logs, foods]);

  const weeklyStats = useMemo(() => {
    const tracked = weekData.filter(d => d.tracked);
    const totalCals = tracked.reduce((s, d) => s + d.calories, 0);
    const targetBalance = totalCals - (calorieTarget * tracked.length);
    const maintenanceDeficit = maintenanceCalories
      ? totalCals - (maintenanceCalories * tracked.length)
      : null;
    return { trackedDays: tracked.length, targetBalance, maintenanceDeficit };
  }, [weekData, calorieTarget, maintenanceCalories]);

  // Recent foods (from log history)
  const recentFoodIds = useMemo(() => {
    const seen = new Set();
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const result = [];
    for (const l of sorted) {
      if (!seen.has(l.foodId) && foods.find(f => f.id === l.foodId)) {
        seen.add(l.foodId);
        result.push(l.foodId);
        if (result.length >= 4) break;
      }
    }
    return result;
  }, [logs, foods]);

  // Days with logs (for calendar dots)
  const dateStatus = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.date]) map[l.date] = { calories: 0 };
      const n = getNutrients(l.foodId, l.amountGrams);
      map[l.date].calories += n.c;
    });
    return map;
  }, [logs, foods]);

  // Live preview in log modal
  const previewNet = useMemo(() => {
    const raw = parseFloat(scaleWeight);
    if (!raw || isNaN(raw)) return 0;
    let ded = 0;
    if (selectedPlate) {
      const p = plates.find(x => x.id === selectedPlate);
      if (p) ded = p.weight;
    }
    return Math.max(0, raw - ded);
  }, [scaleWeight, selectedPlate, plates]);

  const plateDeduction = useMemo(() => {
    if (!selectedPlate) return 0;
    const p = plates.find(x => x.id === selectedPlate);
    return p ? p.weight : 0;
  }, [selectedPlate, plates]);

  const comboTotalPct = useMemo(() =>
    comboItems.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0)
  , [comboItems]);

  const previewTotals = useMemo(() => {
    if (previewNet <= 0) return null;
    if (!isCombo) {
      if (!singleFoodId) return null;
      const n = getNutrients(singleFoodId, previewNet);
      return { c: n.c, p: n.p, breakdown: null };
    }
    const breakdown = comboItems
      .filter(i => i.foodId && parseFloat(i.percentage) > 0)
      .map(i => {
        const grams = (parseFloat(i.percentage) / 100) * previewNet;
        const n = getNutrients(i.foodId, grams);
        const food = foods.find(f => f.id === i.foodId);
        return { foodName: food?.name || '—', grams, c: n.c, p: n.p };
      });
    const c = breakdown.reduce((s, b) => s + b.c, 0);
    const p = breakdown.reduce((s, b) => s + b.p, 0);
    return { c, p, breakdown };
  }, [previewNet, isCombo, singleFoodId, comboItems, foods]);

  const isLogValid = previewNet > 0 && (
    (!isCombo && singleFoodId) ||
    (isCombo && Math.abs(comboTotalPct - 100) < 0.1 && comboItems.some(i => i.foodId && parseFloat(i.percentage) > 0))
  );

  // ============ HANDLERS ============
  const resetLogForm = () => {
    setScaleWeight(''); setSelectedPlate(''); setSingleFoodId('');
    setComboItems([{ foodId: '', percentage: '' }, { foodId: '', percentage: '' }]);
    setIsCombo(false);
  };

  const handleSaveLog = async () => {
    if (!user || !isLogValid) return;
    const plate = plates.find(p => p.id === selectedPlate);
    const plateName = plate?.name || null;

    if (!isCombo) {
      const id = newId();
      await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, id), {
        id, foodId: singleFoodId, amountGrams: parseFloat(previewNet.toFixed(1)),
        date: currentDate, plateName,
      });
    } else {
      for (const item of comboItems) {
        if (item.foodId && parseFloat(item.percentage) > 0) {
          const id = newId();
          const grams = (parseFloat(item.percentage) / 100) * previewNet;
          await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, id), {
            id, foodId: item.foodId, amountGrams: parseFloat(grams.toFixed(1)),
            date: currentDate, plateName,
          });
        }
      }
    }
    resetLogForm();
    setShowAddLog(false);
  };

  const handleSaveEditLog = async (newFoodId, newGrams) => {
    if (!user || !editingLog) return;
    await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, editingLog.id), {
      ...editingLog,
      foodId: newFoodId,
      amountGrams: parseFloat(newGrams),
    });
    setEditingLog(null);
  };

  if (Object.keys(firebaseConfig).length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-10 text-center bg-slate-900 text-white">
        <div>
          <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
          <h2 className="text-xl font-bold">Config Missing</h2>
        </div>
      </div>
    );
  }

  // Filtered foods for picker
  const filteredFoods = foods
    .filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 bg-slate-900 flex justify-center overflow-hidden overscroll-none">
      <div className="w-full h-full max-w-[450px] bg-white flex flex-col relative overflow-hidden">

        {/* ============ HEADER ============ */}
        <div className="bg-emerald-600 text-white p-6 pt-10 rounded-b-[2.5rem] shrink-0 shadow-lg z-10 relative">

          {/* Settings gear (absolute top right) */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-10 right-6 p-2 rounded-full hover:bg-emerald-500/40 transition-colors"
            aria-label="Settings"
          >
            <Settings size={18} className="opacity-80" />
          </button>

          <div className="flex justify-between items-center mb-6 mt-1">
            <button
              onClick={() => setCurrentDate(getIsoOffset(-1 + ((new Date(currentDate + 'T00:00:00') - new Date(getTodayIso() + 'T00:00:00')) / 86400000)))}
              className="p-1.5 hover:bg-emerald-500/40 rounded-full transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowCalendar(true); const d = new Date(currentDate + 'T00:00:00'); setCalMonth({ year: d.getFullYear(), month: d.getMonth() }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-emerald-500/40 transition-colors"
              >
                <span className="font-bold text-sm">{formatFriendlyDate(currentDate)}</span>
                <CalendarIcon size={13} className="opacity-70" />
              </button>
              {currentDate !== getTodayIso() && (
                <button
                  onClick={() => setCurrentDate(getTodayIso())}
                  className="bg-emerald-500/50 hover:bg-emerald-500/70 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider transition-colors"
                >
                  TODAY
                </button>
              )}
            </div>

            <button
              onClick={() => {
                const d = new Date(currentDate + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                setCurrentDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 hover:bg-emerald-500/40 rounded-full transition-colors"
              aria-label="Next day"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="text-center">
            <div className="flex justify-center items-baseline gap-1">
              <span className="text-6xl font-bold tracking-tight">{Math.round(totals.c)}</span>
              <span className="text-xl text-emerald-100 opacity-75">/ {calorieTarget}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest opacity-70 mt-1 font-semibold">Calories</div>

            <div className="mt-4 flex justify-center gap-2">
              <div className="bg-emerald-700/40 px-4 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/30">
                {Math.round(totals.p)}g Protein
              </div>
              <div className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                remainingCals >= 0
                  ? 'bg-emerald-700/40 border-emerald-500/30 text-white'
                  : 'bg-red-500/90 border-red-400 text-white'
              }`}>
                {Math.abs(remainingCals)} kcal {remainingCals >= 0 ? 'Left' : 'Over'}
              </div>
            </div>
          </div>
        </div>

        {/* ============ SCROLLABLE CONTENT ============ */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {isLoading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-600" /></div>}

          {/* --- LOG TAB --- */}
          {activeTab === 'log' && !isLoading && (
            <div className="p-6 space-y-3 pb-32">
              <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">Entries</h3>

              {dayLogs.length === 0 && (
                <div className="text-center p-10 text-slate-400">
                  <Utensils size={28} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">No entries for {formatFriendlyDate(currentDate).toLowerCase()}.</p>
                  <p className="text-xs mt-1 opacity-75">Tap + to log your first meal.</p>
                </div>
              )}

              {dayLogs.map(l => {
                const food = foods.find(f => f.id === l.foodId);
                const n = getNutrients(l.foodId, l.amountGrams);
                return (
                  <div
                    key={l.id}
                    onClick={() => setEditingLog(l)}
                    className="p-4 bg-white rounded-2xl flex justify-between border border-slate-100 items-center shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-700 block truncate">{food?.name || 'Unknown Food'}</span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {l.amountGrams}g{l.plateName ? ` · ${l.plateName}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <div className="text-emerald-600 font-bold text-sm">{Math.round(n.c)} kcal</div>
                        <div className="text-[10px] font-bold text-slate-400">{Math.round(n.p)}g P</div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (user) await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, l.id));
                        }}
                        className="text-slate-200 hover:text-red-500 transition-colors p-1"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* --- FOODS TAB --- */}
          {activeTab === 'foods' && (
            <div className="p-6 space-y-3 pb-32">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Registry</h2>

              <div className="flex gap-2 mb-6">
                <button onClick={() => setShowAddFood(true)} className="flex-1 border-2 border-dashed border-slate-200 p-3 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-100 transition-colors">+ Add Food</button>
                <button onClick={() => setShowAddPlate(true)} className="flex-1 border-2 border-dashed border-slate-200 p-3 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-100 transition-colors">+ Add Plate</button>
              </div>

              <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2 mt-4">My Foods</h3>
              {foods.length === 0 && <div className="text-xs text-slate-400 italic">No foods registered yet.</div>}
              {[...foods].sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                <div key={f.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                  <div>
                    <span className="font-bold text-slate-700 block">{f.name}</span>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400">{f.caloriesPer100g} kcal</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">{f.proteinPer100g}g P</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingFood(f)} className="text-slate-300 hover:text-emerald-600 transition-colors p-1"><Edit2 size={16} /></button>
                    <button onClick={async () => {
                      if (window.confirm(`Delete ${f.name} from your registry?`)) {
                        await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, f.id));
                      }
                    }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}

              <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2 mt-8">My Plates</h3>
              {plates.length === 0 && <div className="text-xs text-slate-400 italic">No plates registered yet.</div>}
              {plates.map(p => (
                <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                  <span className="font-bold text-slate-700">{p.name}</span>
                  <div className="flex items-center gap-4">
                    <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{p.weight}g</div>
                    <button onClick={async () => {
                      if (window.confirm(`Delete plate ${p.name}?`)) {
                        await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/plates`, p.id));
                      }
                    }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* --- TRENDS TAB --- */}
          {activeTab === 'trends' && (
            <div className="p-6 space-y-4 pb-32">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Weekly Trends</h2>
              <p className="text-xs text-slate-400 mb-4">Tap any bar to jump to that day.</p>

              {/* Chart card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                {/* Toggle */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
                  <button onClick={() => setChartMode('calories')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${chartMode === 'calories' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Calories</button>
                  <button onClick={() => setChartMode('protein')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${chartMode === 'protein' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Protein</button>
                </div>

                <Chart
                  weekData={weekData}
                  mode={chartMode}
                  target={calorieTarget}
                  onBarClick={(date) => { setCurrentDate(date); setActiveTab('log'); }}
                />
              </div>

              {/* Stats banner */}
              {weeklyStats.trackedDays > 0 && chartMode === 'calories' && (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4">

                  {/* Maintenance Deficit (only if maintenance is set) */}
                  {weeklyStats.maintenanceDeficit !== null && (
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Weekly Deficit</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">vs maintenance · {maintenanceCalories} kcal/day</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Days</div>
                          <div className="text-sm font-bold text-slate-700 mt-0.5">{weeklyStats.trackedDays}<span className="text-slate-400">/7</span></div>
                        </div>
                      </div>
                      <div className={`text-3xl font-bold ${weeklyStats.maintenanceDeficit <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {weeklyStats.maintenanceDeficit <= 0 ? '−' : '+'}{Math.abs(Math.round(weeklyStats.maintenanceDeficit)).toLocaleString()} kcal
                      </div>
                    </div>
                  )}

                  {/* Target Balance */}
                  <div className={weeklyStats.maintenanceDeficit !== null ? 'pt-4 border-t border-slate-100' : ''}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Target Balance</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">vs target · {calorieTarget} kcal/day</div>
                      </div>
                      {weeklyStats.maintenanceDeficit === null && (
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Days</div>
                          <div className="text-sm font-bold text-slate-700 mt-0.5">{weeklyStats.trackedDays}<span className="text-slate-400">/7</span></div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className={`text-2xl font-bold ${weeklyStats.targetBalance <= 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {weeklyStats.targetBalance <= 0 ? '−' : '+'}{Math.abs(Math.round(weeklyStats.targetBalance)).toLocaleString()} kcal
                      </div>
                      <div className={`text-[11px] font-bold ${weeklyStats.targetBalance <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {weeklyStats.targetBalance <= 0 ? 'banked buffer' : 'over budget'}
                      </div>
                    </div>
                  </div>

                  {/* Hint if maintenance not set */}
                  {weeklyStats.maintenanceDeficit === null && (
                    <div className="text-[10px] text-slate-400 italic pt-3 border-t border-slate-100">
                      Set maintenance calories in Settings to see your actual weekly deficit.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============ BOTTOM NAV ============ */}
        <div className="h-24 bg-white border-t flex items-center justify-around shrink-0 pb-6 px-4 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          <button onClick={() => setActiveTab('log')} className={activeTab === 'log' ? 'text-emerald-600' : 'text-slate-300'}><Home /></button>
          <button onClick={() => setActiveTab('foods')} className={activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-300'}><Utensils /></button>
          <button onClick={() => setActiveTab('trends')} className={activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-300'}><BarChart3 /></button>
        </div>

        {/* ============ FAB ============ */}
        <button
          onClick={() => {
            if (foods.length === 0) {
              if (window.confirm("You need to register at least one food before logging. Go to Foods tab?")) {
                setActiveTab('foods');
              }
              return;
            }
            setShowAddLog(true);
          }}
          className="fixed bottom-28 right-8 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-[0_10px_25px_rgba(5,150,105,0.4)] flex items-center justify-center z-30 hover:scale-105 transition-transform"
        >
          <Plus />
        </button>

        {/* ============ MODALS ============ */}

        {/* Settings */}
        {showSettings && (
          <ModalShell onClose={() => setShowSettings(false)}>
            <h2 className="text-2xl font-bold mb-2">Daily Goal</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">Set your calorie targets. Maintenance is what you burn at rest; fat-loss target is what you aim to eat.</p>

            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">Fat Loss Target (kcal/day)</label>
            <input
              type="number"
              defaultValue={calorieTarget}
              className="w-full bg-slate-50 rounded-2xl p-4 mb-4 outline-none border border-slate-100 focus:border-emerald-500 transition-colors text-emerald-600 font-bold"
              id="ct"
            />

            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">Maintenance Calories (kcal/day)</label>
            <input
              type="number"
              defaultValue={maintenanceCalories || ''}
              placeholder="e.g. 3000"
              className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500 transition-colors text-emerald-600 font-bold"
              id="mc"
            />

            <div className="flex gap-3">
              <button onClick={() => setShowSettings(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={async () => {
                const target = document.getElementById('ct').value;
                const maint = document.getElementById('mc').value;
                if (!target || !user) return;
                await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/settings`, 'goals'), {
                  calorieTarget: parseFloat(target),
                  maintenanceCalories: maint ? parseFloat(maint) : null,
                }, { merge: true });
                setShowSettings(false);
              }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">Save</button>
            </div>
          </ModalShell>
        )}

        {/* Calendar Picker */}
        {showCalendar && (
          <ModalShell onClose={() => setShowCalendar(false)}>
            <CalendarPicker
              year={calMonth.year}
              month={calMonth.month}
              currentDate={currentDate}
              dateStatus={dateStatus}
              target={calorieTarget}
              onPrevMonth={() => setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}
              onNextMonth={() => setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}
              onSelect={(iso) => { setCurrentDate(iso); setShowCalendar(false); }}
            />
          </ModalShell>
        )}

        {/* Add Food */}
        {showAddFood && (
          <ModalShell onClose={() => setShowAddFood(false)}>
            <h2 className="text-2xl font-bold mb-6">Register Food</h2>
            <input placeholder="Name" className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="fn" />
            <input placeholder="Cals / 100g" type="number" className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="fc" />
            <input placeholder="Protein / 100g" type="number" className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500 transition-colors" id="fp" />
            <div className="flex gap-3">
              <button onClick={() => setShowAddFood(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600">Cancel</button>
              <button onClick={async () => {
                const name = document.getElementById('fn').value;
                const cals = document.getElementById('fc').value;
                const prot = document.getElementById('fp').value;
                if (!name || !cals || !user) return;
                const id = newId();
                await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, id), {
                  id, name, caloriesPer100g: parseFloat(cals), proteinPer100g: parseFloat(prot || 0)
                });
                setShowAddFood(false);
              }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl shadow-lg shadow-emerald-600/30">Save</button>
            </div>
          </ModalShell>
        )}

        {/* Edit Food */}
        {editingFood && (
          <ModalShell onClose={() => setEditingFood(null)}>
            <h2 className="text-2xl font-bold mb-6">Edit Food</h2>
            <input placeholder="Name" defaultValue={editingFood.name} className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500" id="efn" />
            <input placeholder="Cals / 100g" type="number" defaultValue={editingFood.caloriesPer100g} className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500" id="efc" />
            <input placeholder="Protein / 100g" type="number" defaultValue={editingFood.proteinPer100g} className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500" id="efp" />
            <div className="flex gap-3">
              <button onClick={() => setEditingFood(null)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600">Cancel</button>
              <button onClick={async () => {
                const name = document.getElementById('efn').value;
                const cals = document.getElementById('efc').value;
                const prot = document.getElementById('efp').value;
                if (!name || !cals || !user) return;
                await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/foods`, editingFood.id), {
                  id: editingFood.id, name, caloriesPer100g: parseFloat(cals), proteinPer100g: parseFloat(prot || 0)
                });
                setEditingFood(null);
              }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl shadow-lg shadow-emerald-600/30">Update</button>
            </div>
          </ModalShell>
        )}

        {/* Add Plate */}
        {showAddPlate && (
          <ModalShell onClose={() => setShowAddPlate(false)}>
            <h2 className="text-2xl font-bold mb-2">Register Plate</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">Save physical bowls/plates so the app can deduct their weight automatically.</p>
            <input placeholder="Plate Name (e.g. Big Bowl)" className="w-full bg-slate-50 rounded-2xl p-4 mb-3 outline-none border border-slate-100 focus:border-emerald-500" id="pn" />
            <input placeholder="Empty Weight (g)" type="number" className="w-full bg-slate-50 rounded-2xl p-4 mb-6 outline-none border border-slate-100 focus:border-emerald-500" id="pw" />
            <div className="flex gap-3">
              <button onClick={() => setShowAddPlate(false)} className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600">Cancel</button>
              <button onClick={async () => {
                const name = document.getElementById('pn').value;
                const wght = document.getElementById('pw').value;
                if (!name || !wght || !user) return;
                const id = newId();
                await setDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/plates`, id), {
                  id, name, weight: parseFloat(wght)
                });
                setShowAddPlate(false);
              }} className="flex-1 bg-emerald-600 text-white font-bold p-4 rounded-2xl shadow-lg shadow-emerald-600/30">Save</button>
            </div>
          </ModalShell>
        )}

        {/* Edit Log Entry */}
        {editingLog && (
          <EditLogModal
            log={editingLog}
            foods={foods}
            onCancel={() => setEditingLog(null)}
            onSave={handleSaveEditLog}
            onDelete={async () => {
              if (window.confirm("Delete this entry?")) {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${MY_PERMANENT_UID}/logs`, editingLog.id));
                setEditingLog(null);
              }
            }}
            openPicker={() => { setFoodPicker({ type: 'edit' }); }}
          />
        )}

        {/* ============ LOG MODAL ============ */}
        {showAddLog && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 max-h-[95vh] overflow-y-auto shadow-2xl">
              <h2 className="text-xl font-bold mb-5 text-center">Log Food</h2>

              {/* Scale + Plate */}
              <div className="bg-slate-50 p-5 rounded-3xl mb-4 border border-slate-100">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">1. Scale Weight (g)</label>
                <input
                  placeholder="0"
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-white rounded-2xl p-4 outline-none border border-slate-200 font-bold text-3xl text-emerald-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center shadow-sm"
                  value={scaleWeight}
                  onChange={e => setScaleWeight(e.target.value)}
                />

                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block mt-4">2. Deduct Plate</label>
                <select
                  className="w-full bg-white rounded-2xl p-4 outline-none border border-slate-200 text-sm font-bold text-slate-700 focus:border-emerald-500 shadow-sm"
                  value={selectedPlate}
                  onChange={e => setSelectedPlate(e.target.value)}
                >
                  <option value="">No Plate (0g)</option>
                  {plates.map(p => <option key={p.id} value={p.id}>{p.name} (−{p.weight}g)</option>)}
                </select>
              </div>

              {/* Allocation toggle */}
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">3. Allocation</label>
              <div className="flex p-1 bg-slate-100 rounded-2xl mb-4">
                <button
                  className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all ${!isCombo ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
                  onClick={() => setIsCombo(false)}
                >Single Food</button>
                <button
                  className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all ${isCombo ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}
                  onClick={() => setIsCombo(true)}
                >Combo (%)</button>
              </div>

              {/* Food selection */}
              {!isCombo ? (
                <button
                  onClick={() => { setFoodSearch(''); setFoodPicker({ type: 'single' }); }}
                  className="w-full bg-slate-50 rounded-2xl p-4 mb-4 outline-none border border-slate-100 font-bold text-left flex justify-between items-center hover:border-emerald-500 transition-colors"
                >
                  <span className={singleFoodId ? 'text-slate-700' : 'text-slate-400'}>
                    {singleFoodId ? (foods.find(f => f.id === singleFoodId)?.name || 'Select Food...') : 'Select Food...'}
                  </span>
                  <Search size={16} className="text-slate-400" />
                </button>
              ) : (
                <div className="space-y-2 mb-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                  {comboItems.map((item, index) => {
                    const food = foods.find(f => f.id === item.foodId);
                    return (
                      <div key={index} className="flex gap-2 items-center">
                        <button
                          onClick={() => { setFoodSearch(''); setFoodPicker({ type: 'combo', index }); }}
                          className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 text-sm font-bold text-left flex justify-between items-center hover:border-emerald-500 transition-colors"
                        >
                          <span className={food ? 'text-slate-700 truncate' : 'text-slate-400'}>
                            {food?.name || `Food ${index + 1}...`}
                          </span>
                          <Search size={14} className="text-slate-400 shrink-0 ml-2" />
                        </button>
                        <input
                          placeholder="%"
                          type="number"
                          className="w-16 bg-white border border-slate-200 rounded-2xl p-3 outline-none text-center text-sm font-bold text-emerald-600 focus:border-emerald-500"
                          value={item.percentage}
                          onChange={e => {
                            const next = [...comboItems];
                            next[index].percentage = e.target.value;
                            setComboItems(next);
                          }}
                        />
                        {index > 1 && (
                          <button onClick={() => setComboItems(comboItems.filter((_, i) => i !== index))} className="text-slate-300 p-2 hover:text-red-500 transition-colors">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setComboItems([...comboItems, { foodId: '', percentage: '' }])}
                    className="w-full text-xs font-bold text-emerald-600 py-2.5 mt-1 border-2 border-dashed border-emerald-100 rounded-xl hover:bg-emerald-50 transition-colors"
                  >
                    + Add food to combo
                  </button>

                  {/* Live combo % */}
                  <div className={`mt-2 p-2.5 rounded-xl flex justify-between items-center text-[11px] font-bold transition-colors ${
                    Math.abs(comboTotalPct - 100) < 0.1
                      ? 'bg-emerald-100 text-emerald-700'
                      : comboTotalPct === 0
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    <span>Total: {comboTotalPct}%</span>
                    <span>
                      {Math.abs(comboTotalPct - 100) < 0.1
                        ? '✓ ready'
                        : comboTotalPct > 100
                          ? `${(comboTotalPct - 100).toFixed(0)}% over`
                          : `needs ${(100 - comboTotalPct).toFixed(0)}% more`}
                    </span>
                  </div>
                </div>
              )}

              {/* Live preview */}
              {previewTotals ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Preview</span>
                    <span className="text-[10px] text-slate-500">
                      {scaleWeight}g{plateDeduction ? ` − ${plateDeduction}g = ${Math.round(previewNet)}g` : ''}
                    </span>
                  </div>

                  {isCombo && previewTotals.breakdown && previewTotals.breakdown.length > 0 && (
                    <div className="space-y-1 pb-2 mb-2 border-b border-emerald-100">
                      {previewTotals.breakdown.map((b, i) => (
                        <div key={i} className="flex justify-between text-[11px]">
                          <span className="text-emerald-700 truncate mr-2">{b.foodName} · {Math.round(b.grams)}g</span>
                          <span className="text-emerald-800 font-bold whitespace-nowrap">{Math.round(b.c)} kcal · {Math.round(b.p)}g P</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-baseline">
                    <div>
                      <div className="text-3xl font-bold text-emerald-800 leading-none">{Math.round(previewTotals.c)}</div>
                      <div className="text-[10px] text-emerald-700 mt-1 font-bold">kcal{isCombo ? ' total' : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-emerald-800 leading-none">{Math.round(previewTotals.p)}g</div>
                      <div className="text-[10px] text-emerald-700 mt-1 font-bold">protein</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 mb-4 flex items-center justify-center gap-2">
                  <Scale size={14} className="text-slate-300" />
                  <span className="text-[11px] text-slate-400 font-bold">Enter weight and pick a food</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { resetLogForm(); setShowAddLog(false); }}
                  className="flex-1 bg-slate-100 font-bold p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors"
                >Cancel</button>
                <button
                  onClick={handleSaveLog}
                  disabled={!isLogValid}
                  className={`flex-1 font-bold p-4 rounded-2xl transition-colors ${
                    isLogValid
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >Log Food</button>
              </div>
            </div>
          </div>
        )}

        {/* ============ FOOD PICKER OVERLAY ============ */}
        {foodPicker && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-end justify-center">
            <div className="bg-white w-full max-w-[450px] rounded-t-[2.5rem] p-6 max-h-[80vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Pick Food</h2>
                <button onClick={() => setFoodPicker(null)} className="text-slate-400 p-1"><X size={20} /></button>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-4 py-3 mb-4">
                <Search size={16} className="text-slate-400" />
                <input
                  autoFocus
                  placeholder="Search foods..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  value={foodSearch}
                  onChange={e => setFoodSearch(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto -mx-2 px-2">
                {!foodSearch && recentFoodIds.length > 0 && (
                  <>
                    <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2 mt-2">Recent</h3>
                    <div className="space-y-1 mb-4">
                      {recentFoodIds.map(id => {
                        const f = foods.find(x => x.id === id);
                        if (!f) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => handlePickFood(foodPicker, f.id, { setSingleFoodId, comboItems, setComboItems, editingLog, setEditingLog, setFoodPicker })}
                            className="w-full p-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex justify-between items-center transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Clock size={13} className="text-emerald-600" />
                              <span className="font-bold text-sm text-slate-700">{f.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold">{f.caloriesPer100g} kcal · {f.proteinPer100g}g P</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">
                  {foodSearch ? 'Results' : 'All Foods'}
                </h3>
                <div className="space-y-1">
                  {filteredFoods.length === 0 && (
                    <div className="text-center p-6 text-slate-400 text-sm">No matches.</div>
                  )}
                  {filteredFoods.map(f => (
                    <button
                      key={f.id}
                      onClick={() => handlePickFood(foodPicker, f.id, { setSingleFoodId, comboItems, setComboItems, editingLog, setEditingLog, setFoodPicker })}
                      className="w-full p-3 hover:bg-slate-50 rounded-xl flex justify-between items-center transition-colors text-left"
                    >
                      <span className="font-bold text-sm text-slate-700 truncate mr-2">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">{f.caloriesPer100g} kcal</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ============ HELPERS / SUBCOMPONENTS ============

function handlePickFood(picker, foodId, ctx) {
  const { setSingleFoodId, comboItems, setComboItems, editingLog, setEditingLog, setFoodPicker } = ctx;
  if (picker.type === 'single') setSingleFoodId(foodId);
  else if (picker.type === 'combo') {
    const next = [...comboItems];
    next[picker.index].foodId = foodId;
    setComboItems(next);
  } else if (picker.type === 'edit' && editingLog) {
    setEditingLog({ ...editingLog, foodId });
  }
  setFoodPicker(null);
}

function ModalShell({ children, onClose }) {
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function CalendarPicker({ year, month, currentDate, dateStatus, target, onPrevMonth, onNextMonth, onSelect }) {
  const days = buildCalendarDays(year, month);
  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = getTodayIso();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-slate-800">{monthName}</h2>
        <div className="flex gap-1">
          <button onClick={onPrevMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={18} className="text-slate-600" /></button>
          <button onClick={onNextMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={18} className="text-slate-600" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-400 text-center mb-2 tracking-wider font-bold">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 text-sm text-center">
        {days.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const isToday = cell.iso === today;
          const isSelected = cell.iso === currentDate;
          const isFuture = cell.iso > today;
          const status = dateStatus[cell.iso];
          const isOver = status && status.calories > target;
          const isTracked = !!status;

          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => onSelect(cell.iso)}
              className={`relative aspect-square flex items-center justify-center rounded-full transition-colors font-medium ${
                isSelected ? 'bg-emerald-600 text-white font-bold' :
                isToday ? 'border border-emerald-600 text-emerald-700 font-bold' :
                isFuture ? 'text-slate-200' :
                'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cell.day}
              {isTracked && !isSelected && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isOver ? 'bg-red-500' : 'bg-emerald-600'}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 justify-center mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />On target</div>
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Over</div>
        <div>Empty = untracked</div>
      </div>
    </div>
  );
}

function Chart({ weekData, mode, target, onBarClick }) {
  const values = weekData.map(d => mode === 'calories' ? d.calories : d.protein);
  const maxV = Math.max(...values, mode === 'calories' ? target * 1.2 : 1) || 1;
  const today = getTodayIso();
  const W = 320;
  const H = 160;
  const padTop = 20;
  const padBot = 25;
  const chartH = H - padTop - padBot;
  const barW = (W - 30) / 7 - 8;
  const targetY = mode === 'calories' ? padTop + chartH - (target / maxV) * chartH : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* target line */}
      {targetY !== null && (
        <>
          <line x1="15" y1={targetY} x2={W - 15} y2={targetY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
          <text x={W - 15} y={targetY - 4} fontSize="9" fill="#94a3b8" textAnchor="end">target {target}</text>
        </>
      )}

      {/* bars */}
      {weekData.map((d, i) => {
        const v = mode === 'calories' ? d.calories : d.protein;
        const h = v > 0 ? (v / maxV) * chartH : 0;
        const x = 15 + i * ((W - 30) / 7) + 4;
        const y = padTop + chartH - h;
        const isToday = d.date === today;
        const isOver = mode === 'calories' && v > target;
        const isEmpty = v === 0;
        const fill = isToday ? 'transparent' : isOver ? '#ef4444' : '#10b981';

        return (
          <g key={d.date} style={{ cursor: 'pointer' }} onClick={() => onBarClick(d.date)}>
            {!isEmpty && (
              <rect
                x={x} y={y} width={barW} height={h} rx="4"
                fill={fill}
                stroke={isToday ? '#10b981' : 'none'}
                strokeWidth={isToday ? 2 : 0}
              />
            )}
            <rect x={x} y={padTop} width={barW} height={chartH} fill="transparent" />
            <text
              x={x + barW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill={isToday ? '#0f766e' : '#94a3b8'}
              fontWeight={isToday ? '700' : '500'}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function EditLogModal({ log, foods, onCancel, onSave, onDelete, openPicker }) {
  const [grams, setGrams] = useState(log.amountGrams);
  const [foodId, setFoodId] = useState(log.foodId);

  // sync foodId if parent edits it via picker
  useEffect(() => { setFoodId(log.foodId); }, [log.foodId]);

  const food = foods.find(f => f.id === foodId);
  const cals = food ? (parseFloat(grams || 0) / 100) * food.caloriesPer100g : 0;
  const prot = food ? (parseFloat(grams || 0) / 100) * food.proteinPer100g : 0;

  return (
    <ModalShell onClose={onCancel}>
      <h2 className="text-2xl font-bold mb-2">Edit Entry</h2>
      <p className="text-xs text-slate-400 mb-6">Update the food or amount.</p>

      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">Food</label>
      <button
        onClick={openPicker}
        className="w-full bg-slate-50 rounded-2xl p-4 mb-4 outline-none border border-slate-100 font-bold text-left flex justify-between items-center hover:border-emerald-500 transition-colors"
      >
        <span className="text-slate-700 truncate">{food?.name || 'Unknown'}</span>
        <Search size={16} className="text-slate-400" />
      </button>

      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2 block">Amount (g)</label>
      <input
        type="number"
        value={grams}
        onChange={e => setGrams(e.target.value)}
        className="w-full bg-slate-50 rounded-2xl p-4 mb-4 outline-none border border-slate-100 focus:border-emerald-500 transition-colors text-emerald-600 font-bold text-2xl text-center"
      />

      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 mb-6 flex justify-around text-center">
        <div>
          <div className="text-lg font-bold text-emerald-800">{Math.round(cals)}</div>
          <div className="text-[10px] text-emerald-700 font-bold">kcal</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-800">{Math.round(prot)}g</div>
          <div className="text-[10px] text-emerald-700 font-bold">protein</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onDelete} className="px-4 py-3 bg-red-50 text-red-600 font-bold rounded-2xl text-sm hover:bg-red-100 transition-colors">
          <Trash2 size={16} />
        </button>
        <button onClick={onCancel} className="flex-1 bg-slate-100 font-bold p-3 rounded-2xl text-slate-600 text-sm">Cancel</button>
        <button
          onClick={() => onSave(foodId, grams)}
          disabled={!grams || !foodId}
          className={`flex-1 font-bold p-3 rounded-2xl text-sm transition-colors ${
            grams && foodId
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30'
              : 'bg-slate-200 text-slate-400'
          }`}
        >Save</button>
      </div>
    </ModalShell>
  );
}
