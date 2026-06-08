import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors, User, Shirt, IndianRupee, Trash2, Camera, Loader2,
  Wallet, FileText, Settings, Edit2, PenTool, Printer, RefreshCw, Image as ImageIcon, AlertCircle, ChevronDown, Download, Lock, LogOut, CheckCircle, Clock, ListTodo, Search, Plus
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); 
  const [loginStep, setLoginStep] = useState('select'); 
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- CORE STATE ---
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [products, setProducts] = useState([]);
  
  // UI & Network State
  const [activeTab, setActiveTab] = useState('ledger');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(false);
  
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null); 
  const [cancellingSubId, setCancellingSubId] = useState(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isTaskProductDropdownOpen, setIsTaskProductDropdownOpen] = useState(false); 
  const [productSearch, setProductSearch] = useState('');
  
  const [expandedTaskGroup, setExpandedTaskGroup] = useState(null);
  const [selectedSubTaskIds, setSelectedSubTaskIds] = useState(new Set());

  // Form States
  const [taskForm, setTaskForm] = useState({ product: '', size: '', quantity: 1 });

  const [prodForm, setProdForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '', product: '', sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 }, pieceRate: 250
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  // WebRTC Camera States
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [payForm, setPayForm] = useState({
    date: new Date().toISOString().split('T')[0], tailor: '', amount: '', note: ''
  });

  const [setupForm, setSetupForm] = useState({ tailorsText: '', productsText: '' });
  const [reportForm, setReportForm] = useState({ type: 'ledger', startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], tailor: 'All' });

  // Formatting & Sorting
  const [ledgerSortOrder, setLedgerSortOrder] = useState('desc'); 
  const [ledgerFilterType, setLedgerFilterType] = useState('all'); 
  const [ledgerViewMode, setLedgerViewMode] = useState('detailed'); 
  const [dashboardTimeFilter, setDashboardTimeFilter] = useState('all'); 

  // Pay Cycles
  const getPayCycleDates = (offsetWeeks = 0) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const daysSinceFriday = (dayOfWeek + 2) % 7; 
    const cycleStart = new Date(today);
    cycleStart.setDate(today.getDate() - daysSinceFriday - (offsetWeeks * 7));
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + 6);
    return { start: cycleStart.toISOString().split('T')[0], end: cycleEnd.toISOString().split('T')[0] };
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
      setIsLoggedIn(true);
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

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      showToast("Camera access denied or unavailable.", "error");
      setIsCameraOpen(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && photoCanvasRef.current) {
      const video = videoRef.current;
      const canvas = photoCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Compress frame for Firebase
      const MAX_WIDTH = 600;
      const scaleSize = MAX_WIDTH / video.videoWidth;
      const compressedCanvas = document.createElement('canvas');
      compressedCanvas.width = MAX_WIDTH;
      compressedCanvas.height = video.videoHeight * scaleSize;
      const compCtx = compressedCanvas.getContext('2d');
      compCtx.drawImage(canvas, 0, 0, compressedCanvas.width, compressedCanvas.height);
      
      const base64 = compressedCanvas.toDataURL('image/jpeg', 0.6);
      setImagePreview(base64);
      setImageFile('WEBCAM'); // Flag to skip file reader compression
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const forceLocalMode = () => {
    setUseLocalMode(true);
    const localLedger = JSON.parse(localStorage.getItem('poshakh_ledger') || '[]');
    setEntries(localLedger);
    setLoading(false);
    showToast("Switched to Local Offline Mode", "error");
  };

  const handleLogin = (selectedRole) => {
    if (selectedRole === 'staff') {
      setRole('staff'); setIsLoggedIn(true); setActiveTab('tasks'); localStorage.setItem('poshakh_role', 'staff');
    } else if (selectedRole === 'admin') {
      if (pinInput === ADMIN_PIN) {
        setRole('admin'); setIsLoggedIn(true); setActiveTab('ledger'); localStorage.setItem('poshakh_role', 'admin'); setPinInput('');
      } else { showToast("Incorrect PIN", "error"); setPinInput(''); }
    }
  };

  const handleLogout = () => { setIsLoggedIn(false); setRole(null); setLoginStep('select'); localStorage.removeItem('poshakh_role'); };
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
          resolve(canvas.toDataURL('image/jpeg', 0.6));
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
    if (!imagePreview) return showToast("Please attach a QC photo!", "error");

    setIsUploading(true);

    try {
      let finalImageData = null;
      if (imageFile === 'WEBCAM') finalImageData = imagePreview;
      else if (imageFile && !useLocalMode) finalImageData = await compressImageToBase64(imageFile);
      else if (editingEntryId && !imageFile) {
         const existingEntry = entries.find(e => e.id === editingEntryId);
         if(existingEntry) finalImageData = existingEntry.imageUrl;
      }

      const existingStatus = editingEntryId ? entries.find(e => e.id === editingEntryId)?.qcStatus : 'pending';

      const entryData = {
        ...prodForm,
        type: 'production',
        totalPieces,
        amount: totalPieces * prodForm.pieceRate,
        imageUrl: finalImageData,
        qcStatus: existingStatus || 'pending',
        timestamp: new Date().toISOString()
      };

      if (useLocalMode) {
        let newEntries = [...entries];
        if (editingEntryId) newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
        else newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
        setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
      } else {
        if (editingEntryId) await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
        else await addDoc(collection(db, 'ledger'), entryData);
      }
      
      showToast(editingEntryId ? "Log Updated" : "Sent to Admin for QC Review!");
      setEditingEntryId(null); setImageFile(null); setImagePreview(null);
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      if (role === 'admin') setActiveTab('ledger');
    } catch (err) { showToast("Failed to save.", "error"); } finally { setIsUploading(false); }
  };

  const toggleSubTaskSelection = (subId) => {
    setSelectedSubTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subId)) newSet.delete(subId);
      else newSet.add(subId);
      return newSet;
    });
  };

  const handleCompleteTaskSelection = async (group) => {
    const selectedSubTasks = group.subTasks.filter(st => selectedSubTaskIds.has(st.subId));
    if (selectedSubTasks.length === 0) return showToast("Select at least one piece below!", "error");
    if (!prodForm.tailor) return showToast("Please select your name (Tailor) on the 'Add Batch' tab first!", "error");
    if (!imagePreview) return showToast("Please attach a QC photo to submit!", "error");
    
    const taskUpdates = {}; 
    selectedSubTasks.forEach(st => { taskUpdates[st.id] = (taskUpdates[st.id] || 0) + 1; });

    const pieceRate = selectedSubTasks[0].pieceRate || 250;
    const totalQuantity = selectedSubTasks.length;
    const sizesStitched = selectedSubTasks.reduce((acc, st) => {
       const s = st.size || 'M';
       acc[s] = (acc[s] || 0) + 1;
       return acc;
    }, {});
    const totalAmount = totalQuantity * pieceRate;

    setIsUploading(true);

    try {
      let finalImageData = null;
      if (imageFile === 'WEBCAM') finalImageData = imagePreview;
      else if (imageFile && !useLocalMode) finalImageData = await compressImageToBase64(imageFile);

      if (!useLocalMode) {
        for (const [taskId, completedQty] of Object.entries(taskUpdates)) {
           const originalTask = tasks.find(t => t.id === taskId);
           if (!originalTask) continue;
           const remainingQty = (Number(originalTask.quantity) || 1) - completedQty;

           if (remainingQty <= 0) {
             await updateDoc(doc(db, 'priority_tasks', taskId), {
               status: 'pending_review', completedBy: prodForm.tailor, completedAt: new Date().toISOString()
             });
           } else {
             await updateDoc(doc(db, 'priority_tasks', taskId), { quantity: remainingQty });
             await addDoc(collection(db, 'priority_tasks'), {
               ...originalTask, quantity: completedQty, status: 'pending_review', completedBy: prodForm.tailor, completedAt: new Date().toISOString()
             });
           }
           fetch('https://app.poshakhfabrics.com/api/tailor-webhook', {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ taskId, product: originalTask.product, size: originalTask.size, quantity: completedQty, tailor: prodForm.tailor })
           }).catch(() => {});
        }
      }

      const entryData = {
        type: 'production', date: new Date().toISOString().split('T')[0], tailor: prodForm.tailor,
        product: group.product, sizes: sizesStitched, totalPieces: totalQuantity, pieceRate: pieceRate, amount: totalAmount,
        imageUrl: finalImageData, qcStatus: 'pending', timestamp: new Date().toISOString(),
        note: group.status === 'rejected' ? 'Alteration Fixed' : 'Priority Queue'
      };

      if (!useLocalMode) await addDoc(collection(db, 'ledger'), entryData);
      
      showToast(`Sent to Admin for QC Review!`);
      setImageFile(null); setImagePreview(null); setSelectedSubTaskIds(new Set());
      if (selectedSubTasks.length === group.subTasks.length) setExpandedTaskGroup(null);
    } catch(err) { showToast("Error completing task", "error"); } finally { setIsUploading(false); }
  };

  const executeCancelSubTask = async (subTask) => {
    try {
      const originalTask = tasks.find(t => t.id === subTask.id);
      if(originalTask) {
         const remaining = (Number(originalTask.quantity) || 1) - 1;
         if (!useLocalMode) {
            if (remaining <= 0) await deleteDoc(doc(db, 'priority_tasks', originalTask.id));
            else await updateDoc(doc(db, 'priority_tasks', originalTask.id), { quantity: remaining });
            showToast("Item removed from queue.");
         }
      }
      setCancellingSubId(null);
    } catch (err) { showToast("Failed to cancel task.", "error"); }
  };

  const confirmRejectBatch = async (entry) => {
    setRejectingId(null);
    let mainSize = 'M';
    if(entry.sizes) {
       const activeSizes = Object.entries(entry.sizes).filter(([_, qty]) => Number(qty) > 0);
       if(activeSizes.length > 0) mainSize = activeSizes[0][0];
    }
    try {
      if (!useLocalMode) {
        await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'rejected', rejectedAt: new Date().toISOString() });
        await addDoc(collection(db, 'priority_tasks'), {
          product: entry.product, size: mainSize, quantity: entry.totalPieces, pieceRate: entry.pieceRate, 
          status: "rejected", note: "QC REJECTED - ALTERATION REQUIRED", createdAt: new Date().toISOString()
        });
        showToast(`Batch rejected and returned to ${entry.tailor}'s Tasks!`, "error");
      }
    } catch (err) { showToast("Failed to reject.", "error"); }
  };
  
  const handleApproveBatch = async (entry) => {
    try {
      if (!useLocalMode) {
        await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'approved', approvedAt: new Date().toISOString() });
        showToast(`Batch approved!`);
      }
    } catch (err) { showToast("Failed to approve.", "error"); }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const payAmount = parseFloat(payForm.amount);
    if (!payForm.tailor || !payAmount || payAmount <= 0) return showToast("Enter valid amount.", "error");

    const entryData = { type: 'payment', date: payForm.date, tailor: payForm.tailor, amount: payAmount, note: payForm.note, timestamp: new Date().toISOString() };
    try {
      if (useLocalMode) {
        let newEntries = [...entries];
        if (editingEntryId) newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
        else newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
        setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
      } else {
        if (editingEntryId) await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
        else await addDoc(collection(db, 'ledger'), entryData);
      }
      setEditingEntryId(null); setPayForm(prev => ({ ...prev, amount: '', note: '' })); setActiveTab('ledger');
    } catch (err) { showToast("Failed to save.", "error"); }
  };

  const deleteEntry = async (id) => {
    try {
      if (!useLocalMode) await deleteDoc(doc(db, 'ledger', id));
      setDeletingId(null); showToast("Cloud record deleted.");
    } catch (err) { showToast("Delete failed.", "error"); }
  };

  const startEdit = (entry) => {
    setEditingEntryId(entry.id);
    if (entry.type === 'production') {
      setProdForm({ date: entry.date, tailor: entry.tailor, product: entry.product, sizes: entry.sizes || { XS: 0, S: 0, M: 0, L: 0, XL: 0 }, pieceRate: entry.pieceRate || 250 });
      setImagePreview(entry.imageUrl || null);
      setImageFile(null);
      setActiveTab('add-batch');
    } else {
      setPayForm({ date: entry.date, tailor: entry.tailor, amount: entry.amount, note: entry.note || '' });
      setActiveTab('pay');
    }
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
    const recentProduction = [...entries].filter(e => e.type === 'production' && e.qcStatus !== 'rejected' && (selectedTailorFilter === 'All' || e.tailor === selectedTailorFilter)).sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const item of recentProduction) {
      if (balanceLeft <= 0) break;
      const rate = Number(item.pieceRate) || 250;
      const piecesInItem = Number(item.totalPieces) || 0;
      const valueOfItem = piecesInItem * rate;
      if (balanceLeft >= valueOfItem) { piecesToCover += piecesInItem; balanceLeft -= valueOfItem; } 
      else { piecesToCover += balanceLeft / rate; balanceLeft = 0; }
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

  const currentSelectedProductImage = useMemo(() => {
    const found = products.find(p => p.name === prodForm.product);
    return found ? found.image : null;
  }, [prodForm.product, products]);

  const renderCameraModal = () => {
    if (!isCameraOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in">
        <div className="w-full max-w-lg bg-[#111] rounded-3xl overflow-hidden border border-gray-800 flex flex-col relative shadow-2xl">
           <video ref={videoRef} autoPlay playsInline className="w-full h-auto bg-black aspect-video object-cover" />
           <canvas ref={photoCanvasRef} className="hidden" />
           <div className="p-6 flex gap-4 bg-[#111]">
              <button onClick={stopCamera} className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors">Cancel</button>
              <button onClick={takePhoto} className="flex-1 py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-black rounded-xl flex justify-center items-center gap-2 transition-colors"><Camera size={18}/> Snap Photo</button>
           </div>
        </div>
      </div>
    );
  };

  const renderPhotoUploader = () => (
    <div className="pt-4 border-t border-gray-800">
      <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3 text-center">Quality Control Photo (Required)</label>
      
      {!imagePreview ? (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full md:flex-1 h-14 bg-black border-2 border-dashed border-gray-800 rounded-xl flex items-center justify-center overflow-hidden hover:border-[#cdfc4c] transition-colors cursor-pointer group">
            <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <span className="text-gray-500 font-bold text-xs flex items-center gap-2 group-hover:text-[#cdfc4c]"><ImageIcon size={16}/> Upload / Phone Cam</span>
          </div>
          <button type="button" onClick={startCamera} className="w-full md:flex-1 h-14 bg-gray-900 hover:bg-gray-800 border-2 border-dashed border-gray-800 hover:border-sky-500 rounded-xl flex items-center justify-center gap-2 text-gray-400 font-bold text-xs transition-colors">
            <Camera size={16} /> Desktop Webcam
          </button>
        </div>
      ) : (
        <div className="relative w-full h-48 bg-black rounded-xl border border-[#cdfc4c] overflow-hidden flex items-center justify-center shadow-lg shadow-[#cdfc4c]/10">
           <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover opacity-90" />
           <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }} className="px-5 py-3 bg-rose-500 hover:bg-rose-600 transition-colors text-white font-black tracking-wide rounded-xl text-xs flex items-center gap-2 shadow-2xl"><Trash2 size={16}/> Remove Photo</button>
           </div>
           <div className="absolute bottom-3 right-3 bg-[#cdfc4c] text-black text-[10px] font-black px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5"><CheckCircle size={12}/> Attached</div>
        </div>
      )}
    </div>
  );

  const renderTasks = () => {
    const groupedTasks = Object.values(tasks.reduce((acc, t) => {
      if (!acc[t.product]) acc[t.product] = { id: t.product, product: t.product, subTasks: [], status: t.status };
      const qty = Number(t.quantity) || 1;
      if (t.status === 'rejected') acc[t.product].status = 'rejected';
      for (let i = 0; i < qty; i++) acc[t.product].subTasks.push({ ...t, subId: `${t.id}-${i}`, listIndex: i + 1, quantity: 1 });
      return acc;
    }, {}));

    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in">
        <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight text-rose-500 flex items-center justify-center gap-2"><ListTodo size={28}/> Priority Tasks</h2><p className="text-gray-400 mt-2">Urgent items out of stock on Shopify/Amazon.</p></div>

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
              <div className="relative"><span className="absolute left-3 top-2 text-sm text-gray-500 font-bold">Qty:</span><input type="number" min="1" value={taskForm.quantity} onChange={(e) => setTaskForm({...taskForm, quantity: parseInt(e.target.value) || 1})} className="w-full pl-10 pr-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none" /></div>
              <button onClick={() => {
                if(!taskForm.product || !taskForm.size) return showToast("Select a product and size", "error");
                addDoc(collection(db, 'priority_tasks'), { product: taskForm.product, size: taskForm.size, quantity: taskForm.quantity, pieceRate: 250, status: 'pending', createdAt: new Date().toISOString() });
                setTaskForm({ product: '', size: '', quantity: 1 }); showToast("Task Assigned!");
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
              const isExpanded = expandedTaskGroup === group.id;
              
              return (
                <div key={group.id} className="bg-[#111] border border-rose-900/50 rounded-2xl p-5 flex flex-col items-start gap-4 shadow-lg relative overflow-hidden group transition-all">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                  
                  <div className="flex items-center w-full gap-5 cursor-pointer" onClick={() => setExpandedTaskGroup(isExpanded ? null : group.id)}>
                    {productInfo?.image ? <img src={productInfo.image} className="w-16 h-16 rounded-lg object-cover bg-black shrink-0" /> : <div className="w-16 h-16 rounded-lg bg-black flex items-center justify-center shrink-0"><ImageIcon className="text-gray-700"/></div>}
                    <div className="flex-1">
                      <div className="text-[10px] text-rose-500 font-bold uppercase mb-1 flex items-center gap-1"><Clock size={12}/> {group.status === 'rejected' ? 'REJECTED - START ALTERATION' : 'URGENT ORDER'}</div>
                      <h3 className="text-lg font-bold text-white leading-tight">{group.product}</h3>
                      <div className="text-xs text-gray-500 mt-1 font-bold">{group.subTasks.length} pieces pending</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-400 shrink-0">
                       <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="w-full pt-4 border-t border-gray-800 mt-2 animate-in slide-in-from-top-2">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3 px-1">Select completed pieces:</div>
                      <div className="flex flex-col gap-2 w-full mb-6">
                        {group.subTasks.map(st => (
                          <div key={st.subId} onClick={() => toggleSubTaskSelection(st.subId)} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedSubTaskIds.has(st.subId) ? 'bg-[#cdfc4c]/10 border-[#cdfc4c]' : 'bg-black border-gray-800 hover:border-gray-600'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedSubTaskIds.has(st.subId) ? 'border-[#cdfc4c] bg-[#cdfc4c]' : 'border-gray-600'}`}>
                                {selectedSubTaskIds.has(st.subId) && <CheckCircle size={14} className="text-black" />}
                              </div>
                              <span className={`font-bold ${selectedSubTaskIds.has(st.subId) ? 'text-white' : 'text-gray-400'}`}>Size: {st.size}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`font-bold text-sm ${selectedSubTaskIds.has(st.subId) ? 'text-[#cdfc4c]' : 'text-gray-500'}`}>₹{st.pieceRate}</span>
                              {role === 'admin' && (
                                cancellingSubId === st.subId ? (
                                  <div className="flex items-center gap-2 bg-rose-900/30 p-1 rounded-lg border border-rose-900/50" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-[10px] font-bold text-rose-500 uppercase px-1">Sure?</span>
                                    <button onClick={(e) => { e.stopPropagation(); executeCancelSubTask(st); }} className="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-black uppercase">Yes</button>
                                    <button onClick={(e) => { e.stopPropagation(); setCancellingSubId(null); }} className="px-2 py-1 bg-gray-700 text-white rounded text-[10px] font-black uppercase">No</button>
                                  </div>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setCancellingSubId(st.subId); }} className="p-1.5 text-gray-600 hover:text-rose-500 transition-colors bg-gray-900 rounded-lg hover:bg-rose-900/30" title="Cancel this piece">
                                    <Trash2 size={16} />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {renderPhotoUploader()}

                      <div className="mt-6">
                         {(() => {
                            const selectedSubTasks = group.subTasks.filter(st => selectedSubTaskIds.has(st.subId));
                            const hasSelection = selectedSubTasks.length > 0;
                            const canSubmit = hasSelection && imagePreview;
                            return (
                              <button disabled={isUploading || !canSubmit} onClick={() => handleCompleteTaskSelection(group)} className="w-full py-4 bg-[#cdfc4c] text-black font-black tracking-wide rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-[#cdfc4c]/10">
                                {isUploading ? 'Uploading Securely...' : (!hasSelection ? 'Select Sizes Above' : (!imagePreview ? 'Add QC Photo to Submit' : 'Submit for QC Review'))}
                              </button>
                            );
                         })()}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderAddBatch = () => {
    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + val, 0);
    const canSubmit = totalPieces > 0 && prodForm.tailor && prodForm.product && imagePreview;

    return (
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
                <div className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none cursor-pointer flex items-center justify-between transition-colors hover:border-gray-600" onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    {currentSelectedProductImage ? <img src={currentSelectedProductImage} alt="Preview" className="w-8 h-8 rounded-md object-cover border border-gray-800 bg-[#111] shrink-0" /> : <div className="w-8 h-8 rounded-md bg-[#111] border border-gray-800 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-gray-600" /></div>}
                    <span className={`truncate font-medium ${prodForm.product ? 'text-white' : 'text-gray-500'}`}>{prodForm.product || "Select Product"}</span>
                  </div>
                  <ChevronDown size={18} className={`text-gray-500 transition-transform duration-200 ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isProductDropdownOpen && (
                  <><div className="fixed inset-0 z-40" onClick={() => setIsProductDropdownOpen(false)} /><div className="absolute z-50 w-full mt-2 bg-[#111] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"><div className="p-3 border-b border-gray-800 bg-[#0a0a0a] relative"><Search size={16} className="absolute left-6 top-6 text-gray-500" /><input autoFocus type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none"/></div><div className="max-h-72 overflow-y-auto custom-scrollbar flex-1">{products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((p, i) => (<div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0" onClick={() => { setProdForm({...prodForm, product: p.name}); setIsProductDropdownOpen(false); setProductSearch(''); }}>{p.image ? <img src={p.image} alt={p.name} className="w-10 h-10 rounded-md object-cover border border-gray-800 bg-black shrink-0" /> : <div className="w-10 h-10 rounded-md bg-black border border-gray-800 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-gray-600" /></div>}<span className="text-sm font-medium text-gray-200 hover:text-white">{p.name}</span></div>))}</div></div></>
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

            {renderPhotoUploader()}

            <button type="submit" disabled={isUploading || !canSubmit} className="w-full py-4 bg-[#cdfc4c] text-black font-black tracking-wide rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-[#cdfc4c]/10 mt-6">
              {isUploading ? 'Uploading Securely...' : (!canSubmit ? 'Complete Form & Add Photo' : (editingEntryId ? 'Update Batch' : 'Submit for QC Review'))}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderAdminLedger = () => (
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
                                 <button onClick={() => handleApproveBatch(entry)} className="px-3 py-1 bg-green-900/20 border border-green-900/50 text-green-500 rounded text-[10px] font-black uppercase tracking-widest hover:bg-green-50 hover:text-white transition-colors">Approve</button>
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

      {renderCameraModal()}

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
             {activeTab === 'ledger' && renderAdminLedger()}
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
