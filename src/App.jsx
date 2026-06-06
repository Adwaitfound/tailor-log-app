import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Scissors, Calendar, User, Shirt, DollarSign, Trash2, 
  Wallet, FileText, TrendingDown, TrendingUp, Package, CreditCard,
  Settings, ChevronRight, BarChart3, List, CheckCircle2, AlertCircle,
  Home, RefreshCw, LogOut, Clock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';

const DEFAULT_PRODUCTS = ["Backless Cami", "Banaspati Top", "Cami Top", "Creme Dress", "Wrap Around"];
const DEFAULT_TAILORS = ["Sajid", "Imran", "Raju"];

export default function App() {
  // --- FIREBASE STATE ---
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [appId, setAppId] = useState('poshakh-app-id');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteModalId, setDeleteModalId] = useState(null);

  // --- APP STATE ---
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [tailors, setTailors] = useState(DEFAULT_TAILORS);
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');

  // --- VIEW STATE ---
  const [currentView, setCurrentView] = useState('ledger'); 

  // --- FORM STATES ---
  const [prodForm, setProdForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '',
    product: '',
    sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
    pieceRate: 250
  });

  const [payForm, setPayForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '',
    amount: '',
    note: ''
  });

  const [settingsForm, setSettingsForm] = useState({
    productsText: '',
    tailorsText: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    try {
      // 🔴 DEPLOYMENT STEP: Paste your Firebase Config here.
      const YOUR_FIREBASE_CONFIG = {
        // apiKey: "YOUR_API_KEY",
        // authDomain: "YOUR_AUTH_DOMAIN",
        // projectId: "YOUR_PROJECT_ID",
      };

      const configStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
      const fallbackConfig = JSON.parse(configStr);
      const firebaseConfig = Object.keys(YOUR_FIREBASE_CONFIG).length > 0 ? YOUR_FIREBASE_CONFIG : fallbackConfig;
      
      if (Object.keys(firebaseConfig).length === 0) {
        setLoading(false);
        return; 
      }

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const firestoreDb = getFirestore(app);
      setDb(firestoreDb);
      
      if (typeof __app_id !== 'undefined') { setAppId(__app_id); }

      const initAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (err) {
          showToast("Authentication failed.", "error");
        }
      };
      
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase setup error:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const entriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tailor_entries');
    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tailor_settings');

    const unsubEntries = onSnapshot(entriesRef, (snapshot) => {
      const fetchedEntries = [];
      snapshot.forEach(doc => fetchedEntries.push({ id: doc.id, ...doc.data() }));
      fetchedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntries(fetchedEntries);
      setLoading(false);
    }, () => { showToast("Error loading cloud data", "error"); setLoading(false); });

    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      let foundConfig = false;
      snapshot.forEach(doc => {
        if (doc.id === 'config') {
          foundConfig = true;
          const data = doc.data();
          if (data.tailors?.length > 0) {
            setTailors(data.tailors);
            setProdForm(p => ({ ...p, tailor: p.tailor || data.tailors[0] }));
            setPayForm(p => ({ ...p, tailor: p.tailor || data.tailors[0] }));
            setSettingsForm(p => ({ ...p, tailorsText: data.tailors.join('\n') }));
          }
          if (data.products?.length > 0) {
            setProducts(data.products);
            setProdForm(p => ({ ...p, product: p.product || data.products[0] }));
            setSettingsForm(p => ({ ...p, productsText: data.products.join('\n') }));
          }
        }
      });
      if (!foundConfig) {
        setProdForm(p => ({ ...p, tailor: DEFAULT_TAILORS[0], product: DEFAULT_PRODUCTS[0] }));
        setPayForm(p => ({ ...p, tailor: DEFAULT_TAILORS[0] }));
        setSettingsForm({ tailorsText: DEFAULT_TAILORS.join('\n'), productsText: DEFAULT_PRODUCTS.join('\n') });
      }
    });

    return () => { unsubEntries(); unsubSettings(); };
  }, [user, db, appId]);

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    if (!user || !db) return showToast("Cloud not connected.", "error");

    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    if (totalPieces === 0) return showToast("Enter at least 1 piece.", "error");

    const newEntry = {
      type: 'production',
      date: prodForm.date,
      tailor: prodForm.tailor,
      product: prodForm.product,
      sizes: prodForm.sizes,
      pieceRate: Number(prodForm.pieceRate),
      totalPieces,
      amount: totalPieces * Number(prodForm.pieceRate),
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tailor_entries'), newEntry);
      showToast("Production logged successfully!");
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      setCurrentView('ledger');
    } catch (err) {
      showToast("Failed to save entry", "error");
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!user || !db) return;

    const payAmount = parseFloat(payForm.amount);
    if (!payAmount || payAmount <= 0) return showToast("Enter a valid amount.", "error");

    const newEntry = {
      type: 'payment',
      date: payForm.date,
      tailor: payForm.tailor,
      amount: payAmount,
      note: payForm.note,
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tailor_entries'), newEntry);
      showToast("Payment recorded successfully!");
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      setCurrentView('ledger');
    } catch (err) {
      showToast("Failed to record payment", "error");
    }
  };

  const confirmDelete = async () => {
    if (!user || !db || !deleteModalId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tailor_entries', deleteModalId));
      showToast("Record permanently deleted.");
      setDeleteModalId(null);
    } catch (err) {
      showToast("Failed to delete entry", "error");
    }
  };

  const saveSettings = async () => {
    if (!user || !db) return showToast("Database not fully connected yet.", "error");
    const newTailors = settingsForm.tailorsText.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = settingsForm.productsText.split('\n').map(p => p.trim()).filter(p => p);
    if (newTailors.length === 0 || newProducts.length === 0) return showToast("Lists cannot be empty", "error");

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tailor_settings', 'config'), {
        tailors: newTailors, products: newProducts, updatedAt: new Date().toISOString()
      });
      showToast("Settings synced to Cloud!");
    } catch (err) {
      showToast("Failed to save settings", "error");
    }
  };

  const filteredEntries = useMemo(() => {
    if (selectedTailorFilter === 'All') return entries;
    return entries.filter(e => e.tailor === selectedTailorFilter);
  }, [entries, selectedTailorFilter]);

  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, curr) => {
      if (curr.type === 'production') {
        acc.pieces += curr.totalPieces;
        acc.earned += curr.amount;
      } else if (curr.type === 'payment') {
        acc.paid += curr.amount;
      }
      return acc;
    }, { pieces: 0, earned: 0, paid: 0 });
  }, [filteredEntries]);

  const pendingBalance = totals.earned - totals.paid;

  const weeklyReports = useMemo(() => {
    const weeks = {};
    filteredEntries.forEach(entry => {
      const d = new Date(entry.date);
      const day = d.getDay();
      const diffToFriday = (day >= 5) ? (day - 5) : (day + 2);
      const friday = new Date(d);
      friday.setDate(d.getDate() - diffToFriday);
      const thursday = new Date(friday);
      thursday.setDate(friday.getDate() + 6);

      const weekKey = `${friday.toISOString().split('T')[0]} to ${thursday.toISOString().split('T')[0]}`;
      const label = `${friday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short'})} - ${thursday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

      if (!weeks[weekKey]) weeks[weekKey] = { label, earned: 0, paid: 0, pieces: 0, sortKey: friday.getTime() };
      
      if (entry.type === 'production') {
        weeks[weekKey].earned += entry.amount;
        weeks[weekKey].pieces += entry.totalPieces;
      } else if (entry.type === 'payment') {
        weeks[weekKey].paid += entry.amount;
      }
    });
    return Object.values(weeks).sort((a, b) => b.sortKey - a.sortKey);
  }, [filteredEntries]);

  const renderLedger = () => (
    <div className="w-full animate-in fade-in">
      
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <BarChart3 className="text-[#cdfc4c]" size={20}/> 
          Overview Dashboard
        </h2>
        <select 
          value={selectedTailorFilter} 
          onChange={(e) => setSelectedTailorFilter(e.target.value)} 
          className="bg-[#1a1a1a] border border-[#333] text-white font-medium py-2 px-4 rounded-lg text-sm focus:border-[#cdfc4c] outline-none"
        >
          <option value="All">All Tailors (Company View)</option>
          {tailors.map(t => <option key={t} value={t}>{t}'s Dashboard</option>)}
        </select>
      </div>

      {/* Main Revenue/Pending Card (Neon Lime) */}
      <div className="bg-[#cdfc4c] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center text-black mb-6 w-full shadow-lg">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase opacity-70 mb-1 flex items-center gap-1"><TrendingUp size={14}/> Total Tailor Value</p>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tighter">₹{totals.earned.toLocaleString()}</h2>
          <p className="text-sm font-medium opacity-80 mt-2">{totals.pieces} Total Pieces Stitched</p>
        </div>
        <div className="mt-8 md:mt-0 md:text-right bg-white/30 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 w-full md:w-auto">
          <p className="text-[10px] font-bold tracking-widest uppercase opacity-70 mb-1">Total Pending Balance</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-rose-700">₹{pendingBalance.toLocaleString()}</h2>
          <p className="text-xs font-medium opacity-80 mt-1">To be paid out</p>
        </div>
      </div>

      {/* Grid of Secondary Metrics (Pastel Colors) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 w-full">
        <div className="bg-[#ffe4e6] rounded-2xl p-5 border border-[#fda4af]">
          <p className="text-[10px] font-bold tracking-widest uppercase text-rose-900 mb-1 flex items-center gap-1"><Wallet size={12}/> Total Paid (All Time)</p>
          <h3 className="text-3xl font-bold tracking-tight text-rose-950">₹{totals.paid.toLocaleString()}</h3>
        </div>
        <div className="bg-[#dcfce7] rounded-2xl p-5 border border-[#86efac]">
           <p className="text-[10px] font-bold tracking-widest uppercase text-green-900 mb-1 flex items-center gap-1"><Package size={12}/> Ready for QC</p>
           <h3 className="text-3xl font-bold tracking-tight text-green-950">{totals.pieces} <span className="text-lg opacity-70">units</span></h3>
        </div>
        <div className="bg-[#fef08a] rounded-2xl p-5 border border-[#fde047]">
           <p className="text-[10px] font-bold tracking-widest uppercase text-yellow-900 mb-1 flex items-center gap-1"><Clock size={12}/> Last Activity</p>
           <h3 className="text-xl font-bold tracking-tight text-yellow-950 mt-2">
             {filteredEntries.length > 0 ? new Date(filteredEntries[0].timestamp).toLocaleDateString() : 'No activity'}
           </h3>
        </div>
      </div>

      {/* Full Width Ledger Table */}
      <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl overflow-hidden w-full">
        <div className="px-6 py-4 border-b border-[#222] flex items-center justify-between bg-[#141414]">
          <h3 className="font-bold text-white text-sm tracking-wide uppercase">Recent Transactions</h3>
          <span className="text-[10px] bg-[#222] text-gray-400 px-2 py-1 rounded-md">{filteredEntries.length} Records</span>
        </div>
        
        <div className="overflow-x-auto w-full">
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-[#444]">
              <FileText size={32} className="mx-auto mb-3" />
              <p>No records found.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[#888] font-medium text-[10px] uppercase tracking-wider bg-[#0a0a0a]">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Tailor</th>
                  <th className="px-6 py-4 font-semibold">Details</th>
                  <th className="px-6 py-4 font-semibold text-right">Credit (+)</th>
                  <th className="px-6 py-4 font-semibold text-right">Debit (-)</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-[#1a1a1a] transition-colors group">
                    <td className="px-6 py-4 text-gray-400">{entry.date}</td>
                    <td className="px-6 py-4 font-medium text-gray-200">
                      <span className="bg-[#222] px-2 py-1 rounded-md text-xs border border-[#333]">{entry.tailor}</span>
                    </td>
                    <td className="px-6 py-4">
                      {entry.type === 'production' ? (
                        <div>
                          <p className="text-white font-medium mb-1">{entry.product}</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#cdfc4c] bg-[#cdfc4c]/10 px-1.5 py-0.5 rounded">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</span>
                            <span className="text-gray-500">
                              {Object.entries(entry.sizes).filter(([_, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join(', ')}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-rose-400 font-medium flex items-center gap-1"><Wallet size={14}/> Cash Payout</p>
                          {entry.note && <p className="text-gray-500 text-xs mt-1">{entry.note}</p>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {entry.type === 'production' ? `₹${entry.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-rose-500">
                      {entry.type === 'payment' ? `₹${entry.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setDeleteModalId(entry.id)} className="text-[#444] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-[#222] rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  const renderLogForm = () => (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in">
      <div className="bg-[#cdfc4c] p-6 rounded-t-3xl border border-[#cdfc4c]">
        <h2 className="text-2xl font-bold text-black tracking-tight flex items-center gap-2"><Plus size={24}/> Log Stitched Batch</h2>
        <p className="text-black/70 text-sm mt-1 font-medium">Add new inventory from the tailor floor.</p>
      </div>
      <div className="bg-[#0f0f0f] border border-[#222] border-t-0 rounded-b-3xl p-6 md:p-10 shadow-2xl">
        <form onSubmit={handleProdSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Tailor</label>
              <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-3.5 rounded-xl focus:border-[#cdfc4c] outline-none transition-colors appearance-none" required>
                <option value="" disabled>Select Tailor</option>
                {tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Date</label>
              <input type="date" value={prodForm.date} onChange={(e) => setProdForm({...prodForm, date: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-3.5 rounded-xl focus:border-[#cdfc4c] outline-none transition-colors" required/>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Style / Product</label>
            <select value={prodForm.product} onChange={(e) => setProdForm({...prodForm, product: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-3.5 rounded-xl focus:border-[#cdfc4c] outline-none transition-colors appearance-none" required>
              <option value="" disabled>Select Product</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="bg-[#141414] border border-[#222] p-6 rounded-2xl">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 text-center">Quantities by Size</label>
            <div className="flex justify-between gap-2 md:gap-4">
              {['XS', 'S', 'M', 'L', 'XL'].map(size => (
                <div key={size} className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-600 mb-2 text-center">{size}</label>
                  <input type="number" min="0" value={prodForm.sizes[size] || ''} onChange={(e) => setProdForm(prev => ({ ...prev, sizes: { ...prev.sizes, [size]: parseInt(e.target.value) || 0 } }))} placeholder="0" className="w-full text-center bg-[#222] border border-[#333] text-white py-3 rounded-xl focus:border-[#cdfc4c] outline-none transition-colors font-bold"/>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-[#222]">
            <div className="w-full md:w-1/3">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Rate per Piece</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500">₹</span>
                <input type="number" value={prodForm.pieceRate} onChange={(e) => setProdForm({...prodForm, pieceRate: parseFloat(e.target.value) || 0})} className="w-full pl-8 pr-4 py-3.5 bg-[#1a1a1a] border border-[#333] text-white font-bold rounded-xl focus:border-[#cdfc4c] outline-none transition-colors" required/>
              </div>
            </div>
            <div className="text-center md:text-right w-full md:w-auto">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Batch Value</p>
              <p className="text-4xl font-bold text-[#cdfc4c] tracking-tighter">
                ₹{Object.values(prodForm.sizes).reduce((a, b) => a + b, 0) * prodForm.pieceRate}
              </p>
            </div>
          </div>

          <button type="submit" className="w-full py-4 mt-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-bold rounded-xl transition-all flex justify-center items-center gap-2">
            <Plus size={20} /> Save Batch to Database
          </button>
        </form>
      </div>
    </div>
  );

  const renderPayForm = () => (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in">
       <div className="bg-[#ffe4e6] p-6 rounded-t-3xl border border-[#fda4af]">
        <h2 className="text-2xl font-bold text-rose-950 tracking-tight flex items-center gap-2"><Wallet size={24}/> Record Payout</h2>
        <p className="text-rose-900/70 text-sm mt-1 font-medium">Log cash advances or weekly settlements.</p>
      </div>
      <div className="bg-[#0f0f0f] border border-[#222] border-t-0 rounded-b-3xl p-6 md:p-10 shadow-2xl">
        <form onSubmit={handlePaySubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Tailor</label>
              <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-3.5 rounded-xl focus:border-rose-400 outline-none transition-colors appearance-none" required>
                <option value="" disabled>Select Tailor</option>
                {tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Date</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-3.5 rounded-xl focus:border-rose-400 outline-none transition-colors" required/>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Amount Paid</label>
            <div className="relative">
              <span className="absolute left-6 top-4 text-rose-500 text-2xl font-bold">₹</span>
              <input type="number" value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: e.target.value})} placeholder="0.00" className="w-full pl-14 pr-4 py-4 bg-[#1a1a1a] border border-[#333] text-white text-3xl font-bold rounded-xl focus:border-rose-400 outline-none transition-colors" required/>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Notes (Optional)</label>
            <input type="text" value={payForm.note} onChange={(e) => setPayForm({...payForm, note: e.target.value})} placeholder="e.g. Weekly settlement" className="w-full bg-[#1a1a1a] border border-[#333] text-white px-4 py-4 rounded-xl focus:border-rose-400 outline-none transition-colors" />
          </div>

          <button type="submit" className="w-full py-4 mt-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all flex justify-center items-center gap-2">
            <CreditCard size={20} /> Confirm Payment
          </button>
        </form>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="w-full animate-in fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Thursday Settlements</h2>
          <p className="text-gray-500 text-sm mt-1">Automated Friday-Thursday payout cycles.</p>
        </div>
        <select value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-[#1a1a1a] border border-[#333] text-white font-medium py-2 px-4 rounded-lg text-sm focus:border-[#cdfc4c] outline-none">
          <option value="All">All Tailors combined</option>
          {tailors.map(t => <option key={t} value={t}>{t}'s Reports</option>)}
        </select>
      </div>

      {weeklyReports.length === 0 ? (
         <div className="text-center py-24 bg-[#0f0f0f] border border-[#222] rounded-3xl">
           <p className="text-gray-500 font-medium">No production logged yet.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
          {weeklyReports.map((week, idx) => {
            const netPay = week.earned - week.paid;
            return (
              <div key={idx} className="bg-[#0f0f0f] border border-[#222] rounded-3xl overflow-hidden shadow-lg">
                <div className="bg-[#141414] px-6 py-4 border-b border-[#222] flex justify-between items-center">
                  <span className="text-sm font-bold text-white flex items-center gap-2"><Calendar size={14} className="text-[#cdfc4c]"/> {week.label}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-[#222] px-2 py-1 rounded-md">{week.pieces} Units</span>
                </div>
                <div className="p-6 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Generated</p>
                    <p className="text-2xl font-bold text-white">₹{week.earned.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Advances Paid</p>
                    <p className="text-2xl font-bold text-rose-400">- ₹{week.paid.toLocaleString()}</p>
                  </div>
                </div>
                <div className={`px-6 py-5 border-t border-[#222] flex items-center justify-between ${netPay > 0 ? 'bg-rose-950/30' : 'bg-[#141414]'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${netPay > 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                    {netPay > 0 ? 'Pending Payout' : netPay < 0 ? 'Advance Carryover' : 'Fully Settled'}
                  </span>
                  <span className={`text-3xl font-bold tracking-tighter ${netPay > 0 ? 'text-rose-500' : 'text-white'}`}>
                    ₹{Math.abs(netPay).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-xl font-bold tracking-tight text-white">App Configuration</h2>
        <p className="text-gray-500 text-sm mt-1">Manage tailor team and product SKUs.</p>
      </div>
      <div className="bg-[#0f0f0f] border border-[#222] rounded-3xl p-6 md:p-8 space-y-8 shadow-2xl">
        <div className="bg-amber-950/30 border border-amber-900 rounded-2xl p-5 flex gap-4 text-sm text-amber-200/80 items-start">
          <AlertCircle size={20} className="shrink-0 text-amber-500 mt-0.5" />
          <p className="leading-relaxed">Paste lists directly from Excel or CSV (one item per line). Cloud sync instantly updates all devices.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Tailor Team</label>
            <textarea value={settingsForm.tailorsText} onChange={(e) => setSettingsForm({...settingsForm, tailorsText: e.target.value})} className="w-full p-5 bg-[#1a1a1a] border border-[#333] rounded-2xl text-sm text-white focus:border-[#cdfc4c] outline-none h-64 font-mono leading-relaxed transition-all resize-none" placeholder="Sajid&#10;Imran"/>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Product Catalog</label>
            <textarea value={settingsForm.productsText} onChange={(e) => setSettingsForm({...settingsForm, productsText: e.target.value})} className="w-full p-5 bg-[#1a1a1a] border border-[#333] rounded-2xl text-sm text-white focus:border-[#cdfc4c] outline-none h-64 font-mono leading-relaxed transition-all resize-none" placeholder="Wrap Around Dress&#10;Kalamkari Top"/>
          </div>
        </div>
        <button onClick={saveSettings} className="w-full py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-bold rounded-xl transition-all text-sm flex justify-center items-center gap-2">
          <CheckCircle2 size={18}/> Save Configuration to Cloud
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-screen bg-black flex-col items-center justify-center text-[#cdfc4c]">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <p className="font-medium text-sm tracking-widest uppercase">Connecting to Poshakh Cloud</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans selection:bg-[#cdfc4c]/30 overflow-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 border ${toast.type === 'error' ? 'bg-rose-950 border-rose-900 text-rose-200' : 'bg-[#cdfc4c] border-[#b5e638] text-black'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#111] border border-[#333] rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete Record?</h3>
            <p className="text-sm text-gray-400 mb-8">This action permanently alters your ledger and settlements.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModalId(null)} className="flex-1 py-3 bg-[#222] hover:bg-[#333] text-white font-medium rounded-xl transition-all">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOP HEADER (Like Reference) --- */}
      <header className="bg-[#022c22] border-b border-[#044e3b] px-4 md:px-8 py-3 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-[#022c22] shrink-0">
            <Scissors size={18} />
          </div>
          <h1 className="text-white font-bold text-lg tracking-tight">Poshakh</h1>
          <div className="hidden md:flex gap-2 ml-4">
            <span className="bg-[#cdfc4c] text-black px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
              <CheckCircle2 size={12}/> Tailor Sync
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-bold leading-none">Admin</p>
            <p className="text-[#86efac] text-[10px] uppercase tracking-widest mt-1">Workspace</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
            <User size={16} className="text-white" />
          </div>
        </div>
      </header>

      {/* --- MAIN WORKSPACE --- */}
      <main className="flex-1 overflow-y-auto w-full z-10 p-4 md:p-8 pb-32">
        {currentView === 'ledger' && renderLedger()}
        {currentView === 'log' && renderLogForm()}
        {currentView === 'pay' && renderPayForm()}
        {currentView === 'reports' && renderReports()}
        {currentView === 'settings' && renderSettings()}
      </main>

      {/* --- BOTTOM NAVIGATION (Like Reference) --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#222] flex justify-between px-2 sm:px-8 pb-safe pt-2 z-50 overflow-x-auto no-scrollbar">
        {[
          { id: 'ledger', icon: Home, label: 'Dashboard' },
          { id: 'log', icon: Plus, label: 'Log Batch' },
          { id: 'pay', icon: Wallet, label: 'Add Pay' },
          { id: 'reports', icon: BarChart3, label: 'Settlements' },
          { id: 'settings', icon: Settings, label: 'Setup' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setCurrentView(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-2 min-w-[70px] gap-1.5 transition-all ${currentView === tab.id ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-white'}`}
          >
            <tab.icon size={20} strokeWidth={currentView === tab.id ? 2.5 : 2} />
            <span className={`text-[10px] uppercase tracking-widest font-bold ${currentView === tab.id ? 'text-[#cdfc4c]' : 'text-gray-500'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
