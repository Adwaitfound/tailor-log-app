import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Scissors,
  Calendar,
  User,
  Shirt,
  IndianRupee,
  Trash2,
  Wallet,
  FileText,
  TrendingDown,
  TrendingUp,
  Package,
  CreditCard,
  CalendarDays,
  Settings,
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';

// ==========================================
// 🔴 DEPLOYMENT STEP: PUT YOUR FIREBASE INFO HERE
// ==========================================
const myFirebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// (This logic keeps it working in this preview window while being ready for your real project)
const firebaseConfig =
  typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : myFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Helper to group dates into Friday -> Thursday weekly cycles
const getSettlementCycle = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const daysToThu = day >= 5 ? 4 - day + 7 : 4 - day;

  const end = new Date(d);
  end.setDate(d.getDate() + daysToThu);

  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  const formatDate = (date) =>
    date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  return `${formatDate(start)} - ${formatDate(end)}`;
};

export default function App() {
  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState('production');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [mainView, setMainView] = useState('ledger');

  // Settings State (Starts empty now)
  const [customProductsText, setCustomProductsText] = useState('');
  const [customTailorsText, setCustomTailorsText] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to Ledger Entries
    const entriesRef = collection(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'entries'
    );
    const unsubscribeEntries = onSnapshot(
      entriesRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setEntries(
          data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        );
        setIsLoading(false);
      },
      (err) => console.error('Firestore Error:', err)
    );

    // Listen to Custom Products
    const productsRef = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      'products'
    );
    const unsubscribeProducts = onSnapshot(
      productsRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().text)
          setCustomProductsText(docSnap.data().text);
      },
      (err) => console.error(err)
    );

    // Listen to Custom Tailors
    const tailorsRef = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      'tailors'
    );
    const unsubscribeTailors = onSnapshot(
      tailorsRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().text)
          setCustomTailorsText(docSnap.data().text);
      },
      (err) => console.error(err)
    );

    return () => {
      unsubscribeEntries();
      unsubscribeProducts();
      unsubscribeTailors();
    };
  }, [user]);

  const handleCustomProductsTextChange = async (e) => {
    const text = e.target.value;
    setCustomProductsText(text);
    if (user)
      await setDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'products'),
        { text }
      );
  };

  const handleCustomTailorsTextChange = async (e) => {
    const text = e.target.value;
    setCustomTailorsText(text);
    if (user)
      await setDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'tailors'),
        { text }
      );
  };

  const activeProducts = useMemo(() => {
    const list = customProductsText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return list.length > 0 ? list : ['Please add products in Settings'];
  }, [customProductsText]);

  const activeTailors = useMemo(() => {
    const list = customTailorsText
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return list.length > 0 ? list : ['Please add tailors in Settings'];
  }, [customTailorsText]);

  const [prodForm, setProdForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '',
    product: '',
    sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
    pieceRate: 250,
  });

  const [payForm, setPayForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '',
    amount: '',
    note: '',
  });

  const currentSelectedProduct = prodForm.product || activeProducts[0];
  const currentSelectedTailorProd = prodForm.tailor || activeTailors[0];
  const currentSelectedTailorPay = payForm.tailor || activeTailors[0];

  const handleProdSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setProdForm((prev) => ({
      ...prev,
      sizes: { ...prev.sizes, [size]: numValue },
    }));
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    const totalPieces = Object.values(prodForm.sizes).reduce(
      (sum, val) => sum + val,
      0
    );

    if (totalPieces === 0) {
      alert('Please enter at least one piece.');
      return;
    }

    if (activeTailors[0] === 'Please add tailors in Settings') {
      alert('Please add tailors in the Settings tab first.');
      return;
    }

    const newEntry = {
      ...prodForm,
      tailor: currentSelectedTailorProd,
      product: currentSelectedProduct,
      type: 'production',
      totalPieces,
      amount: totalPieces * prodForm.pieceRate,
      timestamp: new Date().toISOString(),
    };

    if (user) {
      await addDoc(
        collection(db, 'artifacts', appId, 'users', user.uid, 'entries'),
        newEntry
      );
    }
    setProdForm((prev) => ({
      ...prev,
      sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
    }));
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const payAmount = parseFloat(payForm.amount);

    if (!payAmount || payAmount <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    if (activeTailors[0] === 'Please add tailors in Settings') {
      alert('Please add tailors in the Settings tab first.');
      return;
    }

    const newEntry = {
      type: 'payment',
      date: payForm.date,
      tailor: currentSelectedTailorPay,
      amount: payAmount,
      note: payForm.note,
      timestamp: new Date().toISOString(),
    };

    if (user) {
      await addDoc(
        collection(db, 'artifacts', appId, 'users', user.uid, 'entries'),
        newEntry
      );
    }
    setPayForm((prev) => ({ ...prev, amount: '', note: '' }));
  };

  const deleteEntry = async (id) => {
    if (user)
      await deleteDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'entries', id)
      );
  };

  const filteredEntries = useMemo(() => {
    if (selectedTailorFilter === 'All') return entries;
    return entries.filter((e) => e.tailor === selectedTailorFilter);
  }, [entries, selectedTailorFilter]);

  const settlementReports = useMemo(() => {
    const cycles = {};
    filteredEntries.forEach((entry) => {
      const cycleStr = getSettlementCycle(entry.date);
      if (!cycles[cycleStr])
        cycles[cycleStr] = {
          cycle: cycleStr,
          earned: 0,
          paid: 0,
          pieces: 0,
          details: [],
        };

      if (entry.type === 'production') {
        cycles[cycleStr].earned += entry.amount;
        cycles[cycleStr].pieces += entry.totalPieces;
      } else if (entry.type === 'payment') {
        cycles[cycleStr].paid += entry.amount;
      }
      cycles[cycleStr].details.push(entry);
    });
    return Object.values(cycles).sort(
      (a, b) =>
        new Date(b.cycle.split(' - ')[1]) - new Date(a.cycle.split(' - ')[1])
    );
  }, [filteredEntries]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, curr) => {
        if (curr.type === 'production') {
          acc.pieces += curr.totalPieces;
          acc.earned += curr.amount;
        } else if (curr.type === 'payment') {
          acc.paid += curr.amount;
        }
        return acc;
      },
      { pieces: 0, earned: 0, paid: 0 }
    );
  }, [filteredEntries]);

  const pendingBalance = totals.earned - totals.paid;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Scissors className="text-indigo-600" />
            Tailor Accounts & Ledger
          </h1>
          <p className="text-slate-500 text-sm mt-1 flex flex-wrap items-center gap-2">
            <span>Track production, payments, and pending balances</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>{' '}
              Cloud Sync Active
            </span>
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <button
            onClick={() => setMainView('ledger')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              mainView === 'ledger'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={16} /> Ledger
          </button>
          <button
            onClick={() => setMainView('reports')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              mainView === 'reports'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays size={16} /> Reports
          </button>
          <button
            onClick={() => setMainView('settings')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              mainView === 'settings'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={16} /> Settings
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button
                onClick={() => setActiveTab('production')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${
                  activeTab === 'production'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Shirt size={16} /> Log Clothes
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${
                  activeTab === 'payment'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CreditCard size={16} /> Log Payment
              </button>
            </div>

            {/* PRODUCTION FORM */}
            {activeTab === 'production' && (
              <form
                onSubmit={handleProdSubmit}
                className="space-y-5 animate-in fade-in"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar
                        size={16}
                        className="absolute left-3 top-2.5 text-slate-400"
                      />
                      <input
                        type="date"
                        value={prodForm.date}
                        onChange={(e) =>
                          setProdForm({ ...prodForm, date: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tailor
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-3 top-2.5 text-slate-400"
                      />
                      <select
                        value={currentSelectedTailorProd}
                        onChange={(e) =>
                          setProdForm({ ...prodForm, tailor: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                      >
                        {activeTailors.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Style / Product
                  </label>
                  <div className="relative">
                    <Shirt
                      size={16}
                      className="absolute left-3 top-2.5 text-slate-400"
                    />
                    <select
                      value={currentSelectedProduct}
                      onChange={(e) =>
                        setProdForm({ ...prodForm, product: e.target.value })
                      }
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                    >
                      {activeProducts.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Quantities by Size
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
                      <div key={size} className="text-center">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {size}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={prodForm.sizes[size] || ''}
                          onChange={(e) =>
                            handleProdSizeChange(size, e.target.value)
                          }
                          placeholder="0"
                          className="w-full py-2 text-center bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Rate per Piece (₹)
                    </label>
                    <div className="relative w-28">
                      <IndianRupee
                        size={16}
                        className="absolute left-3 top-2.5 text-slate-400"
                      />
                      <input
                        type="number"
                        value={prodForm.pieceRate}
                        onChange={(e) =>
                          setProdForm({
                            ...prodForm,
                            pieceRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      Earned This Batch
                    </div>
                    <div className="text-xl font-bold text-indigo-700">
                      ₹
                      {Object.values(prodForm.sizes).reduce(
                        (a, b) => a + b,
                        0
                      ) * prodForm.pieceRate}
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm"
                >
                  Log Production
                </button>
              </form>
            )}

            {/* PAYMENT FORM */}
            {activeTab === 'payment' && (
              <form
                onSubmit={handlePaySubmit}
                className="space-y-5 animate-in fade-in"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar
                        size={16}
                        className="absolute left-3 top-2.5 text-slate-400"
                      />
                      <input
                        type="date"
                        value={payForm.date}
                        onChange={(e) =>
                          setPayForm({ ...payForm, date: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tailor
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-3 top-2.5 text-slate-400"
                      />
                      <select
                        value={currentSelectedTailorPay}
                        onChange={(e) =>
                          setPayForm({ ...payForm, tailor: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                      >
                        {activeTailors.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Amount Paid (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee
                      size={16}
                      className="absolute left-3 top-2.5 text-slate-400"
                    />
                    <input
                      type="number"
                      value={payForm.amount}
                      onChange={(e) =>
                        setPayForm({ ...payForm, amount: e.target.value })
                      }
                      placeholder="e.g. 3000"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes (Optional)
                  </label>
                  <div className="relative">
                    <FileText
                      size={16}
                      className="absolute left-3 top-2.5 text-slate-400"
                    />
                    <input
                      type="text"
                      value={payForm.note}
                      onChange={(e) =>
                        setPayForm({ ...payForm, note: e.target.value })
                      }
                      placeholder="e.g. Advance payment"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm mt-4"
                >
                  Record Payment
                </button>
              </form>
            )}
          </div>
        </div>

        {}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-200">
            <span className="text-sm font-medium text-slate-600">
              Viewing Records For:
            </span>
            <select
              value={selectedTailorFilter}
              onChange={(e) => setSelectedTailorFilter(e.target.value)}
              className="bg-slate-100 border-none text-sm font-semibold text-slate-800 py-1.5 px-3 rounded-lg outline-none cursor-pointer"
            >
              <option value="All">All Tailors Overview</option>
              {activeTailors
                .filter((t) => t !== 'Please add tailors in Settings')
                .map((t) => (
                  <option key={t} value={t}>
                    {t} Only
                  </option>
                ))}
            </select>
          </div>

          {/* VIEW: SETTINGS */}
          {mainView === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <User className="text-indigo-600" size={20} /> Manage Tailors
                </h2>
                <p className="text-slate-500 text-sm mb-4">
                  Type one tailor name per line.
                </p>
                <textarea
                  className="w-full h-[300px] p-4 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none resize-y"
                  value={customTailorsText}
                  onChange={handleCustomTailorsTextChange}
                  placeholder="Sajid&#10;Imran&#10;Raju"
                />
                <div className="mt-3 text-xs text-emerald-600 font-medium">
                  {activeTailors[0] === 'Please add tailors in Settings'
                    ? 0
                    : activeTailors.length}{' '}
                  tailors active.
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Shirt className="text-indigo-600" size={20} /> Manage
                  Products
                </h2>
                <p className="text-slate-500 text-sm mb-4">
                  Paste your CSV column here. One product per line.
                </p>
                <textarea
                  className="w-full h-[300px] p-4 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none whitespace-pre resize-y"
                  value={customProductsText}
                  onChange={handleCustomProductsTextChange}
                  placeholder="Product A&#10;Product B"
                />
                <div className="mt-3 text-xs text-emerald-600 font-medium">
                  {activeProducts[0] === 'Please add products in Settings'
                    ? 0
                    : activeProducts.length}{' '}
                  products loaded.
                </div>
              </div>
            </div>
          )}

          {/* VIEW: REPORTS */}
          {mainView === 'reports' && (
            <div className="space-y-6 animate-in fade-in">
              {settlementReports.map((report) => {
                const balance = report.earned - report.paid;
                return (
                  <div
                    key={report.cycle}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-lg">
                        Cycle: {report.cycle} (Thu)
                      </h3>
                      <span className="text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-bold">
                        {report.pieces} Pcs
                      </span>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-sm font-medium text-slate-500 mb-1">
                          Earned This Cycle (+)
                        </div>
                        <div className="text-2xl font-bold text-slate-900">
                          ₹{report.earned.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <div className="text-sm font-medium text-emerald-700 mb-1">
                          Paid During Cycle (-)
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">
                          ₹{report.paid.toLocaleString()}
                        </div>
                      </div>
                      <div
                        className={`p-4 rounded-xl border ${
                          balance > 0
                            ? 'bg-orange-50 border-orange-200'
                            : balance < 0
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div
                          className={`text-sm font-medium mb-1 ${
                            balance > 0
                              ? 'text-orange-700'
                              : balance < 0
                              ? 'text-blue-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {balance > 0
                            ? 'Pending Payout'
                            : balance < 0
                            ? 'Overpaid / Advance'
                            : 'Fully Settled'}
                        </div>
                        <div
                          className={`text-2xl font-bold ${
                            balance > 0
                              ? 'text-orange-700'
                              : balance < 0
                              ? 'text-blue-700'
                              : 'text-slate-700'
                          }`}
                        >
                          ₹{Math.abs(balance).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {settlementReports.length === 0 && (
                <div className="text-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No settlement cycles found.</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW: LEDGER */}
          {mainView === 'ledger' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium mb-2">
                    Pieces Stitched
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {totals.pieces}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium mb-2">
                    Total Earned
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    ₹{totals.earned.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium mb-2">
                    Amount Paid
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    ₹{totals.paid.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-sm border ${
                    pendingBalance > 0
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    className={`text-xs font-medium mb-2 ${
                      pendingBalance > 0 ? 'text-orange-700' : 'text-slate-600'
                    }`}
                  >
                    Pending Balance
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      pendingBalance > 0 ? 'text-orange-700' : 'text-slate-900'
                    }`}
                  >
                    ₹{pendingBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">
                    Account Ledger
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Tailor</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3 text-right">Earned (+)</th>
                        <th className="px-4 py-3 text-right">Paid (-)</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEntries.length === 0 && (
                        <tr>
                          <td
                            colSpan="6"
                            className="text-center py-8 text-slate-400"
                          >
                            No entries yet. Add tailors and products in Settings
                            to begin!
                          </td>
                        </tr>
                      )}
                      {filteredEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {entry.date}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                            {entry.tailor}
                          </td>
                          <td className="px-4 py-3">
                            {entry.type === 'production' ? (
                              <div>
                                <div className="text-slate-800 font-medium">
                                  {entry.product}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {entry.totalPieces} pcs @ ₹{entry.pieceRate}
                                  <span className="ml-2 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {Object.entries(entry.sizes)
                                      .filter(([_, q]) => q > 0)
                                      .map(([s, q]) => `${s}:${q}`)
                                      .join(', ')}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-emerald-700 font-medium flex items-center gap-1">
                                  <Wallet size={12} /> Cash Payment
                                </div>
                                {entry.note && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {entry.note}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {entry.type === 'production'
                              ? `₹${entry.amount.toLocaleString()}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">
                            {entry.type === 'payment'
                              ? `₹${entry.amount.toLocaleString()}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
