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
  CalendarClock,
  Info,
  Trash2,
  AlertTriangle,
  X,
  LogIn,
  LogOut,
  User,
  Layout,
  Plus,
  Minus,
  LayoutList,
  ChevronLeft
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
  TSF: { name: 'TSF', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', badge: 'bg-indigo-600' },
  CBG: { name: 'CBG', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', badge: 'bg-emerald-600' },
  BIO: { name: 'BIO', color: 'bg-rose-100 text-rose-800 border-rose-200', badge: 'bg-rose-600' },
  ANA: { name: 'ANA', color: 'bg-blue-100 text-blue-800 border-blue-200', badge: 'bg-blue-600' },
  PMD: { name: 'PMD', color: 'bg-amber-100 text-amber-800 border-amber-200', badge: 'bg-amber-600' }
};

const INTERVALS = [1, 2, 4, 7];

const MediTrack = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Data State
  const [config, setConfig] = useState(null); 
  const [lectures, setLectures] = useState({});
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('config');
  const [tempConfig, setTempConfig] = useState({ TSF: 0, CBG: 0, BIO: 0, ANA: 0, PMD: 0 });
  const [selectedManageSubject, setSelectedManageSubject] = useState('ANA');

  // Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState('focus');

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

  // --- Helpers ---
  const getDueReviews = () => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return Object.values(lectures).filter(l => {
      if (l.isCompleted || !l.nextReview || l.nextReview === 'COMPLETED') return false;
      return new Date(l.nextReview) <= endOfDay;
    }).sort((a,b) => new Date(a.nextReview) - new Date(b.nextReview));
  };

  const getUpcomingReviews = () => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return Object.values(lectures).filter(l => {
      if (l.isCompleted || !l.nextReview || l.nextReview === 'COMPLETED') return false;
      return new Date(l.nextReview) > endOfDay;
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

  // --- Timer ---
  useEffect(() => {
    let int = null;
    if (timerActive && timeLeft > 0) {
      int = setInterval(() => setTimeLeft(p => p - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      setTimerMode(m => m === 'focus' ? 'break' : 'focus');
      setTimeLeft(timerMode === 'focus' ? 5*60 : 25*60);
    }
    return () => clearInterval(int);
  }, [timerActive, timeLeft]);

  const fmtTime = (s) => `${Math.floor(s/60)}:${(s%60)<10?'0':''}${s%60}`;
  const formatDate = (isoString) => {
    if (!isoString) return '';
    if (isoString === 'COMPLETED') return 'مكتمل';
    return new Date(isoString).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-slate-600 font-bold">جاري تحميل النظام...</div>;

  // LOGIN SCREEN (Centered Card)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-10 rounded-lg shadow-md border border-gray-200 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-lg flex items-center justify-center mx-auto mb-6">
             <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">MediTrack Pro</h1>
          <p className="text-slate-500 mb-8 text-sm">إدارة المنهج الطبي بنظام التكرار المتباعد</p>
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
  const upcoming = getUpcomingReviews();
  const news = getNewSuggestions();

  // DASHBOARD LAYOUT
  return (
    <div className="min-h-screen bg-gray-100 text-slate-800 font-sans" dir="rtl">
      
      {/* Top Navigation Bar */}
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
          <span className="text-sm text-slate-500 ml-2 hidden sm:inline">
            مرحباً، {user.isAnonymous ? 'زائر' : user.displayName?.split(' ')[0]}
          </span>
          <button onClick={() => { setShowSettings(true); setSettingsTab('guide'); }} className="p-2 text-slate-500 hover:bg-gray-100 rounded-md transition" title="الدليل"><Info size={20} /></button>
          <button onClick={() => { setShowSettings(true); setSettingsTab('manage'); }} className="p-2 text-slate-500 hover:bg-gray-100 rounded-md transition" title="الإعدادات"><Settings size={20} /></button>
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-md transition" title="خروج"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RIGHT COLUMN: Timer & Info (3 Cols) */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Timer Widget */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className={`p-4 text-center text-white transition-colors duration-300 ${timerMode === 'focus' ? 'bg-slate-800' : 'bg-emerald-600'}`}>
              <div className="flex justify-center items-center gap-2 mb-2 opacity-80">
                <Clock size={16} />
                <span className="text-xs font-bold tracking-wider">{timerMode === 'focus' ? 'FOCUS' : 'BREAK'}</span>
              </div>
              <div className="text-5xl font-mono font-bold tracking-widest mb-2">{fmtTime(timeLeft)}</div>
            </div>
            <div className="p-3 bg-gray-50 flex gap-2">
               <button onClick={() => setTimerActive(!timerActive)} className={`flex-1 py-2 rounded-md font-bold text-sm text-white transition ${timerActive ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-800'}`}>
                 {timerActive ? 'إيقاف' : 'بدء'}
               </button>
               <button onClick={() => {setTimerActive(false); setTimeLeft(25*60); setTimerMode('focus')}} className="px-3 py-2 bg-white border border-gray-300 rounded-md text-slate-500 hover:bg-gray-100">
                 <RotateCcw size={16} />
               </button>
            </div>
          </div>

          {/* Stats Summary (Simplified) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-sm text-slate-700 mb-3 border-b pb-2">ملخص المهام</h3>
            <div className="space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-slate-500">مراجعات اليوم:</span>
                 <span className="font-bold text-amber-600">{reviews.length}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500">جديد مقترح:</span>
                 <span className="font-bold text-blue-600">{news.length}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500">قادمة:</span>
                 <span className="font-bold text-slate-700">{upcoming.length}</span>
               </div>
            </div>
          </div>
        </aside>

        {/* MIDDLE COLUMN: Work Area (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section: Due Reviews */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <BrainCircuit size={18} className="text-amber-500" /> مراجعات مستحقة
              </h2>
              {reviews.length > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{reviews.length}</span>}
            </div>

            {reviews.length === 0 ? (
               <div className="bg-white border border-gray-200 border-dashed rounded-lg p-6 text-center">
                 <div className="text-green-500 mb-2 flex justify-center"><CheckCircle size={24} /></div>
                 <p className="text-sm text-slate-500">ممتاز! لا توجد مراجعات متراكمة.</p>
               </div>
            ) : (
              <div className="space-y-2">
                {reviews.map(r => (
                  <div key={r.id} className="bg-white p-3 rounded-lg border-r-4 border-amber-400 border border-gray-200 shadow-sm flex justify-between items-center group hover:shadow-md transition">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${SUBJECTS[r.subject]?.color}`}>{r.subject}</span>
                        <span className="font-bold text-sm">محاضرة {r.number}</span>
                      </div>
                      <div className="text-xs text-slate-400">تكرار رقم {r.stage} (فاصل {INTERVALS[r.stage-1]} أيام)</div>
                    </div>
                    <button onClick={() => updateLectureStatus(r.id, r.subject, r.number, r.stage)} className="text-slate-300 hover:text-green-600 p-1">
                      <CheckCircle size={24} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: New Lectures */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-500" /> محاضرات جديدة
              </h2>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {news.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-400">
                  {config ? "انتهى الجديد! قم بزيادة العدد من الإعدادات." : "اضبط المنهج من الإعدادات ⚙️"}
                </div>
              ) : (
                news.map(n => (
                  <div key={n.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white ${SUBJECTS[n.subject]?.badge}`}>
                          {n.subject}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-700">Lec {n.number}</p>
                          <p className="text-[10px] text-slate-400">لم تذاكر بعد</p>
                        </div>
                     </div>
                     <button onClick={() => updateLectureStatus(n.id, n.subject, n.number, 0)} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 transition">
                       بدء
                     </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: Upcoming Schedule (4 Cols) */}
        <div className="lg:col-span-4">
           <div className="bg-slate-50 rounded-lg border border-slate-200 h-full flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-white rounded-t-lg">
                <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                   <CalendarClock size={16} /> الجدول القادم
                </h2>
              </div>
              <div className="p-4 overflow-y-auto max-h-[500px] flex-1">
                {upcoming.length === 0 ? (
                   <p className="text-center text-xs text-slate-400 mt-10">الجدول فارغ حالياً.</p>
                ) : (
                   <div className="space-y-3">
                     {upcoming.map(u => (
                       <div key={u.id} className="flex items-center gap-3 text-sm">
                          <div className={`w-1 h-8 rounded-full ${SUBJECTS[u.subject]?.badge}`}></div>
                          <div className="flex-1">
                             <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-slate-700 text-xs">{u.subject} - Lec {u.number}</span>
                                <span className="text-[10px] bg-white border px-1 rounded text-slate-500">{formatDate(u.nextReview)}</span>
                             </div>
                             <div className="w-full bg-gray-200 rounded-full h-1">
                               <div className="bg-slate-400 h-1 rounded-full" style={{ width: `${(u.stage/4)*100}%` }}></div>
                             </div>
                          </div>
                       </div>
                     ))}
                   </div>
                )}
              </div>
           </div>
        </div>

      </main>

      {/* SETTINGS MODAL (Re-styled) */}
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
               {/* Tab Content Logic Same as before but cleaner UI */}
               {settingsTab === 'guide' && (
                  <div className="space-y-4 text-slate-600 text-sm">
                     <h3 className="font-bold text-slate-800">نظام 1-2-4-7</h3>
                     <p>هذا النظام مصمم لنقل المعلومات للذاكرة طويلة المدى عن طريق تباعد فترات المراجعة.</p>
                     <ul className="list-disc list-inside space-y-1 bg-slate-50 p-4 rounded-md border border-slate-100">
                        <li>مذاكرة جديد ⬅ مراجعة غداً.</li>
                        <li>مراجعة 1 ⬅ بعد يومين.</li>
                        <li>مراجعة 2 ⬅ بعد 4 أيام.</li>
                        <li>مراجعة 3 ⬅ بعد أسبوع (تم الانتهاء).</li>
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