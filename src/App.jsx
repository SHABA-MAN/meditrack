import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  RotateCcw, 
  BrainCircuit, 
  Settings, 
  BookOpen,
  Save,
  FastForward
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
// تم تثبيت معرف التطبيق الخاص بك
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
// Index 0: First Review (after 1 day)
// Index 1: Second Review (after 2 days)
// Index 2: Third Review (after 4 days)
// Index 3: Fourth Review (after 7 days)
const INTERVALS = [1, 2, 4, 7];

const MediTrack = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [config, setConfig] = useState(null); 
  const [lectures, setLectures] = useState({});
  
  // UI State
  const [showConfig, setShowConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState({ TSF: 0, CBG: 0, BIO: 0, ANA: 0, PMD: 0 });

  // Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState('focus');

  // --- Auth & Sync ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to Config
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(data);
        setTempConfig(data);
        setShowConfig(false);
      } else {
        setShowConfig(true);
      }
      setLoading(false);
    });

    // Listen to Lectures
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
    setShowConfig(false);
  };

  const markFirstFiveAsStudied = async () => {
    if (!user || !window.confirm("هل أنت متأكد؟ سيتم اعتبار أول 5 محاضرات من كل مادة أنها 'تمت مذاكرتها' وستدخل جدول المراجعة فوراً.")) return;

    const batch = writeBatch(db);
    const today = new Date();
    
    // Set them as studied yesterday so they appear due today/tomorrow depending on logic
    // We'll set lastStudied to NOW, so next review (after 1 day) is TOMORROW.
    // Or if user wants them as "Old" ready for review -> set lastStudied to yesterday.
    // Let's set them as Stage 1, last studied NOW. Next review in 1 day.
    
    Object.keys(SUBJECTS).forEach(subj => {
      for (let i = 1; i <= 5; i++) {
        const id = `${subj}_${i}`;
        // Only update if not already progressed beyond stage 1
        if (!lectures[id] || lectures[id].stage < 1) {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', id);
          
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 1); // Due tomorrow

          batch.set(ref, {
            id,
            subject: subj,
            number: i,
            stage: 1, // Finished study (Stage 0 -> 1)
            lastStudied: new Date().toISOString(),
            nextReview: nextDate.toISOString(),
            isCompleted: false
          });
        }
      }
    });

    await batch.commit();
    alert("تم تحديث أول 5 محاضرات بنجاح! ستظهر في المراجعات بداية من الغد (أو يمكنك تعديل التواريخ).");
    setShowConfig(false);
  };

  const updateLectureStatus = async (lectureId, subject, number, currentStage) => {
    if (!user) return;

    // CurrentStage 0 = New Study
    // CurrentStage 1 = Review 1 (Interval 1 day)
    // ...
    const today = new Date();
    today.setHours(0,0,0,0);

    let nextStage = currentStage + 1;
    let nextDate = new Date(); // From NOW
    
    let interval = 0;
    let isCompleted = false;

    // Logic:
    // If just studied New (Stage 0->1): Next review in INTERVALS[0] (1 day)
    // If just did Review 1 (Stage 1->2): Next review in INTERVALS[1] (2 days)
    if (currentStage < INTERVALS.length) {
      interval = INTERVALS[currentStage]; 
      nextDate.setDate(nextDate.getDate() + interval);
    } else {
      isCompleted = true; // Done all reps
    }

    const data = {
      id: lectureId,
      subject,
      number,
      stage: nextStage,
      lastStudied: new Date().toISOString(),
      nextReview: isCompleted ? 'COMPLETED' : nextDate.toISOString(),
      isCompleted
    };

    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data);
  };

  // --- Helpers ---
  const getDueReviews = () => {
    const now = new Date();
    return Object.values(lectures).filter(l => {
      if (l.isCompleted || !l.nextReview || l.nextReview === 'COMPLETED') return false;
      return new Date(l.nextReview) <= now;
    }).sort((a,b) => new Date(a.nextReview) - new Date(b.nextReview));
  };

  const getNewSuggestions = () => {
    if (!config) return [];
    const suggestions = [];
    Object.keys(SUBJECTS).forEach(subj => {
      const total = parseInt(config[subj]) || 0;
      for (let i = 1; i <= total; i++) {
        const id = `${subj}_${i}`;
        // Suggest if it doesn't exist OR it's stage 0 (never finished study)
        if (!lectures[id] || lectures[id].stage === 0) {
          suggestions.push({ id, subject: subj, number: i, stage: 0 });
          break; // Only next one per subject
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

  // --- Views ---

  if (loading) return <div className="flex items-center justify-center h-screen text-blue-600">جاري التحميل...</div>;

  // Settings View
  if (showConfig) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 font-sans text-right" dir="rtl">
        <div className="max-w-md mx-auto bg-white p-6 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">إعداد المنهج ⚙️</h2>
            {config && <button onClick={() => setShowConfig(false)} className="text-sm text-blue-600">رجوع</button>}
          </div>
          
          <form onSubmit={handleSaveConfig} className="space-y-3">
            <p className="text-sm text-slate-500 mb-2">أدخل العدد الكلي للمحاضرات (تقدر تزوده بعدين):</p>
            {Object.keys(SUBJECTS).map(subj => (
              <div key={subj} className="flex items-center gap-3">
                <label className={`w-16 font-bold py-2 px-3 rounded text-center text-sm ${SUBJECTS[subj].color}`}>{subj}</label>
                <input
                  type="number"
                  className="flex-1 p-2 border rounded-lg text-center outline-none focus:border-blue-500"
                  value={tempConfig[subj]}
                  onChange={e => setTempConfig({...tempConfig, [subj]: e.target.value})}
                />
              </div>
            ))}
            
            <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition flex items-center justify-center gap-2 mt-4">
              <Save size={18} />
              حفظ التغييرات
            </button>
          </form>

          <hr className="my-6 border-slate-100" />

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
            <h3 className="font-bold text-amber-800 mb-1 flex items-center gap-2">
              <FastForward size={18} />
              تسريع البدء
            </h3>
            <p className="text-xs text-amber-700 mb-3">لو ذاكرت أول 5 محاضرات، اضغط هنا عشان نعتبرهم "خلصوا مذاكرة أولى" ويدخلوا في جدول المراجعة فوراً.</p>
            <button 
              onClick={markFirstFiveAsStudied}
              className="w-full bg-white text-amber-600 border border-amber-200 py-2 rounded-lg text-sm font-bold hover:bg-amber-100"
            >
              اعتبار أول 5 تم مذاكرتهم
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reviews = getDueReviews();
  const news = getNewSuggestions();

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800" dir="rtl">
      <div className="max-w-md mx-auto pb-20">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">MediTrack <span className="text-blue-600">Pro</span></h1>
            <p className="text-xs text-slate-500 font-medium">System 1-2-4-7 Activated</p>
          </div>
          <button onClick={() => setShowConfig(true)} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-blue-600 transition">
            <Settings size={20} />
          </button>
        </header>

        {/* Timer */}
        <div className={`mb-8 p-6 rounded-3xl text-white shadow-xl shadow-blue-900/5 relative overflow-hidden transition-all duration-500 ${timerMode === 'focus' ? 'bg-slate-900' : 'bg-emerald-600'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-white/10"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2 opacity-90">
              <Clock size={18} />
              <span className="text-sm font-medium">{timerMode === 'focus' ? 'Focus Session' : 'Break Time'}</span>
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
            {timerActive ? 'إيقاف مؤقت' : 'ابدأ الآن'}
          </button>
        </div>

        {/* Reviews Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <BrainCircuit className="text-amber-500" size={20} />
              مراجعات اليوم
            </h3>
            {reviews.length > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{reviews.length}</span>}
          </div>

          {reviews.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={24} />
              </div>
              <p className="text-slate-400 text-sm">عظيم! مفيش تراكمات قديمة عليك النهاردة.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SUBJECTS[r.subject]?.color}`}>
                        {r.subject}
                      </span>
                      <span className="font-bold text-slate-700">Lecture {r.number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>تكرار: {r.stage}/4</span>
                      <span>•</span>
                      <span>الفاصل القادم: {INTERVALS[r.stage]} أيام</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateLectureStatus(r.id, r.subject, r.number, r.stage)}
                    className="w-10 h-10 rounded-full border-2 border-slate-100 text-slate-300 flex items-center justify-center hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition"
                  >
                    <CheckCircle size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Lectures Section */}
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <BookOpen className="text-blue-500" size={20} />
            الجديد (New)
          </h3>
          
          <div className="grid gap-3">
            {news.length === 0 ? (
               <div className="text-center text-slate-400 text-sm py-4">
                 خلصت كل الجديد! زود العدد من الإعدادات لو فيه محاضرات نزلت.
               </div>
            ) : (
              news.map(n => (
                <div key={n.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${SUBJECTS[n.subject]?.color}`}>
                      {n.subject}
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">Lecture {n.number}</p>
                      <p className="text-xs text-slate-400">لم تذاكر بعد</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateLectureStatus(n.id, n.subject, n.number, 0)}
                    className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition"
                  >
                    ذاكر وفعّل 1247
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MediTrack;