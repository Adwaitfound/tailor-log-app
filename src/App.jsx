import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors, User, Shirt, IndianRupee, Trash2, Camera, Loader2,
  Wallet, FileText, Settings, Edit2, PenTool, Printer, RefreshCw, Image as ImageIcon, AlertCircle, ChevronDown, Download, Lock, LogOut, CheckCircle, Clock, ListTodo, Search, Plus, ShoppingBag, Target, Flame, UserCheck, CalendarRange, Activity, Maximize, Minimize, Filter, BarChart3, TrendingUp, AlertTriangle, Calendar, ChevronRight, ChevronLeft, ChevronUp, Check, X
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

const PoshakhLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="7" r="5.5" fill="#9b1c1c" />
    <path d="M4 14.5H20" stroke="#064e3b" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="12" cy="20.5" r="2.5" fill="#9b1c1c" />
  </svg>
);

const ADMIN_PIN = "1234";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); 
  const [loginStep, setLoginStep] = useState('select'); 
  const [pinInput, setPinInput] = useState('');
  
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [activeTab, setActiveTab] = useState('ledger');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [useLocalMode, setUseLocalMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null); 
  const [cancellingSubId, setCancellingSubId] = useState(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  
  const [expandedTaskGroup, setExpandedTaskGroup] = useState(null);
  const [selectedSubTaskIds, setSelectedSubTaskIds] = useState(new Set());
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskFilterOption, setTaskFilterOption] = useState('All');
  const [taskSortOption, setTaskSortOption] = useState('Priority');
  const [taskGroupBy, setTaskGroupBy] = useState('Platform');
  
  const [liveTailorFilter, setLiveTailorFilter] = useState('All');
  const [activeStackIndex, setActiveStackIndex] = useState({});
  
  const wheelLockout = useRef(false);
  const wheelAccumulator = useRef(0);
  const touchStartX = useRef(null);

  const [prodForm, setProdForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '', product: '', sizes: { XXS: 0, XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }, pieceRate: 250, platform: 'Shopify / Website', orderNumber: '', workType: 'Both'
  });

  const [imageFiles, setImageFiles] = useState({ chest: null, waist: null, hip: null });
  const [imagePreviews, setImagePreviews] = useState({ chest: null, waist: null, hip: null });
  const [activeCameraSlot, setActiveCameraSlot] = useState(null);
  const [lightboxData, setLightboxData] = useState(null);

  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const formatProductName = (name) => {
    if (!name) return 'Unnamed Item';
    let cleanName = String(name);
    const httpIndex = cleanName.toLowerCase().indexOf('http');
    if (httpIndex !== -1) cleanName = cleanName.substring(0, httpIndex);
    return cleanName.replace(/[\t,:\-\s]+$/, '').trim();
  };

  const findProductImage = (productName) => {
    if (!productName || !products) return null;
    const cleanSearch = formatProductName(productName).toLowerCase().replace(/\s+/g, ' ');
    let found = products.find(p => formatProductName(p.name).toLowerCase().replace(/\s+/g, ' ') === cleanSearch);
    if (!found) {
        found = products.find(p => {
           const pName = formatProductName(p.name).toLowerCase().replace(/\s+/g, ' ');
           return pName.includes(cleanSearch) || cleanSearch.includes(pName);
        });
    }
    return found ? found.image : null;
  };

  const getUrgencyStyles = (createdAt) => {
    if (!createdAt) return 'border-gray-800 bg-[#111]';
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return 'border-red-500 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse-slow';
    if (hours > 24) return 'border-orange-500 bg-orange-950/20';
    return 'border-gray-800 bg-[#111]';
  };

  const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; 
          const scaleSize = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6)); 
        };
        img.onerror = () => reject("Image processing error");
      };
      reader.onerror = () => reject("File reading error");
    });
  };

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
  const lastCycle = getPayCycleDates(1);

  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split('T')[0], tailor: '', amount: '', note: '', periodStart: lastCycle.start, periodEnd: lastCycle.end });
  const [setupForm, setSetupForm] = useState({ tailorsText: '', productsText: '' });
  const [reportForm, setReportForm] = useState({ type: 'ledger', startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], tailor: 'All' });
  const [ledgerStartDate, setLedgerStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [ledgerSortOrder, setLedgerSortOrder] = useState('desc'); 
  const [ledgerFilterType, setLedgerFilterType] = useState('all'); 
  const [ledgerViewMode, setLedgerViewMode] = useState('tailor'); 
  const [statsTimeFilter, setStatsTimeFilter] = useState('30days');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [signOffStartDate, setSignOffStartDate] = useState(currentCycle.start);
  const [signOffEndDate, setSignOffEndDate] = useState(currentCycle.end);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);

  const safeStorage = {
      getItem: (key) => { try { return localStorage.getItem(key); } catch(e) { return null; } },
      setItem: (key, val) => { try { localStorage.setItem(key, val); } catch(e) {} },
      removeItem: (key) => { try { localStorage.removeItem(key); } catch(e) {} }
  };

  const getBlacklist = () => JSON.parse(safeStorage.getItem('poshakh_blacklist') || '[]');
  const addToBlacklist = (ids) => {
      const current = getBlacklist();
      const newBlacklist = [...new Set([...current, ...ids])];
      safeStorage.setItem('poshakh_blacklist', JSON.stringify(newBlacklist));
      return newBlacklist;
  };

  useEffect(() => {
    const handleFullscreenChange = () => { setIsFullscreen(!!document.fullscreenElement); };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #root { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
      body, html { width: 100%; height: 100%; margin: 0; padding: 0; overflow-x: hidden; background-color: #0a0a0a; touch-action: pan-y; }
      .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      .preserve-3d { transform-style: preserve-3d; }
      .perspective-[2000px] { perspective: 2000px; }
      .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
    `;
    document.head.appendChild(style);

    const savedRole = safeStorage.getItem('poshakh_role');
    if (savedRole) {
      setRole(savedRole); setIsLoggedIn(true);
      if (savedRole === 'staff') setActiveTab('tasks');
    }
  }, []);

  useEffect(() => {
    let unsubscribeLedger; let unsubscribeConfig; let unsubscribeTasks;
    
    // INSTANT CACHE HYDRATION (0ms Load Time)
    const hydrateFromCache = () => {
      try {
        const localLedger = JSON.parse(safeStorage.getItem('poshakh_ledger') || '[]');
        const localConfig = JSON.parse(safeStorage.getItem('poshakh_config') || 'null');
        if (localLedger.length > 0) setEntries(localLedger);
        if (localConfig) {
          setTailors(localConfig.tailors || []); setProducts(localConfig.products || []);
          setSetupForm({ tailorsText: (localConfig.tailors || []).join('\n'), productsText: (localConfig.products || []).map(p => p.image ? `${p.name}\t${p.image}` : p.name).join('\n') });
          setProdForm(prev => ({ ...prev, tailor: prev.tailor || localConfig?.tailors?.[0] || '', product: prev.product || localConfig?.products?.[0]?.name || '' }));
          setPayForm(prev => ({ ...prev, tailor: prev.tailor || localConfig?.tailors?.[0] || '' }));
        }
      } catch(e) {}
    };
    
    hydrateFromCache();

    if (useLocalMode) { 
       setLoading(false); 
       return; 
    }

    const fetchFirebaseDirectly = async () => {
      try {
        // FIRE AND FORGET AUTH - Do not block the UI
        signInAnonymously(auth).catch(err => console.error("Auth error", err));
        setLoading(false); // DROP LOADING SCREEN IMMEDIATELY

        unsubscribeLedger = onSnapshot(collection(db, 'ledger'), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setEntries(data); 
          safeStorage.setItem('poshakh_ledger', JSON.stringify(data)); // Keep cache fresh
        }, (err) => console.error("Firebase connection error", err));

        unsubscribeConfig = onSnapshot(doc(db, 'config', 'setup'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTailors(data.tailors || []); setProducts(data.products || []);
            safeStorage.setItem('poshakh_config', JSON.stringify({ tailors: data.tailors || [], products: data.products || [] }));
            setSetupForm({ tailorsText: (data.tailors || []).join('\n'), productsText: (data.products || []).map(p => p.image ? `${p.name}\t${p.image}` : p.name).join('\n') });
            setProdForm(prev => ({ ...prev, tailor: prev.tailor || data.tailors?.[0] || '', product: prev.product || data.products?.[0]?.name || '' }));
          }
        });

        unsubscribeTasks = onSnapshot(collection(db, 'priority_tasks'), (snapshot) => {
          const blacklist = getBlacklist();
          const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(t => !blacklist.includes(t.id));
          const activeTasks = data.filter(t => (t.status === 'pending' || t.status === 'rejected' || t.status === 'in_progress') && Number(t.quantity) > 0).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          setTasks(activeTasks);
        });
      } catch (err) { 
         console.error("Init error", err); 
         setLoading(false); 
      }
    };
    
    fetchFirebaseDirectly();
    
    return () => { if(unsubscribeLedger) unsubscribeLedger(); if(unsubscribeConfig) unsubscribeConfig(); if(unsubscribeTasks) unsubscribeTasks(); };
  }, [useLocalMode]);

  const startCamera = async (slot) => {
    setActiveCameraSlot(slot); setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      showToast("Camera access denied or unavailable.", "error"); setIsCameraOpen(false); setActiveCameraSlot(null);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && photoCanvasRef.current && activeCameraSlot) {
      const video = videoRef.current; const canvas = photoCanvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return showToast("Camera initializing, please try again.", "error");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const MAX_WIDTH = 800; const scaleSize = video.videoWidth > MAX_WIDTH ? (MAX_WIDTH / video.videoWidth) : 1;
      const compressedCanvas = document.createElement('canvas'); compressedCanvas.width = video.videoWidth * scaleSize; compressedCanvas.height = video.videoHeight * scaleSize;
      const compCtx = compressedCanvas.getContext('2d'); compCtx.drawImage(canvas, 0, 0, compressedCanvas.width, compressedCanvas.height);
      const base64 = compressedCanvas.toDataURL('image/jpeg', 0.6);
      setImagePreviews(prev => ({ ...prev, [activeCameraSlot]: base64 })); setImageFiles(prev => ({ ...prev, [activeCameraSlot]: 'WEBCAM' }));
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false); setActiveCameraSlot(null);
  };

  const toggleNetworkMode = () => {
    const nextMode = !useLocalMode; setUseLocalMode(nextMode);
    if (nextMode) showToast("Switched to Local Offline Mode", "error"); else showToast("Reconnecting to Cloud...", "success");
  };

  const handleLogin = (selectedRole) => {
    if (selectedRole === 'staff') { setRole('staff'); setIsLoggedIn(true); setActiveTab('tasks'); safeStorage.setItem('poshakh_role', 'staff'); } 
    else if (selectedRole === 'admin') {
      if (pinInput === ADMIN_PIN) { setRole('admin'); setIsLoggedIn(true); setActiveTab('ledger'); safeStorage.setItem('poshakh_role', 'admin'); setPinInput(''); } 
      else { showToast("Incorrect PIN", "error"); setPinInput(''); }
    }
  };

  const handleLogout = () => { setIsLoggedIn(false); setRole(null); setLoginStep('select'); safeStorage.removeItem('poshakh_role'); };
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const syncLocal = (key, data) => safeStorage.setItem(key, JSON.stringify(data));

  const saveConfig = async () => {
    const newTailors = setupForm.tailorsText.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = setupForm.productsText.split('\n').map(line => {
      let name = ''; let image = null; const httpIndex = line.toLowerCase().indexOf('http');
      if (httpIndex !== -1) { image = line.substring(httpIndex).trim(); name = line.substring(0, httpIndex).replace(/[\t,:\-\s]+$/, '').trim(); } 
      else { const parts = line.split(/[\t,]/); name = parts[0]?.trim() || ''; image = parts[1]?.trim() || null; }
      return { name, image };
    }).filter(p => p.name);

    try {
      if (useLocalMode) {
        setTailors(newTailors); setProducts(newProducts); syncLocal('poshakh_config', { tailors: newTailors, products: newProducts }); showToast("Setup saved locally!");
      } else {
        await setDoc(doc(db, 'config', 'setup'), { tailors: newTailors, products: newProducts, updatedAt: new Date().toISOString() }); showToast("Cloud setup saved!");
      }
    } catch (err) { showToast("Failed to save setup.", "error"); }
  };

  const handleImageChange = (e, slot) => {
    const file = e.target.files[0];
    if (file) { setImageFiles(prev => ({...prev, [slot]: file})); setImagePreviews(prev => ({...prev, [slot]: URL.createObjectURL(file)})); }
  };

  const handleProdSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setProdForm(prev => ({ ...prev, sizes: { ...prev.sizes, [size]: numValue } }));
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.tailor) return showToast("Missing: Please select a Tailor.", "error");
    if (!prodForm.product) return showToast("Missing: Please select a Product.", "error");

    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + val, 0);
    if (totalPieces === 0) return showToast("Missing: Enter at least 1 piece in the sizes section.", "error");
    
    const isCutOnly = prodForm.workType === 'Cut';
    if (isCutOnly) {
       if (!imagePreviews.chest) return showToast("Missing: Please attach a Fabric Proof photo!", "error");
    } else {
       if (!imagePreviews.chest || !imagePreviews.waist || !imagePreviews.hip) return showToast("Missing: Please attach all 3 QC Photos!", "error");
    }

    setIsUploading(true);
    try {
      const finalImageUrls = { chest: null, waist: null, hip: null };
      const slotsToProcess = isCutOnly ? ['chest'] : ['chest', 'waist', 'hip'];

      for (const slot of slotsToProcess) {
         if (imageFiles[slot] === 'WEBCAM') finalImageUrls[slot] = imagePreviews[slot];
         else if (imageFiles[slot] && !useLocalMode) finalImageUrls[slot] = await compressImageToBase64(imageFiles[slot]);
         else if (imageFiles[slot] && useLocalMode) finalImageUrls[slot] = imagePreviews[slot]; 
         else if (editingEntryId && !imageFiles[slot]) {
            const existingEntry = entries.find(e => e.id === editingEntryId);
            if (existingEntry) {
               if (existingEntry.imageUrls) finalImageUrls[slot] = existingEntry.imageUrls[slot];
               else if (slot === 'chest') finalImageUrls[slot] = existingEntry.imageUrl; 
            }
         }
      }

      const existingStatus = editingEntryId ? entries.find(e => e.id === editingEntryId)?.qcStatus : 'pending';
      const entryData = {
        ...prodForm, product: formatProductName(prodForm.product), type: 'production', totalPieces,
        amount: totalPieces * prodForm.pieceRate, imageUrls: finalImageUrls, qcStatus: existingStatus || 'pending', timestamp: new Date().toISOString()
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

      if (!editingEntryId && isCutOnly && !useLocalMode) {
         for(const [size, qty] of Object.entries(prodForm.sizes)) {
             const numQty = Number(qty);
             if(numQty > 0) {
                 await addDoc(collection(db, 'priority_tasks'), {
                     product: formatProductName(prodForm.product), size: size, quantity: numQty, pieceRate: 120, platform: prodForm.platform,
                     assignee: 'Any', priority: '3', orderNumber: prodForm.orderNumber, status: 'pending', workType: 'Stitch', createdAt: new Date().toISOString()
                 });
             }
         }
      }
      
      showToast(editingEntryId ? "Log Updated Successfully!" : "Sent to Admin for QC Review!");
      setEditingEntryId(null); setImageFiles({ chest: null, waist: null, hip: null }); setImagePreviews({ chest: null, waist: null, hip: null });
      setProdForm(prev => ({ ...prev, sizes: { XXS: 0, XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 } }));
      if (role === 'admin') setActiveTab('ledger');
    } catch (err) { showToast(`Database Error: ${err.message || 'Failed to save batch.'}`, "error"); } finally { setIsUploading(false); }
  };

  const startEdit = (entry) => {
    setEditingEntryId(entry.id);
    if (entry.type === 'payment') {
      setPayForm({ date: entry.date || new Date().toISOString().split('T')[0], tailor: entry.tailor || '', amount: entry.amount || '', note: entry.note || '', periodStart: entry.periodStart || lastCycle.start, periodEnd: entry.periodEnd || lastCycle.end });
      setActiveTab('pay');
    } else {
      setProdForm({
        date: entry.date || new Date().toISOString().split('T')[0], tailor: entry.tailor || '', product: formatProductName(entry.product), 
        sizes: entry.sizes || { XXS: 0, XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }, pieceRate: entry.pieceRate || 250, platform: entry.platform || 'Shopify / Website', 
        orderNumber: entry.orderNumber || '', workType: entry.workType || 'Both'
      });
      if (entry.imageUrls) setImagePreviews(entry.imageUrls); else if (entry.imageUrl) setImagePreviews({ chest: entry.imageUrl, waist: null, hip: null }); else setImagePreviews({ chest: null, waist: null, hip: null });
      setImageFiles({ chest: null, waist: null, hip: null }); setActiveTab('add-batch');
    }
  };

  const deleteEntry = async (id) => {
    if (useLocalMode) {
      const newEntries = entries.filter(e => e.id !== id); setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
    } else {
      try { await deleteDoc(doc(db, 'ledger', id)); } catch (error) { return showToast("Failed to delete entry", "error"); }
    }
    setDeletingId(null); showToast("Entry deleted!");
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payForm.tailor || !payForm.amount) return showToast("Missing tailor or amount", "error");
    const entryData = { ...payForm, amount: parseFloat(payForm.amount), type: 'payment', timestamp: new Date().toISOString() };
    
    if (useLocalMode) {
      let newEntries = [...entries];
      if (editingEntryId) newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
      else newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
      setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
    } else {
      if (editingEntryId) await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
      else await addDoc(collection(db, 'ledger'), entryData);
    }
    
    showToast(editingEntryId ? "Payment Updated!" : "Payment Recorded!");
    setPayForm({ ...payForm, amount: '', note: '' }); setEditingEntryId(null); setActiveTab('ledger');
  };

  const confirmRejectBatch = async (entry) => {
    if (useLocalMode) return;
    await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'rejected' }); setRejectingId(null); showToast("Batch Rejected!");
  };

  const handleApproveBatch = async (entry) => {
    if (useLocalMode) return;
    await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'approved' }); showToast("Batch Approved!");
  };

  const handleClearOutfit = async (group) => {
    const ids = group.subTasks.map(st => st.id);
    addToBlacklist(ids); setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    if (!useLocalMode) ids.forEach(async id => { try { await updateDoc(doc(db, 'priority_tasks', id), { status: 'cancelled', quantity: 0 }); } catch(e) {} });
    showToast("Outfit Cleared!");
  };

  const toggleSubTaskSelection = (subId) => {
    setSelectedSubTaskIds(prev => { const newSet = new Set(prev); if (newSet.has(subId)) newSet.delete(subId); else newSet.add(subId); return newSet; });
  };

  const handleDropTask = async (taskId) => {
    if (useLocalMode) return;
    const originalDoc = tasks.find(t => t.id === taskId);
    if (!originalDoc) return;
    const origQty = Number(originalDoc.quantity) || 1;
    if (origQty <= 1) {
        await updateDoc(doc(db, 'priority_tasks', taskId), { status: 'pending', startedBy: null, startedAt: null });
    } else {
        await updateDoc(doc(db, 'priority_tasks', taskId), { quantity: origQty - 1 });
        const { id, ...taskDataWithoutId } = originalDoc;
        await addDoc(collection(db, 'priority_tasks'), { ...taskDataWithoutId, quantity: 1, status: 'pending', startedBy: null, startedAt: null });
    }
    showToast("Item dropped back to queue.");
  };

  const handleCompleteLiveSelection = async (e, tailorName, items) => {
    e.preventDefault(); e.stopPropagation();
    const selected = items.filter(st => selectedSubTaskIds.has(st.subId));
    if (selected.length === 0) return;

    const firstSelectedItem = selected[0];
    const isCutOnly = firstSelectedItem.workType === 'Cut';
    
    if (isCutOnly) {
       if (!imagePreviews.chest) return showToast("Missing: Please attach Fabric Proof photo!", "error");
    } else {
       if (!imagePreviews.chest || !imagePreviews.waist || !imagePreviews.hip) return showToast("Missing: Please attach all 3 QC Photos!", "error");
    }

    setIsUploading(true);
    try {
      const finalImageUrls = { chest: null, waist: null, hip: null };
      const slotsToProcess = isCutOnly ? ['chest'] : ['chest', 'waist', 'hip'];

      for (const slot of slotsToProcess) {
         if (imageFiles[slot] === 'WEBCAM') finalImageUrls[slot] = imagePreviews[slot];
         else if (imageFiles[slot] && !useLocalMode) finalImageUrls[slot] = await compressImageToBase64(imageFiles[slot]);
         else if (imageFiles[slot] && useLocalMode) finalImageUrls[slot] = imagePreviews[slot]; 
      }

      const groupedByProduct = selected.reduce((acc, st) => {
        const prodName = formatProductName(st.product || 'Unnamed Item'); const orderNum = st.orderNumber || ''; const groupKey = `${prodName}|||${orderNum}`;
        if (!acc[groupKey]) acc[groupKey] = []; acc[groupKey].push(st); return acc;
      }, {});

      if (!useLocalMode) {
        for (const [groupKey, productTasks] of Object.entries(groupedByProduct)) {
          const [productName, orderNum] = groupKey.split('|||'); const firstItem = productTasks[0];
          const entryData = {
            date: new Date().toISOString().split('T')[0], tailor: tailorName, product: productName, platform: firstItem.platform || 'Shopify / Website',
            orderNumber: orderNum, sizes: {}, pieceRate: firstItem.pieceRate || 250, workType: firstItem.workType || 'Both', type: 'production',
            totalPieces: productTasks.length, amount: productTasks.length * (firstItem.pieceRate || 250), imageUrls: finalImageUrls, qcStatus: 'pending', timestamp: new Date().toISOString()
          };
          productTasks.forEach(st => { if(!entryData.sizes[st.size]) entryData.sizes[st.size] = 0; entryData.sizes[st.size] += 1; });
          await addDoc(collection(db, 'ledger'), entryData);
        }

        const tasksById = selected.reduce((acc, st) => { if (!acc[st.id]) acc[st.id] = { ...st, selectedQty: 0 }; acc[st.id].selectedQty += 1; return acc; }, {});

        for (const [origId, data] of Object.entries(tasksById)) {
           const originalDoc = tasks.find(t => t.id === origId); if (!originalDoc) continue;
           const origQty = Number(originalDoc.quantity) || 1; const selQty = data.selectedQty;
           if (selQty >= origQty) await updateDoc(doc(db, 'priority_tasks', origId), { status: 'completed' });
           else {
              const { id, ...taskDataWithoutId } = originalDoc;
              await updateDoc(doc(db, 'priority_tasks', origId), { quantity: origQty - selQty });
              await addDoc(collection(db, 'priority_tasks'), { ...taskDataWithoutId, quantity: selQty, status: 'completed' });
           }

           if (data.workType === 'Cut') {
              const { id, ...spawndata } = originalDoc;
              await addDoc(collection(db, 'priority_tasks'), { ...spawndata, quantity: selQty, status: 'pending', workType: 'Stitch', pieceRate: 120, startedBy: null, startedAt: null, assignee: 'Any', createdAt: new Date().toISOString() });
           }
        }
      } else {
        let newEntries = [...entries];
        for (const [groupKey, productTasks] of Object.entries(groupedByProduct)) {
           const [productName, orderNum] = groupKey.split('|||'); const firstItem = productTasks[0];
           const entryData = {
              id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], tailor: tailorName, product: productName, platform: firstItem.platform || 'Shopify / Website', orderNumber: orderNum,
              sizes: {}, pieceRate: firstItem.pieceRate || 250, type: 'production', workType: firstItem.workType || 'Both', totalPieces: productTasks.length, amount: productTasks.length * (firstItem.pieceRate || 250),
              imageUrls: finalImageUrls, qcStatus: 'pending', timestamp: new Date().toISOString()
           };
           productTasks.forEach(st => { if(!entryData.sizes[st.size]) entryData.sizes[st.size] = 0; entryData.sizes[st.size] += 1; });
           newEntries = [entryData, ...newEntries];
        }
        setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
      }
      setSelectedSubTaskIds(new Set()); setImageFiles({ chest: null, waist: null, hip: null }); setImagePreviews({ chest: null, waist: null, hip: null }); showToast("Work completed and logged!"); if (role === 'staff') setActiveTab('tasks');
    } catch(err) { showToast(`Error saving task: ${err.message || "Failed"}`, "error"); }
    setIsUploading(false);
  };

  const handleStartStitching = async (group) => {
    const selected = group.subTasks.filter(st => selectedSubTaskIds.has(st.subId));
    if (selected.length === 0) return;
    if (!useLocalMode) {
      const tasksById = selected.reduce((acc, st) => { if (!acc[st.id]) acc[st.id] = { ...st, selectedQty: 0 }; acc[st.id].selectedQty += 1; return acc; }, {});
      for (const [origId, data] of Object.entries(tasksById)) {
        let assignedTailor = prodForm.tailor; if (role === 'admin' && data.assignee && data.assignee !== 'Any') assignedTailor = data.assignee;
        const startedByName = assignedTailor || 'Unknown';
        const originalDoc = tasks.find(t => t.id === origId); if (!originalDoc) continue;
        const origQty = Number(originalDoc.quantity) || 1; const selQty = data.selectedQty;
        if (selQty >= origQty) await updateDoc(doc(db, 'priority_tasks', origId), { status: 'in_progress', startedBy: startedByName, startedAt: new Date().toISOString() });
        else {
           const { id, ...taskDataWithoutId } = originalDoc;
           await updateDoc(doc(db, 'priority_tasks', origId), { quantity: origQty - selQty });
           await addDoc(collection(db, 'priority_tasks'), { ...taskDataWithoutId, quantity: selQty, status: 'in_progress', startedBy: startedByName, startedAt: new Date().toISOString() });
        }
      }
    }
    setSelectedSubTaskIds(new Set()); setActiveTab('live'); showToast("Started working!");
  };

  const executeCancelSubTask = async (st) => {
    const originalDoc = tasks.find(t => t.id === st.id);
    if (originalDoc) {
        const origQty = Number(originalDoc.quantity) || 1;
        if (origQty <= 1) {
            addToBlacklist([st.id]); setTasks(prev => prev.filter(t => t.id !== st.id));
            if (!useLocalMode) try { await updateDoc(doc(db, 'priority_tasks', st.id), { status: 'cancelled', quantity: 0 }); } catch(e) {}
        } else {
            if (!useLocalMode) try { await updateDoc(doc(db, 'priority_tasks', st.id), { quantity: origQty - 1 }); const { id, ...taskDataWithoutId } = originalDoc; await addDoc(collection(db, 'priority_tasks'), { ...taskDataWithoutId, quantity: 1, status: 'cancelled' }); } catch(e) {}
        }
    }
    setCancellingSubId(null); showToast("Piece removed!");
  };

  const toggleFullScreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => console.log(err)); } else { document.exitFullscreen(); } };

  const timeFilteredEntries = useMemo(() => entries.filter(e => { const d = new Date(e.date); const start = new Date(ledgerStartDate); const end = new Date(ledgerEndDate); return d >= start && d <= end; }), [entries, ledgerStartDate, ledgerEndDate]);
  const tailorFilteredEntries = useMemo(() => selectedTailorFilter === 'All' ? timeFilteredEntries : timeFilteredEntries.filter(e => e.tailor === selectedTailorFilter), [timeFilteredEntries, selectedTailorFilter]);
  
  const finalLedgerEntries = useMemo(() => {
    let result = [...tailorFilteredEntries];
    if (ledgerFilterType === 'credits') result = result.filter(e => e.type === 'production');
    if (ledgerFilterType === 'debits') result = result.filter(e => e.type === 'payment');
    if (ledgerSearch.trim()) {
       const query = ledgerSearch.toLowerCase().trim();
       result = result.filter(e => e.tailor?.toLowerCase().includes(query) || e.product?.toLowerCase().includes(query) || e.note?.toLowerCase().includes(query) || e.orderNumber?.toLowerCase().includes(query));
    }
    result.sort((a, b) => ledgerSortOrder === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));
    return result;
  }, [tailorFilteredEntries, ledgerFilterType, ledgerSortOrder, ledgerSearch]);

  const periodTotals = useMemo(() => tailorFilteredEntries.reduce((acc, curr) => {
      if (curr.type === 'production' && curr.qcStatus !== 'rejected') { acc.pieces += Number(curr.totalPieces) || 0; acc.earned += Number(curr.amount) || 0; }
      else if (curr.type === 'payment') acc.paid += Number(curr.amount) || 0;
      return acc;
    }, { pieces: 0, earned: 0, paid: 0 }), [tailorFilteredEntries]);

  const lifetimeTotals = useMemo(() => {
    const matchingEntries = selectedTailorFilter === 'All' ? entries : entries.filter(e => e.tailor === selectedTailorFilter);
    return matchingEntries.reduce((acc, curr) => {
       if (curr.type === 'production' && curr.qcStatus !== 'rejected') acc.earned += Number(curr.amount) || 0;
       else if (curr.type === 'payment') acc.paid += Number(curr.amount) || 0;
       return acc;
    }, { earned: 0, paid: 0 });
  }, [entries, selectedTailorFilter]);

  const pendingBalance = lifetimeTotals.earned - lifetimeTotals.paid;
  const unpaidPieces = useMemo(() => {
    if (pendingBalance <= 0) return 0;
    let balanceLeft = pendingBalance; let piecesToCover = 0;
    const recentProduction = [...entries].filter(e => e.type === 'production' && e.qcStatus !== 'rejected' && (selectedTailorFilter === 'All' || e.tailor === selectedTailorFilter)).sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const item of recentProduction) {
      if (balanceLeft <= 0) break;
      const rate = Number(item.pieceRate) || 250; const piecesInItem = Number(item.totalPieces) || 0; const valueOfItem = piecesInItem * rate;
      if (balanceLeft >= valueOfItem) { piecesToCover += piecesInItem; balanceLeft -= valueOfItem; } 
      else { piecesToCover += balanceLeft / rate; balanceLeft = 0; }
    }
    return Math.floor(piecesToCover);
  }, [pendingBalance, entries, selectedTailorFilter]);

  const groupedByProduct = useMemo(() => {
    const groups = {};
    finalLedgerEntries.filter(e => e.type === 'production' && e.qcStatus !== 'rejected').forEach(e => {
      const safeProduct = formatProductName(e.product);
      if (!groups[safeProduct]) groups[safeProduct] = { pieces: 0, value: 0, sizes: {} };
      groups[safeProduct].pieces += Number(e.totalPieces) || 0; groups[safeProduct].value += Number(e.amount) || 0;
      if(e.sizes) Object.entries(e.sizes).forEach(([s, q]) => { const numQ = Number(q) || 0; if (numQ > 0) { if(!groups[safeProduct].sizes[s]) groups[safeProduct].sizes[s] = 0; groups[safeProduct].sizes[s] += numQ; } });
    });
    return Object.entries(groups).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.value - a.value);
  }, [finalLedgerEntries]);

  const groupedByTailor = useMemo(() => {
    const groups = {};
    entries.forEach(e => {
        if (!groups[e.tailor]) groups[e.tailor] = { lifetimeEarned: 0, lifetimePaid: 0, periodPieces: 0, periodEarned: 0, periodPaid: 0 };
        if (e.type === 'production' && e.qcStatus !== 'rejected') groups[e.tailor].lifetimeEarned += Number(e.amount) || 0;
        else if (e.type === 'payment') groups[e.tailor].lifetimePaid += Number(e.amount) || 0;
    });
    finalLedgerEntries.forEach(e => {
      if (!groups[e.tailor]) groups[e.tailor] = { lifetimeEarned: 0, lifetimePaid: 0, periodPieces: 0, periodEarned: 0, periodPaid: 0 };
      if (e.type === 'production' && e.qcStatus !== 'rejected') { groups[e.tailor].periodPieces += Number(e.totalPieces) || 0; groups[e.tailor].periodEarned += Number(e.amount) || 0; } 
      else if (e.type === 'payment') groups[e.tailor].periodPaid += Number(e.amount) || 0;
    });
    return Object.entries(groups).filter(([name, data]) => data.lifetimeEarned > 0 || data.lifetimePaid > 0).map(([name, data]) => ({ name, ...data })).sort((a, b) => (b.lifetimeEarned - b.lifetimePaid) - (a.lifetimeEarned - a.lifetimePaid));
  }, [entries, finalLedgerEntries]);

  const groupedByPlatform = useMemo(() => {
    const groups = {};
    finalLedgerEntries.filter(e => e.type === 'production' && e.qcStatus !== 'rejected').forEach(e => {
      const plat = e.platform || 'Shopify / Website'; if (!groups[plat]) groups[plat] = { pieces: 0, value: 0 };
      groups[plat].pieces += Number(e.totalPieces) || 0; groups[plat].value += Number(e.amount) || 0;
    });
    return Object.entries(groups).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.value - a.value);
  }, [finalLedgerEntries]);

  const currentSelectedProductImage = useMemo(() => findProductImage(prodForm.product), [prodForm.product, products]);

  const renderPhotoUploader = (currentWorkType = 'Both', layout = 'grid') => {
    const isCut = currentWorkType === 'Cut';
    const slots = isCut ? ['chest'] : ['chest', 'waist', 'hip'];

    if (layout === 'compact-sidebar') {
      return (
        <div className="flex flex-col gap-3 w-full">
          {slots.map(slot => (
             <div key={slot} className="flex-1 flex flex-col gap-1 w-full">
                 <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 text-left pl-1">
                   {isCut && slot === 'chest' ? 'Fabric Proof' : slot}
                 </div>
                 {!imagePreviews[slot] ? (
                    <div className="flex gap-2 h-14">
                        <label className="flex-[2] bg-black/40 border border-dashed border-gray-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#cdfc4c] text-gray-500 hover:text-[#cdfc4c] transition-colors relative">
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageChange(e, slot)} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="flex items-center gap-2 text-xs font-bold"><ImageIcon size={14}/> Upload</div>
                        </label>
                        <button type="button" onClick={() => startCamera(slot)} className="flex-1 bg-gray-900/40 border border-dashed border-gray-700 rounded-xl flex items-center justify-center hover:border-sky-500 text-gray-500 hover:text-sky-500 transition-colors">
                            <Camera size={18}/>
                        </button>
                    </div>
                 ) : (
                    <div className="relative w-full h-24 bg-black rounded-xl border border-[#cdfc4c] overflow-hidden group shadow-lg shadow-[#cdfc4c]/10">
                        <img src={imagePreviews[slot]} className="w-full h-full object-cover object-top opacity-80" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => { setImagePreviews(p => ({...p, [slot]: null})); setImageFiles(p => ({...p, [slot]: null})); }} className="p-2 bg-rose-500 hover:bg-rose-600 transition-colors text-white rounded-full shadow-lg"><Trash2 size={14}/></button>
                        </div>
                    </div>
                 )}
             </div>
          ))}
        </div>
      );
    }

    return (
      <div className={layout === 'horizontal' ? 'w-full' : 'pt-4 border-t border-gray-800'}>
        {layout !== 'horizontal' && <label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 mb-4 text-center">{isCut ? 'QC Photo (1 Required)' : 'QC Photos (3 Required)'}</label>}
        <div className={`flex gap-3 ${layout === 'horizontal' ? 'flex-row justify-center w-full max-w-3xl mx-auto' : (isCut ? 'flex-col max-w-xs mx-auto' : 'grid grid-cols-3')}`}>
          {slots.map(slot => (
             <div key={slot} className={`flex flex-col gap-2 ${layout === 'horizontal' ? 'flex-1' : ''}`}>
                 <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 text-center">{isCut && slot === 'chest' ? 'Fabric Proof' : slot}</div>
                 {!imagePreviews[slot] ? (
                    <div className={`flex gap-2 ${layout === 'horizontal' ? 'flex-col sm:flex-row h-12' : 'flex-col'}`}>
                        <label className={`flex-1 bg-black/40 border border-dashed border-gray-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#cdfc4c] text-gray-500 hover:text-[#cdfc4c] transition-colors relative ${layout !== 'horizontal' ? 'h-12 w-full' : 'h-full'}`}>
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageChange(e, slot)} className="absolute inset-0 opacity-0 cursor-pointer" /><ImageIcon size={16}/>
                        </label>
                        <button type="button" onClick={() => startCamera(slot)} className={`flex-1 bg-gray-900/40 border border-dashed border-gray-700 rounded-xl flex items-center justify-center hover:border-sky-500 text-gray-500 hover:text-sky-500 transition-colors ${layout !== 'horizontal' ? 'h-12 w-full' : 'h-full'}`}>
                            <Camera size={16}/>
                        </button>
                    </div>
                 ) : (
                    <div className={`relative w-full ${layout === 'horizontal' ? 'h-12' : 'h-28'} bg-black rounded-xl border border-[#cdfc4c] overflow-hidden group shadow-lg shadow-[#cdfc4c]/10`}>
                        <img src={imagePreviews[slot]} className="w-full h-full object-cover object-top opacity-80" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => { setImagePreviews(p => ({...p, [slot]: null})); setImageFiles(p => ({...p, [slot]: null})); }} className={`p-2 ${layout === 'horizontal' ? 'bg-rose-500' : 'p-2.5 bg-rose-500'} hover:bg-rose-600 transition-colors text-white rounded-full shadow-lg`}><Trash2 size={layout === 'horizontal' ? 12 : 16}/></button>
                        </div>
                        <div className="absolute bottom-1 right-1 bg-[#cdfc4c] text-black text-[9px] font-black px-1 py-0.5 rounded shadow flex items-center gap-1"><CheckCircle size={8}/></div>
                    </div>
                 )}
             </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLiveQueue = () => {
    const liveTasks = tasks.filter(t => t.status === 'in_progress');
    const tasksByTailor = liveTasks.reduce((acc, t) => {
      const tailor = t.startedBy || 'Unknown';
      if (role === 'admin' && liveTailorFilter !== 'All' && tailor !== liveTailorFilter) return acc;
      if (!acc[tailor]) acc[tailor] = [];
      const qty = Number(t.quantity) || 1;
      for (let i = 0; i < qty; i++) acc[tailor].push({ ...t, subId: `${t.id}-live-${i}`, quantity: 1 });
      return acc;
    }, {});

    const navigateStack = (tailorName, newIndex, totalItems) => {
        if (totalItems <= 1) return;
        const wrappedIndex = (newIndex % totalItems + totalItems) % totalItems;
        setActiveStackIndex(prev => ({ ...prev, [tailorName]: wrappedIndex }));
    };

    const handleWheel = (e, tailorName, totalItems, currentIndex) => {
        if (wheelLockout.current || totalItems <= 1) return;
        
        wheelAccumulator.current += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
        
        const threshold = 50; 
        
        if (Math.abs(wheelAccumulator.current) > threshold) {
            wheelLockout.current = true;
            const direction = wheelAccumulator.current > 0 ? 1 : -1;
            navigateStack(tailorName, currentIndex + direction, totalItems);
            wheelAccumulator.current = 0;
            
            setTimeout(() => { wheelLockout.current = false; }, 400); 
        }
    };

    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e, tailorName, totalItems, currentIndex) => {
        if (touchStartX.current === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchStartX.current - touchEndX;
        if (Math.abs(deltaX) > 40) navigateStack(tailorName, currentIndex + (deltaX > 0 ? 1 : -1), totalItems);
        touchStartX.current = null;
    };

    return (
      <div className={`w-full ${isFullscreen ? 'h-screen absolute inset-0 z-40 bg-[#050505]' : 'flex-1'} flex flex-col overflow-hidden animate-in fade-in relative`}>
        <div className="flex items-center justify-between gap-4 p-4 md:px-8 md:py-5 z-40 absolute top-0 left-0 w-full pointer-events-none bg-gradient-to-b from-black/90 via-black/40 to-transparent pb-16">
           <div className="flex items-center gap-6 pointer-events-auto">
             <div>
               <h2 className="font-black tracking-tight text-white flex items-center gap-2 text-2xl md:text-3xl"><Activity size={24} className="text-purple-500"/> Live Floor</h2>
               <p className="text-gray-400 mt-1 text-xs md:text-sm">Factory Production Dashboard</p>
             </div>
             {role === 'admin' && (
               <div className="relative shadow-xl">
                 <User size={14} className="absolute left-3 top-3 text-purple-400"/>
                 <select value={liveTailorFilter} onChange={(e) => setLiveTailorFilter(e.target.value)} className="pl-9 pr-8 py-2 bg-purple-900/30 backdrop-blur-md border border-purple-500/50 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-purple-500 outline-none appearance-none text-purple-300 font-bold cursor-pointer transition-colors hover:bg-purple-900/50">
                   <option value="All" className="bg-[#111] text-white">Viewing All Floor</option>
                   {tailors.map(t => <option key={t} value={t} className="bg-[#111] text-white">Floor: {t}</option>)}
                 </select>
                 <ChevronDown size={14} className="absolute right-3 top-3 text-purple-400 pointer-events-none"/>
               </div>
             )}
           </div>
           <div className="pointer-events-auto">
             <button onClick={toggleFullScreen} className="flex items-center justify-center gap-2 bg-purple-900/40 hover:bg-purple-500 border border-purple-500/50 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-2xl backdrop-blur-md whitespace-nowrap">
               {isFullscreen ? <><Minimize size={16}/> Exit Kiosk</> : <><Maximize size={16}/> Fullscreen</>}
             </button>
           </div>
        </div>

        {!prodForm.tailor && role !== 'admin' && (
           <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-6 py-2 rounded-full shadow-2xl text-xs font-black whitespace-nowrap">
               Go to "Add Batch" to select your name!
           </div>
        )}

        {Object.keys(tasksByTailor).length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-20 min-h-[60vh]">
            <div className="bg-[#111] border border-gray-800 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg mx-auto text-center">
               <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6 border border-gray-800"><Scissors size={32} className="text-gray-500" /></div>
               <h3 className="text-xl md:text-2xl font-black text-white mb-2">{liveTailorFilter !== 'All' ? `No active pieces for ${liveTailorFilter}.` : 'The floor is quiet right now.'}</h3>
               <p className="text-gray-500 text-sm font-bold">Waiting for tailors to start working on priority tasks.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col w-full relative overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth no-scrollbar">
            {Object.entries(tasksByTailor).map(([tailorName, items]) => {
              const isMyWork = prodForm.tailor === tailorName || role === 'admin';
              if (isFullscreen && !isMyWork) return null;

              const currentIndex = activeStackIndex[tailorName] || 0;
              const selectedSubTasks = items.filter(st => selectedSubTaskIds.has(st.subId));
              const hasSelection = selectedSubTasks.length > 0;
              const requiresThree = selectedSubTasks.some(st => st.workType !== 'Cut');
              const uploaderWorkType = requiresThree ? 'Both' : 'Cut';
              const canSubmit = hasSelection && (requiresThree ? (imagePreviews.chest && imagePreviews.waist && imagePreviews.hip) : imagePreviews.chest);

              return (
                <div key={tailorName} className={`w-full ${isFullscreen ? 'h-screen' : 'h-[90vh] min-h-[600px] max-h-[1000px]'} shrink-0 snap-start relative flex flex-col bg-[#050505] overflow-hidden border-b border-gray-900`}>
                  
                  {/* Floating Tailor Header */}
                  <div className="absolute top-24 left-6 md:left-8 z-30 flex items-center gap-4 pointer-events-none drop-shadow-2xl">
                     <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-xl shrink-0"><User size={24}/></div>
                     <div>
                        <h3 className="text-2xl md:text-4xl font-black text-white leading-none">{tailorName}</h3>
                        <div className="text-[9px] md:text-xs text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1.5"><Scissors size={10}/> {items.length} active pieces</div>
                     </div>
                  </div>

                  {/* Right Side Floating Stack Countdown Tracker */}
                  {items.length > 1 && !hasSelection && (
                    <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-4 pointer-events-auto">
                       <div className="bg-[#111]/80 backdrop-blur-xl border border-gray-700 rounded-full p-2 flex flex-col items-center justify-center gap-4 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                          <button onClick={(e) => { e.stopPropagation(); navigateStack(tailorName, currentIndex - 1, items.length); }} className="w-10 h-10 rounded-full bg-black border border-gray-600 text-white flex items-center justify-center hover:bg-gray-800 transition-colors"><ChevronUp size={16}/></button>
                          
                          <div className="w-12 h-12 rounded-full bg-purple-900/30 border border-purple-500/50 flex items-center justify-center text-white font-black text-lg shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                              {items.length - currentIndex}
                          </div>
                          
                          <div className="w-0.5 h-20 bg-gray-700 rounded-full"></div>
                          <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Pending In Stack</div>
                          
                          <button onClick={(e) => { e.stopPropagation(); navigateStack(tailorName, currentIndex + 1, items.length); }} className="w-10 h-10 rounded-full bg-black border border-gray-600 text-white flex items-center justify-center hover:bg-gray-800 transition-colors"><ChevronDown size={16}/></button>
                       </div>
                    </div>
                  )}

                  {/* Edge-to-Edge Cover Flow */}
                  <div 
                    className={`flex-1 relative flex items-center justify-center w-full h-full touch-pan-y select-none transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${hasSelection ? 'md:-translate-x-[140px]' : ''}`}
                    onWheel={(e) => handleWheel(e, tailorName, items.length, currentIndex)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => handleTouchEnd(e, tailorName, items.length, currentIndex)}
                  >
                     <div className="w-full h-full relative flex items-center justify-center perspective-[2000px] preserve-3d">
                        {items.map((st, i) => {
                           const entryImage = findProductImage(st.product);
                           let startTime = 'Just now';
                           if (st.startedAt) {
                               const stDate = new Date(st.startedAt);
                               if (!isNaN(stDate)) startTime = stDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                           }
                           const isSelected = selectedSubTaskIds.has(st.subId);
                           
                           let offset = i - currentIndex;
                           if (items.length > 2) {
                              if (offset > items.length / 2) offset -= items.length;
                              else if (offset < -items.length / 2) offset += items.length;
                           }

                           const isCenter = offset === 0;
                           const absOffset = Math.abs(offset);
                           const sign = Math.sign(offset);
                           
                           if (absOffset > 1) return null; 

                           const translateX = isCenter ? '0%' : `${sign * 95}%`; 
                           const translateZ = isCenter ? '0px' : '-400px';
                           const rotateY = isCenter ? '0deg' : `${-sign * 5}deg`;
                           const scale = isCenter ? 1 : 0.85;
                           const blurAmount = isCenter ? 0 : 8;
                           const opacity = isCenter ? 1 : (items.length > 2 ? 0.3 : 0); 
                           const zIndex = 50 - absOffset;

                           return (
                             <div 
                               key={st.subId}
                               onClick={() => {
                                 if (!isCenter && isMyWork) navigateStack(tailorName, i, items.length);
                                 else if (isCenter && isMyWork) toggleSubTaskSelection(st.subId);
                               }}
                               className={`absolute top-1/2 left-1/2 rounded-[2.5rem] overflow-hidden flex flex-col justify-end backdrop-blur-xl shadow-[0_30px_60px_rgba(0,0,0,0.8)]
                                 ${isMyWork ? (isCenter ? 'cursor-pointer' : 'cursor-pointer') : 'opacity-50 grayscale pointer-events-none'} 
                                 ${isSelected && isCenter ? 'border-4 border-[#cdfc4c] shadow-[0_0_50px_rgba(205,252,76,0.3)] ring-4 ring-[#cdfc4c]/30' : 'border-[3px] border-gray-800 hover:border-gray-600 transition-colors'}
                               `}
                               style={{
                                  transform: `translate(-50%, -50%) translateX(${translateX}) translateZ(${translateZ}) rotateY(${rotateY}) scale(${scale})`,
                                  zIndex, opacity, filter: `blur(${blurAmount}px)`, visibility: opacity === 0 ? 'hidden' : 'visible',
                                  width: 'min(90vw, 550px)', height: 'min(75vh, 650px)',
                                  transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease, filter 0.6s ease, border 0.3s ease'
                               }}
                             >
                                {entryImage ? (
                                   <img src={entryImage} className="absolute inset-0 w-full h-full object-cover object-top opacity-90 pointer-events-none" />
                                ) : (
                                   <div className="absolute inset-0 bg-gray-900 flex items-center justify-center"><ImageIcon className="text-gray-800 w-32 h-32 opacity-50" /></div>
                                )}
                                
                                <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${isSelected && isCenter ? 'bg-gradient-to-t from-[#cdfc4c]/30 via-black/40 to-black/10' : 'bg-gradient-to-t from-black/90 via-black/40 to-black/10'}`}></div>

                                {/* Top Left Badges */}
                                <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
                                    <span className={`px-4 py-2 rounded-xl backdrop-blur-xl text-xs font-black flex items-center gap-1.5 shadow-2xl border ${st.workType === 'Cut' ? 'bg-yellow-500 text-black border-yellow-400 shadow-yellow-500/20' : (st.workType === 'Stitch' ? 'bg-blue-500 text-white border-blue-400 shadow-blue-500/20' : 'bg-purple-500 text-white border-purple-400 shadow-purple-500/20')}`}>
                                      {st.workType === 'Cut' ? '✂️ CUT ONLY' : (st.workType === 'Stitch' ? '🧵 STITCH ONLY' : '✂️+🧵 BOTH')}
                                    </span>
                                </div>

                                {isMyWork && isCenter && (
                                  <div className="absolute top-6 right-6 z-20">
                                     <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-xl ${isSelected ? 'border-[#cdfc4c] bg-[#cdfc4c] scale-110' : 'border-white/20 bg-black/40 hover:border-white/60 hover:bg-black/60'}`}>
                                        {isSelected && <CheckCircle size={28} className="text-black" />}
                                     </div>
                                  </div>
                                )}

                                <div className="relative w-full p-6 md:p-8 z-20 flex flex-col justify-end pointer-events-none mt-auto">
                                   <div className="mb-4 flex items-end justify-between pointer-events-auto">
                                      <div className={`text-6xl md:text-7xl font-black uppercase tracking-tighter px-6 py-2 rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.8)] border-[4px] transition-colors inline-block ${isSelected ? 'bg-[#cdfc4c] text-black border-[#cdfc4c]' : 'bg-black/80 text-[#cdfc4c] border-[#cdfc4c] backdrop-blur-xl'}`}>
                                         SIZE {st.size}
                                      </div>
                                      
                                      {isMyWork && isCenter && (
                                         <button onClick={(e) => { e.stopPropagation(); handleDropTask(st.id); }} className="w-14 h-14 rounded-full bg-black/80 border-2 border-gray-700 text-gray-400 hover:bg-rose-500 hover:border-rose-500 hover:text-white flex items-center justify-center transition-all backdrop-blur-xl shadow-2xl shrink-0 ml-4 pointer-events-auto" title="Drop Item">
                                            <Trash2 size={20} />
                                         </button>
                                      )}
                                   </div>

                                   <div className="flex flex-col pointer-events-auto max-w-[85%] pr-4">
                                     <div className="flex items-center gap-2 mb-2 opacity-90 drop-shadow-md">
                                       <Activity size={14} className="text-purple-300"/>
                                       <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">{startTime}</span>
                                     </div>
                                     <div className={`font-black text-3xl md:text-4xl leading-tight line-clamp-2 drop-shadow-[0_4px_15px_rgba(0,0,0,0.8)] mb-3 ${isSelected ? 'text-white' : 'text-gray-100'}`}>
                                        {formatProductName(st.product)}
                                     </div>
                                     <div className="flex flex-wrap items-center gap-2">
                                       <div className="text-[10px] text-white font-bold bg-purple-900/80 border border-purple-500/50 px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-xl backdrop-blur-md">
                                         {st.platform === 'Shopify / Website' ? 'Shopify' : (st.platform || 'Shopify')}
                                       </div>
                                       {st.orderNumber && (
                                         <div className="text-[10px] text-white font-bold bg-blue-900/80 border border-blue-500/50 px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-xl backdrop-blur-md">
                                           Ord: {st.orderNumber}
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                </div>
                             </div>
                           )
                        })}
                     </div>
                  </div>

                  {/* Right Side Sliding QC Drawer */}
                  {isMyWork && (
                     <div className={`absolute top-0 right-0 h-full w-72 md:w-80 z-50 transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform ${hasSelection ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}>
                        <div className="h-full w-full bg-[#0a0a0a]/95 backdrop-blur-3xl border-l border-gray-800 p-5 md:p-6 flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.8)] pt-24 md:pt-28 pb-safe">
                           
                           <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-5">
                              <div className="w-10 h-10 rounded-full bg-[#cdfc4c]/10 flex items-center justify-center border border-[#cdfc4c]/30 text-[#cdfc4c] shrink-0">
                                 <CheckCircle size={20}/>
                              </div>
                              <div>
                                 <div className="text-xl font-black text-white leading-none">{selectedSubTasks.length} Selected</div>
                                 <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-1">Ready for QC</div>
                              </div>
                           </div>

                           <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-2 pb-4">
                              {renderPhotoUploader(uploaderWorkType, 'compact-sidebar')}
                           </div>

                           <div className="mt-auto pt-4 border-t border-gray-800">
                              <button disabled={isUploading || !canSubmit} onClick={(e) => handleCompleteLiveSelection(e, tailorName, items)} className={`w-full py-4 text-black font-black tracking-wide rounded-xl disabled:opacity-50 transition-all shadow-xl text-sm flex items-center justify-center gap-2 shrink-0 ${canSubmit ? 'bg-[#cdfc4c] hover:bg-[#b5e638] shadow-[#cdfc4c]/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}>
                                 {isUploading ? <><Loader2 className="animate-spin" size={16}/> Submitting...</> : (!canSubmit ? (requiresThree ? 'Add 3 Photos' : 'Add Proof') : `Submit ${selectedSubTasks.length}`)}
                              </button>
                           </div>
                        </div>
                     </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTasks = () => {
    const PRIORITY_WEIGHT = { '1': 4, '2': 3, '3': 2, '4': 1, 'Urgent': 4, 'High': 3, 'Normal': 2, 'Low': 1 };
    const getNormalizedPriority = (p) => {
        if (p === '1' || p === 'Urgent') return '1';
        if (p === '2' || p === 'High') return '2';
        if (p === '3' || p === 'Normal' || !p) return '3';
        if (p === '4' || p === 'Low') return '4';
        return '3';
    };

    const updateTaskField = async (taskId, field, newValue) => {
        if(useLocalMode) return;
        const originalTask = tasks.find(t => t.id === taskId);
        if(originalTask) {
            if (Number(originalTask.quantity) <= 1) {
                await updateDoc(doc(db, 'priority_tasks', originalTask.id), { [field]: newValue });
            } else {
                const { id, ...taskDataWithoutId } = originalTask;
                await updateDoc(doc(db, 'priority_tasks', originalTask.id), { quantity: Number(originalTask.quantity) - 1 });
                await addDoc(collection(db, 'priority_tasks'), { ...taskDataWithoutId, quantity: 1, [field]: newValue });
            }
            showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated!`);
        }
    };

    const filteredPendingTasks = tasks.filter(t => {
      if (t.status !== 'pending' && t.status !== 'rejected') return false;
      const priority = getNormalizedPriority(t.priority);
      if (taskFilterOption === 'Urgent' && priority !== '1') return false;
      const taskAssignee = t.assignee || 'Any';
      if (taskFilterOption === 'Mine' && taskAssignee !== prodForm.tailor && role !== 'admin') return false;
      if (taskSearchQuery && !formatProductName(t.product).toLowerCase().includes(String(taskSearchQuery).toLowerCase())) return false;
      return true;
    });

    const allGroupedCards = filteredPendingTasks.reduce((acc, t) => {
      const plat = t.platform || 'Shopify / Website';
      const taskPriority = getNormalizedPriority(t.priority);
      const safeProduct = formatProductName(t.product);
      const groupKey = `${safeProduct}-${t.workType || 'Both'}-${plat}`;
      
      if (!acc[groupKey]) {
        acc[groupKey] = { id: groupKey, product: safeProduct, platform: plat, workType: t.workType || 'Both', subTasks: [], status: t.status, oldestTask: t.createdAt, highestPriority: taskPriority, highestPriorityWeight: PRIORITY_WEIGHT[taskPriority] || 2 };
      } else {
        const weight = PRIORITY_WEIGHT[taskPriority] || 2;
        if (weight > acc[groupKey].highestPriorityWeight) { acc[groupKey].highestPriority = taskPriority; acc[groupKey].highestPriorityWeight = weight; }
      }
      
      const qty = Number(t.quantity) || 1;
      if (t.status === 'rejected') acc[groupKey].status = 'rejected';
      if (new Date(t.createdAt) < new Date(acc[groupKey].oldestTask)) acc[groupKey].oldestTask = t.createdAt;
      
      for (let i = 0; i < qty; i++) acc[groupKey].subTasks.push({ ...t, subId: `${t.id}-${i}`, listIndex: i + 1, quantity: 1, size: t.size, pieceRate: t.pieceRate, priority: taskPriority, assignee: t.assignee, orderNumber: t.orderNumber, workType: t.workType || 'Both' });
      return acc;
    }, {});

    const sortedCards = Object.values(allGroupedCards).sort((a, b) => {
      if (taskSortOption === 'Outfit') {
         const nameCmp = a.product.localeCompare(b.product);
         if (nameCmp !== 0) return nameCmp;
         return b.highestPriorityWeight - a.highestPriorityWeight;
      }
      if (taskSortOption === 'Date') return new Date(a.oldestTask) - new Date(b.oldestTask);
      if (b.highestPriorityWeight !== a.highestPriorityWeight) return b.highestPriorityWeight - a.highestPriorityWeight;
      return a.product.localeCompare(b.product);
    });

    const getPlatformBrand = (plat) => {
        const p = String(plat).toLowerCase();
        if (p.includes('shopify') || p.includes('website')) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', gradient: 'from-emerald-500/20 to-transparent', ring: 'ring-emerald-500', overlay: 'bg-emerald-500/30', hexOverlay: 'rgba(16, 185, 129, 0.4)' };
        if (p.includes('amazon')) return { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/50', gradient: 'from-orange-500/20 to-transparent', ring: 'ring-orange-500', overlay: 'bg-orange-500/30', hexOverlay: 'rgba(249, 115, 22, 0.4)' };
        if (p.includes('myntra')) return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/50', gradient: 'from-rose-500/20 to-transparent', ring: 'ring-rose-500', overlay: 'bg-rose-500/30', hexOverlay: 'rgba(244, 63, 94, 0.4)' };
        return { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/50', gradient: 'from-purple-500/20 to-transparent', ring: 'ring-purple-500', overlay: 'bg-purple-500/30', hexOverlay: 'rgba(168, 85, 247, 0.4)' };
    };

    const renderTaskCard = (group, brandOverride) => {
        const productImage = findProductImage(group.product);
        const isExpanded = expandedTaskGroup === group.id;
        const urgencyClass = getUrgencyStyles(group.oldestTask);
        const brand = brandOverride || getPlatformBrand(group.platform);
        
        const priorityStyles = { '1': 'bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]', '2': 'bg-orange-500/90 text-white border-orange-500', '3': 'bg-black/80 text-white border-gray-600', '4': 'bg-gray-800 text-gray-400 border-gray-700' };
        const pBadge = priorityStyles[group.highestPriority] || priorityStyles['3'];

        return (
          <div key={group.id} className={`shrink-0 snap-start w-full sm:w-[320px] bg-[#111] border rounded-3xl overflow-hidden flex flex-col shadow-2xl relative transition-all duration-300 ${isExpanded ? `ring-2 ${brand.ring} scale-[1.02] z-20` : 'hover:border-gray-600 cursor-pointer'} ${urgencyClass}`} onClick={() => !isExpanded && setExpandedTaskGroup(group.id)}>
             <div className="w-full aspect-[4/5] relative bg-black shrink-0 border-b border-gray-800">
                {productImage ? (
                    <>
                        <img src={productImage} className="absolute inset-0 w-full h-full object-cover opacity-80 object-top" />
                        {taskGroupBy === 'Outfit' && (
                            <div className="absolute inset-0 transition-opacity duration-300 pointer-events-none" style={{ backgroundColor: brand.hexOverlay }}></div>
                        )}
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="text-gray-800 w-16 h-16" /></div>
                )}
                
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                   <span className={`px-2 py-1 rounded-lg border backdrop-blur-md text-xs font-black flex items-center gap-1.5 ${pBadge}`}>
                     {group.highestPriority === '1' && <Flame size={12}/>} P{group.highestPriority} Priority
                   </span>
                   <span className={`px-2 py-1 rounded-lg border backdrop-blur-md text-xs font-black flex items-center gap-1.5 shadow-lg ${group.workType === 'Cut' ? 'bg-yellow-500 text-black border-yellow-400' : (group.workType === 'Stitch' ? 'bg-blue-500 text-white border-blue-400' : 'bg-purple-500 text-white border-purple-400')}`}>
                     {group.workType === 'Cut' ? '✂️ CUT ONLY' : (group.workType === 'Stitch' ? '🧵 STITCH ONLY' : '✂️+🧵 BOTH')}
                   </span>
                   {taskGroupBy === 'Outfit' && (
                     <span className={`px-2 py-1 rounded-lg border backdrop-blur-md text-[10px] font-black uppercase tracking-widest bg-black/80 text-white border-gray-600`}>
                       {group.platform}
                     </span>
                   )}
                </div>
                {group.status === 'rejected' && <div className="absolute top-4 right-4 z-10"><span className="bg-rose-500 text-white border border-rose-400 text-xs font-black px-2 py-1 rounded-lg shadow-lg">REJECTED FIX</span></div>}

                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                   <h3 className="text-xl font-black text-white leading-tight line-clamp-2 drop-shadow-md">{group.product}</h3>
                   <div className="text-sm text-purple-400 font-bold mt-1 uppercase tracking-widest">{group.subTasks.length} Pieces Pending</div>
                </div>
             </div>

             {isExpanded ? (
                <div className="p-4 bg-[#0a0a0a] flex-1 flex flex-col">
                   <div className="flex items-center justify-between mb-4">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Select pieces to start:</div>
                      <div className="flex gap-2">
                         {role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleClearOutfit(group); }} className="text-[10px] text-rose-500 font-black uppercase tracking-widest bg-rose-950/30 px-3 py-1.5 rounded-lg hover:bg-rose-500 hover:text-white transition-colors border border-rose-900/50 flex items-center gap-1"><Trash2 size={12}/> Clear All</button>}
                         <button onClick={(e) => { e.stopPropagation(); setExpandedTaskGroup(null); }} className="text-[10px] text-gray-400 hover:text-white font-black uppercase tracking-widest bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">Close</button>
                      </div>
                   </div>

                   <div className="flex flex-col gap-2 w-full mb-6 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                      {group.subTasks.map(st => (
                        <div key={st.subId} onClick={(e) => { e.stopPropagation(); toggleSubTaskSelection(st.subId); }} className={`flex flex-col gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedSubTaskIds.has(st.subId) ? 'bg-purple-900/20 border-purple-500' : 'bg-[#111] border-gray-800 hover:border-gray-600'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedSubTaskIds.has(st.subId) ? 'border-purple-500 bg-purple-500' : 'border-gray-600'}`}>
                                {selectedSubTaskIds.has(st.subId) && <CheckCircle size={14} className="text-black" />}
                              </div>
                              <span className={`font-bold ${selectedSubTaskIds.has(st.subId) ? 'text-white' : 'text-gray-400'}`}>Size {st.size}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {role === 'admin' && (
                                cancellingSubId === st.subId ? (
                                  <div className="flex items-center gap-2 bg-rose-900/30 p-1 rounded-lg border border-rose-900/50" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-[10px] font-bold text-rose-500 uppercase px-1">Sure?</span>
                                    <button onClick={(e) => { e.stopPropagation(); executeCancelSubTask(st); }} className="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-black uppercase">Yes</button>
                                    <button onClick={(e) => { e.stopPropagation(); setCancellingSubId(null); }} className="px-2 py-1 bg-gray-700 text-white rounded text-[10px] font-black uppercase">No</button>
                                  </div>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setCancellingSubId(st.subId); }} className="p-1.5 text-gray-600 hover:text-rose-500 transition-colors bg-black border border-gray-800 rounded-lg hover:bg-rose-900/30"><Trash2 size={16} /></button>
                                )
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            <select value={st.workType || 'Both'} onChange={(e) => updateTaskField(st.id, 'workType', e.target.value)} className="bg-black border border-gray-700 text-[10px] text-gray-400 font-bold py-1 px-2 rounded outline-none appearance-none cursor-pointer hover:border-gray-500">
                              <option value="Both">Both</option><option value="Cut">Cut</option><option value="Stitch">Stitch</option>
                            </select>
                            <select value={st.assignee || 'Any'} onChange={(e) => updateTaskField(st.id, 'assignee', e.target.value)} className="bg-purple-950/20 border border-purple-900/50 text-[10px] text-purple-400 font-bold py-1 px-2 rounded outline-none appearance-none cursor-pointer hover:border-purple-500 transition-colors">
                              <option value="Any">Any Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input type="text" placeholder="Ord #" defaultValue={st.orderNumber || ''} onBlur={(e) => { if (e.target.value !== (st.orderNumber || '')) updateTaskField(st.id, 'orderNumber', e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} className="bg-black border border-gray-700 text-[10px] text-blue-300 font-bold py-1 px-2 rounded outline-none w-14 sm:w-16 hover:border-blue-500/50 transition-colors"/>
                            <select value={getNormalizedPriority(st.priority)} onChange={(e) => updateTaskField(st.id, 'priority', e.target.value)} className="bg-black border border-gray-700 text-[10px] text-gray-400 font-bold py-1 px-2 rounded outline-none appearance-none cursor-pointer hover:border-gray-500 hidden sm:block">
                              <option value="1">P1</option><option value="2">P2</option><option value="3">P3</option><option value="4">P4</option>
                            </select>
                          </div>
                        </div>
                      ))}
                   </div>

                   <div className="mt-auto pt-4">
                      {(() => {
                         const selectedSubTasks = group.subTasks.filter(st => selectedSubTaskIds.has(st.subId));
                         return (
                            <button onClick={(e) => { e.stopPropagation(); handleStartStitching(group); }} disabled={selectedSubTasks.length === 0} className={`w-full py-3 rounded-xl font-black transition-all ${selectedSubTasks.length > 0 ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                               Start {selectedSubTasks.length > 0 ? selectedSubTasks.length : ''} Pieces
                            </button>
                         )
                      })()}
                   </div>
                </div>
             ) : (
                <div className="p-4 bg-[#0a0a0a] flex items-center justify-between mt-auto border-t border-gray-800 text-sm font-bold text-gray-400">Tap to Open <ChevronDown size={16}/></div>
             )}
          </div>
        );
    };

    return (
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in pb-20 relative px-4 md:px-8">
        <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-xl pt-2 pb-4 border-b border-gray-800 -mx-4 px-4 md:-mx-8 md:px-8">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                 <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-2"><ListTodo size={28} className="text-rose-500"/> Priority Tasks</h2>
                 <p className="text-gray-400 mt-1">Urgent items grouped by your preference.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap">
                 {role === 'admin' && (
                   <div className="relative">
                     <User size={16} className="absolute left-3 top-3 text-purple-400"/>
                     <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full sm:w-auto pl-10 pr-8 py-2 bg-purple-900/20 border border-purple-500/50 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none appearance-none text-purple-300 font-bold cursor-pointer">
                       {tailors.map(t => <option key={t} value={t}>Assign: {t}</option>)}
                     </select>
                     <ChevronDown size={14} className="absolute right-3 top-3.5 text-purple-400 pointer-events-none"/>
                   </div>
                 )}
                 <div className="relative w-full sm:w-48">
                   <Search size={16} className="absolute left-3 top-3 text-gray-500"/>
                   <input type="text" value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} placeholder="Search styles..." className="w-full pl-10 pr-4 py-2 bg-[#111] border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none text-white"/>
                 </div>
                 
                 <div className="relative">
                   <ListTodo size={16} className="absolute left-3 top-3 text-gray-500"/>
                   <select value={taskGroupBy} onChange={(e) => setTaskGroupBy(e.target.value)} className="w-full sm:w-auto pl-10 pr-8 py-2 bg-[#111] border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none appearance-none text-white font-bold cursor-pointer">
                     <option value="Platform">Group: Platform</option><option value="Outfit">Group: Outfit</option>
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none"/>
                 </div>

                 <div className="relative">
                   <Filter size={16} className="absolute left-3 top-3 text-gray-500"/>
                   <select value={taskSortOption} onChange={(e) => setTaskSortOption(e.target.value)} className="w-full sm:w-auto pl-10 pr-8 py-2 bg-[#111] border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none appearance-none text-white font-bold cursor-pointer">
                     <option value="Priority">Sort: Priority</option><option value="Outfit">Sort: Outfit A-Z</option><option value="Date">Sort: Oldest</option>
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none"/>
                 </div>

                 <div className="relative">
                   <Filter size={16} className="absolute left-3 top-3 text-gray-500"/>
                   <select value={taskFilterOption} onChange={(e) => setTaskFilterOption(e.target.value)} className="w-full sm:w-auto pl-10 pr-8 py-2 bg-[#111] border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none appearance-none text-white font-bold cursor-pointer">
                     <option value="All">All Tasks</option><option value="Urgent">Urgent Only</option><option value="Mine">Assigned to Me</option>
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none"/>
                 </div>
              </div>
           </div>
        </div>

        {sortedCards.length === 0 && (
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-16 text-center max-w-2xl mx-auto mt-12">
             <CheckCircle size={64} className="mx-auto mb-6 text-green-500 opacity-50" />
             <h3 className="text-2xl font-black text-white mb-2">Queue is Empty!</h3>
             <p className="text-gray-500">There are no pending tasks matching your current filters.</p>
          </div>
        )}

        {taskGroupBy === 'Platform' ? (
           <div className="flex flex-col gap-6 mt-6">
             {(() => {
                const platformOrder = ['Shopify / Website', 'Amazon', 'Myntra'];
                const cardsByPlat = sortedCards.reduce((acc, card) => { if(!acc[card.platform]) acc[card.platform] = []; acc[card.platform].push(card); return acc; }, {});
                const sortedPlatforms = Object.keys(cardsByPlat).sort((a,b) => {
                    const idxA = platformOrder.indexOf(a); const idxB = platformOrder.indexOf(b);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1; if (idxB !== -1) return 1; return a.localeCompare(b);
                });

                return sortedPlatforms.map(plat => {
                   const groups = cardsByPlat[plat];
                   const brand = getPlatformBrand(plat);
                   const taskCount = groups.reduce((sum, g) => sum + g.subTasks.length, 0);
                   const isPlatformExpanded = expandedPlatforms[plat];

                   return (
                     <div key={plat} className={`relative flex flex-col w-full border ${brand.border} rounded-3xl bg-[#0a0a0a] overflow-hidden shadow-2xl transition-all duration-300`}>
                       <div onClick={() => togglePlatform(plat)} className={`w-full p-5 border-b ${isPlatformExpanded ? brand.border : 'border-transparent'} bg-gradient-to-r ${brand.gradient} flex items-center justify-between relative z-10 cursor-pointer hover:bg-white/5 transition-colors`}>
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-black border ${brand.border} shadow-2xl shrink-0`}><ShoppingBag size={24} className={brand.color}/></div>
                             <div>
                                <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${brand.color}`}>{plat}</h2>
                                <div className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{groups.length} Styles • {taskCount} Pending Pieces</div>
                             </div>
                          </div>
                          <div className={`w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white transition-transform duration-300 ${isPlatformExpanded ? 'rotate-180' : ''}`}><ChevronDown size={20} /></div>
                       </div>
                       {isPlatformExpanded && (
                         <div className="p-4 md:p-6 bg-black/40 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex overflow-x-auto gap-6 pb-8 pt-2 px-2 custom-scrollbar snap-x snap-mandatory items-start">
                               {groups.map(group => renderTaskCard(group, brand))}
                            </div>
                         </div>
                       )}
                     </div>
                   );
                })
             })()}
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
              {sortedCards.map(group => renderTaskCard(group))}
           </div>
        )}
      </div>
    );
  };

  const renderAddBatch = () => (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 md:px-0">
      <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight">{editingEntryId ? 'Edit Log' : 'Log Stitched Batch'}</h2><p className="text-gray-400 mt-2">Record daily production turnaround.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl">
        <form onSubmit={handleProdSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Tailor</label>
              <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none appearance-none">
                <option value="">Select Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Platform</label>
              <select value={prodForm.platform} onChange={(e) => setProdForm({...prodForm, platform: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none appearance-none">
                <option value="Shopify / Website">Shopify / Website</option><option value="Amazon">Amazon</option><option value="Myntra">Myntra</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Order # (Optional)</label>
              <input type="text" value={prodForm.orderNumber} onChange={(e) => setProdForm({...prodForm, orderNumber: e.target.value})} placeholder="e.g. #1024" className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Date</label>
              <input type="date" value={prodForm.date} onChange={(e) => setProdForm({...prodForm, date: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-800 bg-purple-950/10 p-4 rounded-xl mb-4 border border-purple-900/30">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-purple-400 mb-2">Work Performed</label>
              <select value={prodForm.workType} onChange={(e) => { const newWorkType = e.target.value; setProdForm({...prodForm, workType: newWorkType, pieceRate: newWorkType === 'Both' ? 250 : 120}); }} className="w-full px-4 py-3 bg-black border border-purple-900/50 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none appearance-none text-white font-bold">
                  <option value="Both">✂️+🧵 Cutting & Stitching (₹250 base)</option>
                  <option value="Cut">✂️ Cutting Only (₹120 base)</option>
                  <option value="Stitch">🧵 Stitching Only (₹120 base)</option>
              </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Style / Product</label>
            <div className="relative">
              <div className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none cursor-pointer flex items-center justify-between transition-colors hover:border-gray-600" onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}>
                <div className="flex items-center gap-3 overflow-hidden">
                  {currentSelectedProductImage ? <img src={currentSelectedProductImage} alt="Preview" className="w-8 h-8 rounded-md object-cover border border-gray-800 bg-[#111] shrink-0" /> : <div className="w-8 h-8 rounded-md bg-[#111] border border-gray-800 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-gray-600" /></div>}
                  <span className={`truncate font-medium ${prodForm.product ? 'text-white' : 'text-gray-500'}`}>{formatProductName(prodForm.product) || "Select Product"}</span>
                </div>
                <ChevronDown size={18} className={`text-gray-500 transition-transform duration-200 ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isProductDropdownOpen && (
                <><div className="fixed inset-0 z-40" onClick={() => setIsProductDropdownOpen(false)} /><div className="absolute z-50 w-full mt-2 bg-[#111] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"><div className="p-3 border-b border-gray-800 bg-[#0a0a0a] relative"><Search size={16} className="absolute left-6 top-6 text-gray-500" /><input autoFocus type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none"/></div><div className="max-h-72 overflow-y-auto custom-scrollbar flex-1">{products.filter(p => formatProductName(p.name).toLowerCase().includes(productSearch.toLowerCase())).map((p, i) => (<div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-800/50 last:border-0" onClick={() => { setProdForm({...prodForm, product: formatProductName(p.name)}); setIsProductDropdownOpen(false); setProductSearch(''); }}>{p.image ? <img src={p.image} alt={p.name} className="w-10 h-10 rounded-md object-cover object-top border border-gray-800 bg-black shrink-0" /> : <div className="w-10 h-10 rounded-md bg-black border border-gray-800 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-gray-600" /></div>}<span className="text-sm font-medium text-gray-200 hover:text-white">{formatProductName(p.name)}</span></div>))}</div></div></>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-4 text-center">Quantities by Size</label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
              {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => (
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

          {renderPhotoUploader(prodForm.workType, 'horizontal')}

          <button type="submit" disabled={isUploading} className="w-full py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-black tracking-wide rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-[#cdfc4c]/10 mt-6 text-lg">
            {isUploading ? 'Uploading Securely...' : (editingEntryId ? 'Update Batch Log' : 'Submit Batch for QC Review')}
          </button>
        </form>
      </div>
    </div>
  );

  const renderAdminLedger = () => (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20 px-4 md:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-3xl font-black text-white tracking-tight">Financial Ledger</h2><p className="text-gray-400 text-sm mt-1">Real-time ledger and balances.</p></div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select value={selectedTailorFilter} onChange={(e) => setSelectedTailorFilter(e.target.value)} className="bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none w-full sm:w-auto cursor-pointer">
            <option value="All">All Tailors Combined</option>{tailors.map(t => <option key={t} value={t}>{t} Only</option>)}
          </select>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <input type="date" value={ledgerStartDate} onChange={(e) => setLedgerStartDate(e.target.value)} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-3 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
             <span className="text-gray-500 text-[10px] font-bold uppercase">to</span>
             <input type="date" value={ledgerEndDate} onChange={(e) => setLedgerEndDate(e.target.value)} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-3 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-[#cdfc4c] to-[#a3d827] rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(205,252,76,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div><div className="text-black/60 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertCircle size={14}/> Total Lifetime Pending</div><div className="text-5xl md:text-6xl font-black text-black tracking-tighter">₹{pendingBalance.toLocaleString()}</div></div>
          <div className="mt-6 text-sm font-bold text-black/80 flex items-center gap-2 bg-black/5 px-4 py-2 rounded-xl inline-flex w-fit backdrop-blur-sm"><Shirt size={16}/> Equates to ~{unpaidPieces} unpaid pieces</div>
        </div>
        <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between">
           <div><div className="text-rose-500/80 text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1"><Calendar size={10}/> Earned In Period</div><div className="text-3xl md:text-4xl font-black text-white">₹{periodTotals.earned.toLocaleString()}</div></div>
           <div className="mt-6 text-gray-500 text-sm font-bold flex items-center gap-1.5"><Scissors size={14}/> {periodTotals.pieces} pieces stitched</div>
        </div>
        <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between">
           <div><div className="text-sky-400/80 text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1"><Calendar size={10}/> Paid In Period</div><div className="text-3xl md:text-4xl font-black text-white">₹{periodTotals.paid.toLocaleString()}</div></div>
           <div className="mt-6 text-gray-500 text-sm font-bold flex items-center gap-1.5"><Wallet size={14}/> Cash payouts</div>
        </div>
      </div>
      <div className="mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-[#111] p-4 rounded-2xl border border-gray-800">
           <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select value={ledgerViewMode} onChange={(e) => setLedgerViewMode(e.target.value)} className="bg-black border border-gray-700 text-sm font-bold text-white py-2 px-4 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-[#cdfc4c]">
                <option value="tailor">Group by Tailor (Statements)</option><option value="detailed">Detailed List</option><option value="outfit">Group by Outfit</option><option value="platform">Group by Platform</option>
              </select>
              {ledgerViewMode === 'detailed' && (
                <select value={ledgerFilterType} onChange={(e) => setLedgerFilterType(e.target.value)} className="bg-black border border-gray-700 text-sm font-bold text-white py-2 px-4 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-[#cdfc4c]">
                  <option value="all">All Transactions</option><option value="credits">Credits Only (+)</option><option value="debits">Debits Only (-)</option>
                </select>
              )}
           </div>
           <div className="flex items-center gap-3 w-full md:w-auto">
              {ledgerViewMode === 'detailed' && (<div className="relative w-full md:w-64"><Search size={16} className="absolute left-3 top-3 text-gray-500"/><input type="text" value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Search records..." className="w-full pl-9 pr-4 py-2 bg-black border border-gray-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none"/></div>)}
              <span className="text-xs bg-gray-800 text-gray-400 px-3 py-2 rounded-xl font-bold whitespace-nowrap hidden sm:block">{ledgerViewMode === 'detailed' ? finalLedgerEntries.length : (ledgerViewMode === 'outfit' ? groupedByProduct.length : (ledgerViewMode === 'platform' ? groupedByPlatform.length : groupedByTailor.length))} Records</span>
           </div>
        </div>
        
        <div className="w-full">
          {ledgerViewMode === 'detailed' ? (
            finalLedgerEntries.length === 0 ? <div className="p-16 text-center text-gray-600 bg-[#111] rounded-3xl border border-gray-800"><FileText size={48} className="mx-auto mb-4 opacity-20" /><p className="font-bold">No transactions found.</p></div> : (
              <div className="space-y-3">
                 {finalLedgerEntries.map((entry) => {
                    const entryImage = findProductImage(entry.product); const isReject = entry.qcStatus === 'rejected'; const isPending = entry.qcStatus === 'pending'; const isApproved = entry.qcStatus === 'approved';
                    return (
                      <div key={entry.id} className={`flex flex-col lg:flex-row gap-4 lg:items-center justify-between p-4 rounded-2xl border transition-all shadow-md ${isReject ? 'bg-rose-950/10 border-rose-900/40 opacity-80' : 'bg-[#111] border-gray-800 hover:border-gray-600'}`}>
                         <div className="flex items-center gap-3 min-w-[200px]"><div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 ${entry.type === 'payment' ? 'bg-sky-900/20 text-sky-400 border border-sky-900/50' : 'bg-gray-800 text-gray-400'}`}>{entry.type === 'payment' ? <Wallet size={20}/> : <User size={20}/>}</div><div><div className="text-white font-black text-base">{entry.tailor}</div><div className="text-gray-500 text-xs font-bold flex items-center gap-1.5 mt-0.5"><Calendar size={12}/> {entry.date}</div></div></div>
                         <div className="flex-1 flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                            {entry.type === 'production' ? (
                               <><div className="shrink-0">{entryImage ? <img src={entryImage} className="w-16 h-16 rounded-xl object-cover bg-black border border-gray-700 shrink-0"/> : <div className="w-16 h-16 rounded-xl bg-black border border-gray-700 flex items-center justify-center shrink-0"><Shirt size={24} className="text-gray-600"/></div>}</div><div className="min-w-0"><div className="text-white font-black text-sm lg:text-base leading-tight mb-1.5 truncate">{formatProductName(entry.product)}</div><div className="flex flex-wrap gap-2"><span className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</span><span className="bg-purple-900/30 text-purple-300 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">{entry.platform || 'Shopify'}</span>{entry.sizes && <span className="bg-blue-900/30 text-blue-300 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">Sizes: {Object.entries(entry.sizes).filter(([_,q])=>Number(q)>0).map(([s,q])=>`${s}:${q}`).join(', ')}</span>}</div></div></>
                            ) : (<div className="flex-1"><div className="text-sky-400 font-black text-base mb-1.5">Cash Payout Settled</div>{entry.note && <div className="text-gray-400 text-xs bg-black/40 px-3 py-1.5 rounded-lg inline-block border border-gray-800/50">{entry.note}</div>}</div>)}
                         </div>
                         <div className="min-w-[120px] text-left lg:text-right px-2 lg:px-4"><div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{entry.type === 'production' ? 'Earned Value' : 'Amount Paid'}</div><div className={`text-2xl font-black tracking-tight ${entry.type === 'production' ? (isReject ? 'text-gray-600 line-through' : 'text-[#cdfc4c]') : 'text-sky-400'}`}>{entry.type === 'payment' ? '-' : '+'} ₹{entry.amount.toLocaleString()}</div></div>
                         <div className="flex flex-col lg:items-end justify-center gap-2 min-w-[200px] border-t lg:border-t-0 lg:border-l border-gray-800 pt-4 lg:pt-0 lg:pl-6">
                            {entry.type === 'production' && (
                               <div className="flex items-center gap-2 w-full lg:justify-end mb-1">
                                  {isPending && (<><button onClick={()=>handleApproveBatch(entry)} className="flex-1 lg:flex-none px-4 py-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-green-500/30 flex items-center justify-center gap-1.5"><CheckCircle size={14}/> Approve</button><button onClick={()=>setRejectingId(entry.id)} className="flex-1 lg:flex-none px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-rose-500/30 flex items-center justify-center gap-1.5"><AlertCircle size={14}/> Reject</button></>)}
                                  {isApproved && <span className="text-green-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20"><CheckCircle size={14}/> Approved</span>}
                                  {isReject && <span className="text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"><AlertCircle size={14}/> Rejected</span>}
                               </div>
                            )}
                            <div className="flex items-center gap-2 w-full lg:justify-end mt-1">
                               {(entry.imageUrls || entry.imageUrl) && (<button onClick={() => setLightboxData({ urls: entry.imageUrls || { old_photo: entry.imageUrl }, timestamp: entry.timestamp, tailor: entry.tailor, product: formatProductName(entry.product), sizes: entry.sizes, workType: entry.workType || 'Both' })} className="px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-400 bg-blue-900/20 border border-blue-900/50 hover:bg-blue-500 hover:text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors flex-1 lg:flex-none"><Camera size={14}/> View QC</button>)}
                               <button onClick={() => startEdit(entry)} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors border border-gray-700" title="Edit"><Edit2 size={16}/></button>
                               {deletingId === entry.id ? (
                                  <div className="flex items-center gap-1 bg-rose-900/30 p-1 rounded-xl border border-rose-900/50"><button onClick={() => deleteEntry(entry.id)} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase transition-colors">Del</button><button onClick={() => setDeletingId(null)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors">No</button></div>
                               ) : (<button onClick={() => setDeletingId(entry.id)} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-rose-600 rounded-xl transition-colors border border-gray-700 hover:border-rose-500" title="Delete"><Trash2 size={16}/></button>)}
                            </div>
                         </div>
                      </div>
                    );
                 })}
              </div>
            )
          ) : ledgerViewMode === 'outfit' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedByProduct.length === 0 ? <div className="col-span-full p-16 text-center text-gray-600 bg-[#111] rounded-3xl border border-gray-800"><p className="font-bold">No production data.</p></div> : groupedByProduct.map((prod, i) => {
                const entryImage = findProductImage(prod.name);
                return (
                  <div key={i} className="bg-[#111] p-5 rounded-3xl border border-gray-800 flex items-center gap-4 hover:border-gray-600 transition-colors shadow-lg">
                    {entryImage ? <img src={entryImage} className="w-20 h-20 rounded-2xl object-cover bg-black border border-gray-700 shrink-0" /> : <div className="w-20 h-20 rounded-2xl bg-black border border-gray-700 flex items-center justify-center shrink-0"><Shirt size={28} className="text-gray-600" /></div>}
                    <div className="flex-1 min-w-0"><div className="font-black text-white text-lg leading-tight truncate mb-1">{formatProductName(prod.name)}</div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest line-clamp-1">Sizes: <span className="text-gray-300">{Object.entries(prod.sizes).map(([s, q]) => `${s}:${q}`).join(', ')}</span></div><div className="mt-2 text-[#cdfc4c] font-black text-xl">₹{prod.value.toLocaleString()}</div></div>
                    <div className="text-right shrink-0 bg-gray-900 rounded-xl p-3 border border-gray-800"><div className="text-2xl font-black text-white">{prod.pieces}</div><div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Pcs</div></div>
                  </div>
              )})}
            </div>
          ) : ledgerViewMode === 'platform' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {groupedByPlatform.length === 0 ? <div className="col-span-full p-16 text-center text-gray-600 bg-[#111] rounded-3xl border border-gray-800"><p className="font-bold">No production data.</p></div> : groupedByPlatform.map((plat, i) => (
                <div key={i} className="bg-[#111] p-6 rounded-3xl border border-gray-800 hover:border-gray-600 transition-colors shadow-lg flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 rounded-2xl bg-purple-900/20 border border-purple-900/50 flex items-center justify-center text-purple-400"><ShoppingBag size={20}/></div><div className="font-black text-white text-2xl">{plat.name}</div></div>
                  <div className="space-y-3"><div className="flex justify-between items-center"><span className="text-gray-500 font-bold text-sm uppercase tracking-widest">Pieces</span><span className="font-black text-xl text-white">{plat.pieces}</span></div><div className="w-full h-px bg-gray-800"></div><div className="flex justify-between items-center"><span className="text-gray-500 font-bold text-sm uppercase tracking-widest">Labor Cost</span><span className="font-black text-2xl text-[#cdfc4c]">₹{plat.value.toLocaleString()}</span></div></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groupedByTailor.length === 0 ? <div className="col-span-full p-16 text-center text-gray-600 bg-[#111] rounded-3xl border border-gray-800"><p className="font-bold">No tailors with pending balances.</p></div> : groupedByTailor.map((t, i) => {
                const lifetimePending = t.lifetimeEarned - t.lifetimePaid; const isOwedMoney = lifetimePending > 0;
                return (
                <div key={i} className={`bg-[#111] p-6 rounded-3xl border transition-colors shadow-2xl flex flex-col relative overflow-hidden ${isOwedMoney ? 'border-rose-900/50' : 'border-gray-800'}`}>
                   <div className={`p-5 -mx-6 -mt-6 mb-6 flex justify-between items-center ${isOwedMoney ? 'bg-gradient-to-r from-rose-950/40 to-black border-b border-rose-900/50' : 'bg-gray-900/40 border-b border-gray-800'}`}>
                      <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-black border-2 border-gray-800 flex items-center justify-center text-gray-400"><User size={20}/></div><div className="text-xl font-black text-white">{t.name}</div></div>
                      <div className="text-right"><div className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-end gap-1 ${isOwedMoney ? 'text-rose-500' : 'text-gray-500'}`}>{isOwedMoney ? <AlertCircle size={10}/> : <CheckCircle size={10}/>} Total Pending</div><div className={`text-3xl font-black tracking-tighter ${isOwedMoney ? 'text-rose-500' : 'text-gray-400'}`}>₹{lifetimePending.toLocaleString()}</div></div>
                   </div>
                   <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"><CalendarRange size={12}/> Activity in selected dates</div>
                   <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-black/40 p-4 rounded-2xl border border-gray-800"><div className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-1">Earned</div><div className="font-black text-[#cdfc4c] text-xl">₹{t.periodEarned.toLocaleString()}</div><div className="text-[9px] text-gray-600 mt-1 font-mono">({t.periodPieces} pieces)</div></div>
                      <div className="bg-black/40 p-4 rounded-2xl border border-gray-800"><div className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-1">Paid</div><div className="font-black text-sky-400 text-xl">₹{t.periodPaid.toLocaleString()}</div></div>
                   </div>
                   <div className="mt-auto flex justify-between items-center border-t border-gray-800 pt-4">
                      <span className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Net change in period</span><span className={`font-black text-lg ${(t.periodEarned - t.periodPaid) > 0 ? 'text-[#cdfc4c]' : (t.periodEarned - t.periodPaid < 0 ? 'text-sky-400' : 'text-gray-500')}`}>{(t.periodEarned - t.periodPaid) > 0 ? '+' : ''}₹{(t.periodEarned - t.periodPaid).toLocaleString()}</span>
                   </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStats = () => {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
          <div><h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-2"><BarChart3 className="text-rose-500" /> Factory Analytics</h2><p className="text-gray-400 mt-1 text-sm">Performance metrics and production trends.</p></div>
          <select value={statsTimeFilter} onChange={(e) => setStatsTimeFilter(e.target.value)} className="bg-[#111] border border-gray-800 text-sm font-bold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none w-full sm:w-auto cursor-pointer">
            <option value="7days">Last 7 Days</option><option value="30days">Last 30 Days</option><option value="all">All Time</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {/* Top Performers Card */}
           <div className="bg-[#111] p-6 rounded-3xl border border-gray-800 shadow-xl col-span-1 md:col-span-2 lg:col-span-2 row-span-2">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={14}/> Top Performing Tailors</h3>
              {groupedByTailor.slice(0, 5).map((t, i) => (
                 <div key={i} className="flex items-center justify-between mb-4 last:mb-0 bg-black/40 p-3 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center font-black text-xs border border-rose-500/30">#{i + 1}</div>
                       <div className="font-bold text-white">{t.name}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-[#cdfc4c] font-black">₹{t.lifetimeEarned.toLocaleString()}</div>
                    </div>
                 </div>
              ))}
              {groupedByTailor.length === 0 && <div className="text-center text-gray-600 py-10 font-bold">No data available</div>}
           </div>

           {/* Platform Distribution */}
           <div className="bg-[#111] p-6 rounded-3xl border border-gray-800 shadow-xl col-span-1 md:col-span-2 lg:col-span-2">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><Target size={14}/> Production by Platform</h3>
              <div className="space-y-4">
                 {groupedByPlatform.map((p, i) => {
                    const totalPieces = groupedByPlatform.reduce((sum, plat) => sum + plat.pieces, 0);
                    const percentage = totalPieces > 0 ? Math.round((p.pieces / totalPieces) * 100) : 0;
                    return (
                       <div key={i}>
                          <div className="flex justify-between text-sm font-bold text-white mb-1"><span>{p.name}</span><span>{percentage}%</span></div>
                          <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                             <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                          <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase">{p.pieces} pieces • ₹{p.value.toLocaleString()}</div>
                       </div>
                    )
                 })}
                 {groupedByPlatform.length === 0 && <div className="text-center text-gray-600 py-4 font-bold">No platform data</div>}
              </div>
           </div>

           {/* Quick Stats */}
           <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-3xl border border-indigo-500/30 shadow-xl flex flex-col justify-center">
              <div className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-2">Total Styles Active</div>
              <div className="text-4xl font-black text-white">{products.length}</div>
           </div>
           <div className="bg-gradient-to-br from-rose-900 to-red-900 p-6 rounded-3xl border border-rose-500/30 shadow-xl flex flex-col justify-center">
              <div className="text-rose-300 text-[10px] font-black uppercase tracking-widest mb-2">Total Tailors</div>
              <div className="text-4xl font-black text-white">{tailors.length}</div>
           </div>
        </div>
      </div>
    );
  };

  const renderAddPay = () => (
    <div className="w-full max-w-lg mx-auto space-y-6 animate-in fade-in duration-500 px-4 md:px-0">
      <div className="text-center mb-8"><h2 className="text-3xl font-black text-white tracking-tight">Record Payout</h2><p className="text-gray-400 mt-2">Log cash payments to tailors.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl">
        <form onSubmit={handlePaySubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Select Tailor</label>
            <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-sky-400 outline-none appearance-none">
              <option value="">Select Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Date</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-sky-400 outline-none"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Amount Paid (₹)</label>
              <div className="relative"><IndianRupee size={16} className="absolute left-4 top-3.5 text-gray-500" /><input type="number" value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: e.target.value})} placeholder="0.00" className="w-full pl-10 pr-4 py-3 bg-black border border-gray-800 rounded-xl font-bold text-white focus:ring-2 focus:ring-sky-400 outline-none"/></div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes / Reference (Optional)</label>
            <input type="text" value={payForm.note} onChange={(e) => setPayForm({...payForm, note: e.target.value})} placeholder="e.g., Weekly Settlement" className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-sky-400 outline-none"/>
          </div>
          <button type="submit" className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-white font-black tracking-wide rounded-xl transition-all shadow-lg shadow-sky-500/20 mt-6 text-lg">
            {editingEntryId ? 'Update Payment Record' : 'Record Payment'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderSignOff = () => {
    const handleSignOffSubmit = async () => {
       if(!payForm.tailor) return showToast("Select tailor first", "error");
       if(!isDrawing && !signatureLocked) return showToast("Signature required", "error");
       
       const signData = canvasRef.current.toDataURL('image/png');
       const amountCleared = groupedByTailor.find(t => t.name === payForm.tailor)?.periodEarned || 0;
       
       const entryData = {
           date: new Date().toISOString().split('T')[0], tailor: payForm.tailor, amount: amountCleared, type: 'payment',
           note: `Cycle Sign-Off (${signOffStartDate} to ${signOffEndDate})`, signature: signData, timestamp: new Date().toISOString()
       };

       try {
           if (useLocalMode) {
               const newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...entries];
               setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
           } else {
               await addDoc(collection(db, 'ledger'), entryData);
           }
           showToast("Cycle Signed Off Successfully!");
           setSignatureLocked(false); if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height); }
           setPayForm({...payForm, tailor: ''});
       } catch (err) { showToast("Failed to save sign-off", "error"); }
    };

    const clearSignature = () => { if(canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height); } setIsDrawing(false); setSignatureLocked(false); };
    const selectedTailorData = groupedByTailor.find(t => t.name === payForm.tailor) || { periodPieces: 0, periodEarned: 0, periodPaid: 0 };

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 px-4 md:px-0 pb-20">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
            <div><h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-2"><PenTool className="text-[#cdfc4c]" /> Weekly Sign-Off</h2><p className="text-gray-400 mt-1 text-sm">Digital signature for payment cycles.</p></div>
            <div className="flex items-center gap-2 w-full md:w-auto bg-[#111] p-2 rounded-xl border border-gray-800">
               <input type="date" value={signOffStartDate} onChange={(e) => setSignOffStartDate(e.target.value)} className="bg-black border border-gray-700 text-xs font-bold text-white py-1.5 px-2 rounded-lg outline-none"/>
               <span className="text-gray-500 text-[10px] font-black uppercase">to</span>
               <input type="date" value={signOffEndDate} onChange={(e) => setSignOffEndDate(e.target.value)} className="bg-black border border-gray-700 text-xs font-bold text-white py-1.5 px-2 rounded-lg outline-none"/>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
               <div className="bg-[#111] p-6 rounded-3xl border border-gray-800 shadow-xl">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Select Tailor for Sign-off</label>
                  <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-base text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none appearance-none font-bold">
                     <option value="">Choose Tailor...</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>

               {payForm.tailor && (
                  <div className="bg-black p-6 rounded-3xl border border-gray-800 shadow-xl">
                     <h3 className="text-white font-black text-xl mb-4">Cycle Summary</h3>
                     <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-800"><span className="text-gray-400 font-bold">Total Pieces Stitched</span><span className="text-white font-black">{selectedTailorData.periodPieces} pcs</span></div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-800"><span className="text-gray-400 font-bold">Total Earned</span><span className="text-white font-black">₹{selectedTailorData.periodEarned.toLocaleString()}</span></div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-800"><span className="text-gray-400 font-bold">Already Paid</span><span className="text-sky-400 font-black">₹{selectedTailorData.periodPaid.toLocaleString()}</span></div>
                        <div className="flex justify-between items-center py-4 mt-2"><span className="text-gray-400 font-black uppercase tracking-widest text-xs">Final Settlement Due</span><span className="text-[#cdfc4c] font-black text-3xl">₹{(selectedTailorData.periodEarned - selectedTailorData.periodPaid).toLocaleString()}</span></div>
                     </div>
                  </div>
               )}
            </div>

            <div className={`bg-[#111] p-6 rounded-3xl border shadow-xl flex flex-col ${payForm.tailor ? 'border-[#cdfc4c]/30' : 'border-gray-800 opacity-50 pointer-events-none'}`}>
               <h3 className="text-white font-black text-xl mb-2 flex items-center gap-2"><PenTool size={20} className="text-[#cdfc4c]"/> Digital Signature</h3>
               <p className="text-gray-400 text-xs mb-6">I confirm the cycle summary is correct and I have received the settlement amount.</p>
               
               <div className="flex-1 bg-white rounded-2xl relative overflow-hidden min-h-[250px] mb-4 border-2 border-dashed border-gray-300">
                  <canvas 
                     ref={canvasRef} width={400} height={250} className="w-full h-full touch-none cursor-crosshair"
                     onMouseDown={(e) => { if(signatureLocked) return; setIsDrawing(true); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); }}
                     onMouseMove={(e) => { if(!isDrawing || signatureLocked) return; const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.stroke(); }}
                     onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}
                     onTouchStart={(e) => { if(signatureLocked) return; setIsDrawing(true); const rect = canvasRef.current.getBoundingClientRect(); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top); }}
                     onTouchMove={(e) => { if(!isDrawing || signatureLocked) return; const rect = canvasRef.current.getBoundingClientRect(); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top); ctx.stroke(); }}
                     onTouchEnd={() => setIsDrawing(false)}
                  />
                  {signatureLocked && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center"><CheckCircle size={48} className="text-green-500 drop-shadow-md"/></div>}
               </div>

               <div className="flex gap-3">
                  <button onClick={clearSignature} className="px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors shrink-0">Clear</button>
                  <button onClick={() => setSignatureLocked(true)} disabled={signatureLocked || (!isDrawing && !canvasRef.current)} className="flex-1 py-4 bg-black border border-gray-700 hover:border-white text-white font-black rounded-xl transition-colors disabled:opacity-50">Lock Signature</button>
               </div>
               
               <button onClick={handleSignOffSubmit} disabled={!signatureLocked} className="w-full mt-4 py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-black tracking-wide rounded-xl transition-all shadow-lg disabled:opacity-30 text-lg flex justify-center items-center gap-2">
                  <CheckCircle size={20}/> Complete Cycle Sign-Off
               </button>
            </div>
         </div>
      </div>
    );
  };

  const renderSetup = () => (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 px-4 md:px-0">
       <div className="border-b border-gray-800 pb-6"><h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-2"><Settings className="text-gray-400" /> Factory Configuration</h2><p className="text-gray-400 mt-1 text-sm">Manage core master data.</p></div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111] rounded-3xl p-6 border border-gray-800 shadow-xl flex flex-col">
             <h3 className="text-white font-black text-lg mb-2 flex items-center gap-2"><User size={18} className="text-purple-400"/> Tailor Roster</h3>
             <p className="text-gray-500 text-xs mb-4">Enter one name per line. These will appear in assignment dropdowns.</p>
             <textarea value={setupForm.tailorsText} onChange={(e) => setSetupForm({...setupForm, tailorsText: e.target.value})} className="w-full h-64 bg-black border border-gray-700 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none font-mono custom-scrollbar" placeholder="John Doe\nJane Smith"/>
          </div>
          <div className="bg-[#111] rounded-3xl p-6 border border-gray-800 shadow-xl flex flex-col">
             <h3 className="text-white font-black text-lg mb-2 flex items-center gap-2"><Shirt size={18} className="text-rose-400"/> Product Catalog</h3>
             <p className="text-gray-500 text-xs mb-4">Format: Product Name [Tab/Comma] Image URL</p>
             <textarea value={setupForm.productsText} onChange={(e) => setSetupForm({...setupForm, productsText: e.target.value})} className="w-full h-64 bg-black border border-gray-700 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none font-mono custom-scrollbar break-pre" placeholder="Wrap Kurti, https://image.url/kurti.jpg\nMaxi Dress, https://image.url/dress.jpg"/>
          </div>
       </div>
       <button onClick={saveConfig} className="w-full py-4 bg-white hover:bg-gray-200 text-black font-black tracking-wide rounded-xl transition-all shadow-xl text-lg flex items-center justify-center gap-2 mt-4"><Check size={20}/> Save Configuration</button>
    </div>
  );

  const renderLogin = () => {
    if (loginStep === 'select') {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-[#111] p-8 rounded-3xl border border-gray-800 text-center shadow-2xl">
            <div className="flex justify-center mb-6"><PoshakhLogo size={64} /></div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Poshakh</h1>
            <p className="text-gray-400 mb-8 font-bold text-sm uppercase tracking-widest">Select Workspace</p>
            <div className="space-y-4">
              <button onClick={() => setLoginStep('pin')} className="w-full py-4 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl text-white font-black text-lg transition-colors flex items-center justify-center gap-3"><Lock size={20} className="text-gray-400" /> Admin Access</button>
              <button onClick={() => handleLogin('staff')} className="w-full py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-black text-lg rounded-xl transition-colors shadow-lg shadow-[#cdfc4c]/10 flex items-center justify-center gap-3"><Scissors size={20} /> Factory Floor (Staff)</button>
            </div>
          </div>
        </div>
      );
    }
    if (loginStep === 'pin') {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 animate-in fade-in slide-in-from-right-4">
          <div className="max-w-md w-full bg-[#111] p-8 rounded-3xl border border-gray-800 text-center shadow-2xl relative">
            <button onClick={() => { setLoginStep('select'); setPinInput(''); }} className="absolute top-6 left-6 text-gray-500 hover:text-white transition-colors p-2"><ChevronLeft size={24} /></button>
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-800"><Lock size={24} className="text-gray-400" /></div>
            <h2 className="text-2xl font-black text-white mb-2">Admin PIN</h2>
            <p className="text-gray-400 mb-8 text-sm">Enter access code to continue</p>
            <form onSubmit={(e) => { e.preventDefault(); handleLogin('admin'); }}>
              <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full text-center text-4xl tracking-[1em] font-black py-4 bg-black border border-gray-700 rounded-xl text-white mb-6 focus:ring-2 focus:ring-purple-500 outline-none" autoFocus placeholder="****" maxLength={4}/>
              <button type="submit" className="w-full py-4 bg-purple-500 hover:bg-purple-400 text-white font-black text-lg rounded-xl transition-all shadow-lg shadow-purple-500/20">Unlock</button>
            </form>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center text-[#cdfc4c] z-50">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <div className="font-bold tracking-widest text-sm uppercase">Loading Cloud Data</div>
        {useLocalMode ? null : (<button onClick={() => setUseLocalMode(true)} className="mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-colors">Work Offline</button>)}
      </div>
    );
  }

  if (!isLoggedIn) return renderLogin();

  return (
    <div className={`min-h-screen w-full bg-[#0a0a0a] text-white font-sans flex flex-col m-0 p-0 overflow-x-hidden ${isFullscreen ? 'pb-0' : 'pb-28 md:pb-28'}`}>
      
      {lightboxData && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in" onClick={() => setLightboxData(null)}>
          <div className="relative w-full max-w-6xl max-h-[100vh] flex flex-col items-center justify-center h-full">
            <button className="absolute top-4 right-4 text-white hover:text-rose-500 transition-colors bg-black/50 p-3 rounded-full z-50 shadow-2xl backdrop-blur-md" onClick={() => setLightboxData(null)}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            
            <div className="flex overflow-x-auto gap-4 w-full p-4 md:p-8 snap-x snap-mandatory custom-scrollbar items-center">
                {Object.entries(lightboxData.urls).filter(([_, url]) => url).map(([slot, url]) => (
                    <div key={slot} className="shrink-0 w-[85vw] md:w-[45vw] lg:w-[30vw] snap-center flex flex-col items-center">
                        <div className="bg-[#cdfc4c] text-black text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-4 shadow-lg">{slot} Measurement</div>
                        <img src={url} className="w-full max-h-[55vh] object-contain rounded-2xl shadow-2xl bg-black/50 border border-gray-800" onClick={(e) => e.stopPropagation()}/>
                    </div>
                ))}
            </div>

            <div className="mt-2 flex flex-col md:flex-row gap-3 w-full max-w-4xl px-4 shrink-0" onClick={(e) => e.stopPropagation()}>
               <div className="bg-[#111] border border-gray-800 rounded-xl p-4 text-center flex-1 shadow-2xl flex flex-col justify-center">
                  <div className="text-white font-bold text-lg leading-tight mb-1">{lightboxData.product}</div>
                  <div className="text-gray-400 text-sm">Stitched by <span className="text-[#cdfc4c] font-bold">{lightboxData.tailor}</span></div>
                  <div className="text-gray-500 text-xs mt-2 flex items-center justify-center gap-1.5">
                     <Clock size={12}/> {new Date(lightboxData.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  {lightboxData.sizes && (
                     <div className="mt-3 pt-3 border-t border-gray-800 text-[11px] text-[#cdfc4c] font-black uppercase tracking-widest">
                        Batch Sizes: {Object.entries(lightboxData.sizes).filter(([_,q])=>Number(q)>0).map(([s,q])=>`${s} (${q})`).join(', ')}
                     </div>
                  )}
               </div>

               <div className="bg-[#111] border border-gray-800 rounded-xl p-3 flex-1 shadow-2xl">
                  <div className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Standard Size Chart (Inches)</div>
                  <table className="w-full text-xs text-center border-collapse">
                     <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                           <th className="pb-1 font-bold">SIZE</th>
                           <th className="pb-1 font-bold">BUST</th>
                           <th className="pb-1 font-bold">WAIST</th>
                           <th className="pb-1 font-bold">HIP</th>
                        </tr>
                     </thead>
                     <tbody className="text-gray-300">
                        {(() => {
                           const activeSizes = lightboxData.sizes ? Object.entries(lightboxData.sizes).filter(([_,q])=>Number(q)>0).map(([s,_])=>s) : [];
                           return ['XS', 'S', 'M', 'L', 'XL'].map((sizeKey) => {
                              const specs = { 'XS': {b:34,w:30,h:38}, 'S': {b:36,w:32,h:40}, 'M': {b:38,w:34,h:42}, 'L': {b:40,w:36,h:44}, 'XL': {b:42,w:38,h:46} }[sizeKey];
                              const isActive = activeSizes.includes(sizeKey);
                              return (
                                 <tr key={sizeKey} className={`border-b border-gray-800/50 transition-colors ${isActive ? 'bg-[#cdfc4c]/10' : 'hover:bg-gray-800/30'}`}>
                                    <td className={`py-1 font-black ${isActive ? 'text-[#cdfc4c]' : 'text-white'}`}>{sizeKey}</td>
                                    <td className={`py-1 ${isActive ? 'text-[#cdfc4c] font-bold' : ''}`}>{specs.b}</td>
                                    <td className={`py-1 ${isActive ? 'text-[#cdfc4c] font-bold' : ''}`}>{specs.w}</td>
                                    <td className={`py-1 ${isActive ? 'text-[#cdfc4c] font-bold' : ''}`}>{specs.h}</td>
                                 </tr>
                              )
                           });
                        })()}
                     </tbody>
                  </table>
               </div>
            </div>

          </div>
        </div>
      )}

      {!isFullscreen && activeTab !== 'live' && (
        <header className="bg-[#022c22] border-b border-[#064e3b] px-6 py-4 flex items-center justify-between sticky top-0 z-40 w-full print:hidden shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-white flex items-center justify-center rounded-lg shadow-sm"><PoshakhLogo size={18} /></div>
            <h1 className="text-xl font-black tracking-tight text-white hidden sm:block">Poshakh</h1>
            {role === 'admin' && (<button onClick={toggleNetworkMode} className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-full cursor-pointer transition-colors border shadow-lg ${useLocalMode ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 hover:bg-yellow-500 hover:text-black' : 'bg-[#cdfc4c] text-black border-[#cdfc4c] hover:bg-[#b5e638]'}`} title="Toggle Network Mode"><RefreshCw size={10} className={useLocalMode ? "" : "animate-spin-slow"} /> {useLocalMode ? 'LOCAL MODE' : 'CLOUD ACTIVE'}</button>)}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block"><div className="text-sm font-bold text-white">{role === 'admin' ? 'Admin' : 'Staff'}</div><div className="text-[10px] text-green-500 font-bold tracking-widest uppercase">Workspace</div></div>
            <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-green-400 border border-green-700"><User size={18} /></div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors ml-2" title="Switch User"><LogOut size={20} /></button>
          </div>
        </header>
      )}

      <main className={`flex-1 relative w-full h-full flex flex-col bg-[#0a0a0a] ${activeTab === 'live' ? 'p-0' : 'pt-6'} print:p-0 print:bg-white transition-all`}>
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'live' && renderLiveQueue()}
        {activeTab === 'add-batch' && renderAddBatch()}
        {role === 'admin' && (
          <>
             {activeTab === 'stats' && renderStats()}
             {activeTab === 'ledger' && renderAdminLedger()}
             {activeTab === 'pay' && renderAddPay()}
             {activeTab === 'sign-off' && renderSignOff()}
             {activeTab === 'setup' && renderSetup()}
          </>
        )}
      </main>

      {!isFullscreen && (
        <nav className="fixed bottom-0 left-0 w-full bg-black/95 backdrop-blur-xl border-t border-gray-900 pb-safe z-50 print:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className={`flex items-center h-20 w-full max-w-5xl mx-auto px-4 ${role === 'staff' ? 'justify-center gap-8' : 'justify-around'}`}>
            <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors relative ${activeTab === 'tasks' ? 'text-rose-500' : 'text-gray-500 hover:text-rose-400'}`}><ListTodo size={20} className={activeTab === 'tasks' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Tasks</span>{tasks.length > 0 && <span className="absolute top-3 right-1/4 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border border-black"></span>}</button>
            <button onClick={() => setActiveTab('live')} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors relative ${activeTab === 'live' ? 'text-purple-500' : 'text-gray-500 hover:text-purple-400'}`}><Activity size={20} className={activeTab === 'live' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Live</span></button>
            <button onClick={() => { setActiveTab('add-batch'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors ${activeTab === 'add-batch' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Shirt size={20} className={activeTab === 'add-batch' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Add Batch</span></button>
            {role === 'admin' && (
              <>
                <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'stats' ? 'text-[#cdfc4c]' : 'text-gray-500 hover:text-gray-300'}`}><BarChart3 size={20} className={activeTab === 'stats' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Stats</span></button>
                <button onClick={() => setActiveTab('ledger')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'ledger' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Wallet size={20} className={activeTab === 'ledger' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Ledger</span></button>
                <button onClick={() => { setActiveTab('pay'); setEditingEntryId(null); }} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'pay' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><IndianRupee size={20} className={activeTab === 'pay' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Pay</span></button>
                <button onClick={() => setActiveTab('sign-off')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'sign-off' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><PenTool size={20} className={activeTab === 'sign-off' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Sign-Off</span></button>
                <button onClick={() => setActiveTab('setup')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-colors ${activeTab === 'setup' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Settings size={20} className={activeTab === 'setup' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} /><span className="text-[9px] font-black tracking-widest uppercase">Setup</span></button>
              </>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
