import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Settings,
  Printer,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

// 🔴 YOUR EXACT FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyBciTbw1cvMD6au0PZw7k-rfdRlUNHea18",
  authDomain: "tailordaily.firebaseapp.com",
  projectId: "tailordaily",
  storageBucket: "tailordaily.firebasestorage.app",
  messagingSenderId: "669424663727",
  appId: "1:669424663727:web:046d0cd13ad8a6013c685a"
};

// Initialize Firebase safely outside the component
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  // --- CORE STATE ---
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [authError, setAuthError] = useState(false);

  // --- DATA STATE ---
  const [entries, setEntries] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [products, setProducts] = useState([]);
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, batch, pay, setup, signoff
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  
  // Setup Textareas
  const [tailorInput, setTailorInput] = useState('');
  const [productInput, setProductInput] = useState('');

  // Forms
  const [prodForm, setProdForm] = useState({ date: new Date().toISOString().split('T')[0], tailor: '', product: '', sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 }, pieceRate: 250 });
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split('T')[0], tailor: '', amount: '', note: '' });

  // Signature Canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [signoffTailor, setSignoffTailor] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- FIREBASE INITIALIZATION & SUBSCRIPTIONS ---
  useEffect(() => {
    // 1. Authenticate Anonymously
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth blocked:", err);
        setAuthError(true);
        setLoading(false);
      }
    };
    initAuth();

    // 2. Listen for Auth State
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    // 3. Failsafe Timeout: Drop loading screen after 4 seconds no matter what
    const failsafe = setTimeout(() => setLoading(false), 4000);

    return () => {
      unsubscribeAuth();
      clearTimeout(failsafe);
    };
  }, []);

  // 4. Listen for Database Changes (Only if User exists)
  useEffect(() => {
    if (!user) return;

    const unsubLedger = onSnapshot(collection(db, 'ledger'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date descending
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntries(data);
      setLoading(false); // Data loaded, drop shield
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTailors(data.tailors || []);
        setProducts(data.products || []);
        setTailorInput((data.tailors || []).join('\n'));
        setProductInput((data.products || []).join('\n'));
        
        // Auto-select first options if available
        if (data.tailors?.length > 0 && !prodForm.tailor) {
          setProdForm(p => ({ ...p, tailor: data.tailors[0] }));
          setPayForm(p => ({ ...p, tailor: data.tailors[0] }));
          setSignoffTailor(data.tailors[0]);
        }
        if (data.products?.length > 0 && !prodForm.product) {
          setProdForm(p => ({ ...p, product: data.products[0] }));
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubLedger();
      unsubSettings();
    };
  }, [user]);

  // --- HANDLERS ---
  const saveSettings = async () => {
    if (!user) return;
    const newTailors = tailorInput.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = productInput.split('\n').map(p => p.trim()).filter(p => p);
    
    try {
      await setDoc(doc(db, 'settings', 'global'), { tailors: newTailors, products: newProducts });
      showToast("Catalog synced securely.");
    } catch (err) {
      console.error(err);
      showToast("Error saving setup.", "error");
    }
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    if (totalPieces === 0) return showToast("Enter at least 1 piece.", "error");

    const newEntry = {
      ...prodForm,
      type: 'production',
      totalPieces,
      amount: totalPieces * prodForm.pieceRate,
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'ledger'), newEntry);
      showToast(`Logged ${totalPieces} items for ${prodForm.tailor}`);
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
      showToast("Failed to save to cloud.", "error");
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    const payAmount = parseFloat(payForm.amount);
    if (!payAmount || payAmount <= 0) return showToast("Enter valid amount.", "error");

    const newEntry = {
      type: 'payment',
      date: payForm.date,
      tailor: payForm.tailor,
      amount: payAmount,
      note: payForm.note,
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'ledger'), newEntry);
      showToast(`Recorded ₹${payAmount} payment to ${payForm.tailor}`);
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
      showToast("Failed to save to cloud.", "error");
    }
  };

  const deleteEntry = async (id) => {
    if (!user) return;
    if (window.confirm("Delete this record permanently?")) {
      try {
        await deleteDoc(doc(db, 'ledger', id));
        showToast("Record deleted.");
      } catch (err) {
        console.error(err);
        showToast("Error deleting record.", "error");
      }
    }
  };

  // --- SIGNATURE CANVAS LOGIC ---
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on mobile
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSignatureData(null);
  };

  const lockSignature = () => {
    const canvas = canvasRef.current;
    if (hasDrawn) {
      setSignatureData(canvas.toDataURL("image/png"));
      showToast("Signature Locked.");
    }
  };

  // --- CALCULATIONS ---
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

  // --- RENDERERS ---
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#cdfc4c]">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <div className="font-bold tracking-widest text-sm">CONNECTING TO POSHAKH CLOUD</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col pb-20 md:pb-0">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-2xl font-medium border animate-in fade-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-900/90 text-red-100 border-red-700' : 'bg-[#022c22]/90 text-[#cdfc4c] border-[#cdfc4c]/30'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Auth Error Banner */}
      {authError && (
        <div className="bg-red-900 border-b border-red-500 text-red-100 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 z-50 relative">
          <AlertCircle size={16} />
          ACTION REQUIRED: Go to Firebase Console &gt; Authentication &gt; Sign-in method &gt; Enable Anonymous Sign-In.
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-[#022c22] border-b border-[#cdfc4c]/20 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-black rounded flex items-center justify-center">
            <Scissors size={18} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Poshakh</h1>
          <span className="hidden md:flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-[#cdfc4c] text-black px-2 py-0.5 rounded-full ml-4">
            <CheckCircle2 size={10} /> Sync Active
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium">
          <div className="text-right hidden sm:block">
            <div className="text-white">Admin</div>
            <div className="text-[#cdfc4c]/70 text-[10px] uppercase tracking-widest">Workspace</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#cdfc4c]/20 flex items-center justify-center text-[#cdfc4c]">
            <User size={16} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full p-4 md:p-8">
        
        {/* --- TAB: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Financial Overview</h2>
                <p className="text-gray-400 text-sm">Real-time ledger and balances.</p>
              </div>
              <select 
                value={selectedTailorFilter}
                onChange={(e) => setSelectedTailorFilter(e.target.value)}
                className="bg-[#111] border border-gray-800 text-white py-2 px-4 rounded-lg focus:ring-2 focus:ring-[#cdfc4c] outline-none text-sm font-medium min-w-[200px]"
              >
                <option value="All">All Tailors Combined</option>
                {tailors.map(t => <option key={t} value={t}>{t} Only</option>)}
              </select>
            </div>

            {/* Neon KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Main Revenue/Pending Card */}
              <div className="bg-[#cdfc4c] text-black p-6 rounded-2xl shadow-lg md:col-span-3 flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest font-bold opacity-70 mb-1">Total Pending Payout</div>
                  <div className="text-5xl md:text-6xl font-black tracking-tighter">
                    ₹{(totals.earned - totals.paid).toLocaleString()}
                  </div>
                </div>
                <div className="mt-4 md:mt-0 text-left md:text-right">
                  <div className="text-[11px] uppercase tracking-widest font-bold opacity-70 mb-1">Pieces Stitched</div>
                  <div className="text-2xl font-bold">{totals.pieces} <span className="text-sm font-normal opacity-80">Items</span></div>
                </div>
              </div>

              {/* Earned Card */}
              <div className="bg-[#ffe4e6] text-rose-950 p-6 rounded-2xl shadow-sm border border-rose-200">
                <div className="flex items-center gap-2 mb-2 opacity-70">
                  <TrendingUp size={16} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Total Earned Value</span>
                </div>
                <div className="text-3xl font-black tracking-tight">₹{totals.earned.toLocaleString()}</div>
              </div>

              {/* Paid Card */}
              <div className="bg-[#e0f2fe] text-sky-950 p-6 rounded-2xl shadow-sm border border-sky-200">
                <div className="flex items-center gap-2 mb-2 opacity-70">
                  <Wallet size={16} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Total Amount Paid</span>
                </div>
                <div className="text-3xl font-black tracking-tight">₹{totals.paid.toLocaleString()}</div>
              </div>
              
              {/* Active Tailors Card */}
              <div className="bg-[#111] text-white p-6 rounded-2xl shadow-sm border border-gray-800">
                 <div className="flex items-center gap-2 mb-2 text-gray-400">
                  <Scissors size={16} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Active Roster</span>
                </div>
                <div className="text-3xl font-black tracking-tight">{tailors.length}</div>
              </div>
            </div>

            {/* Dark Ledger Table */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-[#111]">
                <h3 className="font-bold text-white text-lg">Transaction History</h3>
                <span className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-full font-medium">
                  {filteredEntries.length} Records
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-gray-500 font-medium text-[10px] uppercase tracking-widest bg-[#0a0a0a]">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Tailor</th>
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4 text-right">Credit (+)</th>
                      <th className="px-6 py-4 text-right">Debit (-)</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                          <FileText size={32} className="mx-auto mb-3 opacity-20" />
                          <p>No transactions found.</p>
                        </td>
                      </tr>
                    )}
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#111] transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">{entry.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{entry.tailor}</td>
                        <td className="px-6 py-4">
                          {entry.type === 'production' ? (
                            <div>
                              <div className="text-gray-200 font-medium">{entry.product}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {entry.totalPieces} pcs @ ₹{entry.pieceRate}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-emerald-400 font-medium flex items-center gap-1">
                                <Wallet size={12} /> Cash Payout
                              </div>
                              {entry.note && <div className="text-xs text-gray-500 mt-1">{entry.note}</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-white">
                          {entry.type === 'production' ? `₹${entry.amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-emerald-400">
                          {entry.type === 'payment' ? `₹${entry.amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => deleteEntry(entry.id)} className="text-gray-600 hover:text-red-500 transition-colors">
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

        {/* --- TAB: ADD BATCH --- */}
        {activeTab === 'batch' && (
          <div className="animate-in fade-in w-full max-w-2xl mx-auto mt-4">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-1">Log Production Batch</h2>
              <p className="text-gray-400 text-sm mb-8">Add stitched items to tailor's ledger.</p>
              
              <form onSubmit={handleProdSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Tailor</label>
                    <select value={prodForm.tailor} onChange={e => setProdForm({...prodForm, tailor: e.target.value})} className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-[#cdfc4c] outline-none">
                      {tailors.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Date</label>
                    <input type="date" value={prodForm.date} onChange={e => setProdForm({...prodForm, date: e.target.value})} className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-[#cdfc4c] outline-none [color-scheme:dark]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Product SKU</label>
                  <select value={prodForm.product} onChange={e => setProdForm({...prodForm, product: e.target.value})} className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-[#cdfc4c] outline-none">
                    {products.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="bg-black p-4 rounded-xl border border-gray-800">
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Quantities by Size</label>
                  <div className="grid grid-cols-5 gap-2 md:gap-4">
                    {['XS', 'S', 'M', 'L', 'XL'].map(size => (
                      <div key={size} className="text-center">
                        <div className="text-xs text-gray-400 mb-1">{size}</div>
                        <input type="number" min="0" value={prodForm.sizes[size] || ''} onChange={e => setProdForm(p => ({...p, sizes: {...p.sizes, [size]: e.target.value}}))} placeholder="0" className="w-full py-2 text-center bg-[#111] border border-gray-800 rounded-lg text-white focus:border-[#cdfc4c] outline-none" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Rate per Piece (₹)</label>
                    <input type="number" value={prodForm.pieceRate} onChange={e => setProdForm({...prodForm, pieceRate: parseFloat(e.target.value) || 0})} className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-[#cdfc4c] outline-none" />
                  </div>
                  <div className="flex-1 text-right bg-black p-3 rounded-xl border border-gray-800">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Batch Value</div>
                    <div className="text-2xl font-bold text-[#cdfc4c]">
                      ₹{Object.values(prodForm.sizes).reduce((a, b) => a + (parseInt(b)||0), 0) * prodForm.pieceRate}
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full py-4 font-bold text-black bg-[#cdfc4c] hover:bg-[#b0d93d] rounded-xl transition-all shadow-[0_0_20px_rgba(205,252,76,0.15)] hover:shadow-[0_0_30px_rgba(205,252,76,0.3)]">
                  Confirm & Save Batch
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB: ADD PAY --- */}
        {activeTab === 'pay' && (
          <div className="animate-in fade-in w-full max-w-xl mx-auto mt-4">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-1">Record Payout</h2>
              <p className="text-gray-400 text-sm mb-8">Log cash advances or weekly settlements.</p>
              
              <form onSubmit={handlePaySubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Tailor</label>
                    <select value={payForm.tailor} onChange={e => setPayForm({...payForm, tailor: e.target.value})} className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-emerald-400 outline-none">
                      {tailors.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Date</label>
                    <input type="date" value={payForm.date} onChange={e => setPayForm({...payForm, date: e.target.value})} className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-emerald-400 outline-none [color-scheme:dark]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Amount Paid (₹)</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} placeholder="e.g. 5000" className="w-full py-4 px-4 text-xl bg-black border border-gray-800 rounded-xl text-white focus:border-emerald-400 outline-none font-bold" />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Note (Optional)</label>
                  <input type="text" value={payForm.note} onChange={e => setPayForm({...payForm, note: e.target.value})} placeholder="e.g. Advance for June" className="w-full py-3 px-4 bg-black border border-gray-800 rounded-xl text-white focus:border-emerald-400 outline-none" />
                </div>

                <button type="submit" className="w-full py-4 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-[0_0_20px_rgba(5,150,105,0.2)]">
                  Confirm Payment
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB: SIGNOFF & PRINT --- */}
        {activeTab === 'signoff' && (
          <div className="animate-in fade-in w-full max-w-2xl mx-auto mt-4 mb-20">
            {/* The Printable Receipt Area */}
            <div id="print-area" className="bg-white text-black p-8 md:p-12 rounded-2xl shadow-2xl relative">
              
              <div className="flex justify-between items-start mb-10 border-b-2 border-black pb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tighter">POSHAKH</h1>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Daily Settlement Receipt</p>
                </div>
                <div className="text-right">
                  <div className="font-bold">{new Date().toLocaleDateString('en-IN')}</div>
                  <div className="text-gray-500 mt-2">
                    <select 
                      value={signoffTailor}
                      onChange={(e) => setSignoffTailor(e.target.value)}
                      className="bg-transparent text-right font-bold border-b border-dashed border-gray-400 outline-none print:appearance-none cursor-pointer"
                    >
                      {tailors.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Summary for Selected Tailor */}
              <div className="mb-10">
                <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-4">Current Account Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Total Earned</div>
                    <div className="text-xl font-bold">
                      ₹{entries.filter(e => e.tailor === signoffTailor && e.type === 'production').reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-xs text-emerald-700 mb-1">Total Paid</div>
                    <div className="text-xl font-bold text-emerald-700">
                      ₹{entries.filter(e => e.tailor === signoffTailor && e.type === 'payment').reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-black text-white p-6 rounded-xl flex justify-between items-center">
                  <div className="uppercase tracking-widest text-xs font-bold text-gray-400">Net Pending Payout</div>
                  <div className="text-3xl font-black">
                    ₹{(
                      entries.filter(e => e.tailor === signoffTailor && e.type === 'production').reduce((sum, e) => sum + e.amount, 0) -
                      entries.filter(e => e.tailor === signoffTailor && e.type === 'payment').reduce((sum, e) => sum + e.amount, 0)
                    ).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Signature Block */}
              <div className="mt-12">
                <div className="flex justify-between items-end">
                  <div className="w-1/2">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2">Tailor Signature</h3>
                    
                    {signatureData ? (
                      <div className="border-b-2 border-black pb-2 h-32 flex items-end">
                        <img src={signatureData} alt="Signature" className="max-h-24" />
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 relative h-32 touch-none print:hidden">
                        <canvas
                          ref={canvasRef}
                          width={300}
                          height={120}
                          className="w-full h-full cursor-crosshair"
                          onPointerDown={startDrawing}
                          onPointerMove={draw}
                          onPointerUp={stopDrawing}
                          onPointerOut={stopDrawing}
                        />
                        {!hasDrawn && <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-medium pointer-events-none">Draw signature here</div>}
                      </div>
                    )}
                    
                    <div className="mt-2 font-bold">{signoffTailor}</div>
                  </div>
                  
                  <div className="w-1/3 text-right">
                    <div className="border-b-2 border-black pb-2 h-16 flex items-end justify-end">
                      <span className="font-bold italic text-xl">Admin</span>
                    </div>
                    <div className="mt-2 font-bold text-gray-500">Authorized By</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Controls (Hidden when printing) */}
            <div className="mt-6 grid grid-cols-3 gap-4 print:hidden">
              <button 
                onClick={clearCanvas}
                disabled={!!signatureData}
                className="py-3 bg-[#111] hover:bg-[#222] text-white rounded-xl font-medium border border-gray-800 disabled:opacity-50"
              >
                Clear
              </button>
              <button 
                onClick={lockSignature}
                disabled={!hasDrawn || !!signatureData}
                className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50"
              >
                Lock Sign
              </button>
              <button 
                onClick={() => window.print()}
                className="py-3 bg-[#cdfc4c] text-black hover:bg-[#b0d93d] rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Print
              </button>
            </div>
            
            <style>{`
              @media print {
                body { background: white; color: black; }
                header, nav, .print\\:hidden { display: none !important; }
                #print-area { box-shadow: none; padding: 0; }
                main { padding: 0; max-width: 100%; margin: 0; }
              }
            `}</style>
          </div>
        )}

        {/* --- TAB: SETUP --- */}
        {activeTab === 'setup' && (
          <div className="animate-in fade-in w-full max-w-4xl mx-auto mt-4">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-1">App Configuration</h2>
              <p className="text-gray-400 text-sm mb-8">Manage tailor team and product SKUs.</p>
              
              <div className="bg-[#1a1500] border border-[#ffaa00]/30 text-[#ffaa00] p-4 rounded-xl mb-8 flex items-start gap-3 text-sm">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p>Paste lists directly from Excel or CSV (one item per line). Cloud sync instantly updates all devices.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Tailor Team</label>
                  <textarea 
                    value={tailorInput}
                    onChange={(e) => setTailorInput(e.target.value)}
                    placeholder="Sajid&#10;Imran"
                    className="w-full h-64 bg-black border border-gray-800 rounded-xl p-4 text-white font-mono text-sm focus:border-[#cdfc4c] outline-none resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Product Catalog</label>
                  <textarea 
                    value={productInput}
                    onChange={(e) => setProductInput(e.target.value)}
                    placeholder="Wrap Around Dress&#10;Kalamkari Top"
                    className="w-full h-64 bg-black border border-gray-800 rounded-xl p-4 text-white font-mono text-sm focus:border-[#cdfc4c] outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              <button 
                onClick={saveSettings}
                className="w-full py-4 font-bold text-black bg-[#cdfc4c] hover:bg-[#b0d93d] rounded-xl transition-all shadow-[0_0_20px_rgba(205,252,76,0.15)]"
              >
                <CheckCircle2 size={18} className="inline mr-2 -mt-1" />
                Save Configuration to Cloud
              </button>
            </div>
          </div>
        )}
      </main>

      {/* --- BOTTOM MOBILE-STYLE NAVIGATION --- */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#050505] border-t border-gray-900 pb-safe z-50">
        <div className="flex justify-center md:gap-32 sm:gap-16 gap-4 items-center h-20 w-full px-4">
          
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-gray-300'}`}>
            <Wallet size={20} className={activeTab === 'dashboard' ? 'fill-[#cdfc4c]/20' : ''} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Ledger</span>
          </button>
          
          <button onClick={() => setActiveTab('batch')} className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${activeTab === 'batch' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Shirt size={20} className={activeTab === 'batch' ? 'fill-white/20' : ''} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Add Batch</span>
          </button>

          <button onClick={() => setActiveTab('pay')} className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${activeTab === 'pay' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}>
            <IndianRupee size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Pay</span>
          </button>

          <button onClick={() => setActiveTab('signoff')} className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${activeTab === 'signoff' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
            <Edit2 size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Sign-Off</span>
          </button>

          <button onClick={() => setActiveTab('setup')} className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${activeTab === 'setup' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Settings size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Setup</span>
          </button>

        </div>
      </nav>
    </div>
  );
}
