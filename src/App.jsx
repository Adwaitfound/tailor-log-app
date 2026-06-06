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

// Your Real Firebase Config
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
  // --- CORE STATE ---
  const [entries, setEntries] = useState([]);
  const [tailors, setTailors] = useState(["Sajid", "Imran"]);
  // Products are now objects to support images: { name: "...", image: "..." }
  const [products, setProducts] = useState([
    { name: "Wrap Around Dress", image: "" }, 
    { name: "Kalamkari Top", image: "" }
  ]);
  
  // UI & Network State
  const [activeTab, setActiveTab] = useState('ledger');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(false); 
  
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

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);

  useEffect(() => {
    let unsubscribeLedger;
    let unsubscribeConfig;

    const loadLocalData = () => {
      const localLedger = JSON.parse(localStorage.getItem('poshakh_ledger') || '[]');
      const localConfig = JSON.parse(localStorage.getItem('poshakh_config') || 'null');
      
      setEntries(localLedger);
      if (localConfig) {
        setTailors(localConfig.tailors || []);
        
        // Handle legacy string arrays or new object arrays
        let loadedProducts = [];
        if (localConfig.products && localConfig.products.length > 0) {
           if (typeof localConfig.products[0] === 'string') {
               loadedProducts = localConfig.products.map(p => ({ name: p, image: '' }));
           } else {
               loadedProducts = localConfig.products;
           }
        }
        setProducts(loadedProducts);

        setSetupForm({
          tailorsText: (localConfig.tailors || []).join('\n'),
          productsText: loadedProducts.map(p => p.image ? `${p.name}\t${p.image}` : p.name).join('\n')
        });
      } else {
        setSetupForm({
          tailorsText: tailors.join('\n'),
          productsText: products.map(p => p.name).join('\n')
        });
      }
      setLoading(false);
    };

    // We bypass auth entirely and query the DB directly since rules are open!
    try {
      unsubscribeLedger = onSnapshot(collection(db, 'ledger'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setEntries(data);
        setUseLocalMode(false);
        setLoading(false);
      }, (err) => {
        console.error("Firebase Read Error:", err);
        setUseLocalMode(true);
        loadLocalData();
      });

      unsubscribeConfig = onSnapshot(doc(db, 'config', 'setup'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTailors(data.tailors || []);
          
          let loadedProducts = [];
          if (data.products && data.products.length > 0) {
             if (typeof data.products[0] === 'string') {
                 loadedProducts = data.products.map(p => ({ name: p, image: '' }));
             } else {
                 loadedProducts = data.products;
             }
          }
          setProducts(loadedProducts);

          setSetupForm({
            tailorsText: (data.tailors || []).join('\n'),
            productsText: loadedProducts.map(p => p.image ? `${p.name}\t${p.image}` : p.name).join('\n')
          });
          
          setProdForm(prev => ({ ...prev, tailor: prev.tailor || data.tailors?.[0] || '', product: prev.product || loadedProducts?.[0]?.name || '' }));
          setPayForm(prev => ({ ...prev, tailor: prev.tailor || data.tailors?.[0] || '' }));
        }
      }, (err) => {
        console.error("Firebase Config Error:", err);
      });

    } catch (err) {
      console.error("Connection failed", err);
      setUseLocalMode(true);
      loadLocalData();
    }

    // Try auth quietly in background just in case
    signInAnonymously(auth).catch(() => {});

    return () => {
      if (unsubscribeLedger) unsubscribeLedger();
      if (unsubscribeConfig) unsubscribeConfig();
    };
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const syncLocal = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const handleProdSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setProdForm(prev => ({
      ...prev,
      sizes: { ...prev.sizes, [size]: numValue }
    }));
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.tailor || !prodForm.product) return showToast("Select tailor and product.", "error");

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
        } else {
          newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
        }
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
        showToast(editingEntryId ? "Local log updated!" : "Local batch logged!");
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
        showToast(editingEntryId ? "Local payment updated!" : "Local payment recorded!");
      } else {
        if (editingEntryId) {
          await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
          showToast("Cloud payment updated!");
        } else {
          await addDoc(collection(db, 'ledger'), entryData);
          showToast("Cloud payment recorded!");
        }
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
        showToast("Entry deleted locally.");
      } else {
        await deleteDoc(doc(db, 'ledger', id));
        showToast("Cloud entry deleted.");
      }
      setDeletingId(null);
    } catch (err) {
      showToast("Failed to delete.", "error");
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
    
    // Parse Product Name + Image URL (separated by tab or comma)
    const newProducts = setupForm.productsText.split('\n').filter(p => p.trim()).map(line => {
      let parts = line.split('\t'); // Excel copy-paste uses tabs
      if (parts.length === 1) parts = line.split(','); // Fallback to comma
      return {
        name: parts[0].trim(),
        image: parts[1] ? parts[1].trim() : ''
      };
    });

    try {
      if (useLocalMode) {
        setTailors(newTailors);
        setProducts(newProducts);
        syncLocal('poshakh_config', { tailors: newTailors, products: newProducts });
        showToast("Configuration saved locally!");
      } else {
        await setDoc(doc(db, 'config', 'setup'), {
          tailors: newTailors, products: newProducts, updatedAt: new Date().toISOString()
        });
        showToast("Configuration saved to Cloud!");
      }
    } catch (err) {
      showToast("Failed to save setup.", "error");
    }
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

  const handleDownloadReport = () => {
    const filtered = entries.filter(e => {
      const d = new Date(e.date);
      const start = new Date(reportForm.startDate);
      const end = new Date(reportForm.endDate);
      const dateMatch = d >= start && d <= end;
      const tailorMatch = reportForm.tailor === 'All' || e.tailor === reportForm.tailor;
      return dateMatch && tailorMatch;
    });

    if (filtered.length === 0) {
      return showToast("No data found for this date range.", "error");
    }

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
        if (pieces > 0 || paid > 0) {
          csvContent += `${t},${pieces},${earned},${paid},${pending}\n`;
        }
      });
    } else if (reportForm.type === 'production') {
      csvContent = "Product,Total Pieces Stitched,Total Value\n";
      const productStats = {};
      filtered.filter(e => e.type === 'production').forEach(e => {
        if (!productStats[e.product]) productStats[e.product] = { pieces: 0, value: 0 };
        productStats[e.product].pieces += e.totalPieces;
        productStats[e.product].value += e.amount;
      });
      Object.entries(productStats).forEach(([prod, stats]) => {
        csvContent += `"${prod}",${stats.pieces},${stats.value}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report Downloaded Successfully!");
  };

  // Find image for current selected product in Add Batch
  const currentSelectedProductImage = useMemo(() => {
    const prodObj = products.find(p => p.name === prodForm.product);
    return prodObj ? prodObj.image : '';
  }, [prodForm.product, products]);

  const renderLedger = () => (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Financial Overview</h2>
          <p className="text-gray-400 text-sm mt-1">Real-time ledger and balances.</p>
        </div>
        <select 
          value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)}
          className="bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"
        >
          <option value="All">All Tailors Combined</option>
          {tailors.map(t => <option key={t} value={t}>{t} Only</option>)}
        </select>
      </div>

      <div className="bg-[#cdfc4c] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl">
        <div>
          <div className="text-black/60 text-xs font-bold uppercase tracking-wider mb-2">Total Pending Payout</div>
          <div className="text-5xl md:text-7xl font-black text-black tracking-tighter">₹{pendingBalance.toLocaleString()}</div>
        </div>
        <div className="mt-6 md:mt-0 md:text-right">
           <div className="text-black/60 text-xs font-bold uppercase tracking-wider mb-2">Pieces Stitched</div>
           <div className="text-2xl md:text-3xl font-bold text-black">{totals.pieces} <span className="text-lg font-medium opacity-60">Items</span></div>
        </div>
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
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Tailor</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4 text-right">Credit (+)</th>
                  <th className="px-6 py-4 text-right">Debit (-)</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredEntries.map((entry) => {
                  // Find image for this entry
                  const prodObj = products.find(p => p.name === entry.product);
                  const entryImage = prodObj ? prodObj.image : '';

                  return (
                    <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">{entry.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-white">{entry.tailor}</td>
                      <td className="px-6 py-4">
                        {entry.type === 'production' ? (
                          <div className="flex items-center gap-3">
                            {entryImage ? (
                              <img src={entryImage} alt={entry.product} className="w-10 h-10 rounded-md object-cover border border-gray-700 bg-gray-900" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-gray-800 border border-gray-700 flex items-center justify-center">
                                <Shirt size={16} className="text-gray-500" />
                              </div>
                            )}
                            <div>
                              <div className="text-white font-semibold">{entry.product}</div>
                              <div className="text-xs text-gray-500 mt-1">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-md bg-sky-900/30 border border-sky-800/50 flex items-center justify-center">
                                <Wallet size={16} className="text-sky-400" />
                             </div>
                             <div>
                                <div className="text-sky-400 font-semibold">Cash Payout</div>
                                {entry.note && <div className="text-xs text-gray-500 mt-1">{entry.note}</div>}
                             </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">{entry.type === 'production' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-sky-400">{entry.type === 'payment' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 text-right w-32">
                        {deletingId === entry.id ? (
                          <div className="flex justify-end items-center gap-3">
                            <button onClick={() => deleteEntry(entry.id)} className="text-rose-500 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded-lg hover:bg-rose-500/20">Delete</button>
                            <button onClick={() => setDeletingId(null)} className="text-gray-400 font-bold text-xs hover:text-white">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-4 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(entry)} className="text-gray-400 hover:text-white" title="Edit"><Edit2 size={16} /></button>
                            <button onClick={() => setDeletingId(entry.id)} className="text-gray-500 hover:text-rose-500" title="Delete"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                  <span className="truncate font-medium {prodForm.product ? 'text-white' : 'text-gray-500'}">
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
          <button type="submit" className="w-full py-4 bg-[#cdfc4c] text-black hover:bg-[#b5e638] font-black tracking-wide rounded-xl transition-all shadow-lg shadow-[#cdfc4c]/10">{editingEntryId ? 'Update Batch' : 'Save Batch'}</button>
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
          <button type="submit" className="w-full flex items-center justify-center gap-2 py-4 bg-sky-500 hover:bg-sky-400 text-white font-black tracking-wide rounded-xl transition-all shadow-lg shadow-sky-500/10"><Wallet size={18} /> {editingEntryId ? 'Update Payment' : 'Confirm Payment'}</button>
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
    const today = new Date().toISOString().split('T')[0];
    const targetTailor = selectedTailorFilter === 'All' ? tailors[0] : selectedTailorFilter;
    const todaysLog = entries.filter(e => e.tailor === targetTailor && e.date === today && e.type === 'production');
    const todaysPay = entries.filter(e => e.tailor === targetTailor && e.date === today && e.type === 'payment');
    const earnedToday = todaysLog.reduce((sum, e) => sum + e.amount, 0);
    const paidToday = todaysPay.reduce((sum, e) => sum + e.amount, 0);
    const piecesToday = todaysLog.reduce((sum, e) => sum + e.totalPieces, 0);

    return (
      <div className="w-full max-w-3xl mx-auto pb-12 print:pb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="print:hidden mb-6 flex items-center justify-between">
          <select value={selectedTailorFilter === 'All' ? tailors[0] : selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none">{tailors.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-colors"><Printer size={16} /> Print</button>
        </div>
        <div className="bg-white text-black p-8 md:p-12 rounded-2xl print:p-0 print:w-full print:shadow-none shadow-2xl">
          <div className="text-center mb-8 border-b-2 border-black pb-6"><h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Poshakh</h1><p className="text-gray-500 font-medium">Daily Production Receipt</p></div>
          <div className="flex justify-between mb-8 font-mono text-sm border-b border-gray-200 pb-4">
            <div><div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Date</div><div className="font-bold text-lg">{today}</div></div>
            <div className="text-right"><div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Tailor</div><div className="font-bold text-lg">{targetTailor}</div></div>
          </div>
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Production Log</h3>
            {todaysLog.length === 0 ? <p className="text-gray-400 italic">No items logged today.</p> : (
              <table className="w-full text-sm"><thead className="border-b border-gray-200 text-left"><tr><th className="py-2">Style</th><th className="py-2 text-center">Qty</th><th className="py-2 text-right">Value</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{todaysLog.map(log => (<tr key={log.id}><td className="py-3">{log.product}</td><td className="py-3 text-center">{log.totalPieces}</td><td className="py-3 text-right">₹{log.amount}</td></tr>))}</tbody></table>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-12">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="text-[10px] uppercase font-bold text-gray-500">Pieces</div><div className="text-2xl font-black">{piecesToday}</div></div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="text-[10px] uppercase font-bold text-gray-500">Earned</div><div className="text-2xl font-black text-green-700">₹{earnedToday}</div></div>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Tailor Signature</h3>
            <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-300 relative mx-auto w-full max-w-md h-40 print:bg-white print:border-black">
               <canvas ref={canvasRef} width={400} height={160} className="w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
               {!signatureLocked && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-400 opacity-50 print:hidden"><PenTool size={32} className="mr-2" /> Sign Here</div>}
            </div>
            <div className="mt-4 flex justify-center gap-4 print:hidden">
              <button onClick={clearSignature} className="text-xs font-bold text-gray-500 hover:text-gray-800 px-4 py-2">Clear</button>
              <button onClick={() => setSignatureLocked(true)} className="bg-black text-white text-xs font-bold px-6 py-2 rounded-lg">Lock Signature</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center text-[#cdfc4c]">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <div className="font-bold tracking-widest text-sm mb-6">CONNECTING TO POSHAKH CLOUD</div>
        <button onClick={() => { setUseLocalMode(true); setLoading(false); }} className="text-gray-500 text-xs underline hover:text-white">Force Offline Mode</button>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        :root, html, body, #root { width: 100vw !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; overflow-x: hidden !important; }
      `}} />
      <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans flex flex-col m-0 p-0 overflow-x-hidden">
        
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in">
            <div className={`px-6 py-3 rounded-full shadow-2xl font-bold text-sm tracking-wide ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-[#cdfc4c] text-black'}`}>
              {toast.msg}
            </div>
          </div>
        )}

        {/* FULL WIDTH HEADER */}
        <header className="bg-[#022c22] border-b border-[#064e3b] px-6 py-4 flex items-center justify-between sticky top-0 z-40 w-full print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-white text-black flex items-center justify-center rounded-lg shrink-0"><Scissors size={18} /></div>
            <h1 className="text-xl font-black tracking-tight text-white hidden sm:block">Poshakh</h1>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-[#cdfc4c] text-black text-[10px] font-black tracking-widest uppercase rounded-full shrink-0">
              <RefreshCw size={10} className={useLocalMode ? "" : "animate-spin-slow"} /> 
              {useLocalMode ? 'LOCAL MODE' : 'CLOUD ACTIVE'}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block"><div className="text-sm font-bold text-white">Admin</div><div className="text-[10px] text-green-500 font-bold tracking-widest uppercase">Workspace</div></div>
            <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-green-400 border border-green-700 shrink-0"><User size={18} /></div>
          </div>
        </header>

        {/* MAIN CONTENT AREA - FULL WIDTH & PADDED FOR SCROLLING */}
        <main className="flex-1 w-full bg-[#0a0a0a] p-4 md:p-8 pb-32 print:p-0 print:bg-white">
          {activeTab === 'ledger' && renderLedger()}
          {activeTab === 'add-batch' && renderAddBatch()}
          {activeTab === 'pay' && renderAddPay()}
          {activeTab === 'sign-off' && renderSignOff()}
          {activeTab === 'setup' && renderSetup()}
        </main>

        {/* BOTTOM NAVIGATION - FIXED & WIDE */}
        <nav className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md border-t border-gray-900 pb-safe z-50 print:hidden">
          <div className="flex justify-around items-center h-20 w-full max-w-5xl mx-auto px-4">
            <button onClick={() => setActiveTab('ledger')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'ledger' ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-gray-300'}`}>
              <Wallet size={20} className={activeTab === 'ledger' ? "opacity-100" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Ledger</span>
            </button>
            <button onClick={() => { setActiveTab('add-batch'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'add-batch' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Shirt size={20} className={activeTab === 'add-batch' ? "opacity-100" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Add Batch</span>
            </button>
            <button onClick={() => { setActiveTab('pay'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'pay' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <IndianRupee size={20} className={activeTab === 'pay' ? "opacity-100" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Pay</span>
            </button>
            <button onClick={() => setActiveTab('sign-off')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'sign-off' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <PenTool size={20} className={activeTab === 'sign-off' ? "opacity-100" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Sign-Off</span>
            </button>
            <button onClick={() => setActiveTab('setup')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'setup' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Settings size={20} className={activeTab === 'setup' ? "opacity-100" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Setup</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
