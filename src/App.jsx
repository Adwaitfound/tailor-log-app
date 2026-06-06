import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors, 
  Calendar, 
  User, 
  Shirt, 
  IndianRupee, 
  Trash2,
  Edit2,
  Wallet,
  FileText,
  TrendingDown,
  TrendingUp,
  Package,
  CreditCard,
  CalendarDays,
  Settings,
  RefreshCw,
  Printer,
  Lock,
  Unlock,
  PenTool
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  updateDoc
} from 'firebase/firestore';

// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBciTbw1cvMD6au0PZw7k-rfdRlUNHea18",
  authDomain: "tailordaily.firebaseapp.com",
  projectId: "tailordaily",
  storageBucket: "tailordaily.firebasestorage.app",
  messagingSenderId: "669424663727",
  appId: "1:669424663727:web:046d0cd13ad8a6013c685a"
};

// --- INITIALIZE FIREBASE SAFELY ---
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase Init Error", e);
}

// Global Collections
const GLOBAL_DOC_ID = 'poshakh_global_settings';
const LEDGER_COLLECTION = 'ledger_entries';

export default function App() {
  // --- CORE STATE ---
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [tailors, setTailors] = useState([]);
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('ledger');
  const [subTab, setSubTab] = useState('production');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [deletingId, setDeletingId] = useState(null); // For custom delete confirmation

  // --- EDIT STATE ---
  const [editingId, setEditingId] = useState(null);

  // --- SETUP FORM STATE ---
  const [setupTailors, setSetupTailors] = useState("");
  const [setupProducts, setSetupProducts] = useState("");

  // --- ENTRY FORM STATE ---
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

  // --- SIGNATURE STATE ---
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);
  const [signatureImage, setSignatureImage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- DATABASE CONNECTION & FALLBACK LOGIC ---
  useEffect(() => {
    let timeoutId;
    let unsubscribeSettings;
    let unsubscribeLedger;

    const connectToDB = () => {
      // Set a 4-second failsafe. If Firebase is blocked, force local mode so the user isn't stuck.
      timeoutId = setTimeout(() => {
        if (loading) {
          console.warn("Firebase connection timed out or blocked by Iframe. Switching to Local Mode.");
          setDbError("Iframe Security blocked Cloud. Running in Local Browser Mode.");
          setIsLocalMode(true);
          loadLocalData();
          setLoading(false);
        }
      }, 4000);

      onAuthStateChanged(auth, (user) => {
        if (!user) {
          signInAnonymously(auth).catch(err => {
            console.error("Auth Error", err);
            setDbError("Auth blocked. Ensure Anonymous Sign-in is enabled in Firebase.");
            setIsLocalMode(true);
            loadLocalData();
            setLoading(false);
          });
          return; // Wait for the auth state to change to logged in
        }

        // Successfully Auth'd! Clear the failsafe timeout.
        clearTimeout(timeoutId);

        // 1. Listen to Global Settings
        unsubscribeSettings = onSnapshot(doc(db, 'settings', GLOBAL_DOC_ID), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTailors(data.tailors || []);
            setProducts(data.products || []);
            setSetupTailors((data.tailors || []).join('\n'));
            setSetupProducts((data.products || []).join('\n'));
            
            // Set defaults if forms are empty
            setProdForm(prev => ({
              ...prev,
              tailor: prev.tailor || (data.tailors && data.tailors[0]) || '',
              product: prev.product || (data.products && data.products[0]) || ''
            }));
            setPayForm(prev => ({
              ...prev,
              tailor: prev.tailor || (data.tailors && data.tailors[0]) || ''
            }));
          }
        }, (err) => {
          console.error("Settings Read Error", err);
          setDbError("Firestore rules blocking read. Update your Security Rules.");
          setIsLocalMode(true);
          loadLocalData();
          setLoading(false);
        });

        // 2. Listen to Ledger
        unsubscribeLedger = onSnapshot(collection(db, LEDGER_COLLECTION), (snapshot) => {
          const loadedEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          // Sort by timestamp descending
          loadedEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setEntries(loadedEntries);
          setLoading(false);
        }, (err) => {
          console.error("Ledger Read Error", err);
          setIsLocalMode(true);
          loadLocalData();
          setLoading(false);
        });
      });
    };

    connectToDB();

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeLedger) unsubscribeLedger();
    };
  }, []);

  // --- LOCAL MODE FUNCTIONS (If Firebase is blocked by Iframe) ---
  const loadLocalData = () => {
    const lTailors = JSON.parse(localStorage.getItem('localTailors') || '[]');
    const lProducts = JSON.parse(localStorage.getItem('localProducts') || '[]');
    const lEntries = JSON.parse(localStorage.getItem('localEntries') || '[]');
    
    setTailors(lTailors);
    setProducts(lProducts);
    setSetupTailors(lTailors.join('\n'));
    setSetupProducts(lProducts.join('\n'));
    setEntries(lEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    
    setProdForm(prev => ({
      ...prev,
      tailor: prev.tailor || lTailors[0] || '',
      product: prev.product || lProducts[0] || ''
    }));
    setPayForm(prev => ({
      ...prev,
      tailor: prev.tailor || lTailors[0] || ''
    }));
  };

  const saveLocalSettings = (newTailors, newProducts) => {
    localStorage.setItem('localTailors', JSON.stringify(newTailors));
    localStorage.setItem('localProducts', JSON.stringify(newProducts));
  };

  const saveLocalEntries = (newEntries) => {
    localStorage.setItem('localEntries', JSON.stringify(newEntries));
  };

  // --- SETUP HANDLER ---
  const handleSetupSave = async () => {
    const cleanTailors = setupTailors.split('\n').map(t => t.trim()).filter(t => t);
    const cleanProducts = setupProducts.split('\n').map(p => p.trim()).filter(p => p);
    
    if (isLocalMode) {
      setTailors(cleanTailors);
      setProducts(cleanProducts);
      saveLocalSettings(cleanTailors, cleanProducts);
      showToast("Settings saved to Local Browser");
      return;
    }

    try {
      await setDoc(doc(db, 'settings', GLOBAL_DOC_ID), {
        tailors: cleanTailors,
        products: cleanProducts,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast("Configuration synced to Cloud");
    } catch (e) {
      console.error(e);
      showToast("Error saving to Cloud", "error");
    }
  };

  // --- FORM HANDLERS ---
  const handleProdSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setProdForm(prev => ({
      ...prev,
      sizes: { ...prev.sizes, [size]: numValue }
    }));
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setActiveTab('add');
    if (entry.type === 'production') {
      setSubTab('production');
      setProdForm({
        date: entry.date,
        tailor: entry.tailor,
        product: entry.product,
        sizes: entry.sizes || { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
        pieceRate: entry.pieceRate
      });
    } else {
      setSubTab('payment');
      setPayForm({
        date: entry.date,
        tailor: entry.tailor,
        amount: entry.amount.toString(),
        note: entry.note || ''
      });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
    setPayForm(prev => ({ ...prev, amount: '', note: '' }));
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.tailor || !prodForm.product) {
      showToast("Please add tailors and products in Setup first.", "error");
      return;
    }

    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + val, 0);
    if (totalPieces === 0) {
      showToast("Enter at least one piece.", "error");
      return;
    }

    const entryData = {
      ...prodForm,
      type: 'production',
      totalPieces,
      amount: totalPieces * prodForm.pieceRate, 
      timestamp: editingId ? entries.find(e => e.id === editingId).timestamp : new Date().toISOString()
    };

    if (isLocalMode) {
      let newEntries;
      if (editingId) {
        newEntries = entries.map(e => e.id === editingId ? { ...entryData, id: editingId } : e);
        setEditingId(null);
        showToast("Production updated locally");
      } else {
        newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...entries];
        showToast("Production logged locally");
      }
      setEntries(newEntries);
      saveLocalEntries(newEntries);
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      setActiveTab('ledger');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, LEDGER_COLLECTION, editingId), entryData);
        setEditingId(null);
        showToast("Production updated in Cloud");
      } else {
        await addDoc(collection(db, LEDGER_COLLECTION), entryData);
        showToast("Production logged to Cloud");
      }
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      setActiveTab('ledger');
    } catch (e) {
      console.error(e);
      showToast("Error saving", "error");
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payForm.tailor) {
      showToast("Please add tailors in Setup first.", "error");
      return;
    }

    const payAmount = parseFloat(payForm.amount);
    if (!payAmount || payAmount <= 0) {
      showToast("Enter a valid amount.", "error");
      return;
    }

    const entryData = {
      type: 'payment',
      date: payForm.date,
      tailor: payForm.tailor,
      amount: payAmount, 
      note: payForm.note,
      timestamp: editingId ? entries.find(e => e.id === editingId).timestamp : new Date().toISOString()
    };

    if (isLocalMode) {
      let newEntries;
      if (editingId) {
        newEntries = entries.map(e => e.id === editingId ? { ...entryData, id: editingId } : e);
        setEditingId(null);
        showToast("Payment updated locally");
      } else {
        newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...entries];
        showToast("Payment recorded locally");
      }
      setEntries(newEntries);
      saveLocalEntries(newEntries);
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      setActiveTab('ledger');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, LEDGER_COLLECTION, editingId), entryData);
        setEditingId(null);
        showToast("Payment updated in Cloud");
      } else {
        await addDoc(collection(db, LEDGER_COLLECTION), entryData);
        showToast("Payment recorded in Cloud");
      }
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      setActiveTab('ledger');
    } catch (e) {
      console.error(e);
      showToast("Error recording payment", "error");
    }
  };

  const deleteEntry = async (id) => {
    if (isLocalMode) {
      const newEntries = entries.filter(e => e.id !== id);
      setEntries(newEntries);
      saveLocalEntries(newEntries);
      setDeletingId(null);
      showToast("Entry deleted locally");
      return;
    }

    try {
      await deleteDoc(doc(db, LEDGER_COLLECTION, id));
      setDeletingId(null);
      showToast("Entry deleted from Cloud");
    } catch (e) {
      console.error(e);
      showToast("Error deleting", "error");
    }
  };

  // --- SIGNATURE FUNCTIONS ---
  const startDrawing = (e) => {
    if (signatureLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get correct coordinates whether mouse or touch
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || signatureLocked) return;
    e.preventDefault(); // Prevent scrolling on touch devices
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#cdfc4c'; // Neon lime ink!
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  };

  const clearSignature = () => {
    if (signatureLocked) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureImage(null);
  };

  const lockSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureImage(canvas.toDataURL());
      setSignatureLocked(true);
      showToast("Signature locked for printing");
    }
  };

  const unlockSignature = () => {
    setSignatureLocked(false);
    setSignatureImage(null);
    setTimeout(clearSignature, 50); // Small delay to let canvas re-render
  };

  const printReceipt = () => {
    window.print();
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

  const pendingBalance = totals.earned - totals.paid;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-[#cdfc4c]">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <div className="font-bold tracking-widest text-sm">CONNECTING TO POSHAKH CLOUD</div>
      </div>
    );
  }

  return (
    <>
      {/* FORCE OVERRIDE VITE'S DEFAULT BOX LAYOUT */}
      <style dangerouslySetInnerHTML={{__html: `
        #root { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; }
        body, html { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0a0a0a !important; overflow-x: hidden !important; }
        @media print {
          body, html { background-color: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; color: black !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />
      
      <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans flex flex-col m-0 p-0 overflow-x-hidden pb-28">
        
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in no-print">
            <div className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-bold text-sm border ${toast.type === 'error' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-[#cdfc4c]/10 text-[#cdfc4c] border-[#cdfc4c]/20'}`}>
              {toast.msg}
            </div>
          </div>
        )}

        {/* TOP STATUS BAR */}
        <header className="bg-[#022c22] border-b border-[#cdfc4c]/10 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-40 no-print w-full">
          <div className="flex items-center gap-4">
            <div className="bg-white text-black w-8 h-8 rounded-lg flex items-center justify-center">
              <Scissors size={18} strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Poshakh</h1>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full tracking-wider ml-2 ${isLocalMode ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-[#cdfc4c]/20 text-[#cdfc4c] border border-[#cdfc4c]/30'}`}>
              {isLocalMode ? 'LOCAL MODE' : 'CLOUD ACTIVE'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-right hidden sm:flex">
            <div>
              <div className="text-sm font-bold text-white">Admin</div>
              <div className="text-[10px] text-[#cdfc4c] tracking-widest font-bold">WORKSPACE</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <User size={14} className="text-white/70" />
            </div>
          </div>
        </header>

        {/* ERROR BANNER FOR DIAGNOSTICS */}
        {dbError && !isLocalMode && (
          <div className="bg-rose-900 border-b border-rose-500 text-rose-200 px-4 py-3 text-sm flex items-center justify-center font-medium no-print w-full">
            ⚠️ {dbError}
          </div>
        )}

        {/* MAIN WORKSPACE */}
        <main className="flex-1 w-full px-4 md:px-8 py-8 md:py-12 no-print max-w-[1600px] mx-auto">
          {activeTab === 'ledger' && renderLedger()}
          {activeTab === 'add' && renderAddData()}
          {activeTab === 'sign' && renderSignatureReceipt()}
          {activeTab === 'setup' && renderSetup()}
        </main>

        {/* BOTTOM NAVIGATION - FIXED TO BOTTOM */}
        <nav className="fixed bottom-0 w-full bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/5 no-print z-50">
          <div className="flex justify-around max-w-[800px] mx-auto">
            <NavItem id="ledger" icon={<Wallet size={20} />} label="LEDGER" />
            <NavItem id="add" icon={<Shirt size={20} />} label="ADD BATCH" />
            <NavItem id="add" subTabTarget="payment" icon={<IndianRupee size={20} />} label="PAY" />
            <NavItem id="sign" icon={<PenTool size={20} />} label="SIGN-OFF" />
            <NavItem id="setup" icon={<Settings size={20} />} label="SETUP" />
          </div>
        </nav>

        {/* PRINT ONLY VIEW */}
        <div className="hidden print-only p-8 text-black bg-white min-h-screen">
           {/* We will render a clean print layout here based on the selected tailor in the Sign-Off tab */}
           {renderPrintLayout()}
        </div>
      </div>
    </>
  );

  // --- SUB-RENDERERS ---

  function NavItem({ id, icon, label, subTabTarget }) {
    const isActive = activeTab === id && (!subTabTarget || subTab === subTabTarget);
    return (
      <button 
        onClick={() => { setActiveTab(id); if(subTabTarget) setSubTab(subTabTarget); }}
        className={`flex flex-col items-center gap-1.5 py-4 px-2 md:px-6 transition-colors w-1/4 ${isActive ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-white'}`}
      >
        {icon}
        <span className="text-[9px] font-bold tracking-widest">{label}</span>
      </button>
    );
  }

  function renderLedger() {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 w-full">
        {/* Header & Filter */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Financial Overview</h2>
            <p className="text-gray-500 text-sm mt-1">Real-time ledger and balances.</p>
          </div>
          <select 
            value={selectedTailorFilter}
            onChange={(e) => setSelectedTailorFilter(e.target.value)}
            className="bg-[#111] border border-white/10 text-sm font-medium text-white py-2 px-4 rounded-xl outline-none focus:border-[#cdfc4c] transition-colors"
          >
            <option value="All">All Tailors Combined</option>
            {tailors.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Main Neon Card */}
          <div className="md:col-span-3 bg-[#cdfc4c] text-black rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between shadow-[0_0_40px_rgba(205,252,76,0.1)]">
            <div>
              <div className="text-[11px] font-black tracking-widest opacity-60 mb-2 uppercase">Total Pending Payout</div>
              <div className="text-5xl md:text-7xl font-bold tracking-tighter">
                <span className="text-3xl md:text-5xl mr-1 opacity-80">₹</span>
                {pendingBalance.toLocaleString()}
              </div>
            </div>
            <div className="mt-6 md:mt-0 md:text-right border-t border-black/10 md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-8">
              <div className="text-[11px] font-black tracking-widest opacity-60 mb-1 uppercase">Pieces Stitched</div>
              <div className="text-3xl font-bold tracking-tight">{totals.pieces} <span className="text-lg font-normal opacity-60">items</span></div>
            </div>
          </div>

          <div className="bg-[#ffe4e6] text-black p-6 rounded-3xl flex flex-col justify-between">
            <div className="text-[10px] font-black tracking-widest opacity-60 mb-6 uppercase flex items-center gap-2"><TrendingUp size={14}/> Total Earned Value</div>
            <div className="text-3xl font-bold text-center tracking-tight text-[#881337]">₹{totals.earned.toLocaleString()}</div>
          </div>

          <div className="bg-[#e0f2fe] text-black p-6 rounded-3xl flex flex-col justify-between">
            <div className="text-[10px] font-black tracking-widest opacity-60 mb-6 uppercase flex items-center gap-2"><Wallet size={14}/> Total Amount Paid</div>
            <div className="text-3xl font-bold text-center tracking-tight text-[#075985]">₹{totals.paid.toLocaleString()}</div>
          </div>

          <div className="bg-[#111] border border-white/5 text-white p-6 rounded-3xl flex flex-col justify-between">
            <div className="text-[10px] font-black tracking-widest text-gray-500 mb-6 uppercase flex items-center gap-2"><Scissors size={14}/> Active Roster</div>
            <div className="text-3xl font-bold text-center tracking-tight">{tailors.length}</div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-[#111] rounded-3xl border border-white/5 overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="font-bold text-white tracking-tight">Transaction History</h3>
            <span className="text-[10px] font-bold tracking-widest bg-white/10 text-white/70 px-3 py-1 rounded-full">
              {filteredEntries.length} Records
            </span>
          </div>
          
          <div className="overflow-x-auto w-full">
            {filteredEntries.length === 0 ? (
              <div className="p-12 text-center text-gray-600">
                <FileText size={32} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium tracking-wide text-sm">No transactions found.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4 border-b border-white/5">Date</th>
                    <th className="px-6 py-4 border-b border-white/5">Tailor</th>
                    <th className="px-6 py-4 border-b border-white/5">Details</th>
                    <th className="px-6 py-4 border-b border-white/5 text-center">Credit (+)</th>
                    <th className="px-6 py-4 border-b border-white/5 text-center">Debit (-)</th>
                    <th className="px-6 py-4 border-b border-white/5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">{entry.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-white">{entry.tailor}</td>
                      <td className="px-6 py-4 min-w-[200px]">
                        {entry.type === 'production' ? (
                          <div>
                            <div className="text-white font-medium">{entry.product}</div>
                            <div className="text-xs text-gray-500 mt-1 font-mono">
                              {entry.totalPieces} pcs @ ₹{entry.pieceRate}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sky-400 font-bold flex items-center gap-2">
                              <Wallet size={14} /> Cash Payout
                            </div>
                            {entry.note && <div className="text-xs text-gray-500 mt-1">{entry.note}</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-white">{entry.type === 'production' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 text-center font-medium text-sky-400">{entry.type === 'payment' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 text-right">
                        {deletingId === entry.id ? (
                          <div className="flex justify-end items-center gap-3">
                            <button onClick={() => deleteEntry(entry.id)} className="text-rose-500 font-bold text-xs bg-rose-500/10 px-3 py-1 rounded">Delete</button>
                            <button onClick={() => setDeletingId(null)} className="text-gray-400 font-bold text-xs hover:text-white">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-4 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(entry)} className="text-gray-400 hover:text-white" title="Edit Entry"><Edit2 size={16} /></button>
                            <button onClick={() => setDeletingId(entry.id)} className="text-gray-500 hover:text-rose-500" title="Delete Entry"><Trash2 size={16} /></button>
                          </div>
                        )}
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
  }

  function renderAddData() {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Toggle Head */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">{editingId ? 'Edit Entry' : 'Data Entry'}</h2>
          <p className="text-gray-500 text-sm mt-1">{editingId ? 'Update the details below.' : 'Log a new stitched batch or record a cash payout.'}</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-[#111] p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setSubTab('production')}
            className={`flex-1 py-3 text-xs font-bold tracking-widest rounded-xl transition-all ${subTab === 'production' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}
          >
            LOG STITCHED BATCH
          </button>
          <button 
            onClick={() => setSubTab('payment')}
            className={`flex-1 py-3 text-xs font-bold tracking-widest rounded-xl transition-all ${subTab === 'payment' ? 'bg-[#022c22] text-[#cdfc4c] shadow-sm border border-[#cdfc4c]/20' : 'text-gray-500 hover:text-white'}`}
          >
            RECORD PAYOUT
          </button>
        </div>

        <div className="bg-[#111] p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
          {/* PRODUCTION FORM */}
          {subTab === 'production' && (
            <form onSubmit={handleProdSubmit} className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Tailor</label>
                  <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full py-3 px-4 bg-black border border-white/10 rounded-xl text-sm focus:border-[#cdfc4c] outline-none text-white appearance-none">
                    <option value="" disabled>Select Tailor</option>
                    {tailors.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Date</label>
                  <input type="date" value={prodForm.date} onChange={(e) => setProdForm({...prodForm, date: e.target.value})} className="w-full py-3 px-4 bg-black border border-white/10 rounded-xl text-sm focus:border-[#cdfc4c] outline-none text-white color-scheme-dark" style={{colorScheme: 'dark'}} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Style / Product</label>
                <select value={prodForm.product} onChange={(e) => setProdForm({...prodForm, product: e.target.value})} className="w-full py-3 px-4 bg-black border border-white/10 rounded-xl text-sm focus:border-[#cdfc4c] outline-none text-white appearance-none">
                  <option value="" disabled>Select Product</option>
                  {products.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <label className="block text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-4 text-center">Quantities by Size</label>
                <div className="grid grid-cols-5 gap-2">
                  {['XS', 'S', 'M', 'L', 'XL'].map(size => (
                    <div key={size} className="text-center">
                      <label className="block text-[10px] font-bold text-gray-500 mb-2">{size}</label>
                      <input type="number" min="0" value={prodForm.sizes[size] || ''} onChange={(e) => handleProdSizeChange(size, e.target.value)} placeholder="0" className="w-full py-2.5 text-center bg-black border border-white/10 rounded-xl text-white font-medium focus:border-[#cdfc4c] outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-black p-4 rounded-2xl border border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Rate per Piece</label>
                  <div className="flex items-center text-white">
                    <span className="text-gray-500 mr-2">₹</span>
                    <input type="number" value={prodForm.pieceRate} onChange={(e) => setProdForm({...prodForm, pieceRate: parseFloat(e.target.value) || 0})} className="w-20 bg-transparent text-lg font-bold outline-none" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-1">Batch Value</div>
                  <div className="text-2xl font-bold text-[#cdfc4c]">
                    ₹{Object.values(prodForm.sizes).reduce((a, b) => a + b, 0) * prodForm.pieceRate}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-4 bg-white hover:bg-gray-200 text-black font-bold tracking-widest text-xs uppercase rounded-xl transition-colors">
                  {editingId ? 'Update Batch' : '+ Save Batch'}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="py-4 px-6 bg-white/5 hover:bg-white/10 text-white font-bold tracking-widest text-xs uppercase rounded-xl transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {/* PAYMENT FORM */}
          {subTab === 'payment' && (
            <form onSubmit={handlePaySubmit} className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Tailor</label>
                  <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full py-3 px-4 bg-black border border-white/10 rounded-xl text-sm focus:border-sky-400 outline-none text-white appearance-none">
                    <option value="" disabled>Select Tailor</option>
                    {tailors.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Date</label>
                  <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} className="w-full py-3 px-4 bg-black border border-white/10 rounded-xl text-sm focus:border-sky-400 outline-none text-white color-scheme-dark" style={{colorScheme: 'dark'}}/>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-500 font-bold">₹</span>
                  <input type="number" value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: e.target.value})} placeholder="0.00" className="w-full pl-9 pr-4 py-3 bg-black border border-white/10 rounded-xl text-lg font-bold focus:border-sky-400 outline-none text-white" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Note (Optional)</label>
                <input type="text" value={payForm.note} onChange={(e) => setPayForm({...payForm, note: e.target.value})} placeholder="e.g. Weekly settlement" className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-sm focus:border-sky-400 outline-none text-white" />
              </div>

              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-4 bg-sky-500 hover:bg-sky-400 text-black font-bold tracking-widest text-xs uppercase rounded-xl transition-colors">
                  {editingId ? 'Update Payment' : 'Confirm Payment'}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="py-4 px-6 bg-white/5 hover:bg-white/10 text-white font-bold tracking-widest text-xs uppercase rounded-xl transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  function renderSignatureReceipt() {
    return (
      <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4">
         <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Tailor Sign-Off</h2>
          <p className="text-gray-500 text-sm mt-1">Generate a printable receipt for settlement.</p>
        </div>

        <div className="bg-[#111] p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
          
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Select Tailor to Print</label>
            <select 
              value={selectedTailorFilter}
              onChange={(e) => setSelectedTailorFilter(e.target.value)}
              className="w-full py-3 px-4 bg-black border border-white/10 rounded-xl text-sm focus:border-[#cdfc4c] outline-none text-white appearance-none"
            >
              <option value="All" disabled>Select Tailor...</option>
              {tailors.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {selectedTailorFilter !== 'All' ? (
            <div className="space-y-6">
               <div className="bg-black p-6 rounded-2xl border border-white/5 text-center">
                  <div className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Current Pending Payout</div>
                  <div className="text-4xl font-bold text-[#cdfc4c]">₹{pendingBalance.toLocaleString()}</div>
               </div>

               <div>
                 <div className="flex justify-between items-end mb-2">
                   <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase">Digital Signature</label>
                   {signatureLocked ? (
                     <button onClick={unlockSignature} className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"><Unlock size={12}/> UNLOCK</button>
                   ) : (
                     <button onClick={clearSignature} className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"><RefreshCw size={12}/> CLEAR</button>
                   )}
                 </div>
                 
                 <div className="relative bg-black border border-white/10 rounded-2xl overflow-hidden h-48 touch-none">
                    {signatureLocked && signatureImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                        <Lock className="text-white/30 w-12 h-12" />
                      </div>
                    )}
                    <canvas 
                      ref={canvasRef}
                      width={600} 
                      height={200}
                      className="w-full h-full cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                 </div>
               </div>

               <div className="flex gap-4 pt-4 border-t border-white/5">
                 {!signatureLocked ? (
                   <button onClick={lockSignature} className="flex-1 py-4 bg-white hover:bg-gray-200 text-black font-bold tracking-widest text-xs uppercase rounded-xl transition-colors">
                     Lock Signature
                   </button>
                 ) : (
                   <button onClick={printReceipt} className="flex-1 py-4 bg-[#cdfc4c] hover:bg-[#b5e03e] text-black flex items-center justify-center gap-2 font-bold tracking-widest text-xs uppercase rounded-xl transition-colors shadow-[0_0_20px_rgba(205,252,76,0.2)]">
                     <Printer size={16} /> Print Receipt
                   </button>
                 )}
               </div>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-600">
               <User size={32} className="mx-auto mb-4 opacity-20" />
               <p className="font-medium tracking-wide text-sm">Select a tailor above to generate receipt.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderPrintLayout() {
    if (selectedTailorFilter === 'All') return null;
    
    // Calculate 7-day window for report if needed, currently printing absolute pending
    return (
      <div className="max-w-2xl mx-auto text-left font-serif">
        <div className="border-b-2 border-black pb-6 mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">POSHAKH</h1>
          <p className="text-sm uppercase tracking-widest text-gray-500">Official Settlement Receipt</p>
        </div>

        <div className="flex justify-between items-end mb-12">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Tailor Name</div>
            <div className="text-2xl font-bold">{selectedTailorFilter}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Date</div>
            <div className="text-lg">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        <div className="bg-gray-50 p-8 rounded-lg mb-12 border border-gray-200">
          <div className="text-center">
             <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Total Outstanding Settlement</div>
             <div className="text-5xl font-bold">₹{pendingBalance.toLocaleString()}</div>
             <div className="text-sm text-gray-500 mt-4">This includes {totals.pieces} pieces stitched across {filteredEntries.length} recorded transactions, minus advances paid.</div>
          </div>
        </div>

        <div className="mt-24 pt-8 border-t border-gray-200 flex justify-between items-end">
           <div className="w-64">
             <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Tailor Signature</div>
             {signatureImage ? (
                <img src={signatureImage} alt="Signature" className="w-full h-24 object-contain filter grayscale invert" />
             ) : (
                <div className="h-24 border-b border-black border-dashed"></div>
             )}
             <div className="text-center mt-2 font-bold">{selectedTailorFilter}</div>
           </div>
           
           <div className="w-64 text-right">
             <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Authorized By</div>
             <div className="h-24 border-b border-black border-dashed flex items-end justify-center pb-2 text-gray-300">Admin Sign Here</div>
             <div className="text-center mt-2 font-bold">Poshakh Admin</div>
           </div>
        </div>
      </div>
    );
  }

  function renderSetup() {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">App Configuration</h2>
          <p className="text-gray-500 text-sm mt-1">Manage tailor team and product SKUs.</p>
        </div>

        <div className="bg-[#111] p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
          
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4 rounded-2xl flex gap-3 text-sm mb-8">
            <span className="font-bold">ⓘ</span>
            <p>Paste lists directly from Excel or CSV (one item per line). Cloud sync instantly updates all devices.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-3">Tailor Team</label>
              <textarea 
                value={setupTailors}
                onChange={(e) => setSetupTailors(e.target.value)}
                placeholder="Sajid&#10;Imran"
                className="w-full h-64 p-4 bg-black border border-white/10 rounded-2xl text-sm focus:border-[#cdfc4c] outline-none text-white font-mono resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-3">Product Catalog</label>
              <textarea 
                value={setupProducts}
                onChange={(e) => setSetupProducts(e.target.value)}
                placeholder="Wrap Around Dress&#10;Kalamkari Top"
                className="w-full h-64 p-4 bg-black border border-white/10 rounded-2xl text-sm focus:border-[#cdfc4c] outline-none text-white font-mono resize-none"
              />
            </div>
          </div>

          <button 
            onClick={handleSetupSave}
            className="w-full mt-8 py-4 bg-[#cdfc4c] hover:bg-[#b5e03e] text-black font-bold tracking-widest text-xs uppercase rounded-xl transition-colors shadow-[0_0_20px_rgba(205,252,76,0.1)] flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} /> Save Configuration
          </button>
        </div>
      </div>
    );
  }
}
