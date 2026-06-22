import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Scissors, User, Shirt, IndianRupee, Trash2, Camera, Loader2,
  Wallet, FileText, Settings, Edit2, PenTool, Printer, RefreshCw, Image as ImageIcon, AlertCircle, ChevronDown, Download, Lock, LogOut, CheckCircle, Clock, ListTodo, Search, Plus, ShoppingBag, Target, Flame, UserCheck, CalendarRange, Activity, Maximize, Minimize, Filter
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null); 
  const [cancellingSubId, setCancellingSubId] = useState(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isTaskProductDropdownOpen, setIsTaskProductDropdownOpen] = useState(false); 
  const [productSearch, setProductSearch] = useState('');
  
  // Task UI State
  const [expandedTaskGroup, setExpandedTaskGroup] = useState(null);
  const [selectedSubTaskIds, setSelectedSubTaskIds] = useState(new Set());
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskFilterOption, setTaskFilterOption] = useState('All');
  const [activeTaskPlatform, setActiveTaskPlatform] = useState('Shopify / Website');

  // Form States
  const [taskForm, setTaskForm] = useState({ product: '', size: '', quantity: 1, platform: 'Shopify / Website', assignee: 'Any', priority: '3' });

  const [prodForm, setProdForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tailor: '', product: '', sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 }, pieceRate: 250, platform: 'Shopify / Website'
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lightboxData, setLightboxData] = useState(null);

  // WebRTC Camera States
  const videoRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

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

  const [payForm, setPayForm] = useState({
    date: new Date().toISOString().split('T')[0], tailor: '', amount: '', note: '', periodStart: lastCycle.start, periodEnd: lastCycle.end
  });

  const [setupForm, setSetupForm] = useState({ tailorsText: '', productsText: '' });
  const [reportForm, setReportForm] = useState({ type: 'ledger', startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], tailor: 'All' });

  // Formatting & Sorting
  const [ledgerSortOrder, setLedgerSortOrder] = useState('desc'); 
  const [ledgerFilterType, setLedgerFilterType] = useState('all'); 
  const [ledgerViewMode, setLedgerViewMode] = useState('detailed'); 
  const [dashboardTimeFilter, setDashboardTimeFilter] = useState('all'); 

  const [signOffStartDate, setSignOffStartDate] = useState(currentCycle.start);
  const [signOffEndDate, setSignOffEndDate] = useState(currentCycle.end);
  const [printFormat, setPrintFormat] = useState('a4'); 

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);

  // --- THE GHOST-TASK BLACKLIST ENGINE ---
  const getBlacklist = () => JSON.parse(localStorage.getItem('poshakh_blacklist') || '[]');
  const addToBlacklist = (ids) => {
      const current = getBlacklist();
      const newBlacklist = [...new Set([...current, ...ids])];
      localStorage.setItem('poshakh_blacklist', JSON.stringify(newBlacklist));
      return newBlacklist;
  };

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #root { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
      body, html { width: 100%; margin: 0; padding: 0; overflow-x: hidden; background-color: #0a0a0a; }
      .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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

    const fetchFirebaseDirectly = async () => {
      try {
        await signInAnonymously(auth);

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
          }
        });

        unsubscribeTasks = onSnapshot(collection(db, 'priority_tasks'), (snapshot) => {
          const blacklist = getBlacklist();
          // THE INTERCEPTOR: Filters out any ID that is on your browser's local blacklist
          const data = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(t => !blacklist.includes(t.id));
          
          const activeTasks = data.filter(t => 
            (t.status === 'pending' || t.status === 'rejected' || t.status === 'in_progress') && 
            Number(t.quantity) > 0
          ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          setTasks(activeTasks);
        });

      } catch (err) { setUseLocalMode(true); loadLocalData(); }
    };

    const timeoutId = setTimeout(() => {
        if (loading) { setUseLocalMode(true); loadLocalData(); }
    }, 5000);

    fetchFirebaseDirectly();

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribeLedger) unsubscribeLedger();
      if (unsubscribeConfig) unsubscribeConfig();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, [loading]);

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
      
      const MAX_WIDTH = 1200; 
      const scaleSize = MAX_WIDTH / video.videoWidth;
      const compressedCanvas = document.createElement('canvas');
      compressedCanvas.width = MAX_WIDTH;
      compressedCanvas.height = video.videoHeight * scaleSize;
      const compCtx = compressedCanvas.getContext('2d');
      compCtx.drawImage(canvas, 0, 0, compressedCanvas.width, compressedCanvas.height);
      
      const base64 = compressedCanvas.toDataURL('image/jpeg', 0.85);
      setImagePreview(base64);
      setImageFile('WEBCAM'); 
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
          const MAX_WIDTH = 1200; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85)); 
        };
      };
    });
  };

  // Smart fuzzy matching for images (ignores case and ALL trailing spaces)
  const findProductImage = (productName) => {
    if (!productName || !products) return null;
    const cleanSearch = productName.trim().toLowerCase().replace(/\s+/g, ' ');
    const found = products.find(p => p.name.trim().toLowerCase().replace(/\s+/g, ' ') === cleanSearch);
    return found ? found.image : null;
  };

  const saveConfig = async () => {
    const newTailors = setupForm.tailorsText.split('\n').map(t => t.trim()).filter(t => t);
    const newProducts = setupForm.productsText.split('\n').map(line => {
      const parts = line.split(/[\t,]/);
      return { name: parts[0]?.trim() || '', image: parts[1]?.trim() || null };
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

  const handleDownloadReport = () => {
    const filtered = entries.filter(e => {
      const d = new Date(e.date); const start = new Date(reportForm.startDate); const end = new Date(reportForm.endDate);
      const dateMatch = d >= start && d <= end; const tailorMatch = reportForm.tailor === 'All' || e.tailor === reportForm.tailor;
      return dateMatch && tailorMatch;
    });

    if (filtered.length === 0) return showToast("No data found.", "error");

    let csvContent = ""; let filename = `poshakh_${reportForm.type}_${reportForm.startDate}_to_${reportForm.endDate}.csv`;

    if (reportForm.type === 'ledger') {
      csvContent = "Date,Tailor,Transaction Type,Platform,Product,Quantity,Rate,Credit (Earned),Debit (Paid),Notes\n";
      filtered.forEach(e => {
        const type = e.type === 'production' ? 'Production' : 'Payment'; 
        const product = e.product ? `"${e.product}"` : ''; 
        const qty = e.totalPieces || ''; 
        const rate = e.pieceRate || '';
        const platform = e.platform || 'Shopify / Website';
        const credit = e.type === 'production' ? e.amount : ''; 
        const debit = e.type === 'payment' ? e.amount : ''; 
        const note = e.note ? `"${e.note}"` : '';
        csvContent += `${e.date},${e.tailor},${type},${platform},${product},${qty},${rate},${credit},${debit},${note}\n`;
      });
    } else if (reportForm.type === 'settlement') {
      csvContent = "Tailor,Pieces Stitched,Total Earned,Total Paid,Pending Balance\n";
      const tailorsSet = reportForm.tailor === 'All' ? tailors : [reportForm.tailor];
      tailorsSet.forEach(t => {
        const tEntries = filtered.filter(e => e.tailor === t);
        const pieces = tEntries.filter(e => e.type === 'production').reduce((sum, e) => sum + Number(e.totalPieces), 0);
        const earned = tEntries.filter(e => e.type === 'production').reduce((sum, e) => sum + Number(e.amount), 0);
        const paid = tEntries.filter(e => e.type === 'payment').reduce((sum, e) => sum + Number(e.amount), 0);
        const pending = earned - paid;
        if (pieces > 0 || paid > 0) csvContent += `${t},${pieces},${earned},${paid},${pending}\n`;
      });
    } else if (reportForm.type === 'production') {
      csvContent = "Platform,Product,Total Pieces Stitched,Total Value\n";
      const productStats = {};
      filtered.filter(e => e.type === 'production').forEach(e => {
        const plat = e.platform || 'Shopify / Website';
        const key = `${e.product}-${plat}`;
        if (!productStats[key]) productStats[key] = { product: e.product, platform: plat, pieces: 0, value: 0 };
        productStats[key].pieces += Number(e.totalPieces); 
        productStats[key].value += Number(e.amount);
      });
      Object.values(productStats).forEach(stats => csvContent += `"${stats.platform}","${stats.product}",${stats.pieces},${stats.value}\n`);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("Report Downloaded!");
  };

  const getCoordinates = (e) => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    if (signatureLocked || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d'); const coords = getCoordinates(e); if(!coords) return;
    ctx.beginPath(); ctx.moveTo(coords.x, coords.y); setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || signatureLocked || !canvasRef.current) return; e.preventDefault();
    const ctx = canvasRef.current.getContext('2d'); const coords = getCoordinates(e); if(!coords) return;
    ctx.lineTo(coords.x, coords.y); ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    if (!canvasRef.current) return;
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setSignatureLocked(false);
  };
  useEffect(() => { clearSignature(); }, [signOffStartDate, signOffEndDate]);

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
    
    // EXPLICIT ERROR MESSAGES
    if (!prodForm.tailor) return showToast("Missing: Please select a Tailor.", "error");
    if (!prodForm.product) return showToast("Missing: Please select a Product.", "error");

    const totalPieces = Object.values(prodForm.sizes).reduce((sum, val) => sum + val, 0);
    if (totalPieces === 0) return showToast("Missing: Enter at least 1 piece in the sizes section.", "error");
    
    if (!imagePreview) return showToast("Missing: Please attach a QC Photo!", "error");

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
      
      showToast(editingEntryId ? "Log Updated Successfully!" : "Sent to Admin for QC Review!");
      setEditingEntryId(null); setImageFile(null); setImagePreview(null);
      setProdForm(prev => ({ ...prev, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0 } }));
      if (role === 'admin') setActiveTab('ledger');
    } catch (err) { 
      console.error("Firebase Add Batch Error:", err);
      showToast(`Database Error: ${err.message || 'Failed to save batch.'}`, "error"); 
    } finally { 
      setIsUploading(false); 
    }
  };

  // --- CORE SYSTEM HANDLERS ---
  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payForm.tailor || !payForm.amount) return showToast("Missing fields", "error");
    setIsUploading(true);
    try {
      const entryData = { ...payForm, type: 'payment', timestamp: new Date().toISOString() };
      if (useLocalMode) {
        let newEntries = [...entries];
        if (editingEntryId) newEntries = newEntries.map(e => e.id === editingEntryId ? { ...entryData, id: editingEntryId } : e);
        else newEntries = [{ ...entryData, id: crypto.randomUUID() }, ...newEntries];
        setEntries(newEntries); syncLocal('poshakh_ledger', newEntries);
      } else {
        if (editingEntryId) await updateDoc(doc(db, 'ledger', editingEntryId), entryData);
        else await addDoc(collection(db, 'ledger'), entryData);
      }
      showToast(editingEntryId ? "Payment Updated Successfully!" : "Payment Logged!");
      setEditingEntryId(null);
      setPayForm(prev => ({ ...prev, amount: '', note: '' }));
      if (role === 'admin') setActiveTab('ledger');
    } catch (err) {
      showToast("Failed to save payment.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const startEdit = (entry) => {
    setEditingEntryId(entry.id);
    if (entry.type === 'payment') {
      setPayForm({
        date: entry.date || new Date().toISOString().split('T')[0],
        tailor: entry.tailor || '',
        amount: entry.amount || '',
        note: entry.note || '',
        periodStart: entry.periodStart || lastCycle.start,
        periodEnd: entry.periodEnd || lastCycle.end
      });
      setActiveTab('pay');
    } else {
      setProdForm({
        date: entry.date || new Date().toISOString().split('T')[0],
        tailor: entry.tailor || '',
        product: entry.product || '',
        sizes: entry.sizes || { XS: 0, S: 0, M: 0, L: 0, XL: 0 },
        pieceRate: entry.pieceRate || 250,
        platform: entry.platform || 'Shopify / Website'
      });
      if (entry.imageUrl) {
        setImagePreview(entry.imageUrl);
        setImageFile(null);
      } else {
        setImagePreview(null);
        setImageFile(null);
      }
      setActiveTab('add-batch');
    }
  };

  const deleteEntry = async (id) => {
    if (useLocalMode) {
      const newEntries = entries.filter(e => e.id !== id);
      setEntries(newEntries);
      syncLocal('poshakh_ledger', newEntries);
    } else {
      try {
        await deleteDoc(doc(db, 'ledger', id));
      } catch (error) {
        console.error("Failed to delete entry:", error);
        showToast("Failed to delete entry", "error");
        return;
      }
    }
    setDeletingId(null);
    showToast("Entry deleted!");
  };

  const confirmRejectBatch = async (entry) => {
    if (useLocalMode) return;
    await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'rejected' });
    setRejectingId(null);
    showToast("Batch Rejected!");
  };

  const handleApproveBatch = async (entry) => {
    if (useLocalMode) return;
    await updateDoc(doc(db, 'ledger', entry.id), { qcStatus: 'approved' });
    showToast("Batch Approved!");
  };

  const handleClearOutfit = async (group) => {
    const ids = group.subTasks.map(st => st.id);
    addToBlacklist(ids);
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    if (!useLocalMode) {
      ids.forEach(async id => {
        try { await updateDoc(doc(db, 'priority_tasks', id), { status: 'cancelled', quantity: 0 }); } catch(e) {}
      });
    }
    showToast("Outfit Cleared!");
  };

  const toggleSubTaskSelection = (subId) => {
    setSelectedSubTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subId)) newSet.delete(subId);
      else newSet.add(subId);
      return newSet;
    });
  };

  const handleDropTask = async (taskId) => {
    if (useLocalMode) return;
    await updateDoc(doc(db, 'priority_tasks', taskId), { status: 'pending', startedBy: null, startedAt: null });
    showToast("Item dropped back to queue.");
  };

  // ✅ Fixed Grouping Logic for Multiple Products
  const handleCompleteLiveSelection = async (tailorName, items) => {
    const selected = items.filter(st => selectedSubTaskIds.has(st.subId));
    if (selected.length === 0 || !imagePreview) return;
    setIsUploading(true);
    try {
      let finalImageData = null;
      if (imageFile === 'WEBCAM') finalImageData = imagePreview;
      else if (imageFile && !useLocalMode) finalImageData = await compressImageToBase64(imageFile);

      // Group selected items by Product Name
      const groupedByProduct = selected.reduce((acc, st) => {
        const prodName = st.product || 'Unnamed Item';
        if (!acc[prodName]) acc[prodName] = [];
        acc[prodName].push(st);
        return acc;
      }, {});

      if (!useLocalMode) {
        // Iterate through each distinct product group and create a separate ledger entry
        for (const [productName, productTasks] of Object.entries(groupedByProduct)) {
          const firstItem = productTasks[0];
          
          const entryData = {
            date: new Date().toISOString().split('T')[0],
            tailor: tailorName,
            product: productName,
            platform: firstItem.platform || 'Shopify / Website',
            sizes: {},
            pieceRate: firstItem.pieceRate || 250,
            type: 'production',
            totalPieces: productTasks.length,
            amount: productTasks.length * (firstItem.pieceRate || 250),
            imageUrl: finalImageData, // Share the same QC photo
            qcStatus: 'pending',
            timestamp: new Date().toISOString()
          };
          
          // Calculate sizes just for this product group
          productTasks.forEach(st => {
            if(!entryData.sizes[st.size]) entryData.sizes[st.size] = 0;
            entryData.sizes[st.size] += 1;
          });

          await addDoc(collection(db, 'ledger'), entryData);
        }

        // Mark all individual tasks as completed
        for (const st of selected) {
          await updateDoc(doc(db, 'priority_tasks', st.id), { status: 'completed' });
        }
      } else {
        let newEntries = [...entries];
        for (const [productName, productTasks] of Object.entries(groupedByProduct)) {
           const firstItem = productTasks[0];
           const entryData = {
              id: crypto.randomUUID(),
              date: new Date().toISOString().split('T')[0],
              tailor: tailorName,
              product: productName,
              platform: firstItem.platform || 'Shopify / Website',
              sizes: {},
              pieceRate: firstItem.pieceRate || 250,
              type: 'production',
              totalPieces: productTasks.length,
              amount: productTasks.length * (firstItem.pieceRate || 250),
              imageUrl: finalImageData,
              qcStatus: 'pending',
              timestamp: new Date().toISOString()
           };
           productTasks.forEach(st => {
              if(!entryData.sizes[st.size]) entryData.sizes[st.size] = 0;
              entryData.sizes[st.size] += 1;
           });
           newEntries = [entryData, ...newEntries];
        }
        setEntries(newEntries);
        syncLocal('poshakh_ledger', newEntries);
      }

      setSelectedSubTaskIds(new Set());
      setImageFile(null);
      setImagePreview(null);
      showToast("Stitching completed and logged!");
      if (role === 'staff') setActiveTab('tasks');
    } catch(e) {
      console.error(e);
      showToast("Failed to complete items.", "error");
    }
    setIsUploading(false);
  };

  const handleStartStitching = async (group) => {
    const selected = group.subTasks.filter(st => selectedSubTaskIds.has(st.subId));
    if (selected.length === 0) return;
    if (!useLocalMode) {
      for (const st of selected) {
        await updateDoc(doc(db, 'priority_tasks', st.id), { 
          status: 'in_progress', 
          startedBy: prodForm.tailor || 'Unknown', 
          startedAt: new Date().toISOString() 
        });
      }
    }
    setSelectedSubTaskIds(new Set());
    setActiveTab('live');
    showToast("Started stitching!");
  };

  const executeCancelSubTask = async (st) => {
    addToBlacklist([st.id]);
    setTasks(prev => prev.filter(t => t.id !== st.id));
    if (!useLocalMode) {
      try { await updateDoc(doc(db, 'priority_tasks', st.id), { status: 'cancelled', quantity: 0 }); } catch(e) {}
    }
    setCancellingSubId(null);
    showToast("Piece removed!");
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };
  // --------------------------------------------------------

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

  const groupedByPlatform = useMemo(() => {
    const groups = {};
    finalLedgerEntries.filter(e => e.type === 'production' && e.qcStatus !== 'rejected').forEach(e => {
      const plat = e.platform || 'Shopify / Website';
      if (!groups[plat]) groups[plat] = { pieces: 0, value: 0 };
      groups[plat].pieces += Number(e.totalPieces) || 0;
      groups[plat].value += Number(e.amount) || 0;
    });
    return Object.entries(groups).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.value - a.value);
  }, [finalLedgerEntries]);

  const currentSelectedProductImage = useMemo(() => {
    return findProductImage(prodForm.product);
  }, [prodForm.product, products]);

  const getUrgencyStyles = (createdAt) => {
    if (!createdAt) return 'border-gray-800 bg-[#111]';
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return 'border-red-500 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse-slow';
    if (hours > 24) return 'border-orange-500 bg-orange-950/20';
    return 'border-gray-800 bg-[#111]';
  };

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
              <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="****" className="w-full text-center tracking-[1em] font-black text-2xl py-4 bg-black border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-[#cdfc4c] outline-none" autoFocus />
              <button onClick={() => handleLogin('admin')} className="w-full py-4 bg-[#cdfc4c] text-black font-black tracking-wide rounded-xl">Unlock</button>
              <button onClick={() => { setLoginStep('select'); setPinInput(''); }} className="w-full py-3 text-gray-500 hover:text-white text-sm font-bold">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

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

  const renderLiveQueue = () => {
    const liveTasks = tasks.filter(t => t.status === 'in_progress');
    const tasksByTailor = liveTasks.reduce((acc, t) => {
      const tailor = t.startedBy || 'Unknown';
      if (!acc[tailor]) acc[tailor] = [];
      const qty = Number(t.quantity) || 1;
      for (let i = 0; i < qty; i++) {
        acc[tailor].push({ ...t, subId: `${t.id}-live-${i}`, quantity: 1 });
      }
      return acc;
    }, {});

    return (
      <div className={`w-full ${isFullscreen ? 'max-w-none' : ''} space-y-6 animate-in fade-in`}>
        
        {/* KIOSK HEADER */}
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 relative ${isFullscreen ? 'p-6 bg-[#111] border-b border-gray-800 sticky top-0 z-40 shadow-xl' : 'px-4'}`}>
           <div className="text-left flex-1 w-full">
             <h2 className={`font-black tracking-tight text-white flex items-center justify-center sm:justify-start gap-3 ${isFullscreen ? 'text-4xl md:text-5xl' : 'text-3xl'}`}>
               <Activity size={isFullscreen ? 36 : 28} className="text-purple-500"/> Live Floor
             </h2>
             <p className="text-gray-400 mt-2 text-center sm:text-left text-sm md:text-lg">Factory Production Dashboard</p>
           </div>
           <button onClick={toggleFullScreen} className={`flex items-center justify-center gap-2 bg-purple-900/40 hover:bg-purple-500 border border-purple-500/50 hover:text-white px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg w-full sm:w-auto ${isFullscreen ? 'text-white bg-purple-600' : 'text-purple-300'}`}>
             {isFullscreen ? <><Minimize size={18}/> Exit Kiosk Mode</> : <><Maximize size={18}/> Enter Kiosk Mode</>}
           </button>
        </div>

        {!prodForm.tailor && role !== 'admin' && <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-sm font-bold text-center mb-6 mx-4">Please go to "Add Batch" and select your name to interact here!</div>}

        {Object.keys(tasksByTailor).length === 0 ? (
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-12 text-center max-w-4xl mx-auto m-4">
            <Scissors size={48} className="mx-auto mb-4 text-gray-700 opacity-50" />
            <h3 className="text-xl font-bold text-gray-500 mb-1">The workshop is quiet right now.</h3>
          </div>
        ) : (
          <div className={`space-y-8 ${isFullscreen ? 'px-6 pb-6' : 'px-2 md:px-0'}`}>
            {Object.entries(tasksByTailor).map(([tailorName, items]) => {
              const isMyWork = prodForm.tailor === tailorName || role === 'admin';
              
              return (
                <div key={tailorName} className="bg-[#111] border border-purple-900/50 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-500"></div>
                  
                  <div className="p-6 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4 bg-[#0a0a0a]">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-full bg-purple-900/30 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                          <User size={24}/>
                       </div>
                       <div>
                          <h3 className="text-3xl font-black text-white">{tailorName}</h3>
                          <div className="text-xs text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1"><Scissors size={12}/> {items.length} active pieces</div>
                       </div>
                     </div>
                     {isMyWork && items.filter(st => selectedSubTaskIds.has(st.subId)).length > 0 && (
                       <span className="bg-[#cdfc4c] text-black text-xs font-black px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                         <CheckCircle size={16}/> {items.filter(st => selectedSubTaskIds.has(st.subId)).length} Selected
                       </span>
                     )}
                  </div>

                  {/* MEGA HORIZONTAL ROW */}
                  <div className="p-6 bg-[#0a0a0a]/50">
                    <div className="flex overflow-x-auto gap-5 pb-6 custom-scrollbar snap-x snap-mandatory items-stretch">
                       {items.map(st => {
                          const entryImage = findProductImage(st.product);
                          const startTime = new Date(st.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                          const isSelected = selectedSubTaskIds.has(st.subId);
                          
                          return (
                            <div key={st.subId} onClick={() => isMyWork && toggleSubTaskSelection(st.subId)} className={`group flex flex-col rounded-2xl border-2 transition-all overflow-hidden relative shrink-0 snap-start w-[260px] sm:w-[300px] lg:w-[340px] ${!isMyWork ? 'border-gray-800 bg-black opacity-60' : (isSelected ? 'border-[#cdfc4c] shadow-[0_0_20px_rgba(205,252,76,0.15)] cursor-pointer translate-y-[-4px]' : 'border-gray-800 hover:border-gray-600 cursor-pointer')}`}>
                               
                               <div className="w-full aspect-[3/4] relative bg-black overflow-hidden shrink-0">
                                 {entryImage ? (
                                    <img src={entryImage} className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110" />
                                 ) : (
                                    <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="text-gray-800 w-16 h-16" /></div>
                                 )}
                                 
                                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none transition-opacity duration-300"></div>

                                 {isMyWork && (
                                   <div className="absolute top-4 right-4 z-10">
                                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-xl backdrop-blur-md ${isSelected ? 'border-[#cdfc4c] bg-[#cdfc4c] scale-110' : 'border-white/40 bg-black/40 group-hover:border-white/80'}`}>
                                         {isSelected && <CheckCircle size={20} className="text-black" />}
                                      </div>
                                   </div>
                                 )}

                                 <div className="absolute bottom-0 left-0 w-full p-4 z-10">
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2 mb-2 opacity-90">
                                        <Activity size={12} className="text-purple-400"/>
                                        <span className="text-[10px] text-purple-200 font-bold uppercase tracking-widest">{startTime}</span>
                                      </div>
                                      <div className={`font-black text-lg leading-tight line-clamp-2 ${isSelected ? 'text-[#cdfc4c]' : 'text-white'}`}>
                                         {st.product}
                                      </div>
                                    </div>
                                 </div>
                               </div>
                               
                               <div className={`p-4 flex flex-1 items-center justify-between bg-[#111] transition-colors ${isSelected ? 'bg-[#cdfc4c]/10' : ''}`}>
                                  <div className="flex items-center gap-2">
                                     <span className={`text-sm px-3 py-1 rounded font-black uppercase ${isSelected ? 'bg-[#cdfc4c] text-black' : 'bg-gray-800 text-white'}`}>Size {st.size}</span>
                                  </div>
                                  
                                  {isMyWork && (
                                     <button onClick={(e) => { e.stopPropagation(); handleDropTask(st.id); }} className="w-8 h-8 rounded-full bg-black border border-gray-700 text-gray-400 hover:bg-rose-500 hover:border-rose-500 hover:text-white flex items-center justify-center transition-all" title="Drop Item">
                                        <Trash2 size={14} />
                                     </button>
                                  )}
                               </div>
                            </div>
                          )
                       })}
                    </div>

                    {isMyWork && (
                       <div className="mt-2 pt-6 border-t border-gray-800 max-w-3xl">
                         {renderPhotoUploader()}
                         
                         {(() => {
                            const selectedSubTasks = items.filter(st => selectedSubTaskIds.has(st.subId));
                            const hasSelection = selectedSubTasks.length > 0;
                            const canSubmit = hasSelection && imagePreview;
                            return (
                              <button disabled={isUploading || !canSubmit} onClick={() => handleCompleteLiveSelection(tailorName, items)} className="w-full py-5 mt-6 bg-[#cdfc4c] text-black font-black tracking-wide rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-[#cdfc4c]/10 text-xl">
                                {isUploading ? 'Submitting...' : (!hasSelection ? 'Select Finished Items' : (!imagePreview ? 'Add QC Photo to Submit' : `Submit ${selectedSubTasks.length} Checked Item(s)`))}
                              </button>
                            );
                         })()}
                       </div>
                    )}

                  </div>
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

    // 🛡️ DUP-KEY FIX: Safely strip 'id' from copied item so Firebase assigns a new unique one
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

    // 1. Pre-filter by Status + User Settings
    const filteredPendingTasks = tasks.filter(t => {
      const isPendingOrRejected = t.status === 'pending' || t.status === 'rejected';
      if (!isPendingOrRejected) return false;
      
      const priority = getNormalizedPriority(t.priority);
      if (taskFilterOption === 'Urgent' && priority !== '1') return false;
      
      const taskAssignee = t.assignee || 'Any';
      if (taskFilterOption === 'Mine' && taskAssignee !== prodForm.tailor && role !== 'admin') return false;
      
      if (taskSearchQuery && !(t.product || '').toLowerCase().includes(String(taskSearchQuery).toLowerCase())) return false;
      
      return true;
    });

    // 2. Group into Data Structure
    const tasksByPlatform = filteredPendingTasks.reduce((acc, t) => {
      const plat = t.platform || 'Shopify / Website';
      const taskPriority = getNormalizedPriority(t.priority);
      const safeProduct = t.product || 'Unnamed Item';
      
      if (!acc[plat]) acc[plat] = {};
      
      if (!acc[plat][safeProduct]) {
        acc[plat][safeProduct] = { 
          id: `${plat}-${safeProduct}`, 
          product: safeProduct, 
          platform: plat, 
          subTasks: [], 
          status: t.status,
          oldestTask: t.createdAt,
          highestPriority: taskPriority,
          highestPriorityWeight: PRIORITY_WEIGHT[taskPriority] || 2
        };
      } else {
        const weight = PRIORITY_WEIGHT[taskPriority] || 2;
        if (weight > acc[plat][safeProduct].highestPriorityWeight) {
          acc[plat][safeProduct].highestPriority = taskPriority;
          acc[plat][safeProduct].highestPriorityWeight = weight;
        }
      }
      
      const qty = Number(t.quantity) || 1;
      if (t.status === 'rejected') acc[plat][safeProduct].status = 'rejected';
      
      if (new Date(t.createdAt) < new Date(acc[plat][safeProduct].oldestTask)) {
          acc[plat][safeProduct].oldestTask = t.createdAt;
      }
      
      for (let i = 0; i < qty; i++) {
        acc[plat][safeProduct].subTasks.push({ ...t, subId: `${t.id}-${i}`, listIndex: i + 1, quantity: 1, size: t.size, pieceRate: t.pieceRate, priority: taskPriority });
      }
      return acc;
    }, {});

    const sortedPlatforms = Object.keys(tasksByPlatform).sort((a, b) => {
      const order = ['Shopify / Website', 'Amazon', 'Myntra'];
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const displayPlatform = (sortedPlatforms.length > 0 && !sortedPlatforms.includes(activeTaskPlatform)) ? sortedPlatforms[0] : activeTaskPlatform;

    const activePlatformGroups = tasksByPlatform[displayPlatform] ? Object.values(tasksByPlatform[displayPlatform]).sort((a, b) => {
      if (b.highestPriorityWeight !== a.highestPriorityWeight) return b.highestPriorityWeight - a.highestPriorityWeight;
      return a.product.localeCompare(b.product);
    }) : [];

    return (
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in pb-20 relative">
        
        {/* MEGA DASHBOARD: Sticky Command Bar */}
        <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-xl pt-2 pb-4 border-b border-gray-800 -mx-4 px-4 md:-mx-8 md:px-8">
           
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                 <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-2"><ListTodo size={28} className="text-rose-500"/> Priority Tasks</h2>
                 <p className="text-gray-400 mt-1">Urgent items grouped by Sales Channel.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                 <div className="relative w-full sm:w-64">
                   <Search size={16} className="absolute left-3 top-3 text-gray-500"/>
                   <input type="text" value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} placeholder="Search styles..." className="w-full pl-10 pr-4 py-2 bg-[#111] border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none text-white"/>
                 </div>
                 
                 <div className="relative">
                   <Filter size={16} className="absolute left-3 top-3 text-gray-500"/>
                   <select value={taskFilterOption} onChange={(e) => setTaskFilterOption(e.target.value)} className="w-full sm:w-auto pl-10 pr-4 py-2 bg-[#111] border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none appearance-none text-white font-bold cursor-pointer">
                     <option value="All">All Open Tasks</option>
                     <option value="Urgent">🔥 Urgent Priority Only</option>
                     {role !== 'admin' && <option value="Mine">👤 My Assigned Tasks</option>}
                   </select>
                   <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none"/>
                 </div>
              </div>
           </div>

           {/* Platform Tabs */}
           <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
              {sortedPlatforms.length === 0 && <div className="text-gray-600 text-sm italic">No platforms with pending tasks.</div>}
              {sortedPlatforms.map(plat => (
                 <button key={plat} onClick={() => setActiveTaskPlatform(plat)} className={`px-6 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all border ${displayPlatform === plat ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#111] text-gray-400 border-gray-800 hover:border-gray-600 hover:text-white'}`}>
                    {plat} <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${displayPlatform === plat ? 'bg-black text-white' : 'bg-gray-800 text-gray-300'}`}>{Object.keys(tasksByPlatform[plat]).length} Styles</span>
                 </button>
              ))}
           </div>
        </div>

        {role === 'admin' && (
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-5 mb-8">
            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2"><Plus size={16} className="text-rose-500"/> Assign Urgent Task</h3>
            <div className="grid grid-cols-2 lg:grid-cols-8 gap-3">
              <div className="col-span-2 relative">
                <div className="w-full px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-gray-400 cursor-pointer flex items-center justify-between" onClick={() => setIsTaskProductDropdownOpen(!isTaskProductDropdownOpen)}>
                  <span className="truncate">{taskForm.product || "Select Product..."}</span><ChevronDown size={14}/>
                </div>
                {isTaskProductDropdownOpen && (
                  <><div className="fixed inset-0 z-40" onClick={() => setIsTaskProductDropdownOpen(false)} /><div className="absolute z-50 w-full mt-1 bg-[#111] border border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar overflow-hidden">{products.map((p, i) => (<div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50" onClick={() => { setTaskForm({...taskForm, product: p.name}); setIsTaskProductDropdownOpen(false); }}>{p.image ? <img src={p.image} className="w-6 h-6 rounded-md object-cover bg-black" /> : <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center"><ImageIcon size={12} className="text-gray-600" /></div>}<span className="text-xs font-medium text-gray-200 truncate">{p.name}</span></div>))}</div></>
                )}
              </div>
              <select value={taskForm.platform} onChange={(e) => setTaskForm({...taskForm, platform: e.target.value})} className="px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none">
                <option value="Shopify / Website">Shopify</option>
                <option value="Amazon">Amazon</option>
                <option value="Myntra">Myntra</option>
              </select>
              <select value={taskForm.size} onChange={(e) => setTaskForm({...taskForm, size: e.target.value})} className="px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none">
                <option value="">Size</option>{['XS', 'S', 'M', 'L', 'XL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={taskForm.assignee} onChange={(e) => setTaskForm({...taskForm, assignee: e.target.value})} className="px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none text-purple-400 font-bold">
                <option value="Any">Assign: Any</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})} className="px-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none font-bold">
                <option value="1">Priority 1 (Highest)</option>
                <option value="2">Priority 2</option>
                <option value="3">Priority 3</option>
                <option value="4">Priority 4</option>
              </select>
              <div className="relative"><span className="absolute left-3 top-2 text-sm text-gray-500 font-bold">Qty:</span><input type="number" min="1" value={taskForm.quantity} onChange={(e) => setTaskForm({...taskForm, quantity: parseInt(e.target.value) || 1})} className="w-full pl-10 pr-3 py-2 bg-black border border-gray-800 rounded-lg text-sm text-white outline-none" /></div>
              <button onClick={() => {
                if(!taskForm.product || !taskForm.size) return showToast("Select a product and size", "error");
                addDoc(collection(db, 'priority_tasks'), { product: taskForm.product, size: taskForm.size, quantity: taskForm.quantity, pieceRate: 250, platform: taskForm.platform, assignee: taskForm.assignee, priority: taskForm.priority, status: 'pending', createdAt: new Date().toISOString() });
                setTaskForm({ product: '', size: '', quantity: 1, platform: 'Shopify / Website', assignee: 'Any', priority: '3' }); showToast("Task Assigned!");
              }} className="col-span-2 lg:col-span-1 bg-[#cdfc4c] text-black font-black text-sm rounded-lg py-2 hover:bg-[#b5e638]">Add</button>
            </div>
          </div>
        )}

        {!prodForm.tailor && role !== 'admin' && <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl text-sm font-bold text-center mb-6">Please go to "Add Batch" and select your name first!</div>}

        {filteredPendingTasks.length === 0 ? (
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-16 text-center max-w-2xl mx-auto mt-12">
             <CheckCircle size={64} className="mx-auto mb-6 text-green-500 opacity-50" />
             <h3 className="text-2xl font-black text-white mb-2">Queue is Empty!</h3>
             <p className="text-gray-500">There are no pending tasks matching your current filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
             {activePlatformGroups.map(group => {
                const productImage = findProductImage(group.product);
                const isExpanded = expandedTaskGroup === group.id;
                const urgencyClass = getUrgencyStyles(group.oldestTask);
                
                const priorityStyles = {
                  '1': 'bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
                  '2': 'bg-orange-500/90 text-white border-orange-500',
                  '3': 'bg-black/80 text-white border-gray-600',
                  '4': 'bg-gray-800 text-gray-400 border-gray-700'
                };
                const pBadge = priorityStyles[group.highestPriority] || priorityStyles['3'];
                
                return (
                  <div key={group.id} className={`bg-[#111] border rounded-3xl overflow-hidden flex flex-col shadow-2xl relative transition-all duration-300 ${isExpanded ? 'ring-2 ring-purple-500 scale-[1.02] z-20' : 'hover:border-gray-600 cursor-pointer'} ${urgencyClass}`} onClick={() => !isExpanded && setExpandedTaskGroup(group.id)}>
                     
                     <div className="w-full aspect-[4/5] relative bg-black shrink-0 border-b border-gray-800">
                        {productImage ? (
                           <img src={productImage} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                        ) : (
                           <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="text-gray-800 w-16 h-16" /></div>
                        )}
                        
                        <div className="absolute top-4 left-4 z-10">
                           <span className={`px-2 py-1 rounded-lg border backdrop-blur-md text-xs font-black flex items-center gap-1.5 ${pBadge}`}>
                             {group.highestPriority === '1' && <Flame size={12}/>}
                             P{group.highestPriority} Priority
                           </span>
                        </div>

                        {group.status === 'rejected' && (
                           <div className="absolute top-4 right-4 z-10">
                              <span className="bg-rose-500 text-white border border-rose-400 text-xs font-black px-2 py-1 rounded-lg shadow-lg">REJECTED FIX</span>
                           </div>
                        )}

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
                                 {role === 'admin' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleClearOutfit(group); }} className="text-[10px] text-rose-500 font-black uppercase tracking-widest bg-rose-950/30 px-3 py-1.5 rounded-lg hover:bg-rose-500 hover:text-white transition-colors border border-rose-900/50 flex items-center gap-1"><Trash2 size={12}/> Clear All</button>
                                 )}
                                 <button onClick={(e) => { e.stopPropagation(); setExpandedTaskGroup(null); }} className="text-[10px] text-gray-400 hover:text-white font-black uppercase tracking-widest bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">Close</button>
                              </div>
                           </div>

                           <div className="flex flex-col gap-2 w-full mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                              {group.subTasks.map(st => (
                                <div key={st.subId} onClick={(e) => { e.stopPropagation(); toggleSubTaskSelection(st.subId); }} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedSubTaskIds.has(st.subId) ? 'bg-purple-900/20 border-purple-500' : 'bg-[#111] border-gray-800 hover:border-gray-600'}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedSubTaskIds.has(st.subId) ? 'border-purple-500 bg-purple-500' : 'border-gray-600'}`}>
                                      {selectedSubTaskIds.has(st.subId) && <CheckCircle size={14} className="text-black" />}
                                    </div>
                                    <span className={`font-bold ${selectedSubTaskIds.has(st.subId) ? 'text-white' : 'text-gray-400'}`}>Size {st.size}</span>
                                    {st.assignee && st.assignee !== 'Any' && <span className="text-[9px] bg-purple-900/40 border border-purple-500 text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-1"><UserCheck size={10}/> {st.assignee}</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {role === 'admin' && (
                                      cancellingSubId === st.subId ? (
                                        <div className="flex items-center gap-2 bg-rose-900/30 p-1 rounded-lg border border-rose-900/50" onClick={(e) => e.stopPropagation()}>
                                          <span className="text-[10px] font-bold text-rose-500 uppercase px-1">Sure?</span>
                                          <button onClick={(e) => { e.stopPropagation(); executeCancelSubTask(st); }} className="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-black uppercase">Yes</button>
                                          <button onClick={(e) => { e.stopPropagation(); setCancellingSubId(null); }} className="px-2 py-1 bg-gray-700 text-white rounded text-[10px] font-black uppercase">No</button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                          <select value={st.platform || 'Shopify / Website'} onChange={(e) => updateTaskField(st.id, 'platform', e.target.value)} className="bg-black border border-gray-700 text-[10px] text-gray-400 font-bold py-1 px-2 rounded outline-none appearance-none cursor-pointer hover:border-gray-500 hidden xl:block">
                                            <option value="Shopify / Website">Shopify</option>
                                            <option value="Amazon">Amazon</option>
                                            <option value="Myntra">Myntra</option>
                                          </select>
                                          <select value={getNormalizedPriority(st.priority)} onChange={(e) => updateTaskField(st.id, 'priority', e.target.value)} className="bg-black border border-gray-700 text-[10px] text-gray-400 font-bold py-1 px-2 rounded outline-none appearance-none cursor-pointer hover:border-gray-500 hidden sm:block">
                                            <option value="1">P1</option>
                                            <option value="2">P2</option>
                                            <option value="3">P3</option>
                                            <option value="4">P4</option>
                                          </select>
                                          <button onClick={() => setCancellingSubId(st.subId)} className="p-1.5 text-gray-600 hover:text-rose-500 transition-colors bg-black border border-gray-800 rounded-lg hover:bg-rose-900/30" title="Remove this piece">
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              ))}
                           </div>

                           <div className="mt-auto pt-4">
                              {(() => {
                                 const selectedSubTasks = group.subTasks.filter(st => selectedSubTaskIds.has(st.subId));
                                 const hasSelection = selectedSubTasks.length > 0;
                                 return (
                                   <button disabled={!hasSelection} onClick={(e) => { e.stopPropagation(); handleStartStitching(group); }} className="w-full py-4 bg-purple-500 hover:bg-purple-400 text-white font-black tracking-wide rounded-xl disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 transition-all shadow-lg shadow-purple-500/20 text-lg flex items-center justify-center gap-2">
                                     <Scissors size={20}/> {hasSelection ? `Start Stitching (${selectedSubTasks.length})` : 'Select Sizes'}
                                   </button>
                                 );
                              })()}
                           </div>
                        </div>
                     ) : (
                        <div className="p-4 bg-[#0a0a0a] flex items-center justify-center border-t border-gray-800">
                           <span className="text-gray-500 font-bold text-sm flex items-center gap-2 group-hover:text-white transition-colors">Tap to Open <ChevronDown size={16}/></span>
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

  const renderAddBatch = () => (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight">{editingEntryId ? 'Edit Log' : 'Log Stitched Batch'}</h2><p className="text-gray-400 mt-2">Record daily production turnaround.</p></div>
      <div className="bg-[#111] rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl">
        <form onSubmit={handleProdSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Tailor</label>
              <select value={prodForm.tailor} onChange={(e) => setProdForm({...prodForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none appearance-none">
                <option value="">Select Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Platform</label>
              <select value={prodForm.platform} onChange={(e) => setProdForm({...prodForm, platform: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-[#cdfc4c] outline-none appearance-none">
                <option value="Shopify / Website">Shopify / Website</option>
                <option value="Amazon">Amazon</option>
                <option value="Myntra">Myntra</option>
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

          <button type="submit" disabled={isUploading} className="w-full py-4 bg-[#cdfc4c] hover:bg-[#b5e638] text-black font-black tracking-wide rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-[#cdfc4c]/10 mt-6 text-lg">
            {isUploading ? 'Uploading Securely...' : (editingEntryId ? 'Update Batch Log' : 'Submit Batch for QC Review')}
          </button>
        </form>
      </div>
    </div>
  );

  const renderAddPay = () => {
    const periodEarned = entries.filter(e => e.type === 'production' && e.tailor === payForm.tailor && e.date >= payForm.periodStart && e.date <= payForm.periodEnd && e.qcStatus !== 'rejected').reduce((sum, e) => sum + Number(e.amount), 0);
    const periodPieces = entries.filter(e => e.type === 'production' && e.tailor === payForm.tailor && e.date >= payForm.periodStart && e.date <= payForm.periodEnd && e.qcStatus !== 'rejected').reduce((sum, e) => sum + Number(e.totalPieces), 0);
    
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8"><h2 className="text-3xl font-black tracking-tight">{editingEntryId ? 'Edit Payout' : 'Settle Payouts'}</h2><p className="text-gray-400 mt-2">Log cash payments tied to specific dates.</p></div>
        <div className="bg-[#111] rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl">
          <form onSubmit={handlePaySubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Tailor to Pay</label>
                <select value={payForm.tailor} onChange={(e) => setPayForm({...payForm, tailor: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none appearance-none text-white font-bold">
                  <option value="">Select Tailor</option>{tailors.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Payment Date</label>
                <input type="date" value={payForm.date} onChange={(e) => setPayForm({...payForm, date: e.target.value})} className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none"/>
              </div>
            </div>

            <div className="bg-sky-950/20 border border-sky-900/50 rounded-2xl p-5">
               <div className="flex items-center gap-2 mb-4">
                 <CalendarRange size={18} className="text-sky-400" />
                 <h3 className="text-sky-400 font-bold text-sm">Select Production Period to Settle</h3>
               </div>
               
               <div className="flex flex-col sm:flex-row items-center gap-3 mb-5">
                  <input type="date" value={payForm.periodStart} onChange={(e) => setPayForm({...payForm, periodStart: e.target.value})} className="w-full bg-black border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none"/>
                  <span className="text-gray-500 text-xs font-bold uppercase">to</span>
                  <input type="date" value={payForm.periodEnd} onChange={(e) => setPayForm({...payForm, periodEnd: e.target.value})} className="w-full bg-black border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none"/>
               </div>

               {payForm.tailor ? (
                 <div className="bg-black/50 rounded-xl p-4 border border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                       <div className="text-xs text-gray-400 font-bold mb-1">Earned in this specific timeframe:</div>
                       <div className="text-2xl font-black text-white">₹{periodEarned.toLocaleString()}</div>
                       <div className="text-[10px] text-gray-500 font-mono mt-1">({periodPieces} approved pieces)</div>
                    </div>
                    <button type="button" onClick={() => setPayForm({...payForm, amount: periodEarned})} className="w-full md:w-auto px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-black tracking-widest uppercase rounded-lg transition-colors">
                       Auto-Fill ₹{periodEarned}
                    </button>
                 </div>
               ) : (
                 <div className="text-center p-4 text-xs text-sky-600/50 font-bold uppercase tracking-widest border border-dashed border-sky-900/30 rounded-xl">Select a tailor above to see period earnings</div>
               )}
            </div>

            <div><label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Final Payment Amount</label><div className="relative"><IndianRupee size={24} className="absolute left-4 top-4 text-sky-500" /><input type="number" value={payForm.amount} onChange={(e) => setPayForm({...payForm, amount: e.target.value})} placeholder="0.00" className="w-full pl-12 pr-4 py-4 bg-black border border-sky-900/50 rounded-xl text-2xl font-black focus:ring-2 focus:ring-sky-400 outline-none"/></div></div>
            <div><label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Extra Note (Optional)</label><input type="text" value={payForm.note} onChange={(e) => setPayForm({...payForm, note: e.target.value})} placeholder="e.g. Weekly settlement bonus" className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none"/></div>
            
            <button type="submit" disabled={!payForm.tailor || !payForm.amount} className="w-full flex items-center justify-center gap-2 py-4 bg-sky-500 hover:bg-sky-400 text-white font-black tracking-wide rounded-xl transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:shadow-none"><Wallet size={18} /> {editingEntryId ? 'Update Payment' : 'Confirm & Log Payment'}</button>
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
              <option value="platform">Group by Platform</option>
            </select>
            {ledgerViewMode === 'detailed' && (
              <select value={ledgerFilterType} onChange={(e) => setLedgerFilterType(e.target.value)} className="bg-black border border-gray-800 text-xs font-bold text-white py-1.5 px-3 rounded-lg outline-none">
                <option value="all">All Transactions</option>
                <option value="credits">Credits Only (+)</option>
                <option value="debits">Debits Only (-)</option>
              </select>
            )}
            <span className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full font-bold">{ledgerViewMode === 'detailed' ? finalLedgerEntries.length : (ledgerViewMode === 'outfit' ? groupedByProduct.length : (ledgerViewMode === 'platform' ? groupedByPlatform.length : groupedByTailor.length))} Records</span>
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
                               <div className="flex flex-wrap items-center gap-2 mt-1">
                                 <div className="text-xs text-gray-500">{entry.totalPieces} pcs @ ₹{entry.pieceRate}</div>
                                 <div className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                   Sizes: {Object.entries(entry.sizes || {}).filter(([_, q]) => Number(q) > 0).map(([s, q]) => `${s}:${q}`).join(', ')}
                                 </div>
                                 <div className="text-[10px] bg-purple-900/20 text-purple-400 border border-purple-900/50 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                   {entry.platform || 'Shopify / Website'}
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
                           <button onClick={() => setLightboxData({ url: entry.imageUrl, timestamp: entry.timestamp, tailor: entry.tailor, product: entry.product })} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded-full hover:bg-blue-400 hover:text-white transition-colors border border-blue-900/50"><Camera size={12}/> View</button>
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
                                 <button onClick={() => setRejectingId(entry.id)} className="px-3 py-1 bg-rose-900/20 border border-rose-900/50 text-rose-500 rounded text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-colors">Reject</button>
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
                            <div className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Sizes combined: <span className="text-gray-300">{Object.entries(prod.sizes).map(([s, q]) => `${s}:${q}`).join(', ')}</span></div>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-xl text-white">{prod.pieces}</td>
                    <td className="px-6 py-4 text-right font-black text-[#cdfc4c] text-lg">₹{prod.value.toLocaleString()}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          ) : ledgerViewMode === 'platform' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0a0a0a] text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                <tr><th className="px-6 py-4">Sales Platform</th><th className="px-6 py-4 text-center">Total Pieces Stitched</th><th className="px-6 py-4 text-right">Production Cost Generated</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {groupedByPlatform.map((plat, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white text-lg flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-purple-900/20 border border-purple-900/50 flex items-center justify-center text-purple-400"><ShoppingBag size={14}/></div> {plat.name}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-300">{plat.pieces}</td>
                    <td className="px-6 py-4 text-right font-black text-[#cdfc4c] text-lg">₹{plat.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0a0a0a] text-gray-500 font-bold text-[10px] uppercase tracking-widest">
                <tr><th className="px-6 py-4">Tailor Name</th><th className="px-6 py-4 text-center">Total Pieces</th><th className="px-6 py-4 text-right">Total Earned</th><th className="px-6 py-4 text-right">Total Paid</th><th className="px-6 py-4 text-right">Pending Balance</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {groupedByTailor.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white text-lg flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400"><User size={14}/></div> {t.name}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-300">{t.pieces}</td>
                    <td className="px-6 py-4 text-right font-bold text-[#cdfc4c]">₹{t.earned.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-sky-400">₹{t.paid.toLocaleString()}</td>
                    <td className={`px-6 py-4 text-right font-black text-lg ${t.earned - t.paid > 0 ? 'text-rose-500' : 'text-gray-500'}`}>₹{(t.earned - t.paid).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
    
    const earnedPeriod = periodProduction.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidPeriod = periodPayments.reduce((sum, e) => sum + Number(e.amount), 0);
    const piecesPeriod = periodProduction.reduce((sum, e) => sum + Number(e.totalPieces), 0);
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
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input type="date" value={signOffStartDate} onChange={(e) => { setSignOffStartDate(e.target.value); clearSignature(); }} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
              <span className="text-gray-500 text-xs font-bold uppercase">to</span>
              <input type="date" value={signOffEndDate} onChange={(e) => { setSignOffEndDate(e.target.value); clearSignature(); }} className="w-full bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none"/>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
            <button onClick={() => { setSignOffStartDate(getPayCycleDates(0).start); setSignOffEndDate(getPayCycleDates(0).end); }} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">This Week</button>
            <button onClick={() => { setSignOffStartDate(getPayCycleDates(1).start); setSignOffEndDate(getPayCycleDates(1).end); }} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">Last Week</button>
            <div className="h-6 w-px bg-gray-800 mx-1 hidden md:block"></div>
            <select value={printFormat} onChange={(e) => setPrintFormat(e.target.value)} className="w-full md:w-auto bg-[#111] border border-gray-800 text-sm font-semibold text-white py-2 px-4 rounded-xl focus:ring-2 focus:ring-[#cdfc4c] outline-none">
              <option value="a4">A4 Printer</option>
              <option value="thermal">Label Printer (4x6)</option>
            </select>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-bold transition-colors w-full md:w-auto whitespace-nowrap"><Printer size={16} /> Print</button>
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
                        <div className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                          {log.platform || 'Shopify / Website'} | Sizes: {formatSizes(log.sizes)}
                          {log.qcStatus === 'rejected' && <span className="text-rose-500 font-black bg-rose-100 px-1 rounded">REJECTED</span>}
                        </div>
                      </td>
                      <td className="py-3 text-center font-bold text-base">{log.totalPieces}</td>
                      <td className={`py-3 text-right text-sm font-bold ${log.qcStatus === 'rejected' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>₹{log.amount}</td>
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
               <canvas ref={canvasRef} width={800} height={320} style={{ width: '100%', height: '100%' }} className="cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
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
        {useLocalMode && <button onClick={forceLocalMode} className="mt-8 text-gray-500 hover:text-white text-xs underline font-mono">Force Offline Mode</button>}
      </div>
    );
  }

  if (!isLoggedIn) return renderLogin();

  return (
    <div className={`min-h-screen w-full bg-[#0a0a0a] text-white font-sans flex flex-col m-0 p-0 overflow-x-hidden ${isFullscreen ? 'pb-0' : 'pb-28 md:pb-28'}`}>
      
      {lightboxData && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxData(null)}>
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
            <button className="absolute -top-12 right-0 text-white hover:text-rose-500 transition-colors bg-black/50 p-2 rounded-full z-50" onClick={() => setLightboxData(null)}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <img src={lightboxData.url} className="w-full h-full max-h-[80vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}/>
            <div className="mt-4 bg-[#111] border border-gray-800 rounded-xl p-4 text-center w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
               <div className="text-white font-bold text-lg">{lightboxData.product}</div>
               <div className="text-gray-400 text-sm mt-1">Stitched by <span className="text-[#cdfc4c] font-bold">{lightboxData.tailor}</span></div>
               <div className="text-gray-500 text-xs mt-2 flex items-center justify-center gap-1.5">
                  <Clock size={12}/> {new Date(lightboxData.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
               </div>
            </div>
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

      {!isFullscreen && (
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
      )}

      <main className={`flex-1 w-full bg-[#0a0a0a] ${activeTab === 'live' ? (isFullscreen ? 'p-0' : 'p-2 md:p-4') : 'p-4 md:p-8'} print:p-0 print:bg-white transition-all`}>
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'live' && renderLiveQueue()}
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

      {!isFullscreen && (
        <nav className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md border-t border-gray-900 pb-safe z-50 print:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className={`flex items-center h-20 w-full max-w-5xl mx-auto px-4 ${role === 'staff' ? 'justify-center gap-8' : 'justify-around'}`}>
            
            <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors relative ${activeTab === 'tasks' ? 'text-rose-500' : 'text-gray-500 hover:text-rose-400'}`}>
              <ListTodo size={20} className={activeTab === 'tasks' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} />
              <span className="text-[9px] font-black tracking-widest uppercase">Tasks</span>
              {tasks.length > 0 && <span className="absolute top-3 right-1/4 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border border-black"></span>}
            </button>

            <button onClick={() => setActiveTab('live')} className={`flex flex-col items-center justify-center w-full max-w-xs h-full gap-1.5 transition-colors relative ${activeTab === 'live' ? 'text-purple-500' : 'text-gray-500 hover:text-purple-400'}`}>
              <Activity size={20} className={activeTab === 'live' ? "opacity-100 scale-110 transition-transform" : "opacity-70"} />
              <span className="text-[9px] font-black tracking-widest uppercase">Live</span>
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
      )}
    </div>
  );
}
