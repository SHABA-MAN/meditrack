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
  MoreVertical,
  Flag
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
  
  // Focus Mode State
  const [focusQueue, setFocusQueue] = useState([]); 
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [isFocusAnimating, setIsFocusAnimating] = useState(false);
  const [isFreeFocus, setIsFreeFocus] = useState(false); 
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('config');
  const [tempConfig, setTempConfig] = useState({ TSF: 0, CBG: 0, BIO: 0, ANA: 0, PMD: 0 });
  const [selectedManageSubject, setSelectedManageSubject] = useState('ANA');
  
  // Task Editing State
  const [editingTask, setEditingTask] = useState(null); 

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

  const startFreeFocus = () => {
    setIsFreeFocus(true);
    setIsFocusModeActive(true);
    setTimeout(() => setIsFocusAnimating(true), 50);
  };

  const closeFocusMode = () => {
    setIsFocusAnimating(false);
    setTimeout(() => {
      setIsFocusModeActive(false);
      setIsFreeFocus(false);
      setFocusQueue([]);
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

    const data = {
      id: task.id, subject: task.subject, number: task.number, stage: nextStage, lastStudied: today.toISOString(), nextReview: isCompleted ? 'COMPLETED' : nextDate.toISOString(), isCompleted
    };
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', task.id), data, { merge: true });

    const newQueue = focusQueue.filter(t => t.id !== task.id);
    setFocusQueue(newQueue);

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
      const task = JSON.parse(taskData);
      if (focusQueue.find(t => t.id === task.id)) return;
      
      const newQueue = [...focusQueue, task];
      setFocusQueue(newQueue);
      
      if (newQueue.length === 2) {
        setIsFocusModeActive(true);
        setTimeout(() => setIsFocusAnimating(true), 50);
      }
    }
  };

  const removeFromQueue = (taskId) => {
    setFocusQueue(focusQueue.filter(t => t.id !== taskId));
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

  // Fixed the bug here: explicit subject assignment
  const getManageLectures = () => {
     if (!config || !selectedManageSubject) return [];
     const total = parseInt(config[selectedManageSubject]) || 0;
     const list = [];
     for(let i=1; i<=total; i++) {
        const id = `${selectedManageSubject}_${i}`;
        const lecture = lectures[id];
        list.push({ 
          id, 
          subject: selectedManageSubject, // Added this line to fix the error
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
      
      {/* 🌑 FULL SCREEN FOCUS MODE OVERLAY (SPLIT SCREEN) 🌑 */}
      {isFocusModeActive && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col transition-all duration-500 ease-in-out transform ${
            isFocusAnimating 
              ? 'bg-slate-950 translate-x-0' 
              : 'bg-slate-950 -translate-x-full'
          }`}
        >
          {/* Top Bar (Minimal) */}
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 pointer-events-none">
             <div className="pointer-events-auto">
                <button 
                  onClick={closeFocusMode} 
                  className="p-2 text-slate-500 hover:text-white transition"
                >
                  <X size={20} />
                </button>
             </div>
          </div>

          <div className="flex-1 flex h-full">
             {isFreeFocus ? (
               // FREE FOCUS UI (Minimal)
               <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                 <Zap size={48} className="text-amber-500 mb-6 opacity-80" />
                 <h2 className="text-2xl font-light tracking-wide mb-8">جلسة تركيز حرة</h2>
                 <button 
                   onClick={closeFocusMode} 
                   className="px-6 py-2 border border-slate-700 hover:bg-slate-800 rounded-full text-sm text-slate-400 hover:text-white transition"
                 >
                    إنهاء
                 </button>
               </div>
             ) : (
               // SPLIT SCREEN TASKS
               <>
                 {focusQueue.map((task, idx) => (
                   <div 
                     key={task.id} 
                     className={`h-full flex flex-col items-center justify-center p-8 relative transition-all duration-500
                       ${focusQueue.length === 2 ? 'w-1/2' : 'w-full'}
                       ${idx === 0 && focusQueue.length === 2 ? 'border-l border-slate-800' : ''}
                     `}
                   >
                      {/* Task Content */}
                      <div className="text-center">
                        {/* Subject Badge */}
                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-6 text-white shadow-lg ${SUBJECTS[task.subject]?.darkBadge || 'bg-slate-700'}`}>
                          {task.subject}
                        </div>

                        {/* Title & Number */}
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">
                          Lec {task.number}
                        </h2>
                        {task.title && <p className="text-lg text-emerald-400 font-medium mb-1">{task.title}</p>}
                        
                        {/* Meta Info */}
                        <div className="flex items-center justify-center gap-3 text-slate-500 text-xs mb-8">
                           <span>{task.stage === 0 ? 'جديد' : `مراجعة ${task.stage}`}</span>
                           {task.difficulty && (
                             <span className={`px-1.5 py-0.5 rounded border ${task.difficulty === 'hard' ? 'border-red-900 text-red-400' : task.difficulty === 'easy' ? 'border-green-900 text-green-400' : 'border-slate-800'}`}>
                               {task.difficulty === 'hard' ? 'صعب' : task.difficulty === 'easy' ? 'سهل' : 'عادي'}
                             </span>
                           )}
                        </div>

                        {/* Description (Minimal) */}
                        {task.description && (
                          <p className="text-slate-400 text-sm max-w-xs mx-auto mb-10 leading-relaxed font-light">
                            {task.description}
                          </p>
                        )}

                        {/* Minimal Done Button */}
                        <button 
                          onClick={() => completeTask(task)}
                          className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900 hover:bg-emerald-900 hover:border-emerald-700 text-slate-500 hover:text-emerald-400 flex items-center justify-center transition-all duration-300 mx-auto group"
                          title="إتمام"
                        >
                           <CheckCircle size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                   </div>
                 ))}
               </>
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
          className="lg:col-span-1 rounded-2xl border-4 border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 flex flex-col p-6 text-center cursor-pointer group hover:scale-[1.01]"
        >
           {/* Placeholder if empty */}
           {focusQueue.length === 0 && (
             <div className="flex-1 flex flex-col items-center justify-center opacity-60 w-full">
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Layers size={32} className="text-slate-400 group-hover:text-blue-500" />
                </div>
                <h3 className="text-xl font-black text-slate-700 mb-1">منطقة التركيز</h3>
                <p className="text-slate-500 text-sm max-w-[200px] leading-relaxed mb-6">
                  اسحب <strong>محاضرتين</strong> هنا لبدء جلسة الانغماس الكامل 🚀
                </p>
                
                <button 
                  onClick={startFreeFocus}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition flex items-center gap-2"
                >
                  <Coffee size={14} />
                  جلسة حرة (بدون مواد)
                </button>
             </div>
           )}

           {/* Queue Display */}
           {focusQueue.length > 0 && (
             <div className="w-full flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>طابور المذاكرة</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${focusQueue.length >= 2 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {focusQueue.length}/2
                  </span>
                </h3>
                
                <div className="space-y-2 flex-1">
                  {focusQueue.map((task, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center animate-in slide-in-from-bottom duration-300">
                       <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${SUBJECTS[task.subject]?.badge}`}>
                            {task.subject}
                          </span>
                          <div className="flex flex-col items-start">
                             <span className="font-bold text-slate-700 text-sm">Lec {task.number}</span>
                             {task.title && <span className="text-[10px] text-slate-400">{task.title}</span>}
                          </div>
                       </div>
                       <button onClick={() => removeFromQueue(task.id)} className="text-slate-300 hover:text-red-500">
                         <X size={16} />
                       </button>
                    </div>
                  ))}
                  
                  {focusQueue.length === 1 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 flex items-center justify-center text-slate-400 text-xs italic animate-pulse">
                      + اسحب محاضرة كمان
                    </div>
                  )}
                </div>

                {focusQueue.length >= 2 && (
                  <div className="mt-4 bg-green-50 text-green-700 p-3 rounded-lg text-sm font-bold animate-pulse">
                    جاري الدخول لوضع التركيز... ⏳
                  </div>
                )}
             </div>
           )}
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
                    className="bg-white p-4 rounded-xl border-l-4 border-amber-400 border border-gray-100 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition group select-none relative"
                  >
                    <button 
                      onClick={() => openEditModal(r)}
                      className="absolute top-2 left-2 p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition opacity-0 group-hover:opacity-100"
                      title="تعديل التفاصيل"
                    >
                      <Edit2 size={12} />
                    </button>

                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <GripHorizontal size={20} className="text-slate-300 group-hover:text-slate-500" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${SUBJECTS[r.subject]?.color}`}>{r.subject}</span>
                            <span className="font-bold text-slate-800">Lec {r.number}</span>
                          </div>
                          {r.title && <p className="text-xs font-medium text-slate-600 mb-0.5">{r.title}</p>}
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                             <span>تكرار {r.stage}</span>
                             {r.difficulty === 'hard' && <span className="text-red-400 font-bold">• صعب</span>}
                          </div>
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
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition group flex items-center gap-3 select-none relative"
                  >
                     <button 
                        onClick={() => openEditModal(n)}
                        className="absolute top-2 left-2 p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition opacity-0 group-hover:opacity-100"
                        title="تعديل التفاصيل"
                      >
                        <Edit2 size={12} />
                      </button>

                     <GripHorizontal size={20} className="text-slate-300 group-hover:text-slate-500" />
                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white ${SUBJECTS[n.subject]?.badge}`}>
                       {n.subject}
                     </div>
                     <div>
                       <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-700">Lec {n.number}</p>
                          {n.difficulty === 'hard' && <Flag size={10} className="text-red-500 fill-current" />}
                       </div>
                       {n.title && <p className="text-xs font-medium text-slate-600">{n.title}</p>}
                       {!n.title && <p className="text-xs text-slate-400">جديد تماماً</p>}
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
                     <h3 className="font-bold text-slate-800">التحديث الجديد: تحدي المحاضرتين 💪</h3>
                     <p>عشان نضمن إنك مش بتدلع، لازم تسحب <strong>محاضرتين</strong> في منطقة التركيز عشان تقدر تبدأ.</p>
                     <ul className="list-disc list-inside space-y-2 bg-blue-50 p-4 rounded-md border border-blue-100 text-blue-800">
                        <li><strong>1.</strong> اسحب المحاضرة الأولى.</li>
                        <li><strong>2.</strong> اسحب المحاضرة الثانية.</li>
                        <li><strong>3.</strong> النظام هيفتح وضع الشاشة الكاملة (Split Screen) للاثنين معاً.</li>
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