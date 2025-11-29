import React, { useState, useEffect } from 'react';
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
  onSnapshot,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { 
  CheckCircle, 
  Clock, 
  RotateCcw, 
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
  Target,
  GripHorizontal,
  Maximize2,
  Minimize2
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
const SUBJECTS = {
  TSF: { name: 'TSF', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', badge: 'bg-indigo-600', darkBadge: 'bg-indigo-500' },
  CBG: { name: 'CBG', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', badge: 'bg-emerald-600', darkBadge: 'bg-emerald-500' },
  BIO: { name: 'BIO', color: 'bg-rose-100 text-rose-800 border-rose-200', badge: 'bg-rose-600', darkBadge: 'bg-rose-500' },
  ANA: { name: 'ANA', color: 'bg-blue-100 text-blue-800 border-blue-200', badge: 'bg-blue-600', darkBadge: 'bg-blue-500' },
  PMD: { name: 'PMD', color: 'bg-amber-100 text-amber-800 border-amber-200', badge: 'bg-amber-600', darkBadge: 'bg-amber-500' }
};

const INTERVALS = [1, 2, 4, 7];

const MediTrack = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Data State
  const [config, setConfig] = useState(null); 
  const [lectures, setLectures] = useState({});
  const [focusedTask, setFocusedTask] = useState(null); // The task currently in the drop zone
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('config');
  const [tempConfig, setTempConfig] = useState({ TSF: 0, CBG: 0, BIO: 0, ANA: 0, PMD: 0 });
  const [selectedManageSubject, setSelectedManageSubject] = useState('ANA');

  // --- Auth Logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    }
  };

  // --- Data Sync ---
  useEffect(() => {
    if (!user) return;
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
    const unsubLectures = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'), (snap) => {
      const data = {};
      snap.forEach(d => data[d.id] = d.data());
      setLectures(data);
    });
    return () => { unsubConfig(); unsubLectures(); };
  }, [user]);

  // --- Actions ---
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), tempConfig);
    alert("تم حفظ الإعدادات ✅");
    setShowSettings(false);
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

  const updateLectureStatus = async (lectureId, subject, number, currentStage) => {
    if (!user) return;
    const today = new Date();
    let nextStage = currentStage + 1;
    let nextDate = new Date(); 
    let isCompleted = false;

    if (currentStage < INTERVALS.length) {
      const interval = INTERVALS[currentStage]; 
      nextDate.setDate(nextDate.getDate() + interval);
    } else {
      isCompleted = true; 
    }

    const data = {
      id: lectureId, subject, number, stage: nextStage, lastStudied: today.toISOString(), nextReview: isCompleted ? 'COMPLETED' : nextDate.toISOString(), isCompleted
    };
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data);
    
    // If completed or updated, remove from focus
    setFocusedTask(null);
  };

  const manualStageUpdate = async (subject, number, newStage) => {
    if (!user) return;
    const lectureId = `${subject}_${number}`;
    const today = new Date();
    let nextDate = new Date();
    let isCompleted = false;
    let nextReviewVal = '';

    if (newStage === 0) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId));
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
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data);
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
      const task = JSON.parse(taskData);
      setFocusedTask(task);
    }
  };

  // --- Helpers ---
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
          suggestions.push({ id, subject: subj, number: i, stage: 0 });
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
        list.push({ id, number: i, stage: lecture ? lecture.stage : 0, nextReview: lecture ? lecture.nextReview : null });
     }
     return list;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    if (isoString === 'COMPLETED') return 'مكتمل';
    return new Date(isoString).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
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
      
      {/* 🌑 FULL SCREEN FOCUS MODE OVERLAY 🌑 */}
      {focusedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center animate-in fade-in duration-300">
          
          {/* Top Bar */}
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start">
             <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-xl text-lg font-bold shadow-lg shadow-black/50 ${SUBJECTS[focusedTask.subject]?.darkBadge || 'bg-slate-700'}`}>
                  {focusedTask.subject}
                </span>
                <span className="text-slate-400 font-mono opacity-50">FOCUS MODE</span>
             </div>
             <button 
                onClick={() => setFocusedTask(null)} 
                className="p-3 bg-slate-900/50 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-full transition backdrop-blur-sm"
                title="خروج من وضع التركيز"
             >
               <X size={32} />
             </button>
          </div>

          {/* Main Focus Content */}
          <div className="flex flex-col items-center justify-center text-center max-w-2xl px-4">
             
             {/* Icon */}
             <div className="mb-8 p-6 bg-slate-900/50 rounded-full border border-slate-800 shadow-2xl">
               <BookOpen size={64} className="text-blue-400" />
             </div>

             <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white drop-shadow-2xl">
               Lecture {focusedTask.number}
             </h2>
             
             <p className="text-xl md:text-2xl text-slate-400 mb-12 font-light">
               {focusedTask.stage === 0 ? '✨ مذاكرة جديدة لأول مرة' : `🔄 مراجعة رقم ${focusedTask.stage}`}
             </p>

             <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-12"></div>

             {/* Action Button */}
             <button 
               onClick={() => updateLectureStatus(focusedTask.id, focusedTask.subject, focusedTask.number, focusedTask.stage)}
               className="group relative inline-flex items-center justify-center px-8 py-5 text-lg font-bold text-white transition-all duration-200 bg-emerald-600 font-pj rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-xl shadow-emerald-900/20"
             >
                <div className="absolute -inset-3 rounded-2xl bg-emerald-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 blur-lg"></div>
                <CheckCircle size={28} className="ml-3" />
                <span>إتمام المهمة</span>
             </button>
             
             <p className="mt-6 text-slate-600 text-sm">اضغط عند الانتهاء لتحديث الجدول</p>
          </div>
        </div>
      )}

      {/* --- NORMAL DASHBOARD UI (Background) --- */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2 rounded-md">
            <BrainCircuit size={20} />
          </div>
          <div>
             <h1 className="font-bold text-lg text-slate-800 leading-tight">MediTrack</h1>
             <p className="text-[10px] text-slate-500 font-medium">لوحة التحكم</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowSettings(true); setSettingsTab('guide'); }} className="p-2 text-slate-500 hover:bg-gray-100 rounded-md transition" title="الدليل"><Info size={20} /></button>
          <button onClick={() => { setShowSettings(true); setSettingsTab('manage'); }} className="p-2 text-slate-500 hover:bg-gray-100 rounded-md transition" title="الإعدادات"><Settings size={20} /></button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition" title="خروج"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* Main Grid: 3 Columns */}
      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-80px)]">
        
        {/* COLUMN 1: DROP ZONE (Visual Placeholder) */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="lg:col-span-1 rounded-2xl border-4 border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
        >
           <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
             <Maximize2 size={40} className="text-slate-400 group-hover:text-blue-500" />
           </div>
           <h3 className="text-2xl font-black text-slate-700 mb-2 group-hover:text-blue-600 transition-colors">منطقة التركيز</h3>
           <p className="text-slate-500 max-w-xs mx-auto leading-relaxed">
             اسحب أي محاضرة هنا للانتقال لوضع <strong>الشاشة الكاملة</strong> والتركيز العميق 🧘‍♂️
           </p>
        </div>

        {/* COLUMN 2: REVIEWS */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 flex flex-col h-full overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <BrainCircuit size={18} className="text-amber-500" /> المراجعات
              </h2>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{reviews.length}</span>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-gray-50/50">
              {reviews.length === 0 ? (
                 <div className="text-center py-10 opacity-50">
                   <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
                   <p>عظيم! لا توجد مراجعات.</p>
                 </div>
              ) : (
                reviews.map(r => (
                  <div 
                    key={r.id}
                    draggable 
                    onDragStart={(e) => handleDragStart(e, r)}
                    className="bg-white p-4 rounded-xl border-l-4 border-amber-400 border border-gray-100 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition group select-none"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <GripHorizontal size={20} className="text-slate-300 group-hover:text-slate-500" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${SUBJECTS[r.subject]?.color}`}>{r.subject}</span>
                            <span className="font-bold text-slate-800">Lec {r.number}</span>
                          </div>
                          <p className="text-xs text-slate-400">تكرار رقم {r.stage}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>

        {/* COLUMN 3: NEW LECTURES */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 flex flex-col h-full overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-500" /> الجديد
              </h2>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{news.length}</span>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-gray-50/50">
              {news.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <p>انتهى الجديد! راجع الإعدادات ⚙️</p>
                </div>
              ) : (
                news.map(n => (
                  <div 
                    key={n.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, n)}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition group flex items-center gap-3 select-none"
                  >
                     <GripHorizontal size={20} className="text-slate-300 group-hover:text-slate-500" />
                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white ${SUBJECTS[n.subject]?.badge}`}>
                       {n.subject}
                     </div>
                     <div>
                       <p className="font-bold text-slate-700">Lecture {n.number}</p>
                       <p className="text-xs text-slate-400">جديد تماماً</p>
                     </div>
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
              <div className="flex gap-4">
                 <button onClick={() => setSettingsTab('guide')} className={`text-sm font-bold pb-1 ${settingsTab==='guide' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>الدليل</button>
                 <button onClick={() => setSettingsTab('config')} className={`text-sm font-bold pb-1 ${settingsTab==='config' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>الأعداد</button>
                 <button onClick={() => setSettingsTab('manage')} className={`text-sm font-bold pb-1 ${settingsTab==='manage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>التقدم</button>
                 <button onClick={() => setSettingsTab('danger')} className={`text-sm font-bold pb-1 ${settingsTab==='danger' ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-500'}`}>تصفير</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1">
               {settingsTab === 'guide' && (
                  <div className="space-y-4 text-slate-600 text-sm">
                     <h3 className="font-bold text-slate-800">طريقة الاستخدام الجديدة 🖱️</h3>
                     <p>النظام الآن يعتمد على السحب والإفلات للتركيز العميق.</p>
                     <ul className="list-disc list-inside space-y-2 bg-blue-50 p-4 rounded-md border border-blue-100 text-blue-800">
                        <li><strong>الخطوة 1:</strong> اختر محاضرة من قائمة "المراجعات" أو "الجديد".</li>
                        <li><strong>الخطوة 2:</strong> اسحبها بالماوس وارمها في المربع الكبير على اليمين (منطقة التركيز).</li>
                        <li><strong>الخطوة 3:</strong> سيتحول النظام لوضع الشاشة الكاملة الداكن. ركز ثم اضغط "إتمام".</li>
                     </ul>
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
                           <div key={lecture.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-slate-50">
                              <span className="text-sm font-bold text-slate-700">Lec {lecture.number}</span>
                              <div className="flex items-center gap-2">
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

export default MediTrack;