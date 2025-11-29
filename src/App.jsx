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
  ShieldCheck
} from 'lucide-react';

// --- Firebase Configuration ---
// استبدل هذا الجزء ببياناتك الحقيقية من فايربيز
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
  TSF: { name: 'TSF', color: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200' },
  CBG: { name: 'CBG', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  BIO: { name: 'BIO', color: 'bg-rose-100 text-rose-700', border: 'border-rose-200' },
  ANA: { name: 'ANA', color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  PMD: { name: 'PMD', color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' }
};

// 1-2-4-7 System
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
  const [settingsTab, setSettingsTab] = useState('config'); // 'guide', 'config', 'danger'
  const [tempConfig, setTempConfig] = useState({ TSF: 0, CBG: 0, BIO: 0, ANA: 0, PMD: 0 });

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
      setAuthError("فشل تسجيل الدخول بجوجل. تأكد من تفعيل Google Provider في Firebase Console.");
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
      // Reset states
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
        // First time user: Show settings but start with guide
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
    alert("تم حفظ إعدادات المواد وتحديث الجدول بنجاح ✅");
    setShowSettings(false);
  };

  const resetSubjectProgress = async (subjCode) => {
    if (!confirm(`هل أنت متأكد من حذف كل تقدمك في مادة ${subjCode}؟ سيعود العداد للصفر ولا يمكن التراجع.`)) return;
    
    const batch = writeBatch(db);
    let count = 0;
    Object.values(lectures).forEach(l => {
      if (l.subject === subjCode) {
        batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', l.id));
        count++;
      }
    });
    
    if (count > 0) await batch.commit();
    alert(`تم تصفير ${count} محاضرة لمادة ${subjCode} بنجاح 🗑️`);
  };

  const markFirstFiveAsStudied = async () => {
    if (!user || !window.confirm("هل أنت متأكد؟ سيتم وضع أول 5 محاضرات في قائمة 'مراجعات اليوم' فوراً.")) return;

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
            id,
            subject: subj,
            number: i,
            stage: 1,
            lastStudied: yesterday.toISOString(),
            nextReview: dueToday.toISOString(),
            isCompleted: false
          });
        }
      }
    });

    await batch.commit();
    alert("تم! أول 5 محاضرات ظهرت الآن في قائمة المراجعات.");
    setShowSettings(false);
  };

  const updateLectureStatus = async (lectureId, subject, number, currentStage) => {
    if (!user) return;

    const today = new Date();
    let nextStage = currentStage + 1;
    let nextDate = new Date(); 
    
    let interval = 0;
    let isCompleted = false;

    if (currentStage < INTERVALS.length) {
      interval = INTERVALS[currentStage]; 
      nextDate.setDate(nextDate.getDate() + interval);
    } else {
      isCompleted = true; 
    }

    const data = {
      id: lectureId,
      subject,
      number,
      stage: nextStage,
      lastStudied: today.toISOString(),
      nextReview: isCompleted ? 'COMPLETED' : nextDate.toISOString(),
      isCompleted
    };

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

  const fmtTime = (s) => {
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${m}:${sec<10?'0':''}${sec}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  // --- Views ---

  if (loading) return <div className="flex items-center justify-center h-screen text-blue-600 font-bold">جاري تحميل بياناتك...</div>;

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">MediTrack Pro</h1>
          <p className="text-slate-500 mb-8">نظم مذاكرة الطب بذكاء واحفظ تقدمك.</p>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3 hover:bg-slate-800 transition"
          >
            <LogIn size={20} />
            تسجيل الدخول (Google)
          </button>

          <button 
            onClick={handleGuestLogin}
            className="w-full bg-white text-slate-600 border border-slate-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
          >
            <User size={20} />
            دخول كزائر (مؤقت)
          </button>

          {authError && (
             <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
               {authError}
             </div>
          )}
        </div>
        <p className="mt-6 text-xs text-slate-400">
          تنويه: الدخول كزائر قد يسبب ضياع البيانات عند مسح المتصفح.
        </p>
      </div>
    );
  }

  // SETTINGS & GUIDE MODAL
  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          
          {/* Header */}
          <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Settings size={20} className="text-slate-500" />
              لوحة التحكم
            </h2>
            {config && <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} /></button>}
          </div>

          {/* Tabs */}
          <div className="flex p-2 gap-2 bg-slate-50">
            <button 
              onClick={() => setSettingsTab('guide')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${settingsTab === 'guide' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:bg-white/50'}`}
            >
              <Info size={16} />
              شرح النظام
            </button>
            <button 
              onClick={() => setSettingsTab('config')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${settingsTab === 'config' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:bg-white/50'}`}
            >
              <Settings size={16} />
              إعداد المواد
            </button>
            <button 
              onClick={() => setSettingsTab('danger')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${settingsTab === 'danger' ? 'bg-white shadow text-red-600' : 'text-slate-400 hover:bg-white/50'}`}
            >
              <AlertTriangle size={16} />
              المنطقة الخطرة
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto">
            
            {/* Tab 1: Guide */}
            {settingsTab === 'guide' && (
              <div className="space-y-4 text-slate-600">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-2">كيف يعمل MediTrack؟ 🤔</h3>
                  <p className="text-sm leading-relaxed">
                    النظام مصمم ليتابع معك المنهج تلقائياً بخوارزمية <strong>1-2-4-7</strong>.
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    <p>عندما تذاكر محاضرة <strong>"جديدة"</strong>، ستختفي وتظهر لك <strong>غداً</strong> للمراجعة الأولى.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    <p>المحاضرات التي تنتظر موعد مراجعتها ستجدها في قسم <strong>"مراجعات قادمة"</strong> بالأسفل.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">3</span>
                    <p>الدورة الكاملة للمحاضرة: مراجعة بعد (يوم) ← (يومين) ← (4 أيام) ← (أسبوع). ثم تكتمل.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Config */}
            {settingsTab === 'config' && (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="text-sm text-slate-500 mb-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                  💡 <strong>نصيحة:</strong> حدد هنا إجمالي المحاضرات المتاحة حالياً. يمكنك زيادة هذا الرقم في أي وقت عندما تنزل محاضرات جديدة.
                </div>
                {Object.keys(SUBJECTS).map(subj => (
                  <div key={subj} className="flex items-center gap-3">
                    <label className={`w-16 font-bold py-2 px-3 rounded text-center text-sm ${SUBJECTS[subj].color}`}>{subj}</label>
                    <input
                      type="number"
                      min="0"
                      className="flex-1 p-2 border rounded-lg text-center outline-none focus:border-blue-500 font-bold bg-slate-50 focus:bg-white transition"
                      value={tempConfig[subj]}
                      onChange={e => setTempConfig({...tempConfig, [subj]: e.target.value})}
                    />
                  </div>
                ))}
                
                <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition flex items-center justify-center gap-2 mt-4">
                  <Save size={18} />
                  حفظ وتحديث الجدول
                </button>

                <hr className="my-4" />
                
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <h3 className="font-bold text-amber-800 mb-1 flex items-center gap-2">
                    <FastForward size={18} />
                    زر الطوارئ (تسريع)
                  </h3>
                  <p className="text-xs text-amber-700 mb-3">
                    استخدم هذا الزر إذا كنت قد ذاكرت أول 5 محاضرات بالفعل وتريد مراجعتهم فوراً (سيظهرون في جدول اليوم).
                  </p>
                  <button 
                    type="button"
                    onClick={markFirstFiveAsStudied}
                    className="w-full bg-white text-amber-600 border border-amber-200 py-2 rounded-lg text-sm font-bold hover:bg-amber-100 shadow-sm"
                  >
                    تفعيل مراجعة أول 5 محاضرات
                  </button>
                </div>
              </form>
            )}

            {/* Tab 3: Danger Zone */}
            {settingsTab === 'danger' && (
              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm">
                  ⚠️ <strong>تحذير:</strong> هذه الأزرار ستمسح سجل مذاكرتك للمادة وتعيد العداد للصفر. استخدمها فقط إذا أردت بدء المادة من جديد.
                </div>
                
                {Object.keys(SUBJECTS).map(subj => (
                  <div key={subj} className="flex items-center justify-between p-3 border rounded-xl bg-white">
                    <span className={`font-bold text-sm ${SUBJECTS[subj].color.replace('bg-', 'text-').split(' ')[1]}`}>{subj}</span>
                    <button 
                      onClick={() => resetSubjectProgress(subj)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition flex items-center gap-2 text-xs font-bold"
                    >
                      <Trash2 size={16} />
                      تصفير المادة
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  const reviews = getDueReviews();
  const upcoming = getUpcomingReviews();
  const news = getNewSuggestions();

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800" dir="rtl">
      <div className="max-w-md mx-auto pb-20">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-6 pt-2">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">MediTrack <span className="text-blue-600">Pro</span></h1>
            <p className="text-xs text-slate-500 font-medium">
              أهلاً {user.isAnonymous ? 'زائر' : user.displayName?.split(' ')[0]} 👋
            </p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => { setShowSettings(true); setSettingsTab('guide'); }} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-blue-500 hover:bg-blue-50 transition" title="شرح النظام">
              <Info size={20} />
            </button>
            <button onClick={() => { setShowSettings(true); setSettingsTab('config'); }} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-slate-600 transition" title="الإعدادات">
              <Settings size={20} />
            </button>
            <button onClick={handleLogout} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-red-400 hover:text-red-600 transition" title="تسجيل الخروج">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Timer */}
        <div className={`mb-8 p-6 rounded-3xl text-white shadow-xl shadow-blue-900/5 relative overflow-hidden transition-all duration-500 ${timerMode === 'focus' ? 'bg-slate-900' : 'bg-emerald-600'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-white/10"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2 opacity-90">
              <Clock size={18} />
              <span className="text-sm font-medium">{timerMode === 'focus' ? 'وقت المذاكرة' : 'وقت الراحة'}</span>
            </div>
            <button onClick={() => {setTimerActive(false); setTimeLeft(25*60); setTimerMode('focus')}} className="hover:bg-white/20 p-1.5 rounded-lg transition">
              <RotateCcw size={16} />
            </button>
          </div>
          
          <div className="text-center mb-6 relative z-10">
            <div className="text-6xl font-black font-mono tracking-wider tabular-nums">
              {fmtTime(timeLeft)}
            </div>
          </div>

          <button 
            onClick={() => setTimerActive(!timerActive)}
            className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold hover:bg-slate-100 transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            {timerActive ? 'إيقاف المؤقت' : 'ابدأ التركيز'}
          </button>
        </div>

        {/* Reviews Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <BrainCircuit className="text-amber-500" size={24} />
              مراجعات اليوم
            </h3>
            {reviews.length > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{reviews.length} مستحق</span>}
          </div>

          {reviews.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={24} />
              </div>
              <p className="text-slate-500 font-medium text-sm">عظيم! لا توجد مراجعات مستحقة الآن.</p>
              <p className="text-slate-400 text-xs mt-1">ابدأ في الجديد 👇</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-white p-4 rounded-2xl border-l-4 border-amber-400 shadow-sm flex items-center justify-between group hover:shadow-md transition">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SUBJECTS[r.subject]?.color}`}>
                        {r.subject}
                      </span>
                      <span className="font-bold text-slate-800">محاضرة {r.number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>تكرار: {r.stage}/4</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateLectureStatus(r.id, r.subject, r.number, r.stage)}
                    className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-green-500 hover:text-white transition shadow-sm"
                    title="تمت المراجعة"
                  >
                    <CheckCircle size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Lectures Section */}
        <div className="mb-8">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-lg">
            <BookOpen className="text-blue-500" size={24} />
            الجديد (New)
          </h3>
          
          <div className="grid gap-3">
            {news.length === 0 ? (
               <div className="text-center text-slate-400 text-sm py-4 bg-slate-100 rounded-xl border border-dashed border-slate-300">
                 {config ? "خلصت كل الجديد! اضغط على ⚙️ لتزويد المحاضرات." : "لم تحدد محاضرات بعد. اضغط على ⚙️ للبدء."}
               </div>
            ) : (
              news.map(n => (
                <div key={n.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${SUBJECTS[n.subject]?.color}`}>
                      {n.subject}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">محاضرة {n.number}</p>
                      <p className="text-xs text-slate-400">لم تذاكر بعد</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateLectureStatus(n.id, n.subject, n.number, 0)}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition"
                  >
                    ذاكر الآن
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Reviews Section */}
        {upcoming.length > 0 && (
          <div className="opacity-75">
            <h3 className="font-bold text-slate-500 flex items-center gap-2 mb-4 text-sm mt-8 border-t pt-4">
              <CalendarClock size={16} />
              مراجعات قادمة (في الانتظار)
            </h3>
            <div className="space-y-2">
              {upcoming.map(u => (
                <div key={u.id} className="bg-slate-100 p-3 rounded-xl flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${SUBJECTS[u.subject]?.color.split(' ')[0].replace('bg-', 'bg-')}`}></span>
                    <span className="text-xs font-bold">{u.subject} {u.number}</span>
                  </div>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border">
                    {formatDate(u.nextReview)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MediTrack;