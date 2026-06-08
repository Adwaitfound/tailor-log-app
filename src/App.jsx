import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors, User, Shirt, IndianRupee, Trash2, Camera, Loader2,
  Wallet, FileText, Settings, Edit2, PenTool, Printer, RefreshCw, Image as ImageIcon, AlertCircle, ChevronDown, Download, Lock, LogOut, CheckCircle, Clock, ListTodo, Search, Plus
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  deleteDoc, doc, setDoc, updateDoc, query, orderBy
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

// Custom Poshakh Brand Logo Component
const PoshakhLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="7" r="5.5" fill="#9b1c1c" />
    <path d="M4 14.5H20" stroke="#064e3b" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="12" cy="20.5" r="2.5" fill="#9b1c1c" />
  </svg>
);

const ADMIN_PIN = "1234";

export default function App() {
  // --- AUTH & ROLES ---
  const [role, setRole] = useState(null); 
  const [loginStep, setLoginStep] = useState('select'); 
  const [pinInput, setPinInput] = useState('');

  // --- CORE STATE ---
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [products, setProducts] = useState([]);
  
  // UI & Network State
  const [activeTab, setActiveTab] = useState('ledger');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(false);
  
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null); 
  const [cancellingTaskId, setCancellingTaskId] = useState(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isTaskProductDropdownOpen, setIsTaskProductDropdownOpen] = useState(false); 
  const [productSearch, setProductSearch] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  const [ledgerSortOrder, setLedgerSortOrder] = useState('desc'); 
  const [ledgerFilterType, setLedgerFilterType] = useState('all'); 
  const [ledgerViewMode, setLedgerViewMode] = useState('detailed'); 
  const [dashboardTimeFilter, setDashboardTimeFilter] = useState('all'); 

  // NEW: Dedicated state for manual task assignment
  const [taskForm, setTaskForm] = useState({
    product: '',
    size: '',
    quantity: 1
  });

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

  const [setupForm, setSetupForm] = useState({ tailorsText: '', productsText: '' });
  const [reportForm, setReportForm] = useState({ type: 'ledger', startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], tailor: 'All' });

  // Calculate Friday-Thursday Pay Cycles
  const getPayCycleDates = (offsetWeeks = 0) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 5 is Friday
    const daysSinceFriday = (dayOfWeek + 2) % 7; 
    
    const cycleStart = new Date(today);
    cycleStart.setDate(today.getDate() - daysSinceFriday - (offsetWeeks * 7));
    
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + 6);
    
    return {
      start: cycleStart.toISOString().split('T')[0],
      end: cycleEnd.toISOString().split('T')[0]
    };
  };

  const currentCycle = getPayCycleDates(0);
  const [signOffStartDate, setSignOffStartDate] = useState(currentCycle.start);
  const [signOffEndDate, setSignOffEndDate] = useState(currentCycle.end);
  const [printFormat, setPrintFormat] = useState('a4'); 

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #root { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
      body, html { width: 100%; margin: 0; padding: 0; overflow-x: hidden; background-color: #0a0a0a; }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
    `;
    document.head.appendChild(style);

    const savedRole = localStorage.getItem('poshakh_role');
    if (savedRole) {
      setRole(savedRole);
      if (savedRole === 'staff') setActiveTab('tasks');
    }

    let unsubscribeLedger;
    let unsubscribeConfig;
    let unsubscribeTasks;

    const loadLocalData = () => {
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
        setProdForm(prev => ({ ...prev, tailor: localConfig?.tailors?.[0] || '', product: localConfig?.products?.[0]?.name || '' }));
        setPayForm(prev => ({ ...prev, tailor: localConfig?.tailors?.[0] || '' }));
      }
      setLoading(false);
    };

    const fetchFirebaseDirectly = () => {
      try {
        unsubscribeLedger = onSnapshot(collection(db, 'ledger'), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setEntries(data);
          setLoading(false);
        }, (err) => { setUseLocalMode(true); loadLocalData(); });

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
        });

        unsubscribeTasks = onSnapshot(collection(db, 'priority_tasks'), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const activeTasks = data.filter(t => t.status === 'pending' || t.status === 'rejected').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          setTasks(activeTasks);
        });

      } catch (err) { setUseLocalMode(true); loadLocalData(); }
    };

    fetchFirebaseDirectly();

    return () => {
      if (unsubscribeLedger) unsubscribeLedger();
      if (unsubscribeConfig) unsubscribeConfig();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, []);

  const forceLocalMode = () => {
    setUseLocalMode(true);
    const localLedger = JSON.parse(localStorage.getItem('poshakh_ledger') || '[]');
    setEntries(localLedger);
    setLoading(false);
    showToast("Switched to Local Offline Mode", "error");
  };

  const handleLogin = (selectedRole) => {
    if (selectedRole === 'staff') {
      setRole('staff'); setActiveTab('tasks'); localStorage.setItem('poshakh_role', 'staff');
    } else if (selectedRole === 'admin') {
      if (pinInput === ADMIN_PIN) {
        setRole('admin'); setActiveTab('ledger'); localStorage.setItem('poshakh_role', 'admin'); setPinInput('');
      } else { showToast("Incorrect PIN", "error"); setPinInput(''); }
    }
  };

  const handleLogout = () => { setRole(null); setLoginStep('select'); localStorage.removeItem('poshakh_role'); };
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const syncLocal = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  const compressImageToBase64 = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 500; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
      };
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleProdSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setProdForm(prev => ({ ...prev, sizes: { ...prev.sizes, [size]: numValue } }));
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
          const existingEntry = newEntries.find(e => e.id === editingEntryId);
          newEntries = newEntries.map(e => e.id === editingEntryId ? { ...existingEntry, ...entryData, id: editingEntryId } : e);
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
      if (role === 'admin') setActiveTab('ledger');
    } catch (err) {
      showToast("Failed to save.", "error");
    }
  };

  const handleCompleteTaskGroup = async (group) => {
    if (!prodForm.tailor) return showToast("Please select your name (Tailor) at the top of the 'Add Batch' tab first!", "error");
    if (!imageFile && !useLocalMode) return showToast("Please attach a QC photo to mark as stitched!", "error");
    
    const rate = group.pieceRate || 250;
    const totalAmount = group.totalQuantity * rate;
    setIsUploading(true);

    try {
      let finalImageData = null;
      if (imageFile && !useLocalMode) finalImageData = await compressImageToBase64(imageFile);

      if (!useLocalMode) {
        for (const taskId of group.taskIds) {
          await updateDoc(doc(db, 'priority_tasks', taskId), {
            status: 'pending_review',
            completedBy: prodForm.tailor,
            completedAt: new Date().toISOString()
          });
        }
      } else {
        let newTasks = [...tasks];
        group.taskIds.forEach(id => {
          newTasks = newTasks.filter(t => t.id !== id);
        });
        setTasks(newTasks);
      }

      const entryData = {
        type: 'production',
        date: new Date().toISOString().split('T')[0],
        tailor: prodForm.tailor,
        product: group.product,
        sizes: group.sizes,
        totalPieces: group.totalQuantity,
        pieceRate: rate,
        amount: totalAmount,
        imageUrl: finalImageData,
        qcStatus: 'pending',
        timestamp: new Date().toISOString(),
        note: group.status === 'rejected' ? 'Alteration Fixed' : 'Priority Queue'
      };

      if (useLocalMode) {
        const newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...entries];
        setEntries(newEntries);
        localStorage.setItem('poshakh_ledger', JSON.stringify(newEntries));
      } else {
        await addDoc(collection(db, 'ledger'), entryData);
      }
      
      group.taskIds.forEach(taskId => {
         const t = tasks.find(x => x.id === taskId);
         if(t) {
           fetch('https://app.poshakhfabrics.com/api/tailor-webhook', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ taskId: t.id, product: t.product, size: t.size, quantity: t.quantity, tailor: prodForm.tailor })
           }).catch(() => {});
         }
      });

      showToast(`Sent to Admin for QC Review!`);
      setImageFile(null); setImagePreview(null);
    } catch(err) { showToast("Error completing task", "error"); }
    finally { setIsUploading(false); }
  };

  const confirmCancelTaskGroup = async (group) => {
    try {
      if (useLocalMode) {
        setTasks(tasks.filter(t => !group.taskIds.includes(t.id)));
        showToast("Tasks cancelled locally.");
      } else {
        for (const taskId of group.taskIds) {
          await deleteDoc(doc(db, 'priority_tasks', taskId));
        }
        showToast("Tasks cancelled and removed from queue.");
      }
      setCancellingTaskId(null);
    } catch (err) { showToast("Failed to cancel tasks.", "error"); }
  };

  const handleRejectBatch = async (entry) => {
    setRejectingId(entry.id);
  };

  const confirmRejectBatch = async (entry) => {
    setRejectingId(null);
    
    let mainSize = 'M';
    if(entry.sizes) {
       const activeSizes = Object.entries(entry.sizes).filter(([_, qty]) => Number(qty) > 0);
       if(activeSizes.length > 0) mainSize = activeSizes[0][0];
    }

    try {
      if (useLocalMode) {
        let newEntries = entries.map(e => e.id === entry.id ? { ...e, qcStatus: 'rejected', rejectedAt: new Date().toISOString() } : e);
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
        
        let newTasks = [...tasks, {
          id: crypto.randomUUID(), product: entry.product, size: mainSize, quantity: entry.totalPieces, pieceRate: entry.pieceRate, status: "rejected", note: "QC REJECTED - ALTERATION REQUIRED", createdAt: new Date().toISOString()
        }];
        setTasks(newTasks);
        showToast(`Batch rejected and returned to ${entry.tailor}'s Tasks!`, "error");
      } else {
        await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'rejected', rejectedAt: new Date().toISOString() });
        
        await addDoc(collection(db, 'priority_tasks'), {
          product: entry.product, 
          size: mainSize, 
          quantity: entry.totalPieces, 
          pieceRate: entry.pieceRate, 
          status: "rejected", 
          note: "QC REJECTED - ALTERATION REQUIRED", 
          createdAt: new Date().toISOString()
        });
        showToast(`Batch rejected and returned to ${entry.tailor}'s Tasks!`, "error");
      }
    } catch (err) { showToast("Failed to reject.", "error"); }
  };
  
  const handleApproveBatch = async (entry) => {
    try {
      if (useLocalMode) {
        let newEntries = entries.map(e => e.id === entry.id ? { ...e, qcStatus: 'approved', approvedAt: new Date().toISOString() } : e);
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
        showToast(`Batch approved!`);
      } else {
        await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'approved', approvedAt: new Date().toISOString() });
        showToast(`Batch approved!`);
      }
    } catch (err) { showToast("Failed to approve.", "error"); }
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
        if (editingEntryId) newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
        else newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
        setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
        showToast("Local payment saved!");
      } else {
        if (editingEntryId) await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
        else await addDoc(collection(db, 'ledger'), entryData);
        showToast("Cloud payment saved!");
      }
      setEditingEntryId(null); setPayForm(prev => ({ ...prev, amount: '', note: '' })); setActiveTab('ledger');
    } catch (err) { showToast("Failed to save.", "error"); }
  };

  const deleteEntry = async (id) => {
    try {
      if (useLocalMode) {
        const newEntries = entries.filter(e => e.id !== id);
        setEntries(newEntries); syncLocal('poshakh_ledger', newEntries); showToast("Deleted locally.");
      } else {
        await deleteDoc(doc(db, 'ledger', id)); showToast("Cloud record deleted.");
      }
      setDeletingId(null);
    } catch (err) { showToast("Delete failed.", "error"); }
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
      setPayForm({ date: entry.date, tailor: entry.tailor, amount: entry.amount, note: entry.note || '' });
      setActiveTab('pay');
    }
  };

  const saveConfig = async () => {
    const newTailors = setupForm.tailorsText.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = setupForm.productsText.split('\n').map(line => {
      const parts = line.split(/[\t,]/);
      return { name: parts[0]?.trim() || '', image: parts.slice(1).join(',')?.trim() || null };
    }).filter(p => p.name);

    try {
      if (useLocalMode) {
        setTailors(newTailors); setProducts(newProducts);
        syncLocal('poshakh_config', { tailors: newTailors, products: newProducts });
        showToast("Setup saved locally!");
      } else {
        await setDoc(doc(db, 'config', 'setup'), { tailors: newTailors, products: newProducts, updatedAt: new Date().toISOString() });
        showToast("Cloud setup saved!");
      }
    } catch (err) { showToast("Failed to save setup.", "error"); }
  };

  const timeFilteredEntries = useMemo(() => {
    if (dashboardTimeFilter === 'all') return entries;
    const current = getPayCycleDates(0);
    const last = getPayCycleDates(1);
    
    return entries.filter(e => {
      const d = new Date(e.date);
      if (dashboardTimeFilter === 'current_cycle') return d >= new Date(current.start) && d <= new Date(current.end);
      if (dashboardTimeFilter === 'last_cycle') return d >= new Date(last.start) && d <= new Date(last.end);
      return true;
    });
  }, [entries, dashboardTimeFilter]);

  const tailorFilteredEntries = useMemo(() => {
    if (selectedTailorFilter === 'All') return timeFilteredEntries;
    return timeFilteredEntries.filter(e => e.tailor === selectedTailorFilter);
  }, [timeFilteredEntries, selectedTailorFilter]);

  const finalLedgerEntries = useMemo(() => {
    let result = [...tailorFilteredEntries];
    if (ledgerFilterType === 'credits') result = result.filter(e => e.type === 'production');
    if (ledgerFilterType === 'debits') result = result.filter(e => e.type === 'payment');
    
    result.sort((a, b) => {
      const dateA = new Date(a.date); const dateB = new Date(b.date);
      return ledgerSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [tailorFilteredEntries, ledgerFilterType, ledgerSortOrder]);

  const totals = useMemo(() => {
    return tailorFilteredEntries.reduce((acc, curr) => {
      if (curr.type === 'production' && curr.qcStatus !== 'rejected') { 
        acc.pieces += Number(curr.totalPieces) || 0; 
        acc.earned += Number(curr.amount) || 0; 
      }
      else if (curr.type === 'payment') { acc.paid += Number(curr.amount) || 0; }
      return acc;
    }, { pieces: 0, earned: 0, paid: 0 });
  }, [tailorFilteredEntries]);

  const pendingBalance = totals.earned - totals.paid;
  
  const unpaidPieces = useMemo(() => {
    if (pendingBalance <= 0) return 0;
    let balanceLeft = pendingBalance;
    let piecesToCover = 0;
    
    const recentProduction = [...entries]
      .filter(e => e.type === 'production' && e.qcStatus !== 'rejected' && (selectedTailorFilter === 'All' || e.tailor === selectedTailorFilter))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const item of recentProduction) {
      if (balanceLeft <= 0) break;
      const rate = Number(item.pieceRate) || 250;
      const piecesInItem = Number(item.totalPieces) || 0;
      
      const valueOfItem = piecesInItem * rate;
      if (balanceLeft >= valueOfItem) {
        piecesToCover += piecesInItem;
        balanceLeft -= valueOfItem;
      } else {
        const fractionalPieces = balanceLeft / rate;
        piecesToCover += fractionalPieces;
        balanceLeft = 0;
      }
    }
    return Math.floor(piecesToCover);
  }, [pendingBalance, entries, selectedTailorFilter]);

  const groupedByProduct = useMemo(() => {
    const groups = {};
    finalLedgerEntries.filter(e => e.type === 'production' && e.qcStatus !== 'rejected').forEach(e => {
      if (!groups[e.product]) groups[e.product] = { pieces: 0, value: 0, sizes: {} };
      groups[e.product].pieces += Number(e.totalPieces) || 0;
      groups[e.product].value += Number(e.amount) || 0;
      
      if(e.sizes) {
         Object.entries(e.sizes).forEach(([s, q]) => {
            const numQ = Number(q) || 0;
            if (numQ > 0) {
               if(!groups[e.product].sizes[s]) groups[e.product].sizes[s] = 0;
               groups[e.product].sizes[s] += numQ;
            }
         });
      }
    });
    return Object.entries(groups).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.value - a.value);
  }, [finalLedgerEntries]);

  const groupedByTailor = useMemo(() => {
    const groups = {};
    finalLedgerEntries.forEach(e => {
      if (!groups[e.tailor]) groups[e.tailor] = { pieces: 0, earned: 0, paid: 0 };
      if (e.type === 'production' && e.qcStatus !== 'rejected') {
        groups[e.tailor].pieces += Number(e.totalPieces) || 0;
        groups[e.tailor].earned += Number(e.amount) || 0;
      } else if (e.type === 'payment') {
        groups[e.tailor].paid += Number(e.amount) || 0;
      }
    });
    return Object.entries(groups).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.earned - a.earned);
  }, [finalLedgerEntries]);

  const filteredProductsDropdown = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const setToCurrentCycle = () => { const c = getPayCycleDates(0); setSignOffStartDate(c.start); setSignOffEndDate(c.end); clearSignature(); };
  const setToLastCycle = () => { const c = getPayCycleDates(1); setSignOffStartDate(c.start); setSignOffEndDate(c.end); clearSignature(); };

  const formatSizes = (sizes) => {
    if (!sizes) return '';
    const activeSizes = Object.entries(sizes).filter(([_, qty]) => Number(qty) > 0);
    if (activeSizes.length === 0) return '-';
    return activeSizes.map(([size, qty]) => `${size}:${qty}`).join(', ');
  };

  const handleDownloadReport = () => {
    if (finalLedgerEntries.length === 0) return showToast("No data found.", "error");
    let csvContent = ""; let filename = `poshakh_${reportForm.type}_${reportForm.startDate}_to_${reportForm.endDate}.csv`;

    if (reportForm.type === 'ledger') {
      csvContent = "Date,Tailor,Transaction Type,Product,Quantity,Rate,Credit (Earned),Debit (Paid),Notes,Status\n";
      finalLedgerEntries.forEach(e => {
        const type = e.type === 'production' ? 'Production' : 'Payment';
        const product = e.product ? `"${e.product}"` : '';
        const qty = e.totalPieces || ''; const rate = e.pieceRate || '';
        const credit = e.type === 'production' && e.qcStatus !== 'rejected' ? e.amount : (e.qcStatus === 'rejected' ? 0 : '');
        const debit = e.type === 'payment' ? e.amount : '';
        const note = e.note ? `"${e.note}"` : '';
        const status = e.qcStatus || '';
        csvContent += `${e.date},${e.tailor},${type},${product},${qty},${rate},${credit},${debit},${note},${status}\n`;
      });
    } else if (reportForm.type === 'settlement') {
      csvContent = "Tailor,Pieces Stitched,Total Earned,Total Paid,Pending Balance\n";
      groupedByTailor.forEach(t => csvContent += `${t.name},${t.pieces},${t.earned},${t.paid},${t.earned - t.paid}\n`);
    } else if (reportForm.type === 'production') {
      csvContent = "Product,Total Pieces Stitched,Total Value\n";
      groupedByProduct.forEach(p => csvContent += `"${p.name}",${p.pieces},${p.value}\n`);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast("Report Downloaded!");
  };

  const currentSelectedProductImage = useMemo(() => {
    const found = products.find(p => p.name === prodForm.product);
    return found ? found.image : null;
  }, [prodForm.product, products]);

  const currentSelectedTaskProductImage = useMemo(() => {
    const found = products.find(p => p.name === prodForm.product);
    return found ? found.image : null;
  }, [prodForm.product, products]);

  const getCoordinates = (e) => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    if (signatureLocked || !canvasRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || signatureLocked || !canvasRef.current) return;
    e.preventDefault(); 
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    if (!canvasRef.current) return;
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureLocked(false);
  };

  // --- RENDER FUNCTIONS ---
  const renderLogin = () => (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-2xl shadow-lg mx-auto mb-6"><PoshakhLogo size={36} /></div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Poshakh Sync</h1>
          <p className="text-gray-400 text-sm">Select your workspace to continue.</p>
        </div>
        {loginStep === 'select' ? (
          <div className="space-y-4">
            <button onClick={() => handleLogin('staff')} className="w-full bg-[#111] border border-gray-800 hover:border-gray-600 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
              <div className="w-12 h-12 rounded-full bg-gray-800 group-hover:bg-gray-700 flex items-center justify-center text-white transition-colors"><Shirt size={24} /></div>
              <div className="text-center"><div className="text-lg font-bold text-white">Tailor / Staff</div><div className="text-xs text-gray-500 mt-1">Log daily production batches</div></div>
            </button>
            <button onClick={() => setLoginStep('pin')} className="w-full bg-[#cdfc4c] hover:bg-[#b5e638] p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group shadow-lg shadow-[#cdfc4c]/10">
              <div className="w-12 h-12 rounded-full bg-black/10 group-hover:bg-black/20 flex items-center justify-center text-black transition-colors"><Lock size={24} /></div>
              <div className="text-center"><div className="text-lg font-bold text-black">Admin Dashboard</div><div className="text-xs text-black/60 mt-1">Full access & financial ledger</div></div>
            </button>
          </div>
        ) : (
          <div className="bg-[#111] border border-gray-800 p-8 rounded-3xl animate-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-white text-center mb-6">Enter Admin PIN</h2>
            <div className="flex flex-col gap-4">
              <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="****" className="w-full text-center tracking-[1em] font-black text-2xl py-4 bg-black border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none" autoFocus/>
              <button onClick={() => handleLogin('admin')} className="w-full py-4 bg-[#cdfc4c] text-black font-black tracking-wide rounded-xl">Unlock</button>
              <button onClick={() => { setLoginStep('select'); setPinInput(''); }} className="w-full py-3 text-gray-500 hover:text-white text-sm font-bold">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTasks = () => {
    const unfulfilledValue = tasks.reduce((sum, task) => sum + ((task.quantity || 1) * (task.pieceRate || 250)), 0);
    const unfulfilledItems = tasks.reduce((sum, task) => sum + (task.quantity || 1), 0);

    const groupedTasks = Object.values(tasks.reduce((acc, t) => {
      if (!acc[t.product]) {
        acc[t.product] = {
          id: t.product,
          product: t.product,
          totalQuantity: 0,
          sizes: {},
          taskIds: [],
          pieceRate: t.pieceRate || 250,
          status: t.status
        };
      }
      acc[t.product].totalQuantity += Number(t.quantity) || 1;
      const sizeKey = t.size || 'M';
      acc[t.product].sizes[sizeKey] = (acc[t.product].sizes[sizeKey] || 0) + (Number(t.quantity) || 1);
      acc[t.product].taskIds.push(t.id);
      if (t.status === 'rejected') acc[t.product].status = 'rejected';
      return acc;
    }, {}));

    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in">
        <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight text-rose-500 flex items-center justify-center gap-2"><ListTodo size={28}/> Priority Tasks</h2><p className="text-gray-400 mt-2">Urgent items out of stock on Shopify/Amazon.</p></div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#111] border border-gray-800 p-4 rounded-2xl"><div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Queue Size</div><div className="text-2xl font-black text-white">{unfulfilledItems} Items</div></div>
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl"><div className="text-[10px] uppercase font-bold text-rose-500 mb-1">Potential Earnings</div><div className="text-2xl font-black text-rose-500">₹{unfulfilledValue.toLocaleString()}</div></div>
        </div>

        {role === 'admin' && (
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-5 mb-8">
            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Plus size={16} className="text-rose-500"/> Assign Urgent Task</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="col-span-2 relative">
                <div className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-gray-400 cursor-pointer flex items-center justify-between" onClick={() => setIsTaskProductDropdownOpen(!isTaskProductDropdownOpen)}>
                  <span className="truncate">{taskForm.product || "Select Product..."}</span><ChevronDown size={14}/>
                </div>
                {isTaskProductDropdownOpen && (
                  <><div className="fixed inset-0 z-40" onClick={() => setIsTaskProductDropdownOpen(false)} /><div className="absolute z-50 w-full mt-1 bg-[#111] border border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar overflow-hidden">{products.map((p, i) => (<div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50" onClick={() => { setTaskForm({...taskForm, product: p.name}); setIsTaskProductDropdownOpen(false); }}>{p.image ? <img src={p.image} className="w-6 h-6 rounded-md object-cover bg-black" /> : <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center"><ImageIcon size={12} className="text-gray-600" /></div>}<span className="text-xs font-medium text-gray-200 truncate">{p.name}</span></div>))}</div></>
                )}
              </div>
              
              <select value={taskForm.size} onChange={(e) => setTaskForm({...taskForm, size: e.target.value})} className="px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none">
                <option value="">Size</option>{['XS', 'S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-gray-500 font-bold">Qty:</span>
                <input type="number" min="1" value={taskForm.quantity} onChange={(e) => setTaskForm({...taskForm, quantity: parseInt(e.target.value) || 1})} className="w-full pl-10 pr-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none" />
              </div>
              
              <button onClick={() => {
                if(!taskForm.product || !taskForm.size) return showToast("Select a product and size", "error");
                addDoc(collection(db, 'priority_tasks'), { product: taskForm.product, size: taskForm.size, quantity: taskForm.quantity, pieceRate: 250, status: 'pending', createdAt: new Date().toISOString() });
                setTaskForm({ product: '', size: '', quantity: 1 }); 
                showToast("Task Assigned!");
              }} className="col-span-2 md:col-span-1 bg-white text-black font-bold text-sm rounded-lg py-2 hover:bg-gray-200">Add to Queue</button>
            </div>
          </div>
        )}

        {!prodForm.tailor && role !== 'admin' && <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-sm font-bold text-center mb-6">Please go to "Add Batch" and select your name first!</div>}

        {groupedTasks.length === 0 ? (
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-12 text-center"><CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" /><h3 className="text-xl font-bold text-white mb-1">Queue is Empty!</h3></div>
        ) : (
          <div className="space-y-4">
            {groupedTasks.map(group => {
              const productInfo = products.find(p => p.name === group.product);
              return (
                <div key={group.id} className="bg-[#111] border border-rose-900/50 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                  
                  {role === 'admin' && (
                    cancellingTaskId === group.id ? (
                      <div className="absolute top-3 right-3 flex items-center gap-2 bg-[#0a0a0a] p-1.5 rounded-lg border border-gray-800 z-20 shadow-xl">
                        <span className="text-[10px] font-bold text-rose-500 uppercase px-1">Cancel Order?</span>
                        <button onClick={() => confirmCancelTaskGroup(group)} className="px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-black uppercase hover:bg-rose-600 transition-colors">Yes</button>
                        <button onClick={() => setCancellingTaskId(null)} className="px-3 py-1 bg-gray-700 text-white rounded text-[10px] font-black uppercase hover:bg-gray-600 transition-colors">No</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setCancellingTaskId(group.id)} 
                        className="absolute top-3 right-3 text-gray-500 hover:text-rose-500 transition-colors bg-black/50 p-1.5 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
                        title="Cancel Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    )
                  )}

                  {productInfo?.image ? <img src={productInfo.image} className="w-20 h-20 rounded-lg object-cover bg-black" /> : <div className="w-20 h-20 bg-black flex items-center justify-center"><ImageIcon className="text-gray-700"/></div>}
                  <div className="flex-1 text-center md:text-left">
                    <div className="text-[10px] text-rose-500 font-bold uppercase mb-1 flex justify-center md:justify-start gap-1"><Clock size={12}/> {group.status === 'rejected' ? 'REJECTED - START ALTERATION' : 'URGENT ORDER'}</div>
                    <h3 className="text-lg font-bold text-white leading-tight">{group.product}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                      {Object.entries(group.sizes).map(([s, qty]) => (
                        <span key={s} className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-md font-bold">{s}: {qty}</span>
                      ))}
                      <span className="bg-[#cdfc4c]/20 text-[#cdfc4c] text-xs px-2.5 py-1 rounded-md font-bold">Total: {group.totalQuantity}</span>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col gap-2">
                     <div className="relative w-full h-12 bg-black border border-gray-800 rounded-xl flex items-center justify-center overflow-hidden hover:border-[#cdfc4c] cursor-pointer">
                        <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        {imagePreview ? <span className="text-[#cdfc4c] font-bold text-xs">Photo Attached!</span> : <span className="text-gray-400 font-bold text-xs flex items-center gap-2"><Camera size={14}/> Add Photo</span>}
                     </div>
                     <button disabled={isUploading} onClick={() => handleCompleteTaskGroup(group)} className="w-full md:w-auto px-6 py-3 bg-[#cdfc4c] text-black font-black rounded-xl disabled:opacity-50">
                        {isUploading ? 'Uploading...' : 'Mark as Stitched'}
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
                  <div className="absolute z-50 w-full mt-2 bg-[#111] border border-gray-700 rounded-xl shadow-2xl max-h-[400px] flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-gray-800 bg-[#0a0a0a] relative">
                       <Search size={16} className="absolute left-6 top-6 text-gray-500" />
                       <input 
                         autoFocus
                         type="text" 
                         placeholder="Search products..." 
                         value={productSearch}
                         onChange={(e) => setProductSearch(e.target.value)}
                         className="w-full pl-10 pr-4 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none"
                       />
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                      {filteredProductsDropdown.map((p, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0"
                          onClick={() => {
                            setProdForm({...prodForm, product: p.name});
                            setIsProductDropdownOpen(false);
                            setProductSearch('');
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
                      {filteredProductsDropdown.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500">No products match "{productSearch}"</div>
                      )}
                    </div>
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
          
          <div className="pt-4 border-t border-gray-800">
             <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Quality Control</label>
             <div className="relative w-full h-32 bg-black border-2 border-dashed border-gray-800 rounded-xl flex items-center justify-center overflow-hidden hover:border-[#cdfc4c] transition-colors cursor-pointer">
                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {imagePreview ? (
                  <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="text-center text-gray-500 flex flex-col items-center"><Camera size={24} className="mb-2"/><span className="text-sm font-bold">Tap to add QC Photo</span></div>
                )}
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
          <button type="submit" disabled={isUploading} className="w-full py-4 bg-[#cdfc4c] text-black hover:bg-[#b5e638] font-black tracking-wide rounded-xl transition-all disabled:opacity-50">{isUploading ? 'Saving...' : (editingEntryId ? 'Update Batch' : 'Save Batch & Upload')}</button>
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

    const periodProduction = rangeLogs.filter(e => e.type === 'production' && e.qcStatus !== 'rejected');
    const periodPayments = rangeLogs.filter(e => e.type === 'payment');
    
    const earnedPeriod = periodProduction.reduce((sum, e) => sum + e.amount, 0);
    const paidPeriod = periodPayments.reduce((sum, e) => sum + e.amount, 0);
    const piecesPeriod = periodProduction.reduce((sum, e) => sum + e.totalPieces, 0);
    const periodBalance = earnedPeriod - paidPeriod;

    // Helper to format sizes clearly
    const formatSizes = (sizes) => {
      if (!sizes) return '';
      const activeSizes = Object.entries(sizes).filter(([_, qty]) => Number(qty) > 0);
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
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                 <input type="date" value={signOffStartDate} onChange={(e) => { setSignOffStartDate(e.target.value); clearSignature(); }} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
                 <span className="text-gray-500 text-xs font-bold uppercase">to</span>
                 <input type="date" value={signOffEndDate} onChange={(e) => { setSignOffEndDate(e.target.value); clearSignature(); }} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                 <button onClick={setToCurrentCycle} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 px-3 py-2 rounded-lg whitespace-nowrap">This Week</button>
                 <button onClick={setToLastCycle} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 px-3 py-2 rounded-lg whitespace-nowrap">Last Week</button>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
            <select value={printFormat} onChange={(e) => setPrintFormat(e.target.value)} className="w-full md:w-auto bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none">
              <option value="a4">A4 Printer</option>
              <option value="thermal">Label Printer (4x6)</option>
            </select>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 bg-[#cdfc4c] hover:bg-[#b5e638] text-black px-4 py-2 rounded-lg font-bold transition-colors w-full md:w-auto whitespace-nowrap"><Printer size={16} /> Print</button>
          </div>
        </div>

        <div className={`bg-white text-black relative overflow-hidden ${printFormat === 'thermal' ? 'thermal-print-area rounded-lg p-4' : 'rounded-2xl p-8 md:p-12 print:p-0 print:w-full print:shadow-none shadow-2xl'}`}>
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
               <canvas 
                 ref={canvasRef} 
                 width={800} 
                 height={320} 
                 style={{ width: '100%', height: '100%' }}
                 className="cursor-crosshair touch-none" 
                 onMouseDown={startDrawing} 
                 onMouseMove={draw} 
                 onMouseUp={stopDrawing} 
                 onMouseOut={stopDrawing} 
                 onTouchStart={startDrawing} 
                 onTouchMove={draw} 
                 onTouchEnd={stopDrawing} 
               />
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

  const renderLedger = () => {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Financial Overview</h2><p className="text-gray-400 text-sm mt-1">Real-time ledger and balances.</p></div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <select value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none w-full sm:w-auto">
              <option value="All">All Tailors Combined</option>{tailors.map(t => <option key={t} value={t}>{t} Only</option>)}
            </select>
            <select value={dashboardTimeFilter} onChange={(e) => setDashboardTimeFilter(e.target.value)} className="bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none w-full sm:w-auto">
              <option value="all">All Time</option>
              <option value="current_cycle">Current Pay Cycle</option>
              <option value="last_cycle">Last Pay Cycle</option>
            </select>
          </div>
        </div>

        <div className="bg-[#cdfc4c] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl">
          <div>
            <div className="text-black/60 text-xs font-bold uppercase tracking-wider mb-2">Total Pending Payout</div>
            <div className="text-5xl md:text-7xl font-black text-black tracking-tighter">₹{pendingBalance.toLocaleString()}</div>
            {pendingBalance > 0 && <div className="mt-2 text-sm font-bold text-black/70 flex items-center gap-1.5"><Shirt size={16}/> Equates to ~{unpaidPieces} unpaid outfits</div>}
          </div>
          <div className="mt-6 md:mt-0 md:text-right"><div className="text-black/60 text-xs font-bold uppercase tracking-wider mb-2">Pieces Stitched</div><div className="text-2xl md:text-3xl font-bold text-black">{totals.pieces} <span className="text-lg font-medium opacity-60">Items</span></div></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#ffe4e6] p-6 rounded-2xl shadow-sm"><div className="text-[10px] uppercase tracking-wider font-bold text-rose-800/60 mb-2">Total Earned Value</div><div className="text-3xl md:text-4xl font-black text-rose-950">₹{totals.earned.toLocaleString()}</div></div>
          <div className="bg-[#e0f2fe] p-6 rounded-2xl shadow-sm"><div className="text-[10px] uppercase tracking-wider font-bold text-sky-800/60 mb-2">Total Amount Paid</div><div className="text-3xl md:text-4xl font-black text-sky-950">₹{totals.paid.toLocaleString()}</div></div>
          <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl shadow-sm"><div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-2">Active Roster</div><div className="text-3xl md:text-4xl font-black text-white">{tailors.length}</div></div>
        </div>

        <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden mt-8">
          <div className="px-6 py-5 border-b border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0a0a]">
            <h3 className="font-bold text-white tracking-tight text-lg">Transaction History</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select value={ledgerViewMode} onChange={(e) => setLedgerViewMode(e.target.value)} className="bg-black border border-gray-800 text-xs font-bold text-white py-1.5 px-3 rounded-lg outline-none">
                <option value="detailed">Detailed View</option>
                <option value="outfit">Group by Outfit</option>
                <option value="tailor">Group by Tailor</option>
              </select>
              {ledgerViewMode === 'detailed' && (
                <select value={ledgerFilterType} onChange={(e) => setLedgerFilterType(e.target.value)} className="bg-black border border-gray-800 text-xs font-bold text-white py-1.5 px-3 rounded-lg outline-none">
                  <option value="all">All Transactions</option>
                  <option value="credits">Credits Only (+)</option>
                  <option value="debits">Debits Only (-)</option>
                </select>
              )}
              <span className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full font-bold">{ledgerViewMode === 'detailed' ? finalLedgerEntries.length : (ledgerViewMode === 'outfit' ? groupedByProduct.length : groupedByTailor.length)} Records</span>
            </div>
          </div>
          
          <div className="overflow-x-auto w-full">
            {ledgerViewMode === 'detailed' ? (
              finalLedgerEntries.length === 0 ? (
                <div className="p-12 text-center text-gray-600"><FileText size={40} className="mx-auto mb-4 opacity-20" /><p>No transactions found.</p></div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#0a0a0a] text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors group flex items-center gap-1" onClick={() => setLedgerSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>DATE <ChevronDown size={12} className={`transition-transform ${ledgerSortOrder === 'asc' ? 'rotate-180' : ''}`} /></th>
                      <th className="px-6 py-4">Tailor</th>
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4 text-center">QC Photo</th>
                      <th className="px-6 py-4 text-right">Credit (+)</th>
                      <th className="px-6 py-4 text-right">Debit (-)</th>
                      <th className="px-6 py-4 text-center">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {finalLedgerEntries.map((entry) => {
                      const entryImage = products.find(p => p.name === entry.product)?.image;
                      return (
                      <tr key={entry.id} className={`hover:bg-gray-800/30 transition-colors group ${entry.qcStatus === 'rejected' ? 'opacity-50 bg-rose-900/10' : ''}`}>
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
                               <div>
                                 <div className="text-white font-bold">{entry.product}</div>
                                 <div className="flex items-center gap-2 mt-1">
                                   <div className="text-xs text-gray-500">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</div>
                                   <div className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                     Sizes: {Object.entries(entry.sizes || {}).filter(([_, q]) => Number(q) > 0).map(([s, q]) => `${s}:${q}`).join(', ')}
                                   </div>
                                 </div>
                               </div>
                            </div>
                          ) : (
                            <div><div className="text-sky-400 font-bold flex items-center gap-1.5"><Wallet size={14} /> Cash Payout</div>{entry.note && <div className="text-xs text-gray-500 mt-1">{entry.note}</div>}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                           {entry.imageUrl ? (
                             <button onClick={() => setLightboxImage(entry.imageUrl)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded-full hover:bg-blue-400 hover:text-white transition-colors border border-blue-900/50"><Camera size={12}/> View</button>
                           ) : <span className="text-gray-700 font-bold text-xs">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white">{entry.type === 'production' ? <span className={entry.qcStatus === 'rejected' ? 'line-through text-gray-600' : 'text-[#cdfc4c]'}>₹{entry.amount.toLocaleString()}</span> : '-'}</td>
                        <td className="px-6 py-4 text-right font-bold text-sky-400">{entry.type === 'payment' ? `₹${entry.amount.toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-4 text-center">
                          {deletingId === entry.id ? (
                            <div className="flex justify-center items-center gap-2 bg-[#0a0a0a] p-1 rounded-lg border border-gray-800">
                              <span className="text-[10px] font-bold text-rose-500 uppercase px-2">Sure?</span>
                              <button onClick={() => deleteEntry(entry.id)} className="text-white font-black text-[10px] bg-rose-600 px-3 py-1 rounded hover:bg-rose-500 transition-colors uppercase">Yes</button>
                              <button onClick={() => setDeletingId(null)} className="text-gray-400 font-black text-[10px] px-3 py-1 rounded hover:bg-gray-800 transition-colors uppercase">No</button>
                            </div>
                          ) : rejectingId === entry.id ? (
                            <div className="flex justify-center items-center gap-2 bg-rose-900/20 p-1 rounded-lg border border-rose-900/50">
                              <span className="text-[10px] font-bold text-rose-500 uppercase px-2">Confirm Reject?</span>
                              <button onClick={() => confirmRejectBatch(entry)} className="text-white font-black text-[10px] bg-rose-600 px-3 py-1 rounded hover:bg-rose-500 transition-colors uppercase">Yes</button>
                              <button onClick={() => setRejectingId(null)} className="text-gray-400 font-black text-[10px] px-3 py-1 rounded hover:bg-gray-800 transition-colors uppercase">No</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-3">
                               {entry.type === 'production' && entry.qcStatus === 'pending' && (
                                 <>
                                   <button onClick={() => handleApproveBatch(entry)} className="px-3 py-1 bg-green-900/20 border border-green-900/50 text-green-500 rounded text-[10px] font-black uppercase tracking-widest hover:bg-green-500 hover:text-white transition-colors">Approve</button>
                                   <button onClick={() => handleRejectBatch(entry)} className="px-3 py-1 bg-rose-900/20 border border-rose-900/50 text-rose-500 rounded text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-colors">Reject</button>
                                 </>
                               )}
                               {entry.type === 'production' && entry.qcStatus === 'approved' && <span className="text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-900/10 px-2 py-1 rounded border border-green-900/30 flex items-center gap-1"><CheckCircle size={10}/> Approved</span>}
                               {entry.type === 'production' && entry.qcStatus === 'rejected' && <span className="text-rose-500 text-[10px] font-black uppercase tracking-widest bg-rose-900/10 px-2 py-1 rounded border border-rose-900/30">Rejected</span>}
                               
                               <div className="flex items-center gap-2 ml-2 border-l border-gray-800 pl-3">
                                 <button onClick={() => startEdit(entry)} className="text-gray-500 hover:text-white transition-colors"><Edit2 size={16} /></button>
                                 <button onClick={() => setDeletingId(entry.id)} className="text-gray-500 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                               </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              )
            ) : ledgerViewMode === 'outfit' ? (
              <table className="w-full text-sm text-left">
                 <thead className="bg-[#0a0a0a] text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                   <tr><th className="px-6 py-4">Product / Style</th><th className="px-6 py-4 text-center">Total Pieces Stitched</th><th className="px-6 py-4 text-right">Total Value Generated</th></tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800/50">
                    {groupedByProduct.map((prod, i) => {
                      const entryImage = products.find(p => p.name === prod.name)?.image;
                      return (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-4">
                             {entryImage ? <img src={entryImage} className="w-12 h-12 rounded-xl object-cover border border-gray-700 bg-black shrink-0" /> : <div className="w-12 h-12 rounded-xl bg-black border border-gray-700 flex items-center justify-center shrink-0"><Shirt size={20} className="text-gray-600" /></div>}
                             <div>
                               <div className="font-bold text-white text-base">{prod.name}</div>
                               <div className="text-gray-500 text-xs mt-1">Sizes combined: <span className="text-gray-300 font-bold">{Object.entries(prod.sizes).map(([s,q]) => `${s}:${q}`).join(', ')}</span></div>
                             </div>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-2xl text-white">{prod.pieces}</td>
                        <td className="px-6 py-4 text-right font-black text-xl text-[#cdfc4c]">₹{prod.value.toLocaleString()}</td>
                      </tr>
                    )})}
                 </tbody>
              </table>
            ) : (
              <table className="w-full text-sm text-left">
                 <thead className="bg-[#0a0a0a] text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                   <tr><th className="px-6 py-4">Tailor Name</th><th className="px-6 py-4 text-center">Total Pieces Stitched</th><th className="px-6 py-4 text-right">Total Earned</th><th className="px-6 py-4 text-right">Total Paid (Cash)</th><th className="px-6 py-4 text-right text-[#cdfc4c]">Pending Balance</th></tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800/50">
                    {groupedByTailor.map((t, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4 font-black text-white text-lg flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400"><User size={16}/></div> {t.name}</td>
                        <td className="px-6 py-4 text-center font-bold text-gray-300 text-lg">{t.pieces}</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-300">₹{t.earned.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-sky-400">₹{t.paid.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-2xl text-[#cdfc4c]">₹{(t.earned - t.paid).toLocaleString()}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
            )}
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
        {useLocalMode && (
          <button onClick={forceLocalMode} className="mt-8 text-gray-500 hover:text-white text-xs underline font-mono">
            Force Offline Mode
          </button>
        )}
      </div>
    );
  }

  // INTERCEPT: Require Role Login
  if (!role) {
    return renderLogin();
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white font-sans flex flex-col m-0 p-0 overflow-x-hidden pb-28 md:pb-28">
      
      {/* GLOBAL LIGHTBOX VIEWER */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button className="absolute -top-12 right-0 text-white hover:text-rose-500 transition-colors bg-black/50 p-2 rounded-full" onClick={() => setLightboxImage(null)}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <img src={lightboxImage} className="w-full h-full object-contain rounded-xl border border-gray-800 shadow-2xl" onClick={(e) => e.stopPropagation()}/>
          </div>
        </div>
      )}

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
          <div className="w-8 h-8 bg-white flex items-center justify-center rounded-lg shadow-sm">
            <PoshakhLogo size={18} />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white hidden sm:block">Poshakh</h1>
          {role === 'admin' && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-[#cdfc4c] text-black text-[10px] font-black tracking-widest uppercase rounded-full">
              <RefreshCw size={10} className={useLocalMode ? "" : "animate-spin-slow"} /> 
              {useLocalMode ? 'LOCAL MODE' : 'CLOUD ACTIVE'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-white">{role === 'admin' ? 'Admin' : 'Staff'}</div>
            <div className="text-[10px] text-green-500 font-bold tracking-widest uppercase">Workspace</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-green-400 border border-green-700">
            <User size={18} />
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors ml-2" title="Switch User / Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full bg-[#0a0a0a] p-4 md:p-8 print:p-0 print:bg-white transition-all">
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'add-batch' && renderAddBatch()}
        {role === 'admin' && (
          <>
             {activeTab === 'ledger' && renderLedger()}
             {activeTab === 'pay' && renderAddPay()}
             {activeTab === 'sign-off' && renderSignOff()}
             {activeTab === 'setup' && renderSetup()}
          </>
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md border-t border-gray-900 pb-safe z-50 print:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className={`flex items-center h-20 w-full max-w-5xl mx-auto px-4 ${role === 'staff' ? 'justify-center gap-8' : 'justify-around'}`}>
          
          <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors relative ${activeTab === 'tasks' ? 'text-rose-500' : 'text-gray-500 hover:text-rose-400'}`}>
            <ListTodo size={20} className={activeTab === 'tasks' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} />
            <span className="text-[9px] font-black tracking-widest uppercase">Tasks</span>
            {tasks.length > 0 && <span className="absolute top-3 right-1/4 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border border-black"></span>}
          </button>

          <button onClick={() => { setActiveTab('add-batch'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors ${activeTab === 'add-batch' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <Shirt size={20} className={activeTab === 'add-batch' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Add Batch</span>
          </button>

          {role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('ledger')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'ledger' ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-gray-300'}`}>
                <Wallet size={20} className={activeTab === 'ledger' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Ledger</span>
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
            </>
          )}

        </div>
      </nav>
    </div>
  );
}
