// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from 'react';
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
  AlertTriangle,
  TrendingUp,
  BarChart3,
  WifiOff
} from 'lucide-react';

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

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
;

const isFirebaseConfigured = Object.keys(firebaseConfig).length > 0;

let app, auth, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // initializeFirestore (instead of getFirestore) lets us turn on
  // a persistent IndexedDB cache. With this enabled, Firestore:
  //   - Caches every document locally on the device.
  //   - Returns cached data instantly when offline.
  //   - Queues setDoc / deleteDoc writes while offline and replays
  //     them automatically when the connection comes back.
  // Your onSnapshot / setDoc / deleteDoc calls do NOT change.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    });
  } catch (e) {
    // initializeFirestore can only be called once per app instance.
    // If it has already been initialized (e.g. hot reload in dev),
    // fall back to the existing instance.
    console.warn('Firestore already initialized, reusing instance.', e);
    const { getFirestore } = require('firebase/firestore');
    db = getFirestore(app);
  }
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Utility Functions ---
const getTodayString = () => new Date().toISOString().split('T')[0];
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'trends' | 'foods' | 'plates'
  const [currentDate, setCurrentDate] = useState(getTodayString());
  const [trendsRange, setTrendsRange] = useState(7); // 7 | 30

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [foods, setFoods] = useState([]);
  const [physicalPlates, setPhysicalPlates] = useState([]);
  const [logs, setLogs] = useState([]);

  // Modals visibility
  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddPhysicalPlate, setShowAddPhysicalPlate] = useState(false);

  // --- Online/Offline detection ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // --- Firebase Auth & Data Fetching ---
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
        // If we're offline, anonymous sign-in will fail but cached data
        // will still be available, so don't surface this as a blocker.
        if (navigator.onLine) {
          setGlobalError("Authentication Failed: " + error.message);
        }
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Shorter fallback — with the persistent cache enabled, the very first
    // snapshot fires from local IndexedDB almost immediately.
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    const foodsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'foods');
    const platesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'plates');
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');

    let loaders = 3;
    const checkLoaded = () => {
      loaders--;
      if (loaders <= 0) {
        setIsLoading(false);
        clearTimeout(fallbackTimer);
      }
    };

    const handleSyncError = (err) => {
      console.error("Sync error:", err);
      // 'unavailable' = offline. With persistence on, cached data is still
      // delivered, so we don't need to show a blocking error.
      if (err.code === 'permission-denied') {
        setGlobalError("Database access denied. Please check your Firestore Rules in the Firebase Console.");
      } else if (err.code !== 'unavailable') {
        setGlobalError("Sync error: " + err.message);
      }
      checkLoaded();
    };

    const unsubFoods = onSnapshot(foodsRef, (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setFoods(data);
      checkLoaded();
    }, handleSyncError);

    const unsubPlates = onSnapshot(platesRef, (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setPhysicalPlates(data);
      checkLoaded();
    }, handleSyncError);

    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setLogs(data);
      checkLoaded();
    }, handleSyncError);

    return () => {
      clearTimeout(fallbackTimer);
      unsubFoods();
      unsubPlates();
      unsubLogs();
    };
  }, [user]);

  // --- Calculations ---
  const calculateFoodCalories = (foodId, grams) => {
    const food = foods.find(f => f.id === foodId);
    if (!food) return 0;
    return (grams / 100) * food.caloriesPer100g;
  };

  const getLogDetails = (log) => {
    if (log.type === 'food') {
      const food = foods.find(f => f.id === log.itemId);
      const calories = calculateFoodCalories(log.itemId, log.amountGrams);
      return {
        name: food?.name || 'Unknown Food',
        calories,
        subtitle: `${log.amountGrams}g single item`
      };
    } else {
      const calories = (log.ingredients || []).reduce((totalCals, ing) => {
        const ingredientGrams = log.amountGrams * (ing.percentage / 100);
        return totalCals + calculateFoodCalories(ing.foodId, ingredientGrams);
      }, 0);

      const compositionStr = (log.ingredients || []).map(ing => {
        const f = foods.find(x => x.id === ing.foodId);
        return `${ing.percentage}% ${f?.name || '?'}`;
      }).join(', ');

      return {
        name: 'Combined Meal',
        calories,
        subtitle: `${log.amountGrams}g total (${compositionStr})`
      };
    }
  };

  const dailyLogs = logs.filter(l => l.date === currentDate);
  const totalDailyCalories = dailyLogs.reduce((total, log) => total + getLogDetails(log).calories, 0);

  // --- Trends data (memoized) ---
  const trendsData = useMemo(() => {
    const todayStr = getTodayString();
    const today = new Date(todayStr + 'T00:00:00');
    const result = [];
    for (let i = trendsRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.date === dateStr);
      const total = dayLogs.reduce((sum, log) => sum + getLogDetails(log).calories, 0);
      result.push({
        date: dateStr,
        label: trendsRange === 7
          ? d.toLocaleDateString(undefined, { weekday: 'short' })
          : d.getDate().toString(),
        calories: Math.round(total),
        isToday: dateStr === todayStr
      });
    }
    return result;
  }, [trendsRange, logs, foods]);

  const loggedDays = trendsData.filter(d => d.calories > 0);
  const trendsTotal = trendsData.reduce((s, d) => s + d.calories, 0);
  const trendsAvg = loggedDays.length ? Math.round(trendsTotal / loggedDays.length) : 0;
  const maxDay = trendsData.reduce(
    (max, d) => (d.calories > max.calories ? d : max),
    { calories: 0, date: null }
  );

  // --- Handlers ---
  const changeDate = (days) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const deleteLog = async (id) => {
    if (!user || !isFirebaseConfigured) return;
    try {
      // With offline persistence, this resolves locally even when offline
      // and replays to the server when connection returns.
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', id));
    } catch (error) {
      console.error("Error deleting log:", error);
      setGlobalError("Failed to delete: " + error.message);
    }
  };

  // --- Sub-components (Views) ---
  const HomeView = () => (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-emerald-600 text-white rounded-b-[2.5rem] px-6 pt-6 pb-10 shadow-md relative z-10 shrink-0">
        <div className="flex justify-between items-center mb-5">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-emerald-500 rounded-full transition"><ChevronLeft size={24} /></button>
          <div className="flex items-center space-x-2 font-medium">
            <Calendar size={18} />
            <span>
              {currentDate === getTodayString()
                ? 'Today'
                : new Date(currentDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-emerald-500 rounded-full transition"><ChevronRight size={24} /></button>
        </div>

        <div className="text-center">
          <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider mb-1">Total Consumed</p>
          <div className="flex justify-center items-baseline space-x-1">
            <span className="text-5xl font-bold tracking-tight">{Math.round(totalDailyCalories) || 0}</span>
            <span className="text-lg text-emerald-200">kcal</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 -mt-5 relative z-20 overflow-y-auto pb-28">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4">
          <h3 className="font-semibold text-slate-800 mb-3 px-2">Today's Log</h3>

          {dailyLogs.length === 0 ? (
            <div className="text-center text-slate-400 py-8 flex flex-col items-center">
              <Utensils size={40} className="mb-2 opacity-20" />
              <p className="text-sm">No food logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dailyLogs.map(log => {
                const details = getLogDetails(log);
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition group">
                    <div className="flex flex-col flex-1 min-w-0 mr-3">
                      <span className="font-medium text-slate-800 truncate">{details.name}</span>
                      <span className="text-xs text-slate-500 truncate">{details.subtitle}</span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="font-bold text-emerald-600">{Math.round(details.calories) || 0} <span className="text-xs font-normal">kcal</span></span>
                      <button onClick={() => deleteLog(log.id)} className="text-red-400 hover:text-red-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition p-1">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowAddLog(true)}
        className="absolute bottom-24 right-6 bg-emerald-600 text-white w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all z-30"
      >
        <Plus size={28} />
      </button>
    </div>
  );

  const TrendsView = () => (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto pb-24">
      <div className="pt-8 pb-5 px-6 bg-white border-b border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Trends</h2>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTrendsRange(7)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${trendsRange === 7 ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
          >Last 7 days</button>
          <button
            onClick={() => setTrendsRange(30)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${trendsRange === 30 ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
          >Last 30 days</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="px-6 pt-5 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Daily Avg</p>
          <p className="text-lg font-bold text-slate-800 leading-tight">
            {trendsAvg.toLocaleString()}<span className="text-[10px] font-normal text-slate-400 ml-1">kcal</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Total</p>
          <p className="text-lg font-bold text-slate-800 leading-tight">
            {trendsTotal.toLocaleString()}<span className="text-[10px] font-normal text-slate-400 ml-1">kcal</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Logged</p>
          <p className="text-lg font-bold text-slate-800 leading-tight">
            {loggedDays.length}<span className="text-[10px] font-normal text-slate-400 ml-1">/ {trendsRange} days</span>
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-6 pt-4">
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-baseline justify-between px-1 mb-3">
            <h3 className="font-semibold text-slate-800">Daily calories</h3>
            <p className="text-xs text-slate-400">tap a bar</p>
          </div>

          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={trendsData} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={trendsRange === 30 ? 3 : 0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                {trendsAvg > 0 && (
                  <ReferenceLine
                    y={trendsAvg}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                )}
                <Tooltip
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    padding: '8px 12px'
                  }}
                  formatter={(value) => [`${value} kcal`, 'Calories']}
                  labelFormatter={(_, payload) => {
                    if (payload && payload[0]) {
                      const d = new Date(payload[0].payload.date + 'T00:00:00');
                      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                    }
                    return '';
                  }}
                />
                <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                  {trendsData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.calories === 0
                          ? '#e2e8f0'
                          : entry.isToday
                            ? '#059669'
                            : '#34d399'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-slate-400 uppercase tracking-wider font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"></span>Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block"></span>Logged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-emerald-500/40 inline-block"></span>Avg
            </span>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="px-6 pt-4 space-y-2">
        {maxDay.calories > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">Highest day</p>
              <p className="text-sm font-medium text-slate-800 truncate">
                {new Date(maxDay.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} — {maxDay.calories.toLocaleString()} kcal
              </p>
            </div>
          </div>
        )}

        {loggedDays.length === 0 && (
          <div className="text-center text-slate-400 py-10 flex flex-col items-center">
            <BarChart3 size={40} className="mb-2 opacity-20" />
            <p className="text-sm">No data for this range yet.</p>
            <p className="text-xs mt-1">Log some meals to see your trends.</p>
          </div>
        )}
      </div>
    </div>
  );

  const FoodsView = () => (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="pt-8 pb-5 px-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">Food Registry</h2>
        <button onClick={() => setShowAddFood(true)} className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-emerald-100 transition">
          <Plus size={16} /> <span>Add</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 pb-24">
        {foods.length === 0 && (
          <div className="text-center text-slate-400 py-10 text-sm">No foods registered. Click "Add" to start.</div>
        )}
        {foods.map(food => (
          <div key={food.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <span className="font-medium text-slate-800">{food.name}</span>
            <span className="text-slate-500 text-sm bg-slate-50 px-3 py-1 rounded-full">{food.caloriesPer100g} kcal / 100g</span>
          </div>
        ))}
      </div>
    </div>
  );

  const PhysicalPlatesView = () => (
    <div className="flex flex-col h-full bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="pt-8 pb-5 px-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">My Plates</h2>
        <button onClick={() => setShowAddPhysicalPlate(true)} className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-emerald-100 transition">
          <Plus size={16} /> <span>Add Plate</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 pb-24">
        <p className="text-sm text-slate-500 mb-3">Register your physical plates/bowls to auto-deduct their empty weight when logging food.</p>

        {physicalPlates.length === 0 && (
          <div className="text-center text-slate-400 py-10 text-sm">No plates registered. Click "Add Plate" to start.</div>
        )}

        {physicalPlates.map(plate => (
          <div key={plate.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Disc size={20} className="text-slate-400" />
              <span className="font-medium text-slate-800">{plate.name}</span>
            </div>
            <span className="text-slate-500 text-sm bg-slate-50 px-3 py-1 rounded-full">{plate.weightGrams}g</span>
          </div>
        ))}
      </div>
    </div>
  );

  // --- Modals ---
  const AddLogModal = () => {
    const [type, setType] = useState('food');
    const [selectedId, setSelectedId] = useState('');
    const [mealIngredients, setMealIngredients] = useState([{ foodId: '', percentage: '' }]);
    const [usePlate, setUsePlate] = useState(false);
    const [selectedPlateId, setSelectedPlateId] = useState('');
    const [weightInput, setWeightInput] = useState('');

    const addIngredient = () => setMealIngredients([...mealIngredients, { foodId: '', percentage: '' }]);
    const updateIngredient = (index, field, value) => {
      const newIngs = [...mealIngredients];
      newIngs[index][field] = value;
      setMealIngredients(newIngs);
    };
    const removeIngredient = (index) => {
      setMealIngredients(mealIngredients.filter((_, i) => i !== index));
    };

    const totalPercentage = mealIngredients.reduce((sum, ing) => sum + (parseFloat(ing.percentage) || 0), 0);
    const isValidMeal = type === 'meal' && mealIngredients.every(i => i.foodId && i.percentage) && totalPercentage === 100;

    let netAmount = 0;
    if (weightInput && !isNaN(weightInput)) {
      if (usePlate && selectedPlateId) {
        const plate = physicalPlates.find(p => p.id === selectedPlateId);
        netAmount = parseFloat(weightInput) - (plate ? plate.weightGrams : 0);
      } else {
        netAmount = parseFloat(weightInput);
      }
    }

    const handleSave = async () => {
      if (netAmount <= 0) return;
      if (type === 'food' && !selectedId) return;
      if (type === 'meal' && !isValidMeal) return;
      if (!user || !isFirebaseConfigured) return;

      const newLog = {
        id: generateId(),
        date: currentDate,
        type,
        amountGrams: netAmount
      };

      if (type === 'food') {
        newLog.itemId = selectedId;
      } else {
        newLog.ingredients = mealIngredients.map(ing => ({
          foodId: ing.foodId,
          percentage: parseFloat(ing.percentage)
        }));
      }

      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', newLog.id), newLog);
        setShowAddLog(false);
      } catch (error) {
        console.error("Error saving log:", error);
        setGlobalError("Failed to save log: " + error.message);
      }
    };

    let previewCals = 0;
    if (netAmount > 0) {
      if (type === 'food' && selectedId) {
        previewCals = calculateFoodCalories(selectedId, netAmount);
      } else if (type === 'meal' && isValidMeal) {
        previewCals = mealIngredients.reduce((total, ing) => {
          const ingredientGrams = netAmount * (parseFloat(ing.percentage) / 100);
          return total + calculateFoodCalories(ing.foodId, ingredientGrams);
        }, 0);
      }
    }

    return (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end">
        <div className="bg-white rounded-t-[32px] p-6 pb-12 animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2 pb-2">
            <h2 className="text-2xl font-bold text-slate-800">Add to Log</h2>
            <button onClick={() => setShowAddLog(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200"><X size={20} /></button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${type === 'food' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
              onClick={() => { setType('food'); }}
            >Single Food</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${type === 'meal' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
              onClick={() => { setType('meal'); }}
            >Custom Meal</button>
          </div>

          <div className="space-y-5">
            {type === 'food' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Food</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                >
                  <option value="">-- Select --</option>
                  {foods.map(f => <option key={f.id} value={f.id}>{f.name} ({f.caloriesPer100g} kcal/100g)</option>)}
                </select>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-end mb-3">
                  <label className="block text-sm font-medium text-slate-700">Meal Composition</label>
                  <span className={`text-sm font-bold ${totalPercentage === 100 ? 'text-emerald-600' : 'text-amber-500'}`}>
                    Total: {totalPercentage}%
                  </span>
                </div>

                <div className="space-y-3">
                  {mealIngredients.map((ing, idx) => (
                    <div key={idx} className="flex space-x-2 items-center">
                      <select
                        value={ing.foodId}
                        onChange={(e) => updateIngredient(idx, 'foodId', e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select Food...</option>
                        {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <div className="relative w-24">
                        <input
                          type="number"
                          value={ing.percentage}
                          onChange={(e) => updateIngredient(idx, 'percentage', e.target.value)}
                          placeholder="%"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-6"
                        />
                        <span className="absolute right-3 top-3.5 text-slate-400 text-sm">%</span>
                      </div>
                      {mealIngredients.length > 1 && (
                        <button onClick={() => removeIngredient(idx)} className="text-red-400 hover:text-red-600 p-2">
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addIngredient}
                  className="mt-3 text-sm font-medium text-emerald-600 flex items-center space-x-1 hover:text-emerald-700"
                >
                  <Plus size={16} /> <span>Add Another Food</span>
                </button>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700">Did you use a registered plate?</label>
                <input
                  type="checkbox"
                  checked={usePlate}
                  onChange={(e) => setUsePlate(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                />
              </div>

              {usePlate && (
                <div className="mb-3 animate-in fade-in duration-200">
                  <select
                    value={selectedPlateId}
                    onChange={(e) => setSelectedPlateId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Plate --</option>
                    {physicalPlates.map(p => <option key={p.id} value={p.id}>{p.name} (-{p.weightGrams}g)</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {usePlate ? 'Gross Weight on Scale (Food + Plate)' : 'Actual Net Food Weight'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="e.g., 400"
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-12"
                  />
                  <span className="absolute right-4 top-3.5 text-slate-400 font-medium">g</span>
                </div>
              </div>
            </div>

            {netAmount > 0 && (
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl flex flex-col justify-center space-y-1 border border-emerald-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-80">Net Food Weight:</span>
                  <span className="font-bold">{netAmount}g</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Estimated Calories:</span>
                  <span className="font-bold text-xl">
                    {(type === 'meal' && !isValidMeal) ? '---' : Math.round(previewCals)} kcal
                  </span>
                </div>
              </div>
            )}

            {netAmount < 0 && usePlate && weightInput && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                Gross weight must be higher than the plate's empty weight.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={
                netAmount <= 0 ||
                (type === 'food' && !selectedId) ||
                (type === 'meal' && !isValidMeal)
              }
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
            >
              <Check size={20} />
              <span>
                {type === 'meal' && totalPercentage !== 100
                  ? 'Percentages must equal 100%'
                  : `Log ${netAmount > 0 ? `${netAmount}g` : 'Entry'}`
                }
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AddFoodModal = () => {
    const [name, setName] = useState('');
    const [cals, setCals] = useState('');

    const handleSave = async () => {
      if (!name || !cals || isNaN(cals)) return;
      if (!user || !isFirebaseConfigured) return;

      const newFood = { id: generateId(), name, caloriesPer100g: parseFloat(cals) };
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'foods', newFood.id), newFood);
        setShowAddFood(false);
      } catch (error) {
        console.error("Error saving food:", error);
        setGlobalError("Failed to save food: " + error.message);
      }
    };

    return (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Register Food</h2>
            <button onClick={() => setShowAddFood(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Food Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Avocado"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Calories per 100g</label>
              <input
                type="number"
                value={cals}
                onChange={(e) => setCals(e.target.value)}
                placeholder="e.g., 160"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!name || !cals}
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center disabled:opacity-50 hover:bg-emerald-700 transition"
            >
              Save Food
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AddPhysicalPlateModal = () => {
    const [name, setName] = useState('');
    const [weight, setWeight] = useState('');

    const handleSave = async () => {
      if (!name || !weight || isNaN(weight)) return;
      if (!user || !isFirebaseConfigured) return;

      const newPlate = { id: generateId(), name, weightGrams: parseFloat(weight) };
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plates', newPlate.id), newPlate);
        setShowAddPhysicalPlate(false);
      } catch (error) {
        console.error("Error saving plate:", error);
        setGlobalError("Failed to save plate: " + error.message);
      }
    };

    return (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Register Plate</h2>
            <button onClick={() => setShowAddPhysicalPlate(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plate/Bowl Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Heavy Red Bowl"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empty Weight (grams)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g., 350"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={!name || !weight}
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center disabled:opacity-50 hover:bg-emerald-700 transition"
            >
              Save Plate
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    // h-[100dvh] uses the DYNAMIC viewport height on mobile (excludes the
    // browser address bar), which is what was causing the unwanted scroll
    // before. sm:h-[844px] keeps the desktop "phone frame" preview.
    <div className="h-[100dvh] sm:min-h-screen bg-slate-100 flex items-center justify-center sm:p-6 font-sans relative overflow-hidden">

      {/* Global Errors */}
      {globalError && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white px-4 py-3 shadow-md z-50 flex justify-between items-center animate-in slide-in-from-top-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} />
            <span className="text-sm font-medium">{globalError}</span>
          </div>
          <button onClick={() => setGlobalError('')} className="p-1 hover:bg-red-700 rounded-full transition"><X size={16} /></button>
        </div>
      )}

      {!isFirebaseConfigured && (
        <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold text-center py-2 z-40">
          Database Disconnected: Add Firebase Config to save your logs permanently.
        </div>
      )}

      {/* Mobile Frame Container */}
      <div className="w-full h-full sm:h-[844px] max-w-[390px] bg-white relative sm:rounded-[40px] sm:shadow-2xl overflow-hidden flex flex-col sm:border-[8px] sm:border-slate-800">

        {/* Offline pill */}
        {!isOnline && isFirebaseConfigured && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[11px] font-medium px-3 py-1 rounded-full shadow-lg flex items-center space-x-1.5 animate-in fade-in slide-in-from-top-2">
            <WifiOff size={12} />
            <span>Offline · saving locally</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative min-h-0">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-emerald-600">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span className="font-medium text-sm">Syncing with cloud...</span>
            </div>
          )}
          {activeTab === 'log' && <HomeView />}
          {activeTab === 'trends' && <TrendsView />}
          {activeTab === 'foods' && <FoodsView />}
          {activeTab === 'plates' && <PhysicalPlatesView />}
        </div>

        {/* Bottom Navigation — 4 tabs */}
        <div className="h-20 bg-white border-t border-slate-100 flex items-center justify-around px-1 pb-safe z-40 relative shrink-0">
          <button
            onClick={() => setActiveTab('log')}
            className={`flex flex-col items-center justify-center w-1/4 h-full space-y-1 transition ${activeTab === 'log' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Home size={22} className={activeTab === 'log' ? 'fill-emerald-100' : ''} />
            <span className="text-[10px] font-medium tracking-wide">Log</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`flex flex-col items-center justify-center w-1/4 h-full space-y-1 transition ${activeTab === 'trends' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <BarChart3 size={22} className={activeTab === 'trends' ? 'fill-emerald-100' : ''} />
            <span className="text-[10px] font-medium tracking-wide">Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('foods')}
            className={`flex flex-col items-center justify-center w-1/4 h-full space-y-1 transition ${activeTab === 'foods' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Utensils size={22} className={activeTab === 'foods' ? 'fill-emerald-100' : ''} />
            <span className="text-[10px] font-medium tracking-wide">Foods</span>
          </button>

          <button
            onClick={() => setActiveTab('plates')}
            className={`flex flex-col items-center justify-center w-1/4 h-full space-y-1 transition ${activeTab === 'plates' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Disc size={22} className={activeTab === 'plates' ? 'fill-emerald-100' : ''} />
            <span className="text-[10px] font-medium tracking-wide">Plates</span>
          </button>
        </div>

        {/* Overlays */}
        {showAddLog && <AddLogModal />}
        {showAddFood && <AddFoodModal />}
        {showAddPhysicalPlate && <AddPhysicalPlateModal />}
      </div>
    </div>
  );
}
