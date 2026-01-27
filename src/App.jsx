import React, { useState, useEffect } from 'react';
import LifeTrack from './LifeTrack';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  onSnapshot,
  writeBatch,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  CheckCircle, 
  BrainCircuit, 
  Settings, 
  BookOpen,
  Save,
  FastForward,
  Info,
  Trash2,
  AlertTriangle,
  X,
  LogIn,
  LogOut,
  User,
  Plus,
  Minus,
  LayoutList,
  GripHorizontal,
  Maximize2,
  Layers,
  Zap,
  Coffee,
  Edit2,
  Flag,
  History,
  Play,
  Calendar,
  CheckSquare
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCTaaYioZuXIIbs3G1RCfe9E5neCAtrRYY",
  authDomain: "organizatio-79680.firebaseapp.com",
  projectId: "organizatio-79680",
  storageBucket: "organizatio-79680.firebasestorage.app",
  messagingSenderId: "168221682458",
  appId: "1:168221682458:web:d394d960fd25289906daa3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'meditrack-v1';

// --- Constants ---
// --- Constants ---
const THEMES = {
  indigo: { name: 'نيلي', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', badge: 'bg-indigo-600', darkBadge: 'bg-indigo-500' },
  emerald: { name: 'زمردي', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', badge: 'bg-emerald-600', darkBadge: 'bg-emerald-500' },
  rose: { name: 'وردي', color: 'bg-rose-100 text-rose-800 border-rose-200', badge: 'bg-rose-600', darkBadge: 'bg-rose-500' },
  blue: { name: 'أزرق', color: 'bg-blue-100 text-blue-800 border-blue-200', badge: 'bg-blue-600', darkBadge: 'bg-blue-500' },
  amber: { name: 'كهرماني', color: 'bg-amber-100 text-amber-800 border-amber-200', badge: 'bg-amber-600', darkBadge: 'bg-amber-500' },
  purple: { name: 'بنفسجي', color: 'bg-purple-100 text-purple-800 border-purple-200', badge: 'bg-purple-600', darkBadge: 'bg-purple-500' },
  cyan: { name: 'سماوي', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', badge: 'bg-cyan-600', darkBadge: 'bg-cyan-500' },
  pink: { name: 'زهري', color: 'bg-pink-100 text-pink-800 border-pink-200', badge: 'bg-pink-600', darkBadge: 'bg-pink-500' },
  slate: { name: 'رمادي', color: 'bg-slate-100 text-slate-800 border-slate-200', badge: 'bg-slate-600', darkBadge: 'bg-slate-500' },
  orange: { name: 'برتقالي', color: 'bg-orange-100 text-orange-800 border-orange-200', badge: 'bg-orange-600', darkBadge: 'bg-orange-500' },
  teal: { name: 'فيروزي', color: 'bg-teal-100 text-teal-800 border-teal-200', badge: 'bg-teal-600', darkBadge: 'bg-teal-500' },
};

const DEFAULT_SUBJECTS = {
  TSF: { name: 'TSF', theme: 'indigo', ...THEMES.indigo },
  CBG: { name: 'CBG', theme: 'emerald', ...THEMES.emerald },
  BIO: { name: 'BIO', theme: 'rose', ...THEMES.rose },
  ANA: { name: 'ANA', theme: 'blue', ...THEMES.blue },
  PMD: { name: 'PMD', theme: 'amber', ...THEMES.amber }
};

const INTERVALS = [1, 2, 4, 7];

const MediTrackApp = ({ onSwitchToLifeTrack, user }) => {
  // const [user, setUser] = useState(null); // LIFTED UP
  const [loading, setLoading] = useState(false); // Managed by parent mostly, but kept for local loading needs if any
  const [authError, setAuthError] = useState(null);
  
  // Data State
  const [config, setConfig] = useState(null); 
  const [lectures, setLectures] = useState({});
  const [history, setHistory] = useState([]); // Session Logs
  
  // Focus Mode State
  const [focusQueue, setFocusQueue] = useState([]); 
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [isFocusAnimating, setIsFocusAnimating] = useState(false);
  const [isFreeFocus, setIsFreeFocus] = useState(false); 
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('config');
  const [tempConfig, setTempConfig] = useState({});
  const [selectedManageSubject, setSelectedManageSubject] = useState('ANA');
  
  // Custom Subjects State
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const SUBJECTS = subjects; // Alias to keep existing code working
  const [newSubject, setNewSubject] = useState({ code: '', name: '', theme: 'blue' });

  
  // Task Editing State
  const [editingTask, setEditingTask] = useState(null); 

  // --- Auth Logic REMOVED (Handled in App) ---
  // We keep login handlers here though, as they trigger auth changes globally


  const handleGoogleLogin = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setAuthError("فشل الدخول بجوجل: " + err.message);
    }
  };

  const handleGuestLogin = async () => {
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error(err);
      setAuthError("فشل الدخول كزائر.");
    }
  };

  const handleLogout = async () => {
    if (confirm("هل تريد تسجيل الخروج؟")) {
      await signOut(auth);
      setConfig(null);
      setLectures({});
      setHistory([]);
    }
  };

  // --- Data Sync ---
  useEffect(() => {
    if (!user) return;
    
    // 1. Settings
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(data);
        setTempConfig(data);
      } else {
        setShowSettings(true);
        setSettingsTab('guide'); 
      }
    });

    // 2. Lectures
    const unsubLectures = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'), (snap) => {
      const data = {};
      snap.forEach(d => data[d.id] = d.data());
      setLectures(data);
    });

    // 3. History (Logs)
    const qHistory = query(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), orderBy('completedAt', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const logs = [];
      snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
      setHistory(logs);
    });

    // 4. Subjects Definitions
    const unsubDefs = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), (snap) => {
      if (snap.exists()) {
        setSubjects(snap.data());
      }
    });

    return () => { unsubConfig(); unsubLectures(); unsubHistory(); unsubDefs(); };
  }, [user]);

  // --- Actions ---
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), tempConfig);
    alert("تم حفظ الإعدادات ✅");
    setShowSettings(false);
  };

  const handleSaveTaskDetails = async (e) => {
    e.preventDefault();
    if (!user || !editingTask) return;
    
    const data = {
      id: editingTask.id,
      subject: editingTask.subject,
      number: editingTask.number,
      title: editingTask.title || '',
      description: editingTask.description || '',
      difficulty: editingTask.difficulty || 'normal',
      stage: editingTask.stage !== undefined ? editingTask.stage : 0, 
      nextReview: editingTask.nextReview !== undefined ? editingTask.nextReview : null
    };

    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', editingTask.id), data, { merge: true });
    setEditingTask(null);
  };

  const resetSubjectProgress = async (subjCode) => {
    if (!confirm(`تحذير: هل أنت متأكد من تصفير مادة ${subjCode}؟`)) return;
    const batch = writeBatch(db);
    let count = 0;
    Object.values(lectures).forEach(l => {
      if (l.subject === subjCode) {
        batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', l.id));
        count++;
      }
    });
    if (count > 0) await batch.commit();
    alert(`تم تصفير ${count} محاضرة.`);
  };

  const markFirstFiveAsStudied = async () => {
    if (!user || !window.confirm("تأكيد: وضع أول 5 محاضرات في المراجعة اليوم؟")) return;
    const batch = writeBatch(db);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dueToday = new Date(); 
    Object.keys(SUBJECTS).forEach(subj => {
      for (let i = 1; i <= 5; i++) {
        const id = `${subj}_${i}`;
        if (!lectures[id] || lectures[id].stage < 1) {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', id);
          batch.set(ref, {
            id, subject: subj, number: i, stage: 1, lastStudied: yesterday.toISOString(), nextReview: dueToday.toISOString(), isCompleted: false
          });
        }
      }
    });
    await batch.commit();
    alert("تم التنفيذ بنجاح.");
    setShowSettings(false);
  };

  // --- Session Persistence ---
  const sessionRef = user ? doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current') : null;

  const saveSessionToCloud = async (isFree, queue) => {
    if (!user || !sessionRef) return;
    try {
      await setDoc(sessionRef, {
        type: 'meditrack',
        startTime: new Date().toISOString(),
        isFree,
        queue: queue || []
      });
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const deleteSessionFromCloud = async () => {
    if (!user || !sessionRef) return;
    try {
      await deleteDoc(sessionRef);
    } catch (e) {
       console.error("Failed to delete session", e);
    }
  };

  useEffect(() => {
    if (!user || !sessionRef) return;
    
    // Restore Session
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
         const data = snap.data();
         if (data.type === 'meditrack') {
            // Only restore if we are not already in a session (to avoid loops) 
            // OR if the queue length is different (sync from another tab)
            // Ideally, we just set state always to match cloud
            setIsFocusModeActive(true);
            setIsFreeFocus(data.isFree);
            setFocusQueue(data.queue || []);
            setTimeout(() => setIsFocusAnimating(true), 50);
         }
      } else {
         // If doc deleted (e.g. from another tab), close session
         if (!isFocusAnimating && isFocusModeActive) { // rough check to avoid closing while opening
             // We can optionally force close here, but let's be gentle
             // setIsFocusModeActive(false); 
         }
      }
    });
    return () => unsubSession();
  }, [user, sessionRef]);


  const startFocusSession = () => {
    if (focusQueue.length === 0) return;
    setIsFreeFocus(false);
    setIsFocusModeActive(true);
    setTimeout(() => setIsFocusAnimating(true), 50);
    saveSessionToCloud(false, focusQueue);
  };

  const startFreeFocus = () => {
    setIsFreeFocus(true);
    setIsFocusModeActive(true);
    setTimeout(() => setIsFocusAnimating(true), 50);
    saveSessionToCloud(true, []);
  };

  const closeFocusMode = () => {
    setIsFocusAnimating(false);
    setTimeout(() => {
      setIsFocusModeActive(false);
      setIsFreeFocus(false);
      // Optional: keep queue or clear it? Clearing it to avoid confusion
      setFocusQueue([]);
      deleteSessionFromCloud();
    }, 500); 
  };

  const completeTask = async (task) => {
    if (!user) return;
    
    const today = new Date();
    let nextStage = task.stage + 1;
    let nextDate = new Date(); 
    let isCompleted = false;

    if (task.stage < INTERVALS.length) {
      const interval = INTERVALS[task.stage]; 
      nextDate.setDate(nextDate.getDate() + interval);
    } else {
      isCompleted = true; 
    }

    // 1. Update Lecture Status
    const data = {
      id: task.id, subject: task.subject, number: task.number, stage: nextStage, lastStudied: today.toISOString(), nextReview: isCompleted ? 'COMPLETED' : nextDate.toISOString(), isCompleted
    };
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', task.id), data, { merge: true });

    // 2. Add to History Log
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), {
      taskId: task.id,
      subject: task.subject,
      number: task.number,
      title: task.title || '',
      completedAt: today.toISOString(),
      stageCompleted: task.stage
    });

    // 3. Update Queue UI (Remove the completed task)
    const newQueue = focusQueue.filter(t => t.id !== task.id);
    setFocusQueue(newQueue);

    // Sync Update to Cloud Session
    saveSessionToCloud(false, newQueue);

    if (newQueue.length === 0) {
      closeFocusMode();
    }
  };

  const manualStageUpdate = async (subject, number, newStage) => {
    if (!user) return;
    const lectureId = `${subject}_${number}`;
    const today = new Date();
    let nextDate = new Date();
    let isCompleted = false;
    let nextReviewVal = '';

    if (newStage === 0) {
      // FIX: Don't delete the doc, just reset progress fields to preserve title/notes
      const data = { 
        stage: 0, 
        lastStudied: null, 
        nextReview: null, 
        isCompleted: false 
      };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data, {merge: true}); 
      return;
    } 
    if (newStage > INTERVALS.length) {
       isCompleted = true; nextReviewVal = 'COMPLETED';
    } else {
      const interval = INTERVALS[newStage - 1] || 7;
      nextDate.setDate(nextDate.getDate() + interval);
      nextReviewVal = nextDate.toISOString();
    }
    const data = { id: lectureId, subject, number, stage: newStage, lastStudied: today.toISOString(), nextReview: nextReviewVal, isCompleted };
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data, {merge: true});
  };

  // --- Drag & Drop Logic ---
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("task", JSON.stringify(task));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const taskData = e.dataTransfer.getData("task");
    if (taskData) {
      try {
        const task = JSON.parse(taskData);
        if (focusQueue.find(t => t.id === task.id)) return;
        setFocusQueue([...focusQueue, task]);
      } catch (err) {
        console.error("Invalid drag data", err);
      }
    }
  };

  const removeFromQueue = (taskId) => {
    setFocusQueue(focusQueue.filter(t => t.id !== taskId));
  };

  // --- Subject Management ---
  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.code || !newSubject.name) return alert("يرجى ملء الكود والاسم");
    
    const code = newSubject.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (subjects[code]) return alert("هذا الكود موجود بالفعل!");

    const theme = THEMES[newSubject.theme];
    const newData = {
      ...subjects,
      [code]: {
        name: newSubject.name,
        theme: newSubject.theme,
        ...theme
      }
    };

    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);
    
    // Init in config if not exists
    if (config && config[code] === undefined) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), { ...config, [code]: 0 }, {merge: true});
    }

    setNewSubject({ code: '', name: '', theme: 'blue' });
    alert("تم إضافة المادة بنجاح ✅");
  };

  const deleteSubject = async (code) => {
     if (!confirm(`هل أنت متأكد من حذف مادة ${code}؟ لن يتم حذف المحاضرات القديمة ولكن لن تظهر المادة.`)) return;
     const newData = { ...subjects };
     delete newData[code];
     await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);
  };


  // --- Helpers ---
  const getSubjectStats = (subj) => {
    const total = parseInt(config?.[subj] || 0);
    let started = 0;
    Object.values(lectures).forEach(l => {
      if (l.subject === subj && l.stage > 0) started++;
    });
    const newCount = Math.max(0, total - started);
    return { total, new: newCount };
  };

  const getDueReviews = () => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return Object.values(lectures).filter(l => {
      if (l.isCompleted || !l.nextReview || l.nextReview === 'COMPLETED') return false;
      return new Date(l.nextReview) <= endOfDay;
    }).sort((a,b) => new Date(a.nextReview) - new Date(b.nextReview));
  };

  const getNewSuggestions = () => {
    if (!config) return [];
    const suggestions = [];
    Object.keys(SUBJECTS).forEach(subj => {
      const total = parseInt(config[subj]) || 0;
      for (let i = 1; i <= total; i++) {
        const id = `${subj}_${i}`;
        if (!lectures[id] || lectures[id].stage === 0) {
          const existing = lectures[id] || {};
          suggestions.push({ 
            id, 
            subject: subj, 
            number: i, 
            stage: 0,
            title: existing.title || '',
            description: existing.description || '',
            difficulty: existing.difficulty || 'normal'
          });
          break;
        }
      }
    });
    return suggestions;
  };

  const getManageLectures = () => {
     if (!config || !selectedManageSubject) return [];
     const total = parseInt(config[selectedManageSubject]) || 0;
     const list = [];
     for(let i=1; i<=total; i++) {
        const id = `${selectedManageSubject}_${i}`;
        const lecture = lectures[id];
        list.push({ 
          id, 
          subject: selectedManageSubject, 
          number: i, 
          stage: lecture ? lecture.stage : 0, 
          nextReview: lecture ? lecture.nextReview : null,
          title: lecture?.title,
          description: lecture?.description,
          difficulty: lecture?.difficulty
        });
     }
     return list;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    if (isoString === 'COMPLETED') return 'مكتمل';
    return new Date(isoString).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTimeLog = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('ar-EG', { hour: '2-digit', minute:'2-digit' });
  };

  const openEditModal = (task) => {
    setEditingTask({
      ...task,
      difficulty: task.difficulty || 'normal'
    });
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-slate-600 font-bold">جاري تحميل النظام...</div>;

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-10 rounded-lg shadow-md border border-gray-200 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-lg flex items-center justify-center mx-auto mb-6">
             <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">MediTrack Pro</h1>
          <p className="text-slate-500 mb-8 text-sm">نظام السحب والإفلات الذكي للمذاكرة</p>
          <button onClick={handleGoogleLogin} className="w-full bg-slate-800 text-white py-3 rounded-md font-bold flex items-center justify-center gap-2 mb-3 hover:bg-slate-900 transition">
            <LogIn size={18} /> تسجيل الدخول (Google)
          </button>
          <button onClick={handleGuestLogin} className="w-full bg-white text-slate-600 border border-slate-300 py-3 rounded-md font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition">
            <User size={18} /> تجربة كزائر
          </button>
          {authError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs font-bold border border-red-200">{authError}</div>}
        </div>
      </div>
    );
  }

  const reviews = getDueReviews();
  const news = getNewSuggestions();

  return (
    <div className="min-h-screen bg-gray-100 text-slate-800 font-sans relative" dir="rtl">
      
      {/* 🌑 FULL SCREEN FOCUS MODE OVERLAY (ALL AT ONCE VIEW) 🌑 */}
      {isFocusModeActive && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col transition-all duration-500 ease-in-out transform ${
            isFocusAnimating 
              ? 'bg-slate-950 translate-x-0' 
              : 'bg-slate-950 -translate-x-full'
          }`}
        >
          {/* Top Bar (Minimal) */}
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 pointer-events-none">
             <div className="pointer-events-auto flex items-center gap-3">
               <span className="text-slate-400 font-mono text-sm uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full bg-slate-900/50 backdrop-blur-md">
                 {isFreeFocus ? 'Free Session' : `Active Tasks: ${focusQueue.length}`}
               </span>
             </div>
             <div className="pointer-events-auto">
                <button 
                  onClick={closeFocusMode} 
                  className="p-2 text-slate-500 hover:text-white transition hover:bg-slate-800 rounded-full"
                >
                  <X size={24} />
                </button>
             </div>
          </div>

          <div className="flex-1 flex flex-col h-full pt-20 pb-10 px-6">
             {isFreeFocus ? (
               // FREE FOCUS UI (Minimal)
               <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                 <Zap size={64} className="text-amber-500 mb-8 opacity-90 animate-pulse" />
                 <h2 className="text-4xl font-light tracking-wide mb-4">جلسة تركيز حرة</h2>
                 <p className="text-slate-500 mb-12 max-w-md text-center leading-relaxed">
                   استمتع بالهدوء والتركيز العميق. لا يوجد مهام، فقط أنت والمادة العلمية.
                 </p>
                 <button 
                   onClick={closeFocusMode} 
                   className="px-8 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/30 rounded-full text-sm font-bold transition-all duration-300"
                 >
                    إنهاء الجلسة
                 </button>
               </div>
             ) : (
               // ALL TASKS GRID VIEW (Pure & Clean)
               <div className="w-full h-full overflow-y-auto">
                 <div className="flex flex-wrap justify-center items-center content-center min-h-full gap-6 pb-10">
                   {focusQueue.map((task) => (
                     <div 
                       key={task.id} 
                       className="bg-slate-900/50 border border-slate-800 hover:border-slate-600 backdrop-blur-sm p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center text-center relative group transition-all duration-300 hover:-translate-y-1"
                     >
                        {/* Subject Badge */}
                        <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-6 text-white shadow-lg ${SUBJECTS[task.subject]?.darkBadge || 'bg-slate-700'}`}>
                          {task.subject}
                        </div>

                        {/* Title & Number */}
                        <h2 className="text-5xl font-black text-white mb-2 tracking-tight">
                          Lec {task.number}
                        </h2>
                        {task.title && <p className="text-lg text-emerald-400 font-medium mb-1">{task.title}</p>}
                        
                        {/* Meta Info */}
                        <div className="flex items-center justify-center gap-3 text-slate-500 text-xs mb-8 uppercase tracking-widest">
                           <span>{task.stage === 0 ? 'New' : `Review ${task.stage}`}</span>
                           {task.difficulty && (
                             <span className={`flex items-center gap-1 ${task.difficulty === 'hard' ? 'text-red-400' : task.difficulty === 'easy' ? 'text-green-400' : ''}`}>
                               {task.difficulty === 'hard' && <Flag size={10} fill="currentColor" />}
                               {task.difficulty === 'hard' ? 'HARD' : task.difficulty === 'easy' ? 'EASY' : 'NORMAL'}
                             </span>
                           )}
                        </div>

                        {/* Description (Minimal) */}
                        {task.description && (
                          <p className="text-slate-400 text-sm max-w-xs mx-auto mb-10 leading-relaxed font-light border-t border-slate-800 pt-4">
                            {task.description}
                          </p>
                        )}

                        {/* Minimal Done Button */}
                        <button 
                          onClick={() => completeTask(task)}
                          className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center transition-all duration-300 transform group-hover:scale-110"
                          title="إتمام"
                        >
                           <CheckCircle size={32} />
                        </button>
                        <span className="text-[10px] text-slate-600 mt-3 font-medium uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Mark Done</span>
                     </div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Edit2 size={16} className="text-blue-500" /> تعديل المحاضرة
                 </h3>
                 <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
              </div>
              <form onSubmit={handleSaveTaskDetails} className="p-4 space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${SUBJECTS[editingTask.subject]?.badge}`}>{editingTask.subject}</span>
                    <span className="font-bold text-sm text-slate-700">Lecture {editingTask.number}</span>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">اسم المحاضرة (اختياري)</label>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                      placeholder="مثلاً: Intro to Bones"
                      value={editingTask.title || ''}
                      onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">وصف / ملاحظات</label>
                    <textarea 
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none h-20 resize-none"
                      placeholder="ملاحظات سريعة..."
                      value={editingTask.description || ''}
                      onChange={e => setEditingTask({...editingTask, description: e.target.value})}
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">مستوى الصعوبة</label>
                    <div className="flex gap-2">
                       <button 
                         type="button"
                         onClick={() => setEditingTask({...editingTask, difficulty: 'easy'})}
                         className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${editingTask.difficulty === 'easy' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-400'}`}
                       >
                         سهلة 🙂
                       </button>
                       <button 
                         type="button"
                         onClick={() => setEditingTask({...editingTask, difficulty: 'normal'})}
                         className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${editingTask.difficulty === 'normal' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}
                       >
                         عادية 😐
                       </button>
                       <button 
                         type="button"
                         onClick={() => setEditingTask({...editingTask, difficulty: 'hard'})}
                         className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${editingTask.difficulty === 'hard' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-400'}`}
                       >
                         صعبة 🥵
                       </button>
                    </div>
                 </div>

                 <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-800 transition mt-2">
                   حفظ التعديلات
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* --- NORMAL DASHBOARD UI --- */}
      
      {/* Top Nav & Stats Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-slate-900 text-white p-2 rounded-md">
            <BrainCircuit size={20} />
          </div>
          <div>
             <h1 className="font-bold text-lg text-slate-800 leading-tight">MediTrack</h1>
          </div>
        </div>

        {/* 📊 SUBJECT STATS SCROLLER (STACKED) 📊 */}
        <div className="flex-1 w-full md:w-auto overflow-x-auto no-scrollbar mx-4">
          <div className="flex gap-3 justify-start md:justify-center">
            {Object.keys(SUBJECTS).map(subj => {
              const stats = getSubjectStats(subj);
              return (
                <div key={subj} className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-lg p-1.5 min-w-[60px] shrink-0">
                  <span className={`text-[10px] font-black px-2 rounded-sm mb-1 text-white ${SUBJECTS[subj].badge}`}>
                    {subj}
                  </span>
                  <div className="flex items-end gap-0.5 leading-none">
                    <span className="text-sm font-bold text-slate-800">{stats.new}</span>
                    <span className="text-[9px] text-slate-400 font-medium">/{stats.total}</span>
                  </div>
                  <span className="text-[8px] text-slate-400 mt-0.5">جديد</span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button onClick={onSwitchToLifeTrack} className="hidden md:flex bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-bold items-center gap-2 hover:bg-slate-800 transition shadow-sm border border-slate-700 animate-in fade-in"><Zap size={16} className="text-amber-500" /> LifeTrack</button>
          <button onClick={() => { setShowSettings(true); setSettingsTab('guide'); }} className="p-2 text-slate-500 hover:bg-gray-100 rounded-md transition" title="الدليل"><Info size={20} /></button>
          <button onClick={() => { setShowSettings(true); setSettingsTab('manage'); }} className="p-2 text-slate-500 hover:bg-gray-100 rounded-md transition" title="الإعدادات"><Settings size={20} /></button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition" title="خروج"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* Main Grid: 3 Columns */}
      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
        
        {/* COLUMN 1: DROP ZONE (Queue System) */}
        <div 
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={handleDrop}
          className={`lg:col-span-1 rounded-3xl transition-all duration-500 flex flex-col relative overflow-hidden group ${focusQueue.length === 0 ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300' : 'bg-white border border-slate-200 shadow-xl'}`}
        >
           {/* Background Pattern for Empty State */}
           {focusQueue.length === 0 && (
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
           )}

           {/* Placeholder if empty */}
           {focusQueue.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-6 z-10">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                  <Layers size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">منطقة التركيز</h3>
                <p className="text-slate-500 font-medium mb-8 max-w-[200px] leading-relaxed mx-auto">
                  اسحب المحاضرات هنا لبدء جلسة عميقة
                </p>
                
                <button 
                  onClick={startFreeFocus}
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-slate-800 hover:bg-slate-800 hover:text-white transition-all shadow-sm flex items-center gap-2 group-hover:translate-y-1 mx-auto"
                >
                  <Coffee size={16} />
                  جلسة حرة (بدون مواد)
                </button>
             </div>
           ) : (
             <div className="flex flex-col h-full bg-slate-50/50">
                {/* Header */}
                <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">طابور المذاكرة</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">تجهيز {focusQueue.length} محاضرات</p>
                  </div>
                  <button 
                    onClick={startFocusSession}
                    className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 transition-all flex items-center gap-2 transform active:scale-95"
                  >
                    <Play size={14} fill="currentColor" />
                    ابدأ
                  </button>
                </div>
                
                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {focusQueue.map((task, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex justify-between items-center group/item">
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-sm ${SUBJECTS[task.subject]?.badge}`}>
                            {task.subject}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-sm block">Lec {task.number}</span>
                            {task.title && <span className="text-[10px] font-medium text-slate-500">{task.title}</span>}
                          </div>
                       </div>
                       <button onClick={() => removeFromQueue(task.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                         <X size={16} />
                       </button>
                    </div>
                  ))}
                </div>
             </div>
           )}
        </div>

        {/* COLUMN 2: REVIEWS */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100/50 text-amber-600 rounded-lg">
                  <BrainCircuit size={18} />
                </div>
                <span className="font-bold text-slate-700">المراجعات</span>
              </div>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">{reviews.length}</span>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              {reviews.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                   <CheckCircle size={40} className="mb-4 text-emerald-100" />
                   <p className="font-medium text-sm">كل شيء تحت السيطرة!</p>
                 </div>
              ) : (
                reviews.map(r => (
                  <div 
                    key={r.id}
                    draggable 
                    onDragStart={(e) => handleDragStart(e, r)}
                    className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 cursor-grab active:cursor-grabbing transition-all group relative"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                         <div className={`mt-1 w-1.5 h-8 rounded-full ${SUBJECTS[r.subject]?.badge || 'bg-slate-300'}`}></div>
                         <div>
                           <div className="flex items-center gap-2 mb-1">
                             <span className="font-black text-slate-700 text-sm">Lec {r.number}</span>
                             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${SUBJECTS[r.subject]?.badge}`}>{r.subject}</span>
                           </div>
                           <div className="flex flex-wrap gap-2 text-[10px]">
                              {r.title ? <span className="font-medium text-slate-600">{r.title}</span> : <span className="text-slate-400 italic">بدون عنوان</span>}
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">تكرار {r.stage}</span>
                           </div>
                         </div>
                      </div>
                      
                      <button onClick={() => openEditModal(r)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 p-1 transition-opacity">
                        <Edit2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>

        {/* COLUMN 3: NEW */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100/50 text-blue-600 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <span className="font-bold text-slate-700">الجديد</span>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">{news.length}</span>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              {news.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                   <p className="font-medium text-sm">لا يوجد مواد جديدة حالياً.</p>
                   <button onClick={() => {setShowSettings(true); setSettingsTab('config')}} className="mt-2 text-blue-500 text-xs font-bold hover:underline">ضبط الإعدادات</button>
                </div>
              ) : (
                news.map(n => (
                  <div 
                    key={n.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, n)}
                    className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 cursor-grab active:cursor-grabbing transition-all group flex items-center justify-between"
                  >
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-sm ${SUBJECTS[n.subject]?.badge}`}>
                          {n.subject}
                        </div>
                        <div>
                           <span className="font-bold text-slate-700 text-sm block">Lecture {n.number}</span>
                           {n.title && <span className="text-[10px] text-slate-500 block">{n.title}</span>}
                        </div>
                     </div>
                     
                     <button onClick={() => openEditModal(n)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 p-2 transition-opacity">
                        <Edit2 size={12} />
                      </button>
                  </div>
                ))
              )}
            </div>
        </div>

      </main>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
              <div className="flex gap-4 overflow-x-auto">
                 <button onClick={() => setSettingsTab('guide')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab==='guide' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>الدليل</button>
                 <button onClick={() => setSettingsTab('subjects')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab==='subjects' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>المواد</button>
                 <button onClick={() => setSettingsTab('config')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab==='config' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>الأعداد</button>
                 <button onClick={() => setSettingsTab('manage')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab==='manage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>التقدم</button>
                 <button onClick={() => setSettingsTab('history')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab==='history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>السجل</button>
                 <button onClick={() => setSettingsTab('danger')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab==='danger' ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-500'}`}>تصفير</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1">
               {settingsTab === 'guide' && (
                  <div className="space-y-4 text-slate-600 text-sm">
                     <h3 className="font-bold text-slate-800">طريقة الاستخدام الجديدة 🖱️</h3>
                     <p>النظام الآن يعتمد على السحب والإفلات للتركيز العميق.</p>
                     <ul className="list-disc list-inside space-y-2 bg-blue-50 p-4 rounded-md border border-blue-100 text-blue-800">
                        <li><strong>الخطوة 1:</strong> اسحب أي عدد من المحاضرات (1، 2، أو أكثر) إلى منطقة التركيز.</li>
                        <li><strong>الخطوة 2:</strong> اضغط "ابدأ الجلسة" للدخول في وضع التركيز.</li>
                        <li><strong>الخطوة 3:</strong> كل إنجاز سيتم حفظه تلقائياً في سجل الجلسات.</li>
                     </ul>
                  </div>
               )}

               {settingsTab === 'subjects' && (
                 <div className="space-y-6">
                    <div className="space-y-3">
                       <h3 className="font-bold text-slate-800 text-sm mb-2">المواد الحالية</h3>
                       <div className="grid grid-cols-1 gap-2">
                          {Object.entries(subjects).map(([code, subj]) => (
                             <div key={code} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${subj.badge}`}>{code}</div>
                                   <div>
                                      <p className="font-bold text-sm text-slate-800">{subj.name}</p>
                                      <p className="text-[10px] text-slate-400">Code: {code}</p>
                                   </div>
                                </div>
                                <button onClick={() => deleteSubject(code)} className="text-red-400 hover:text-red-600 bg-white p-2 border rounded-full hover:bg-red-50 transition" title="حذف المادة">
                                  <Trash2 size={14}/>
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <h3 className="font-bold text-slate-800 text-sm mb-3">إضافة مادة جديدة</h3>
                       <form onSubmit={handleAddSubject} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                               <label className="block text-[10px] font-bold text-slate-500 mb-1">الكود (EN)</label>
                               <input 
                                 type="text" 
                                 placeholder="مثلاً ANAT" 
                                 className="w-full px-3 py-2 rounded-md border text-sm uppercase font-mono"
                                 value={newSubject.code}
                                 onChange={e => setNewSubject({...newSubject, code: e.target.value.toUpperCase()})}
                                 maxLength={5}
                               />
                            </div>
                            <div>
                               <label className="block text-[10px] font-bold text-slate-500 mb-1">الاسم</label>
                               <input 
                                 type="text" 
                                 placeholder="مثلاً تشريح" 
                                 className="w-full px-3 py-2 rounded-md border text-sm"
                                 value={newSubject.name}
                                 onChange={e => setNewSubject({...newSubject, name: e.target.value})}
                               />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">اللون</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                               {Object.entries(THEMES).map(([key, theme]) => (
                                  <button 
                                    key={key}
                                    type="button"
                                    onClick={() => setNewSubject({...newSubject, theme: key})}
                                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border-2 transition ${newSubject.theme === key ? 'border-slate-800 scale-110' : 'border-transparent'} ${theme.badge}`}
                                    title={theme.name}
                                  >
                                    {newSubject.theme === key && <CheckCircle size={14} className="text-white"/>}
                                  </button>
                               ))}
                            </div>
                          </div>

                          <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-md font-bold text-sm hover:bg-black transition flex items-center justify-center gap-2">
                             <Plus size={16} /> إضافة المادة
                          </button>
                       </form>
                    </div>
                 </div>
               )}

               {settingsTab === 'config' && (
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        {Object.keys(SUBJECTS).map(subj => (
                           <div key={subj} className="flex items-center gap-2 border p-2 rounded-md">
                              <span className={`w-10 font-bold text-center text-xs py-1 rounded ${SUBJECTS[subj].color}`}>{subj}</span>
                              <input type="number" min="0" className="w-full text-center outline-none font-bold text-slate-700" value={tempConfig[subj]} onChange={e => setTempConfig({...tempConfig, [subj]: e.target.value})} />
                           </div>
                        ))}
                     </div>
                     <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-md font-bold hover:bg-slate-900 mt-4">حفظ الأعداد</button>
                     <div className="mt-6 pt-4 border-t">
                        <button type="button" onClick={markFirstFiveAsStudied} className="text-amber-600 text-xs font-bold hover:underline flex items-center gap-1"><FastForward size={14}/> تفعيل مراجعة أول 5 محاضرات فوراً</button>
                     </div>
                  </form>
               )}

               {settingsTab === 'manage' && (
                  <div>
                     <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                        {Object.keys(SUBJECTS).map(subj => (
                           <button key={subj} onClick={() => setSelectedManageSubject(subj)} className={`px-3 py-1 rounded text-xs font-bold border transition ${selectedManageSubject === subj ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                              {subj}
                           </button>
                        ))}
                     </div>
                     <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {getManageLectures().length === 0 ? <p className="text-center text-slate-400 text-xs py-4">لا توجد محاضرات.</p> : getManageLectures().map(lecture => (
                           <div key={lecture.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-slate-50 group">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700">Lec {lecture.number}</span>
                                {lecture.title && <span className="text-[10px] text-blue-600">{lecture.title}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                 <button onClick={() => openEditModal(lecture)} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={14}/></button>
                                 <div className="h-4 w-px bg-slate-200 mx-1"></div>
                                 <span className="text-[10px] text-slate-400 mr-2">{lecture.stage >= 5 ? 'Done' : `Stage ${lecture.stage}`}</span>
                                 <button onClick={() => manualStageUpdate(selectedManageSubject, lecture.number, Math.max(0, lecture.stage - 1))} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Minus size={12}/></button>
                                 <span className="w-4 text-center text-xs font-bold">{lecture.stage}</span>
                                 <button onClick={() => manualStageUpdate(selectedManageSubject, lecture.number, Math.min(5, lecture.stage + 1))} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Plus size={12}/></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {settingsTab === 'history' && (
                  <div>
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                       <History size={18} className="text-blue-500"/>
                       سجل الإنجازات
                     </h3>
                     <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {history.length === 0 ? (
                           <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                              لم تقم بأي جلسات بعد. ابدأ الآن! 🚀
                           </div>
                        ) : (
                           history.map((log) => (
                              <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-blue-200 transition">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white ${SUBJECTS[log.subject]?.badge || 'bg-slate-400'}`}>
                                       {log.subject}
                                    </div>
                                    <div>
                                       <p className="font-bold text-sm text-slate-700">Lecture {log.number}</p>
                                       {log.title && <p className="text-[10px] text-slate-500">{log.title}</p>}
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mb-1">
                                       {log.stageCompleted === 0 ? 'مذاكرة أولى' : `مراجعة ${log.stageCompleted}`}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                                       <Calendar size={10}/>
                                       {formatDate(log.completedAt)} - {formatTimeLog(log.completedAt)}
                                    </div>
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               )}

               {settingsTab === 'danger' && (
                  <div className="space-y-2">
                     {Object.keys(SUBJECTS).map(subj => (
                        <div key={subj} className="flex justify-between items-center p-3 border border-red-100 bg-red-50 rounded-md">
                           <span className="font-bold text-red-800 text-sm">{subj}</span>
                           <button onClick={() => resetSubjectProgress(subj)} className="text-red-600 text-xs font-bold hover:underline flex items-center gap-1"><Trash2 size={14}/> تصفير</button>
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('meditrack');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-slate-600 font-bold">جاري تحميل النظام...</div>;

  if (currentView === 'lifetrack') {
    return <LifeTrack onBack={() => setCurrentView('meditrack')} user={user} db={db} />;
  }

  return <MediTrackApp 
    onSwitchToLifeTrack={() => setCurrentView('lifetrack')} 
    user={user} 
    // We pass setUser/loading/etc if MediTrackApp needs to handle login, 
    // but better to move login logic here or keep it simple.
    // For now, let's assume MediTrackApp handles login actions but uses this user prop.
  />;
};

export default App;