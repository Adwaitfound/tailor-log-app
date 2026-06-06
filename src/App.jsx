import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Scissors, Calendar, User, Shirt, DollarSign, Trash2, 
  Wallet, FileText, TrendingDown, TrendingUp, Package, CreditCard,
  Settings, ChevronRight, BarChart3, List, CheckCircle2, AlertCircle,
  Home, RefreshCw, LogOut, Clock, PenTool, Printer, AlertOctagon, Eraser
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
  const [dbError, setDbError] = useState(false);

  // --- APP STATE ---
  const [entries, setEntries] = useState([]);
  const [signatures, setSignatures] = useState([]);
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

  // --- SIGNATURE STATE ---
  const [signDate, setSignDate] = useState(new Date().toISOString().split('T')[0]);
  const [signTailor, setSignTailor] = useState(DEFAULT_TAILORS[0]);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    try {
      // 🔴 DEPLOYMENT STEP: Paste your Firebase Config here.
      // IF YOU DEPLOY TO VERCEL, YOU MUST FILL THIS IN FOR SAVING TO WORK!
      const YOUR_FIREBASE_CONFIG = {
        apiKey: "AIzaSyBciTbw1cvMD6au0PZw7k-rfdRlUNHea18",
        authDomain: "tailordaily.firebaseapp.com",
        projectId: "tailordaily",
        storageBucket: "tailordaily.firebasestorage.app",
        messagingSenderId: "669424663727",
        appId: "1:669424663727:web:046d0cd13ad8a6013c685a"
      };

      const configStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
      const fallbackConfig = JSON.parse(configStr);
      const firebaseConfig = Object.keys(YOUR_FIREBASE_CONFIG).length > 0 ? YOUR_FIREBASE_CONFIG : fallbackConfig;
      
      if (Object.keys(firebaseConfig).length === 0) {
        setDbError(true);
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
    const signaturesRef = collection(db, 'artifacts', appId, 'public', 'data', 'tailor_signatures');

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

    const unsubSignatures = onSnapshot(signaturesRef, (snapshot) => {
      const fetchedSigs = [];
      snapshot.forEach(doc => fetchedSigs.push({ id: doc.id, ...doc.data() }));
      setSignatures(fetchedSigs);
    });

    return () => { unsubEntries(); unsubSettings(); unsubSignatures(); };
  }, [user, db, appId]);

  // --- SIGNATURE HANDLERS ---
  useEffect(() => {
    if (currentView === 'signoff' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#cdfc4c'; 
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (!signTailor && tailors.length > 0) setSignTailor(tailors[0]);
    }
  }, [currentView, tailors]);

  const getCanvasCoordinates = (canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoordinates(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoordinates(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSaveSignature = async () => {
    if (!user || !db) return showToast("Cloud not connected.", "error");
    if (!hasDrawn) return showToast("Please draw a signature first.", "error");

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tailor_signatures'), {
        date: signDate,
        tailor: signTailor,
        signature: dataUrl,
        timestamp: new Date().toISOString()
      });
      showToast("Signature saved to cloud!");
    } catch (err) {
      showToast("Failed to save signature", "error");
    }
  };

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

  const renderSignOff = () => {
    const todaysEntries = entries.filter(e => e.date === signDate && e.tailor === signTailor);
    const todaysTotal = todaysEntries.reduce((acc, curr) => {
      if (curr.type === 'production') acc.earned += curr.amount;
      if (curr.type === 'payment') acc.paid += curr.amount;
      return acc;
    }, { earned: 0, paid: 0 });

    const existingSig = signatures.find(s => s.date === signDate && s.tailor === signTailor);

    return (
      <div className="w-full animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 no-print">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><PenTool className="text-[#cdfc4c]"/> Daily Sign-Off</h2>
            <p className="text-gray-500 text-sm mt-1">Print logs and collect digital signatures.</p>
          </div>
          <div className="flex gap-3">
             <input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} className="bg-[#1a1a1a] border border-[#333] text-white py-2 px-4 rounded-lg text-sm focus:border-[#cdfc4c] outline-none" />
             <select value={signTailor} onChange={(e) => setSignTailor(e.target.value)} className="bg-[#1a1a1a] border border-[#333] text-white py-2 px-4 rounded-lg text-sm focus:border-[#cdfc4c] outline-none">
               {tailors.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
        </div>

        <div id="printable-receipt" className="bg-[#0f0f0f] border border-[#222] rounded-3xl overflow-hidden shadow-2xl p-6 md:p-10 max-w-2xl mx-auto text-white">
          <div className="text-center mb-8 border-b border-[#333] pb-6">
            <h1 className="text-3xl font-bold text-[#cdfc4c] tracking-tighter mb-2 receipt-title">POSHAKH</h1>
            <p className="text-gray-400 font-medium text-sm tracking-widest uppercase receipt-sub">Daily Production Receipt</p>
            <div className="mt-6 flex justify-between text-left text-sm">
              <div><span className="text-gray-500">Date:</span> <br/><span className="font-bold text-lg">{signDate}</span></div>
              <div className="text-right"><span className="text-gray-500">Tailor:</span> <br/><span className="font-bold text-lg">{signTailor}</span></div>
            </div>
          </div>

          <table className="w-full text-sm text-left mb-8">
            <thead className="text-gray-500 border-b border-[#333]">
              <tr>
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium text-center">Qty</th>
                <th className="py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {todaysEntries.length === 0 ? (
                <tr><td colSpan="3" className="py-12 text-center text-gray-500 italic">No records found for {signTailor} on this date.</td></tr>
              ) : (
                todaysEntries.map(entry => (
                  <tr key={entry.id}>
                    <td className="py-4 font-medium text-gray-300">
                      {entry.type === 'production' ? entry.product : 'Cash Advance'}
                    </td>
                    <td className="py-4 text-center text-gray-400">{entry.type === 'production' ? entry.totalPieces : '-'}</td>
                    <td className={`py-4 text-right font-bold ${entry.type === 'payment' ? 'text-rose-500' : 'text-white'}`}>
                      {entry.type === 'payment' ? '-' : ''}₹{entry.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="bg-[#141414] rounded-2xl p-6 mb-8 border border-[#222] flex justify-between print-summary">
             <div>
               <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">Earned Today</p>
               <p className="text-2xl font-bold text-white">₹{todaysTotal.earned}</p>
             </div>
             <div className="text-right">
               <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">Paid Today</p>
               <p className="text-2xl font-bold text-rose-500">₹{todaysTotal.paid}</p>
             </div>
          </div>

          <div className="mb-4">
             <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3 text-center">Tailor Signature Acknowledgment</p>

             {existingSig ? (
               <div className="bg-white rounded-2xl p-4 flex justify-center border border-[#333] print-sig-box">
                 <img src={existingSig.signature} alt="Tailor Signature" className="max-h-32 object-contain" style={{ filter: 'grayscale(1) brightness(0)' }} />
               </div>
             ) : (
               <div className="no-print">
                 <div className="bg-[#1a1a1a] rounded-2xl border-2 border-dashed border-[#444] overflow-hidden relative touch-none">
                   <canvas
                     ref={canvasRef}
                     width={600}
                     height={200}
                     className="w-full h-40 bg-[#111] cursor-crosshair touch-none"
                     onMouseDown={startDrawing}
                     onMouseMove={draw}
                     onMouseUp={stopDrawing}
                     onMouseLeave={stopDrawing}
                     onTouchStart={startDrawing}
                     onTouchMove={draw}
                     onTouchEnd={stopDrawing}
                   />
                   <div className="absolute bottom-3 right-3 flex gap-2">
                     <button onClick={clearSignature} className="bg-[#222] hover:bg-[#333] text-gray-400 p-2 rounded-lg transition-colors"><Eraser size={16}/></button>
                     <button onClick={handleSaveSignature} className="bg-[#cdfc4c] text-black font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"><CheckCircle2 size={16}/> Lock Signature</button>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto mt-6 flex justify-center no-print">
           <button onClick={() => window.print()} className="bg-white hover:bg-gray-200 text-black font-bold px-8 py-4 rounded-xl transition-all flex items-center gap-2 shadow-lg">
             <Printer size={20}/> Print Receipt
           </button>
        </div>
      </div>
    );
  };

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
      
      <style>{`
        @media print {
          body { background: white; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { 
            visibility: visible; 
            color: black !important; 
            background-color: white !important; 
            border-color: #ddd !important; 
          }
          #printable-receipt { 
            position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; 
            box-shadow: none; border: none; padding: 20px;
          }
          .receipt-title { color: black !important; }
          .receipt-sub { color: #666 !important; }
          .print-summary { background-color: #f5f5f5 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Database Warning for Vercel Deployment */}
      {dbError && (
        <div className="bg-rose-600 text-white p-4 flex flex-col md:flex-row items-center justify-between z-50 no-print">
          <div className="flex items-center gap-3">
            <AlertOctagon size={24} className="shrink-0"/>
            <div>
              <p className="font-bold">Missing Firebase Configuration</p>
              <p className="text-sm text-rose-200">The app is running, but it cannot save data. You must paste your Firebase keys into the YOUR_FIREBASE_CONFIG variable in App.jsx.</p>
            </div>
          </div>
        </div>
      )}

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
        {currentView === 'signoff' && renderSignOff()}
        {currentView === 'reports' && renderReports()}
        {currentView === 'settings' && renderSettings()}
      </main>

      {/* --- BOTTOM NAVIGATION (Like Reference) --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#222] flex justify-between px-2 sm:px-8 pb-safe pt-2 z-50 overflow-x-auto no-scrollbar no-print">
        {[
          { id: 'ledger', icon: Home, label: 'Dashboard' },
          { id: 'log', icon: Plus, label: 'Log Batch' },
          { id: 'pay', icon: Wallet, label: 'Add Pay' },
          { id: 'signoff', icon: PenTool, label: 'Sign-Off' },
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
