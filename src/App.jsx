import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors, User, Shirt, IndianRupee, Trash2,
  Wallet, FileText, Settings, Edit2, PenTool, Printer, RefreshCw, Image as ImageIcon, AlertCircle, ChevronDown, Download
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  deleteDoc, doc, setDoc, updateDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBciTbw1cvMD6au0PZw7k-rfdRlUNHea18",
  authDomain: "tailordaily.firebaseapp.com",
  projectId: "tailordaily",
  storageBucket: "tailordaily.firebasestorage.app",
  messagingSenderId: "669424663727",
  appId: "1:669424663727:web:046d0cd13ad8a6013c685a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [entries, setEntries] = useState([]);
  const [tailors, setTailors] = useState(["Sajid", "Imran"]);
  const [products, setProducts] = useState([
    { name: "Wrap Around Dress", image: null },
    { name: "Kalamkari Top", image: null }
  ]);
  
  const [activeTab, setActiveTab] = useState('ledger');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(false);
  const [showLocalOverride, setShowLocalOverride] = useState(false);
  
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

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

  const [setupForm, setSetupForm] = useState({
    tailorsText: '',
    productsText: ''
  });

  const [reportForm, setReportForm] = useState({
    type: 'ledger',
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    tailor: 'All'
  });

  // NEW: Date Range for Sign-Off Receipt
  const [signOffStartDate, setSignOffStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().split('T')[0]); // Default to 1 week
  const [signOffEndDate, setSignOffEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' or 'thermal'

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #root { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
      body, html { width: 100%; margin: 0; padding: 0; overflow-x: hidden; background-color: #0a0a0a; }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
    `;
    document.head.appendChild(style);

    let unsubscribeLedger;
    let unsubscribeConfig;
    let fallbackTimer;

    const loadLocalData = () => {
      console.log("Loading Local Fallback Data");
      const localLedger = JSON.parse(localStorage.getItem('poshakh_ledger') || '[]');
      const localConfig = JSON.parse(localStorage.getItem('poshakh_config') || 'null');
      
      setEntries(localLedger);
      if (localConfig) {
        setTailors(localConfig.tailors || []);
        setProducts(localConfig.products || []);
        setSetupForm({
          tailorsText: (localConfig.tailors || []).join('\n'),
          productsText: (localConfig.products || []).map(p => p.image ? `${p.name}\t${p.image}` : p.name).join('\n')
        });
      } else {
        setSetupForm({
          tailorsText: tailors.join('\n'),
          productsText: products.map(p => p.name).join('\n')
        });
      }
      setProdForm(prev => ({ ...prev, tailor: localConfig?.tailors?.[0] || tailors[0] || '', product: localConfig?.products?.[0]?.name || products[0]?.name || '' }));
      setPayForm(prev => ({ ...prev, tailor: localConfig?.tailors?.[0] || tailors[0] || '' }));
      setLoading(false);
    };

    const fetchFirebaseDirectly = () => {
      try {
        unsubscribeLedger = onSnapshot(collection(db, 'ledger'), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setEntries(data);
          clearTimeout(fallbackTimer);
          setLoading(false);
        }, (err) => {
          console.error("Firebase Read Blocked:", err);
          setUseLocalMode(true);
          loadLocalData();
        });

        unsubscribeConfig = onSnapshot(doc(db, 'config', 'setup'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTailors(data.tailors || []);
            setProducts(data.products || []);
            setSetupForm({
              tailorsText: (data.tailors || []).join('\n'),
              productsText: (data.products || []).map(p => p.image ? `${p.name}\t${p.image}` : p.name).join('\n')
            });
            setProdForm(prev => ({ ...prev, tailor: data.tailors?.[0] || '', product: data.products?.[0]?.name || '' }));
            setPayForm(prev => ({ ...prev, tailor: data.tailors?.[0] || '' }));
          }
        }, (err) => {
          console.error("Firebase Config Blocked:", err);
        });
      } catch (err) {
        setUseLocalMode(true);
        loadLocalData();
      }
    };

    fetchFirebaseDirectly();

    fallbackTimer = setTimeout(() => {
      if (loading) setShowLocalOverride(true);
    }, 4000);

    return () => {
      if (unsubscribeLedger) unsubscribeLedger();
      if (unsubscribeConfig) unsubscribeConfig();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const forceLocalMode = () => {
    setUseLocalMode(true);
    const localLedger = JSON.parse(localStorage.getItem('poshakh_ledger') || '[]');
    setEntries(localLedger);
    setLoading(false);
    showToast("Switched to Local Offline Mode", "error");
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const syncLocal = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  const handleProdSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setProdForm(prev => ({
      ...prev,
      sizes: { ...prev.sizes, [size]: numValue }
    }));
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.tailor || !prodForm.product) return showToast("Select a tailor and product.", "error");

    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + val, 0);
    if (totalPieces === 0) return showToast("Enter at least one piece.", "error");

    const entryData = {
      ...prodForm,
      type: 'production',
      totalPieces,
      amount: totalPieces * prodForm.pieceRate,
      timestamp: new Date().toISOString()
    };

    try {
      if (useLocalMode) {
        let newEntries = [...entries];
        if (editingEntryId) {
          newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
          showToast("Local log updated!");
        } else {
          newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
          showToast("Local batch logged!");
        }
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
      } else {
        if (editingEntryId) {
          await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
          showToast("Cloud log updated!");
        } else {
          await addDoc(collection(db, 'ledger'), entryData);
          showToast("Cloud batch logged!");
        }
      }
      setEditingEntryId(null);
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      setActiveTab('ledger');
    } catch (err) {
      showToast("Failed to save.", "error");
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const payAmount = parseFloat(payForm.amount);
    if (!payForm.tailor || !payAmount || payAmount <= 0) return showToast("Enter valid amount.", "error");

    const entryData = {
      type: 'payment',
      date: payForm.date,
      tailor: payForm.tailor,
      amount: payAmount,
      note: payForm.note,
      timestamp: new Date().toISOString()
    };

    try {
      if (useLocalMode) {
        let newEntries = [...entries];
        if (editingEntryId) {
          newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
        } else {
          newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
        }
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
        showToast("Local payment saved!");
      } else {
        if (editingEntryId) {
          await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
        } else {
          await addDoc(collection(db, 'ledger'), entryData);
        }
        showToast("Cloud payment saved!");
      }
      setEditingEntryId(null);
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      setActiveTab('ledger');
    } catch (err) {
      showToast("Failed to save.", "error");
    }
  };

  const deleteEntry = async (id) => {
    try {
      if (useLocalMode) {
        const newEntries = entries.filter(e => e.id !== id);
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
        showToast("Deleted locally.");
      } else {
        await deleteDoc(doc(db, 'ledger', id));
        showToast("Cloud record deleted.");
      }
      setDeletingId(null);
    } catch (err) {
      showToast("Delete failed.", "error");
    }
  };

  const startEdit = (entry) => {
    setEditingEntryId(entry.id);
    if (entry.type === 'production') {
      setProdForm({
        date: entry.date, tailor: entry.tailor, product: entry.product,
        sizes: entry.sizes || { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
        pieceRate: entry.pieceRate || 250
      });
      setActiveTab('add-batch');
    } else {
      setPayForm({
        date: entry.date, tailor: entry.tailor, amount: entry.amount, note: entry.note || ''
      });
      setActiveTab('pay');
    }
  };

  const saveConfig = async () => {
    const newTailors = setupForm.tailorsText.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = setupForm.productsText.split('\n').map(line => {
      const parts = line.split(/[\t,]/);
      return { name: parts[0]?.trim() || '', image: parts[1]?.trim() || null };
    }).filter(p => p.name);

    try {
      if (useLocalMode) {
        setTailors(newTailors);
        setProducts(newProducts);
        syncLocal('poshakh_config', { tailors: newTailors, products: newProducts });
        showToast("Setup saved locally!");
      } else {
        await setDoc(doc(db, 'config', 'setup'), {
          tailors: newTailors, products: newProducts, updatedAt: new Date().toISOString()
        });
        showToast("Cloud setup saved!");
      }
    } catch (err) {
      showToast("Failed to save setup.", "error");
    }
  };

  const handleDownloadReport = () => {
    const filtered = entries.filter(e => {
      const d = new Date(e.date);
      const start = new Date(reportForm.startDate);
      const end = new Date(reportForm.endDate);
      const dateMatch = d >= start && d <= end;
      const tailorMatch = reportForm.tailor === 'All' || e.tailor === reportForm.tailor;
      return dateMatch && tailorMatch;
    });

    if (filtered.length === 0) return showToast("No data found.", "error");

    let csvContent = "";
    let filename = `poshakh_${reportForm.type}_${reportForm.startDate}_to_${reportForm.endDate}.csv`;

    if (reportForm.type === 'ledger') {
      csvContent = "Date,Tailor,Transaction Type,Product,Quantity,Rate,Credit (Earned),Debit (Paid),Notes\n";
      filtered.forEach(e => {
        const type = e.type === 'production' ? 'Production' : 'Payment';
        const product = e.product ? `"${e.product}"` : '';
        const qty = e.totalPieces || '';
        const rate = e.pieceRate || '';
        const credit = e.type === 'production' ? e.amount : '';
        const debit = e.type === 'payment' ? e.amount : '';
        const note = e.note ? `"${e.note}"` : '';
        csvContent += `${e.date},${e.tailor},${type},${product},${qty},${rate},${credit},${debit},${note}\n`;
      });
    } else if (reportForm.type === 'settlement') {
      csvContent = "Tailor,Pieces Stitched,Total Earned,Total Paid,Pending Balance\n";
      const tailorsSet = reportForm.tailor === 'All' ? tailors : [reportForm.tailor];
      tailorsSet.forEach(t => {
        const tEntries = filtered.filter(e => e.tailor === t);
        const pieces = tEntries.filter(e => e.type === 'production').reduce((sum, e) => sum + e.totalPieces, 0);
        const earned = tEntries.filter(e => e.type === 'production').reduce((sum, e) => sum + e.amount, 0);
        const paid = tEntries.filter(e => e.type === 'payment').reduce((sum, e) => sum + e.amount, 0);
        const pending = earned - paid;
        if (pieces > 0 || paid > 0) csvContent += `${t},${pieces},${earned},${paid},${pending}\n`;
      });
    } else if (reportForm.type === 'production') {
      csvContent = "Product,Total Pieces Stitched,Total Value\n";
      const productStats = {};
      filtered.filter(e => e.type === 'production').forEach(e => {
        if (!productStats[e.product]) productStats[e.product] = { pieces: 0, value: 0 };
        productStats[e.product].pieces += e.totalPieces;
        productStats[e.product].value += e.amount;
      });
      Object.entries(productStats).forEach(([prod, stats]) => csvContent += `"${prod}",${stats.pieces},${stats.value}\n`);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report Downloaded!");
  };

  const startDrawing = (e) => {
    if (signatureLocked || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo((e.clientX || e.touches?.[0]?.clientX) - rect.left, (e.clientY || e.touches?.[0]?.clientY) - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || signatureLocked || !canvasRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    ctx.lineTo((e.clientX || e.touches?.[0]?.clientX) - rect.left, (e.clientY || e.touches?.[0]?.clientY) - rect.top);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    if (!canvasRef.current) return;
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureLocked(false);
  };

  const filteredEntries = useMemo(() => {
    if (selectedTailorFilter === 'All') return entries;
    return entries.filter(e => e.tailor === selectedTailorFilter);
  }, [entries, selectedTailorFilter]);

  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, curr) => {
      if (curr.type === 'production') { acc.pieces += curr.totalPieces; acc.earned += curr.amount; }
      else if (curr.type === 'payment') { acc.paid += curr.amount; }
      return acc;
    }, { pieces: 0, earned: 0, paid: 0 });
  }, [filteredEntries]);

  const pendingBalance = totals.earned - totals.paid;
  const currentSelectedProductImage = products.find(p => p.name === prodForm.product)?.image;

  const renderLedger = () => (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Financial Overview</h2><p className="text-gray-400 text-sm mt-1">Real-time ledger and balances.</p></div>
        <select value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none">
          <option value="All">All Tailors Combined</option>{tailors.map(t => <option key={t} value={t}>{t} Only</option>)}
        </select>
      </div>

      <div className="bg-[#cdfc4c] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl">
        <div><div className="text-black/60 text-xs font-bold uppercase tracking-wider mb-2">Total Pending Payout</div><div className="text-5xl md:text-7xl font-black text-black tracking-tighter">₹{pendingBalance.toLocaleString()}</div></div>
        <div className="mt-6 md:mt-0 md:text-right"><div className="text-black/60 text-xs font-bold uppercase tracking-wider mb-2">Pieces Stitched</div><div className="text-2xl md:text-3xl font-bold text-black">{totals.pieces} <span className="text-lg font-medium opacity-60">Items</span></div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#ffe4e6] p-6 rounded-2xl shadow-sm"><div className="text-[10px] uppercase tracking-wider font-bold text-rose-800/60 mb-2">Total Earned Value</div><div className="text-3xl md:text-4xl font-black text-rose-950">₹{totals.earned.toLocaleString()}</div></div>
        <div className="bg-[#e0f2fe] p-6 rounded-2xl shadow-sm"><div className="text-[10px] uppercase tracking-wider font-bold text-sky-800/60 mb-2">Total Amount Paid</div><div className="text-3xl md:text-4xl font-black text-sky-950">₹{totals.paid.toLocaleString()}</div></div>
        <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl shadow-sm"><div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">Active Roster</div><div className="text-3xl md:text-4xl font-black text-white">{tailors.length}</div></div>
      </div>

      <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-[#0a0a0a]">
          <h3 className="font-bold text-white tracking-tight text-lg">Transaction History</h3>
          <span className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full font-bold">{filteredEntries.length} Records</span>
        </div>
        <div className="overflow-x-auto w-full">
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-gray-600"><FileText size={40} className="mx-auto mb-4 opacity-20" /><p>No transactions found.</p></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0a0a0a] text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Tailor</th><th className="px-6 py-4">Details</th><th className="px-6 py-4 text-right">Credit (+)</th><th className="px-6 py-4 text-right">Debit (-)</th><th className="px-6 py-4 text-right"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredEntries.map((entry) => {
                  const entryImage = products.find(p => p.name === entry.product)?.image;
                  return (
                  <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">{entry.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-white">{entry.tailor}</td>
                    <td className="px-6 py-4">
                      {entry.type === 'production' ? (
                        <div className="flex items-center gap-3">
                           {entryImage ? (
                             <img src={entryImage} className="w-10 h-10 rounded-lg object-cover border border-gray-700 bg-black shrink-0" />
                           ) : (
                             <div className="w-10 h-10 rounded-lg bg-black border border-gray-700 flex items-center justify-center shrink-0"><Shirt size={16} className="text-gray-600" /></div>
                           )}
                           <div><div className="text-white font-bold">{entry.product}</div><div className="text-xs text-gray-500 mt-0.5">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</div></div>
                        </div>
                      ) : (
                        <div><div className="text-sky-400 font-bold flex items-center gap-1.5"><Wallet size={14} /> Cash Payout</div>{entry.note && <div className="text-xs text-gray-500 mt-1">{entry.note}</div>}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">{entry.type === 'production' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-sky-400">{entry.type === 'payment' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      {deletingId === entry.id ? (
                        <div className="flex justify-end items-center gap-3">
                          <button onClick={() => deleteEntry(entry.id)} className="text-rose-500 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded">Delete</button>
                          <button onClick={() => setDeletingId(null)} className="text-gray-400 font-bold text-xs hover:text-white">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(entry)} className="text-[#cdfc4c] hover:text-white"><Edit2 size={16} /></button>
                          <button onClick={() => setDeletingId(entry.id)} className="text-gray-500 hover:text-rose-500"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  const renderAddBatch = () => (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight">{editingEntryId ? 'Edit Log' : 'Log Stitched Batch'}</h2><p className="text-gray-400 mt-2">Record daily production turnaround.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl">
        <form onSubmit={handleProdSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Tailor</label>
              <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none appearance-none">
                <option value="">Select Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Date</label>
              <input type="date" value={prodForm.date} onChange={(e) => setProdForm({...prodForm, date: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Style / Product</label>
            <div className="relative">
              <div 
                className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none cursor-pointer flex items-center justify-between transition-colors hover:border-gray-600"
                onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {currentSelectedProductImage ? (
                    <img src={currentSelectedProductImage} alt="Preview" className="w-8 h-8 rounded-md object-cover border border-gray-800 bg-[#111] shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-[#111] border border-gray-800 flex items-center justify-center shrink-0">
                      <ImageIcon size={16} className="text-gray-600" />
                    </div>
                  )}
                  <span className={`truncate font-medium ${prodForm.product ? 'text-white' : 'text-gray-500'}`}>
                    {prodForm.product || "Select Product"}
                  </span>
                </div>
                <ChevronDown size={18} className={`text-gray-500 transition-transform duration-200 ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isProductDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProductDropdownOpen(false)} />
                  <div className="absolute z-50 w-full mt-2 bg-[#111] border border-gray-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto custom-scrollbar overflow-hidden">
                    {products.map((p, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0"
                        onClick={() => {
                          setProdForm({...prodForm, product: p.name});
                          setIsProductDropdownOpen(false);
                        }}
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-10 h-10 rounded-md object-cover border border-gray-800 bg-black shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-black border border-gray-800 flex items-center justify-center shrink-0">
                            <ImageIcon size={16} className="text-gray-600" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-200 hover:text-white">{p.name}</span>
                      </div>
                    ))}
                    {products.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">No products found. Add some in Setup.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-800">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-4 text-center">Quantities by Size</label>
            <div className="grid grid-cols-5 gap-3">
              {['XS', 'S', 'M', 'L', 'XL'].map(size => (
                <div key={size} className="text-center">
                  <label className="block text-xs font-bold text-gray-500 mb-2">{size}</label>
                  <input type="number" min="0" value={prodForm.sizes[size] || ''} onChange={(e) => handleProdSizeChange(size, e.target.value)} placeholder="0" className="w-full py-3 text-center bg-black border border-gray-800 rounded-xl text-lg font-bold focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6 border-t border-gray-800 flex items-center justify-between">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Rate Per Piece</label>
              <div className="relative w-32"><IndianRupee size={16} className="absolute left-4 top-3.5 text-gray-500" /><input type="number" value={prodForm.pieceRate} onChange={(e) => setProdForm({...prodForm, pieceRate: parseFloat(e.target.value) || 0})} className="w-full pl-10 pr-4 py-3 bg-black border border-gray-800 rounded-xl font-bold focus:ring-2 focus:ring-[#cdfc4c] outline-none"/></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Batch Value</div>
              <div className="text-3xl font-black text-white">₹{Object.values(prodForm.sizes).reduce((a, b) => a + b, 0) * prodForm.pieceRate}</div>
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-[#cdfc4c] text-black hover:bg-[#b5e638] font-black tracking-wide rounded-xl transition-all">{editingEntryId ? 'Update Batch' : 'Save Batch'}</button>
        </form>
      </div>
    </div>
  );

  const renderAddPay = () => (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight">{editingEntryId ? 'Edit Payout' : 'Record Payout'}</h2><p className="text-gray-400 mt-2">Log cash payments and advances to tailors.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl">
        <form onSubmit={handlePaySubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Tailor</label>
              <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none appearance-none">
                <option value="">Select Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Date</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none"/>
            </div>
          </div>
          <div><label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Amount Paid</label><div className="relative"><IndianRupee size={24} className="absolute left-4 top-4 text-gray-500" /><input type="number" value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: e.target.value})} placeholder="0.00" className="w-full pl-12 pr-4 py-4 bg-black border border-gray-800 rounded-xl text-2xl font-bold focus:ring-2 focus:ring-sky-400 outline-none"/></div></div>
          <div><label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Note (Optional)</label><input type="text" value={payForm.note} onChange={(e) => setPayForm({...payForm, note: e.target.value})} placeholder="e.g. Weekly settlement" className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none"/></div>
          <button type="submit" className="w-full flex items-center justify-center gap-2 py-4 bg-sky-500 hover:bg-sky-400 text-white font-black tracking-wide rounded-xl transition-all"><Wallet size={18} /> {editingEntryId ? 'Update Payment' : 'Confirm Payment'}</button>
        </form>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight text-white">App Configuration</h2><p className="text-gray-400 mt-2">Manage tailor team and product catalog.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-10 border border-gray-800 shadow-2xl">
        
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-8 flex gap-4 items-start">
           <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
           <div className="text-sm text-yellow-200/80">
              <strong className="text-yellow-500 block mb-1">How to add Images:</strong>
              Open your Shopify <strong>products_export.csv</strong> file. Copy the <strong>Title</strong> column and the <strong>Image Src</strong> column, paste them side-by-side in a blank Excel sheet, then copy and paste them together into the Product Catalog box below!
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div><label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3 text-center">Tailor Team (One per line)</label><textarea value={setupForm.tailorsText} onChange={(e) => setSetupForm({...setupForm, tailorsText: e.target.value})} className="w-full h-80 p-4 bg-black border border-gray-800 rounded-2xl text-sm font-mono text-gray-300 focus:ring-2 focus:ring-[#cdfc4c] outline-none resize-none" placeholder="Sajid&#10;Imran" /></div>
          <div><label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3 text-center">Product Catalog (Name ⇥ Image URL)</label><textarea value={setupForm.productsText} onChange={(e) => setSetupForm({...setupForm, productsText: e.target.value})} className="w-full h-80 p-4 bg-black border border-gray-800 rounded-2xl text-sm font-mono text-gray-300 focus:ring-2 focus:ring-[#cdfc4c] outline-none resize-none whitespace-pre overflow-x-auto" placeholder="Wrap Around Dress&#9;https://poshakh.com/img1.jpg&#10;Kalamkari Top&#9;https://poshakh.com/img2.jpg" /></div>
        </div>
        <button onClick={saveConfig} className="w-full mt-8 py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-black tracking-wide rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#cdfc4c]/10"><RefreshCw size={18} /> Save Configuration</button>
      </div>

      <div className="text-center mb-8 mt-16 pt-12 border-t border-gray-800/50"><h2 className="text-3xl font-black tracking-tight text-white">Data & Reports</h2><p className="text-gray-400 mt-2">Export your records to CSV for Excel or Accounting.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-10 border border-gray-800 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Report Type</label>
            <select value={reportForm.type} onChange={(e) => setReportForm({...reportForm, type: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none">
              <option value="ledger">Detailed Ledger (All Transactions)</option>
              <option value="settlement">Tailor Settlement (Earnings & Payouts)</option>
              <option value="production">Production by Style (Inventory)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Filter by Tailor</label>
            <select value={reportForm.tailor} onChange={(e) => setReportForm({...reportForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none">
              <option value="All">All Tailors</option>
              {tailors.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Start Date</label>
            <input type="date" value={reportForm.startDate} onChange={(e) => setReportForm({...reportForm, startDate: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">End Date</label>
            <input type="date" value={reportForm.endDate} onChange={(e) => setReportForm({...reportForm, endDate: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
          </div>
        </div>
        <button onClick={handleDownloadReport} className="w-full py-4 bg-white hover:bg-gray-200 text-black font-black tracking-wide rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"><Download size={18} /> Generate & Download CSV</button>
      </div>
    </div>
  );

  const renderSignOff = () => {
    const targetTailor = selectedTailorFilter === 'All' ? tailors[0] : selectedTailorFilter;
    
    // Filter entries by Date Range & Tailor
    const rangeLogs = entries.filter(e => {
      const d = new Date(e.date);
      const start = new Date(signOffStartDate);
      const end = new Date(signOffEndDate);
      return e.tailor === targetTailor && d >= start && d <= end;
    });

    const periodProduction = rangeLogs.filter(e => e.type === 'production');
    const periodPayments = rangeLogs.filter(e => e.type === 'payment');
    
    const earnedPeriod = periodProduction.reduce((sum, e) => sum + e.amount, 0);
    const paidPeriod = periodPayments.reduce((sum, e) => sum + e.amount, 0);
    const piecesPeriod = periodProduction.reduce((sum, e) => sum + e.totalPieces, 0);
    const periodBalance = earnedPeriod - paidPeriod;

    // Helper to format sizes clearly
    const formatSizes = (sizes) => {
      if (!sizes) return '';
      const activeSizes = Object.entries(sizes).filter(([_, qty]) => qty > 0);
      if (activeSizes.length === 0) return '-';
      return activeSizes.map(([size, qty]) => `${size}(${qty})`).join(', ');
    };

    return (
      <div className="w-full max-w-3xl mx-auto pb-12 print:pb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Dynamic Print Styles for A4 vs Thermal */}
        <style>
          {`
            @media print {
              ${printFormat === 'thermal' ? `
                @page { margin: 0; size: 4in 6in; }
                body { margin: 0; padding: 0; }
                .thermal-print-area { width: 3.8in !important; margin: 0.1in auto !important; padding: 0.1in !important; font-size: 11px !important; box-shadow: none !important; }
                .thermal-print-area table { font-size: 10px !important; }
                .thermal-print-area h1 { font-size: 24px !important; }
                .thermal-print-area .adjust-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0.5rem !important; }
              ` : `
                @page { margin: 10mm; size: A4 portrait; }
              `}
            }
          `}
        </style>

        <div className="print:hidden mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <select value={selectedTailorFilter === 'All' ? tailors[0] : selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="w-full md:w-auto bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none">
              {tailors.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input type="date" value={signOffStartDate} onChange={(e) => { setSignOffStartDate(e.target.value); clearSignature(); }} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
              <span className="text-gray-500 text-xs font-bold uppercase">to</span>
              <input type="date" value={signOffEndDate} onChange={(e) => { setSignOffEndDate(e.target.value); clearSignature(); }} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
            <select value={printFormat} onChange={(e) => setPrintFormat(e.target.value)} className="w-full md:w-auto bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none">
              <option value="a4">A4 Printer</option>
              <option value="thermal">Label Printer (4x6 inches)</option>
            </select>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-colors w-full md:w-auto whitespace-nowrap"><Printer size={16} /> Print</button>
          </div>
        </div>

        <div className={`bg-white text-black relative overflow-hidden ${printFormat === 'thermal' ? 'thermal-print-area rounded-lg p-4' : 'rounded-2xl p-8 md:p-12 print:p-0 print:w-full print:shadow-none shadow-2xl'}`}>
          {/* Subtle top border for screen preview */}
          <div className="absolute top-0 left-0 w-full h-3 bg-[#022c22] print:hidden"></div>
          
          <div className={`text-center mb-6 border-b-2 border-dashed border-gray-300 ${printFormat === 'thermal' ? 'pb-4' : 'pb-6'}`}>
            <h1 className={`${printFormat === 'thermal' ? 'text-2xl' : 'text-4xl'} font-black tracking-tighter uppercase mb-1`}>Poshakh</h1>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Production & Settlement Docket</p>
          </div>
          
          <div className="flex justify-between mb-8 font-mono text-sm border-b border-gray-200 pb-4">
            <div>
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Settlement Period</div>
              <div className="font-bold text-base">{signOffStartDate === signOffEndDate ? signOffStartDate : `${signOffStartDate} to \n${signOffEndDate}`}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Tailor</div>
              <div className="font-bold text-xl uppercase">{targetTailor}</div>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 bg-gray-50 p-2 rounded">Production Log</h3>
            {periodProduction.length === 0 ? <p className="text-gray-400 italic font-mono text-sm py-4">No production recorded in this period.</p> : (
              <table className="w-full text-sm font-mono">
                <thead className="border-b border-dashed border-gray-300 text-left text-gray-500 text-[10px]">
                  <tr>
                    <th className="py-2 font-normal uppercase tracking-widest">Date / Details</th>
                    <th className="py-2 font-normal uppercase tracking-widest text-center">Qty</th>
                    <th className="py-2 font-normal uppercase tracking-widest text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-gray-200">
                  {periodProduction.map(log => (
                    <tr key={log.id}>
                      <td className="py-3 pr-2">
                        <div className="text-[9px] text-gray-400 mb-0.5">{log.date}</div>
                        <div className="font-bold text-gray-900 font-sans text-sm leading-tight">{log.product}</div>
                        <div className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">Sizes: {formatSizes(log.sizes)}</div>
                      </td>
                      <td className="py-3 text-center font-bold text-base">{log.totalPieces}</td>
                      <td className="py-3 text-right text-gray-600 text-sm font-bold">₹{log.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {periodPayments.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4 bg-emerald-50 p-2 rounded">Payment Advances Log</h3>
              <table className="w-full text-sm font-mono">
                <thead className="border-b border-dashed border-gray-300 text-left text-gray-500 text-[10px]">
                  <tr>
                    <th className="py-2 font-normal uppercase tracking-widest">Date / Details</th>
                    <th className="py-2 font-normal uppercase tracking-widest text-right">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-gray-200">
                  {periodPayments.map(log => (
                    <tr key={log.id}>
                      <td className="py-3 pr-2">
                        <div className="text-[9px] text-gray-400 mb-0.5">{log.date}</div>
                        <div className="font-bold text-gray-900 font-sans text-xs">{log.note || 'Cash Payout'}</div>
                      </td>
                      <td className="py-3 text-right text-emerald-600 font-bold text-sm">- ₹{log.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className={`grid ${printFormat === 'thermal' ? 'adjust-grid grid-cols-2 gap-2 mb-6' : 'grid-cols-2 md:grid-cols-4 gap-4 mb-8'} border-t-2 border-black pt-6`}>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200"><div className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-1">Pieces</div><div className="text-lg font-black">{piecesPeriod}</div></div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200"><div className="text-[9px] uppercase tracking-widest font-bold text-gray-400 mb-1">Earned</div><div className="text-lg font-black text-gray-900">₹{earnedPeriod}</div></div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100"><div className="text-[9px] uppercase tracking-widest font-bold text-emerald-600/70 mb-1">Cash Paid</div><div className="text-lg font-black text-emerald-700">₹{paidPeriod}</div></div>
            <div className={`${periodBalance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'} p-3 rounded-xl border`}><div className={`text-[9px] uppercase tracking-widest font-bold ${periodBalance > 0 ? 'text-orange-600/70' : 'text-gray-400'} mb-1`}>Period Balance</div><div className={`text-lg font-black ${periodBalance > 0 ? 'text-orange-600' : 'text-gray-900'}`}>₹{periodBalance}</div></div>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tailor Authorization</h3>
            <div className={`bg-gray-50 rounded-lg overflow-hidden border border-gray-300 relative mx-auto w-full ${printFormat === 'thermal' ? 'h-24' : 'max-w-md h-40'} print:bg-white print:border-black`}>
               <canvas ref={canvasRef} width={400} height={160} className="w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
               {!signatureLocked && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-300 font-mono text-sm print:hidden"><PenTool size={20} className="mr-2" /> Sign Here</div>}
            </div>
            <div className="mt-4 flex justify-center gap-4 print:hidden">
              <button onClick={clearSignature} className="text-xs font-bold text-gray-500 hover:text-gray-800 px-4 py-2 uppercase tracking-widest">Clear</button>
              <button onClick={() => setSignatureLocked(true)} className="bg-black text-white text-xs font-bold px-6 py-2 rounded-lg uppercase tracking-widest">Lock Signature</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center text-[#cdfc4c] z-50">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <div className="font-bold tracking-widest text-sm uppercase">Loading Cloud Data</div>
        {showLocalOverride && (
          <button onClick={forceLocalMode} className="mt-8 text-gray-500 hover:text-white text-xs underline font-mono">
            Force Offline Mode
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans flex flex-col m-0 p-0 overflow-x-hidden pb-28 md:pb-28">
      
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in">
          <div className={`px-6 py-3 rounded-full shadow-2xl font-bold text-sm tracking-wide ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-[#cdfc4c] text-black'}`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* FULL WIDTH HEADER */}
      <header className="bg-[#022c22] border-b border-[#064e3b] px-6 py-4 flex items-center justify-between sticky top-0 z-40 w-full print:hidden shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center rounded-lg"><Scissors size={18} /></div>
          <h1 className="text-xl font-black tracking-tight text-white hidden sm:block">Poshakh</h1>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-[#cdfc4c] text-black text-[10px] font-black tracking-widest uppercase rounded-full">
            <RefreshCw size={10} className={useLocalMode ? "" : "animate-spin-slow"} /> 
            {useLocalMode ? 'LOCAL MODE' : 'CLOUD ACTIVE'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block"><div className="text-sm font-bold text-white">Admin</div><div className="text-[10px] text-green-500 font-bold tracking-widest uppercase">Workspace</div></div>
          <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-green-400 border border-green-700"><User size={18} /></div>
        </div>
      </header>

      {/* MAIN CONTENT AREA - FULL WIDTH & PADDED FOR SCROLLING */}
      <main className="flex-1 w-full bg-[#0a0a0a] p-4 md:p-8 print:p-0 print:bg-white transition-all">
        {activeTab === 'ledger' && renderLedger()}
        {activeTab === 'add-batch' && renderAddBatch()}
        {activeTab === 'pay' && renderAddPay()}
        {activeTab === 'sign-off' && renderSignOff()}
        {activeTab === 'setup' && renderSetup()}
      </main>

      {/* BOTTOM NAVIGATION - FIXED & WIDE */}
      <nav className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md border-t border-gray-900 pb-safe z-50 print:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center h-20 w-full max-w-5xl mx-auto px-4">
          <button onClick={() => setActiveTab('ledger')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'ledger' ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-gray-300'}`}>
            <Wallet size={20} className={activeTab === 'ledger' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Ledger</span>
          </button>
          <button onClick={() => { setActiveTab('add-batch'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'add-batch' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Shirt size={20} className={activeTab === 'add-batch' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Add Batch</span>
          </button>
          <button onClick={() => { setActiveTab('pay'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'pay' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <IndianRupee size={20} className={activeTab === 'pay' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Pay</span>
          </button>
          <button onClick={() => setActiveTab('sign-off')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'sign-off' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <PenTool size={20} className={activeTab === 'sign-off' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Sign-Off</span>
          </button>
          <button onClick={() => setActiveTab('setup')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'setup' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Settings size={20} className={activeTab === 'setup' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Setup</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
