import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Scissors, Calendar, User, Shirt, DollarSign, Trash2, 
  Wallet, FileText, TrendingDown, TrendingUp, Package, CreditCard,
  Settings, ChevronRight, BarChart3, List, CheckCircle2, AlertCircle,
  Menu, X
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';

const DEFAULT_PRODUCTS = [
  "Backless Cami", "Banaspati Top", "Cami Top", "Creme Dress", 
  "H/T Kurti Red Brown", "Halter Top", "HTK Maroon", "Jharokha Creme", 
  "Kalamkari Top", "Midnight Bloom H/T Top", "Peacock Pichwai", 
  "Racerback + Cami", "Racerback Dress", "Racerback Midnight", "Wrap Around"
];
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

  // --- RESPONSIVE TAB STATE ---
  const [mobileTab, setMobileTab] = useState('log'); // log, pay, ledger, reports, settings
  const [desktopFormTab, setDesktopFormTab] = useState('log'); // log, pay
  const [desktopViewTab, setDesktopViewTab] = useState('ledger'); // ledger, reports, settings

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
      // 🔴 DEPLOYMENT STEP: Paste your Vercel/Firebase Config here.
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
          showToast("Authentication failed. Check your config.", "error");
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

    const entriesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tailor_entries');
    const settingsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tailor_settings');

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
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tailor_entries'), newEntry);
      showToast("Production logged successfully!");
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      setMobileTab('ledger');
      setDesktopViewTab('ledger');
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
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tailor_entries'), newEntry);
      showToast("Payment recorded successfully!");
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      setMobileTab('ledger');
      setDesktopViewTab('ledger');
    } catch (err) {
      showToast("Failed to record payment", "error");
    }
  };

  const confirmDelete = async () => {
    if (!user || !db || !deleteModalId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tailor_entries', deleteModalId));
      showToast("Record permanently deleted.");
      setDeleteModalId(null);
    } catch (err) {
      showToast("Failed to delete entry", "error");
    }
  };

  const saveSettings = async () => {
    if (!user || !db) return;
    const newTailors = settingsForm.tailorsText.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = settingsForm.productsText.split('\n').map(p => p.trim()).filter(p => p);
    if (newTailors.length === 0 || newProducts.length === 0) return showToast("Lists cannot be empty", "error");

    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tailor_settings', 'config'), {
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

  const renderLogForm = () => (
    <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-6 lg:hidden">
        <h2 className="text-2xl font-serif text-stone-900 tracking-tight">Log Stitched Batch</h2>
        <p className="text-stone-500 text-sm mt-1">Record daily production.</p>
      </div>
      <form onSubmit={handleProdSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Tailor</label>
            <div className="relative">
              <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full px-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-sm text-stone-800 font-medium focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none appearance-none transition-all" required>
                <option value="" disabled>Select Tailor</option>
                {tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronRight size={16} className="absolute right-4 top-4 text-stone-400 rotate-90 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Date</label>
            <input type="date" value={prodForm.date} onChange={(e) => setProdForm({...prodForm, date: e.target.value})} className="w-full px-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-sm text-stone-800 font-medium focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all" required/>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Style / Product</label>
          <div className="relative">
            <select value={prodForm.product} onChange={(e) => setProdForm({...prodForm, product: e.target.value})} className="w-full px-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-sm text-stone-800 font-medium focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none appearance-none transition-all" required>
              <option value="" disabled>Select Product</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronRight size={16} className="absolute right-4 top-4 text-stone-400 rotate-90 pointer-events-none" />
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100">
          <label className="block text-[11px] font-bold text-stone-500 mb-4 uppercase tracking-widest text-center">Quantities by Size</label>
          <div className="flex justify-between gap-2 max-w-sm mx-auto">
            {['XS', 'S', 'M', 'L', 'XL'].map(size => (
              <div key={size} className="flex-1 group">
                <label className="block text-[10px] font-bold text-stone-400 mb-2 text-center group-focus-within:text-stone-900 transition-colors">{size}</label>
                <input type="number" min="0" value={prodForm.sizes[size] || ''} onChange={(e) => setProdForm(prev => ({ ...prev, sizes: { ...prev.sizes, [size]: parseInt(e.target.value) || 0 } }))} placeholder="0" className="w-full py-3 text-center bg-stone-50 border-transparent rounded-xl text-base font-semibold text-stone-800 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all placeholder:font-normal placeholder:text-stone-300"/>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-stone-100 mt-6 gap-4">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Rate per Piece</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-stone-400 font-medium">₹</span>
              <input type="number" value={prodForm.pieceRate} onChange={(e) => setProdForm({...prodForm, pieceRate: parseFloat(e.target.value) || 0})} className="w-full pl-8 pr-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-base font-semibold text-stone-800 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all" required/>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Batch Value</p>
            <p className="text-2xl lg:text-3xl font-serif tracking-tight text-stone-900">
              ₹{Object.values(prodForm.sizes).reduce((a, b) => a + b, 0) * prodForm.pieceRate}
            </p>
          </div>
        </div>
        <button type="submit" className="w-full py-4 mt-4 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-2xl shadow-lg shadow-stone-900/20 transition-all flex justify-center items-center gap-2">
          <Plus size={18} /> Save Batch
        </button>
      </form>
    </div>
  );

  const renderPayForm = () => (
    <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-6 lg:hidden">
        <h2 className="text-2xl font-serif text-stone-900 tracking-tight">Record Payout</h2>
        <p className="text-stone-500 text-sm mt-1">Log cash payments and advances.</p>
      </div>
      <form onSubmit={handlePaySubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Tailor</label>
            <div className="relative">
              <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full px-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-sm text-stone-800 font-medium focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none appearance-none transition-all" required>
                <option value="" disabled>Select Tailor</option>
                {tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronRight size={16} className="absolute right-4 top-4 text-stone-400 rotate-90 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Date</label>
            <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} className="w-full px-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-sm text-stone-800 font-medium focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all" required/>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Amount Paid</label>
          <div className="relative">
            <span className="absolute left-5 top-3.5 text-stone-400 font-serif text-xl">₹</span>
            <input type="number" value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: e.target.value})} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-stone-50 border-transparent rounded-2xl text-2xl font-serif tracking-tight text-stone-900 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all" required/>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-500 uppercase tracking-widest ml-1">Note (Optional)</label>
          <input type="text" value={payForm.note} onChange={(e) => setPayForm({...payForm, note: e.target.value})} placeholder="e.g. Weekly settlement" className="w-full px-4 py-3.5 bg-stone-50 border-transparent rounded-2xl text-sm text-stone-800 focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-all" />
        </div>
        <button type="submit" className="w-full py-4 mt-8 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-2xl shadow-lg shadow-emerald-700/20 transition-all flex justify-center items-center gap-2">
          <CreditCard size={18} /> Confirm Payment
        </button>
      </form>
    </div>
  );

  const renderLedger = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      {/* Desktop Summary Header (Only visible on lg inside right pane) */}
      <div className="hidden lg:flex mb-6 items-end justify-between gap-6">
        <h2 className="text-3xl font-serif text-stone-900 tracking-tight">Account Ledger</h2>
        <div className="flex gap-8 bg-white px-8 py-4 rounded-3xl shadow-sm border border-stone-100 shrink-0">
          <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Stitched</p><p className="text-2xl font-serif text-stone-900">{totals.pieces}</p></div>
          <div className="w-px bg-stone-100"></div>
          <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Value</p><p className="text-2xl font-serif text-stone-900">₹{totals.earned.toLocaleString()}</p></div>
          <div className="w-px bg-stone-100"></div>
          <div><p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">Paid</p><p className="text-2xl font-serif text-emerald-700">₹{totals.paid.toLocaleString()}</p></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-white p-2 pl-4 rounded-2xl border border-stone-200 shadow-sm">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Filter:</span>
        <select value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-stone-100 text-stone-900 font-medium py-2 px-4 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none cursor-pointer">
          <option value="All">All Tailors combined</option>
          {tailors.map(t => <option key={t} value={t}>{t}'s Ledger</option>)}
        </select>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300">
          <FileText size={48} className="mx-auto text-stone-200 mb-4" />
          <p className="text-stone-500 font-medium font-serif text-lg">No records found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="group relative bg-white p-4 sm:p-5 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${entry.type === 'production' ? 'bg-stone-800' : 'bg-emerald-500'}`}></div>
              <div className="pl-3 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">{entry.tailor}</span>
                  <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">{entry.date}</span>
                </div>
                {entry.type === 'production' ? (
                  <>
                    <h4 className="text-base font-serif font-medium text-stone-800 mb-0.5">{entry.product}</h4>
                    <div className="flex flex-wrap gap-1 text-[11px] text-stone-500">
                      <span className="font-medium text-stone-600">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</span>
                      <span className="text-stone-300">•</span>
                      {Object.entries(entry.sizes).filter(([_, q]) => q > 0).map(([s, q]) => (
                        <span key={s} className="bg-stone-50 border border-stone-200 px-1.5 rounded">{s}:{q}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <h4 className="text-sm font-medium text-emerald-700 flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5"><Wallet size={14} /> Cash Payout</span>
                    {entry.note && <span className="text-xs text-stone-500 font-normal">{entry.note}</span>}
                  </h4>
                )}
              </div>
              <div className="pl-3 sm:pl-0 flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-stone-100 pt-2 sm:pt-0">
                <p className={`text-xl font-serif tracking-tight ${entry.type === 'production' ? 'text-stone-900' : 'text-emerald-600'}`}>
                  {entry.type === 'production' ? '+' : '-'}₹{entry.amount.toLocaleString()}
                </p>
                <button onClick={() => setDeleteModalId(entry.id)} className="text-stone-300 hover:text-rose-500 p-1.5 -mr-1.5 rounded-full transition-all sm:opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReports = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <div className="hidden lg:flex mb-6 items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-serif text-stone-900 tracking-tight">Thursday Settlements</h2>
          <p className="text-stone-500 text-sm mt-1">Automatically grouped Friday-Thursday cycles.</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4 bg-white p-2 pl-4 rounded-2xl border border-stone-200 shadow-sm">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Filter:</span>
        <select value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-stone-100 text-stone-900 font-medium py-2 px-4 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none cursor-pointer">
          <option value="All">All Tailors combined</option>
          {tailors.map(t => <option key={t} value={t}>{t}'s Reports</option>)}
        </select>
      </div>

      {weeklyReports.length === 0 ? (
         <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300">
           <p className="text-stone-500 font-medium font-serif text-lg">No production logged yet.</p>
         </div>
      ) : (
        <div className="space-y-6">
          {weeklyReports.map((week, idx) => {
            const netPay = week.earned - week.paid;
            return (
              <div key={idx} className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="bg-stone-50 px-5 sm:px-6 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-base font-bold text-stone-900">{week.label}</span>
                  <span className="text-[10px] w-fit font-bold uppercase tracking-widest text-stone-500 bg-white px-3 py-1 rounded-full border border-stone-200">
                    {week.pieces} Pieces Total
                  </span>
                </div>
                <div className="p-5 sm:p-6 grid grid-cols-2 gap-4 sm:gap-8 bg-white">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><TrendingUp size={12} className="text-stone-500"/> Value Generated</p>
                    <p className="text-xl sm:text-2xl font-serif text-stone-900">₹{week.earned.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><TrendingDown size={12} className="text-stone-500"/> Advances Paid</p>
                    <p className="text-xl sm:text-2xl font-serif text-stone-400">- ₹{week.paid.toLocaleString()}</p>
                  </div>
                </div>
                <div className={`px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-t border-stone-100 ${netPay > 0 ? 'bg-[#faf7f5]' : netPay < 0 ? 'bg-emerald-50/50' : 'bg-stone-50'}`}>
                  <div>
                    <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block mb-0.5 ${netPay > 0 ? 'text-amber-800' : 'text-stone-600'}`}>
                      {netPay > 0 ? 'Pending Weekly Payout' : netPay < 0 ? 'Overpaid / Advance Carryover' : 'Fully Settled'}
                    </span>
                  </div>
                  <span className={`text-2xl sm:text-3xl font-serif tracking-tight ${netPay > 0 ? 'text-rose-700' : netPay < 0 ? 'text-emerald-700' : 'text-stone-900'}`}>
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
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <div className="hidden lg:block mb-6">
        <h2 className="text-3xl font-serif text-stone-900 tracking-tight">App Configuration</h2>
        <p className="text-stone-500 text-sm mt-1">Manage your team and product catalog.</p>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 md:p-8 space-y-6">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-sm text-amber-900">
          <AlertCircle size={20} className="shrink-0 text-amber-600" />
          <p>Paste items directly from Excel or CSV. Enter one item per line. Cloud sync updates all devices instantly.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">Tailor Team</label>
            <textarea value={settingsForm.tailorsText} onChange={(e) => setSettingsForm({...settingsForm, tailorsText: e.target.value})} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none h-48 font-mono leading-relaxed transition-all" placeholder="Sajid&#10;Imran"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2 ml-1">Product Catalog</label>
            <textarea value={settingsForm.productsText} onChange={(e) => setSettingsForm({...settingsForm, productsText: e.target.value})} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none h-48 font-mono leading-relaxed transition-all" placeholder="Wrap Around Dress&#10;Kalamkari Top"/>
          </div>
        </div>
        <button onClick={saveSettings} className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-2xl shadow-lg shadow-stone-900/20 transition-all text-base">
          Save Configuration to Cloud
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex flex-col items-center justify-center text-stone-500">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mb-6"></div>
        <p className="font-serif italic text-lg tracking-wide text-stone-800">Loading Poshakh...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-stone-900 font-sans pb-24 lg:pb-8 selection:bg-stone-200 flex flex-col">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-4 border ${toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-stone-900 border-stone-800 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Delete Record?</h3>
            <p className="text-sm text-stone-500 mb-8">This action cannot be undone. It will affect your ledger and settlement reports.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModalId(null)} className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium rounded-xl transition-all">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Header */}
      <header className="bg-white px-4 md:px-8 py-4 border-b border-stone-200 sticky top-0 z-40 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-white shrink-0">
            <Scissors size={18} />
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold tracking-tight text-stone-900 leading-tight">Poshakh</h1>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold tracking-wider uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Cloud Synced
            </div>
          </div>
        </div>
        
        {/* Universal Pending Balance Indicator */}
        <div className="text-right bg-stone-50 px-4 py-1.5 rounded-2xl border border-stone-100">
          <p className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mb-0.5">Total Pending Pay</p>
          <p className={`text-xl font-serif tracking-tight ${pendingBalance > 0 ? 'text-rose-700' : 'text-stone-900'}`}>
            ₹{pendingBalance.toLocaleString()}
          </p>
        </div>
      </header>

      {/* --- DESKTOP LAYOUT (Side-by-Side) --- */}
      <main className="hidden lg:flex max-w-[90rem] mx-auto w-full p-8 gap-8 items-start flex-1">
        
        {/* Left Sidebar: Forms */}
        <div className="w-[400px] shrink-0 sticky top-28 space-y-4">
          <div className="bg-stone-200/50 p-1.5 rounded-2xl flex gap-1">
            <button onClick={() => setDesktopFormTab('log')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${desktopFormTab === 'log' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
              <Shirt size={16}/> Log Batch
            </button>
            <button onClick={() => setDesktopFormTab('pay')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${desktopFormTab === 'pay' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
              <CreditCard size={16}/> Add Pay
            </button>
          </div>
          {desktopFormTab === 'log' ? renderLogForm() : renderPayForm()}
        </div>

        {/* Right Main Area: Data Views */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="bg-white border border-stone-200 p-1.5 rounded-full flex gap-1 shadow-sm self-start w-full max-w-md">
            {[
              { id: 'ledger', icon: List, label: 'Ledger' },
              { id: 'reports', icon: BarChart3, label: 'Settlements' },
              { id: 'settings', icon: Settings, label: 'Setup' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setDesktopViewTab(tab.id)} className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-full transition-all flex items-center justify-center gap-2 ${desktopViewTab === 'tab.id' || desktopViewTab === tab.id ? 'bg-stone-900 text-white shadow-md' : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50'}`}>
                <tab.icon size={16}/> {tab.label}
              </button>
            ))}
          </div>
          
          <div className="pb-12">
            {desktopViewTab === 'ledger' && renderLedger()}
            {desktopViewTab === 'reports' && renderReports()}
            {desktopViewTab === 'settings' && renderSettings()}
          </div>
        </div>
      </main>

      {/* --- MOBILE LAYOUT (Tabbed) --- */}
      <main className="lg:hidden p-4 sm:p-6 flex-1">
        {mobileTab === 'log' && renderLogForm()}
        {mobileTab === 'pay' && renderPayForm()}
        {mobileTab === 'ledger' && renderLedger()}
        {mobileTab === 'reports' && renderReports()}
        {mobileTab === 'settings' && renderSettings()}
      </main>

      {/* Mobile Fixed Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-between px-2 pb-safe pt-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
        {[
          { id: 'log', icon: Plus, label: 'Batch' },
          { id: 'pay', icon: Wallet, label: 'Pay' },
          { id: 'ledger', icon: List, label: 'Ledger' },
          { id: 'reports', icon: BarChart3, label: 'Reports' },
          { id: 'settings', icon: Settings, label: 'Setup' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setMobileTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 mb-2 gap-1 rounded-xl transition-all ${mobileTab === tab.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}
          >
            <div className={`p-1.5 rounded-full transition-all ${mobileTab === tab.id ? 'bg-stone-100' : 'bg-transparent'}`}>
              <tab.icon size={20} strokeWidth={mobileTab === tab.id ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] font-bold ${mobileTab === tab.id ? 'text-stone-900' : 'text-stone-400'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
