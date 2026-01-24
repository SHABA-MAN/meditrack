import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot,
  deleteDoc,
  query,
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { 
  CheckCircle, 
  Trash2, 
  RefreshCw, 
  Settings, 
  Target,
  Edit3,
  ServerOff,
  Inbox,
  Clock,
  Zap,
  Repeat,
  Play,
  X,
  Layers,
  Coffee
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyCTaaYioZuXIIbs3G1RCfe9E5neCAtrRYY",
  authDomain: "organizatio-79680.firebaseapp.com",
  projectId: "organizatio-79680",
  storageBucket: "organizatio-79680.firebasestorage.app",
  messagingSenderId: "168221682458",
  appId: "1:168221682458:web:d394d960fd25289906daa3"
};

const app = initializeApp(firebaseConfig, "LifeTrackApp"); 
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'lifetrack-v1';

const COLUMNS = {
  inbox: { id: 'inbox', title: 'وارد الرسائل', color: 'border-slate-500', bg: 'bg-slate-900/50', icon: Inbox },
  do_first: { id: 'do_first', title: 'مهم وعاجل 🔥', color: 'border-red-500', bg: 'bg-red-950/20', icon: Zap },
  schedule: { id: 'schedule', title: 'مهم غير عاجل 📅', color: 'border-blue-500', bg: 'bg-blue-950/20', icon: Clock },
  delegate: { id: 'delegate', title: 'غير مهم 🗑️', color: 'border-gray-500', bg: 'bg-gray-800/20', icon: Trash2 },
};

const API_URL = 'http://localhost:3001/api/telegram';

const LifeTrack = ({ onBack }) => {
  // Core State
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState({ botToken: '', chatId: '' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Focus Mode State
  const [focusQueue, setFocusQueue] = useState([]);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [isFocusAnimating, setIsFocusAnimating] = useState(false);
  const [isFreeFocus, setIsFreeFocus] = useState(false);

  // --- Effects ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
      else setShowSettings(true);
      setLoading(false);
    });
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTasks(list);
    });
    return () => { unsubConfig(); unsubTasks(); };
  }, [user]);

  // --- Logic ---
  const syncTelegram = async () => {
    if (!config.botToken) {
      alert("الرجاء ضبط إعدادات البوت أولاً");
      setShowSettings(true);
      return;
    }
    setSyncing(true);
    setServerError(false);
    try {
      const offset = (config.lastUpdateId || 0) + 1;
      const res = await fetch(`${API_URL}/getUpdates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botToken: config.botToken, offset }) });
      if (!res.ok) throw new Error("Server not reachable");
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || "Telegram Error");

      const updates = data.result;
      let newCount = 0;
      let maxId = config.lastUpdateId || 0;

      const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g;

      for (const update of updates) {
        if (update.update_id > maxId) maxId = update.update_id;
        if (update.message && update.message.text) {
           const text = update.message.text;
           const messageId = update.message.message_id;
           const lines = text.split('\n').filter(l => l.trim().length > 0);
           const allMatches = text.match(ytRegex);

           // 📺 Case: Multiple YouTube Links (Playlist/Series)
           if (allMatches && allMatches.length > 1) {
              let seriesTitle = lines.find(l => !ytRegex.test(l));
              if (!seriesTitle) seriesTitle = "سلسلة يوتيوب";
              else if (seriesTitle.length > 60) seriesTitle = seriesTitle.substring(0, 60) + "...";
              
              let vidIndex = 0;
              for (const line of lines) {
                 const lineMatch = line.match(ytRegex);
                 if (lineMatch) {
                    const url = lineMatch[0];
                    let title = line.replace(url, '').replace(/^[\d\-\.\)]+\s*/, '').trim(); 
                    if (!title) title = `فيديو ${vidIndex + 1}`;
                    
                    const subTaskId = `${messageId}_${vidIndex}`;
                    const exists = tasks.find(t => t.id === subTaskId);
                    
                    if (!exists) {
                       const newTask = {
                          id: subTaskId,
                          telegramId: messageId,
                          title: title,
                          description: `السلسلة: ${seriesTitle}\nالرابط: ${url}`,
                          stage: 'inbox',
                          isRecurring: false,
                          isSplit: true, // Mark as part of a split message
                          originalText: text,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                       };
                       await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTaskId), newTask);
                       newCount++;
                    }
                    vidIndex++;
                 }
              }

           } else {
              // 📩 Case: Single Video or Normal Message
              const exists = tasks.find(t => t.telegramId === messageId && !t.isSplit);
              if (!exists) {
                 const newTask = {
                   telegramId: messageId,
                   title: text,
                   description: '',
                   stage: 'inbox',
                   isRecurring: false,
                   createdAt: new Date().toISOString(),
                   updatedAt: new Date().toISOString()
                 };
                 await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', `${messageId}`), newTask);
                 newCount++;
              }
           }
        }
      }
      if (maxId > (config.lastUpdateId || 0)) {
         await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), { ...config, lastUpdateId: maxId });
      }
      if (newCount > 0) alert(`تم استيراد ${newCount} هدف جديد 📨`);
    } catch (err) {
      console.error(err);
      setServerError(true);
    } finally {
      setSyncing(false);
    }
  };

  const deleteTelegramMessage = async (taskId, telegramId) => {
    if (!config.botToken || !telegramId) return;
    try {
      await fetch(`${API_URL}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botToken: config.botToken, chatId: config.chatId, messageId: telegramId }) });
    } catch (e) { console.warn("Failed to delete from TG", e); }
  };

  const updateTelegramMessage = async (telegramId, newText) => {
    if (!config.botToken || !telegramId) return;
    try {
      await fetch(`${API_URL}/editMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botToken: config.botToken, chatId: config.chatId, messageId: telegramId, text: newText }) });
    } catch (e) { console.warn("Failed to update TG", e); }
  };

  // --- Handlers ---
  const completeTask = async (task) => {
    if (task.isRecurring) {
       if (confirm("هذا هدف مستمر. هل أتممت جلسة منه؟")) alert("أحسنت! تم تسجيل الإنجاز ✅");
    } else {
       if (confirm("إتمام الهدف وحذف الرسالة نهائياً؟")) {
          // 1. Delete Locally
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
          
          // 2. Check Telegram Sync
          if (task.isSplit) {
             const siblings = tasks.filter(t => t.telegramId === task.telegramId && t.id !== task.id);
             if (siblings.length === 0) {
                // Last one standing: Delete the message
                await deleteTelegramMessage(task.id, task.telegramId);
             } else {
                // Others remain: Try to remove the line from the message
                try {
                   const urlMatch = task.description.match(/(https?:\/\/[^\s]+)/);
                   if (urlMatch && task.originalText) {
                      const url = urlMatch[0];
                      const newLines = task.originalText.split('\n').filter(l => !l.includes(url));
                      const newText = newLines.join('\n');
                      if (newText.trim() !== task.originalText.trim()) {
                         await updateTelegramMessage(task.telegramId, newText);
                         // Note: We can't easily update 'originalText' of other tasks without many writes.
                         // But for now, this visual update on Telegram is enough.
                      }
                   }
                } catch (e) { console.warn("Partial edit failed", e); }
             }
          } else {
             // Normal Message
             await deleteTelegramMessage(task.id, task.telegramId);
          }
       }
    }
  };

  const saveTaskEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { title: editingTask.title, description: editingTask.description, isRecurring: editingTask.isRecurring });
    if (editingTask.originalTitle !== editingTask.title && !editingTask.isSplit) {
        await updateTelegramMessage(editingTask.telegramId, editingTask.title);
    }
    setEditingTask(null);
  };

  const startFocusSession = () => {
    if (focusQueue.length === 0) return;
    setIsFreeFocus(false);
    setIsFocusModeActive(true);
    setTimeout(() => setIsFocusAnimating(true), 50);
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

  const handleQueueDrop = (e) => {
     e.preventDefault();
     const taskId = e.dataTransfer.getData("taskId");
     const task = tasks.find(t => t.id === taskId);
     if (task && !focusQueue.find(q => q.id === taskId)) {
        setFocusQueue([...focusQueue, task]);
     }
  };

  const removeFromQueue = (id) => {
     setFocusQueue(focusQueue.filter(q => q.id !== id));
  };
  
  const handleDragStart = (e, task) => e.dataTransfer.setData("taskId", task.id);
  const handleDrop = async (e, stageId) => {
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), { stage: stageId, updatedAt: new Date().toISOString() });
  };
  
  const handleLogin = async () => { try { await signInAnonymously(auth); } catch (e) { alert(e.message); } };

  // --- Render ---
  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-bold">Loading...</div>;
  if (!user) return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <Target size={64} className="text-amber-500 mb-6" />
        <h1 className="text-4xl font-bold mb-2">LifeTrack</h1>
        <button onClick={handleLogin} className="px-8 py-3 bg-amber-600 rounded-lg text-white font-bold mt-4">Login</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative" dir="rtl">
      
      {/* 🌑 FULL FOCUS OVERLAY 🌑 */}
      {isFocusModeActive && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-all duration-500 ease-in-out transform ${
            isFocusAnimating ? 'bg-slate-950 translate-x-0' : 'bg-slate-950 -translate-x-full'
        }`}>
          {/* Top Bar */}
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 pointer-events-none">
             <div className="pointer-events-auto flex items-center gap-3">
               <span className="text-slate-400 font-mono text-sm uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full bg-slate-900/50 backdrop-blur-md">
                 {isFreeFocus ? 'Free Session' : `Active Tasks: ${focusQueue.length}`}
               </span>
             </div>
             <div className="pointer-events-auto">
                <button onClick={closeFocusMode} className="p-2 text-slate-500 hover:text-white transition hover:bg-slate-800 rounded-full"><X size={24} /></button>
             </div>
          </div>

          <div className="flex-1 flex flex-col h-full pt-20 pb-10 px-6 overflow-y-auto">
             {isFreeFocus ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                 <Zap size={64} className="text-amber-500 mb-8 opacity-90 animate-pulse" />
                 <h2 className="text-4xl font-light tracking-wide mb-4">جلسة تركيز حرة</h2>
                 <p className="text-slate-500 mb-12 max-w-md text-center leading-relaxed">استمتع بالهدوء. لا مهام، فقط إنجاز.</p>
                 <button onClick={closeFocusMode} className="px-8 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/30 rounded-full text-sm font-bold transition-all duration-300">إنهاء الجلسة</button>
               </div>
             ) : (
               <div className="flex flex-wrap justify-center content-start gap-6 pb-10">
                 {focusQueue.map((task) => (
                   <div key={task.id} className="bg-slate-900/50 border border-slate-800 hover:border-amber-500/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center text-center relative group transition-all hover:-translate-y-1">
                      <h2 className="text-2xl font-bold text-white mb-2 leading-relaxed">{task.title}</h2>
                      {task.description && <p className="text-slate-400 text-sm mb-6 whitespace-pre-wrap dir-ltr">{task.description}</p>}
                      <button onClick={async () => {
                          await completeTask(task);
                          removeFromQueue(task.id);
                          if(focusQueue.length <= 1) closeFocusMode();
                      }} className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-all transform hover:scale-110 mb-2">
                         <CheckCircle size={32} />
                      </button>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">إنجاز</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={onBack} className="bg-slate-800 p-2 rounded text-slate-400 hover:text-white">رجوع للموقع</button>
           <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 border border-amber-500/20"><Target size={24} /></div>
           <h1 className="font-bold text-xl tracking-wide">LifeTrack</h1>
        </div>
        <div className="flex items-center gap-3">
           {serverError && <div className="text-xs text-red-500 font-bold bg-red-950/30 px-3 py-1.5 rounded-full border border-red-900/50 animate-pulse"><ServerOff size={14} /> الخادم غير متصل</div>}
           <button onClick={syncTelegram} disabled={syncing} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${syncing ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}><RefreshCw size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? 'جاري المزامنة...' : 'سحب'}</button>
           <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Settings size={20}/></button>
        </div>
      </header>
      
      <main className="p-6 h-[calc(100vh-80px)] overflow-hidden flex gap-6">
        
        {/* 🔥 SESSION BUILDER ZONE 🔥 */}
        <div 
           className="w-1/4 min-w-[300px] h-full flex flex-col rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 hover:border-amber-500/50 hover:bg-slate-900/50 transition-all p-4"
           onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
           onDrop={handleQueueDrop}
        >
            {focusQueue.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-60">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><Layers size={24}/></div>
                  <h3 className="font-bold text-lg text-slate-300 mb-1">منطقة الجلسة</h3>
                  <p className="text-xs text-center max-w-[200px] mb-6">اسحب الأهداف هنا لتركز عليها الآن</p>
                  <button onClick={startFreeFocus} className="flex items-center gap-2 px-4 py-2 border border-slate-600 rounded-full hover:bg-slate-800 text-xs font-bold transition"><Coffee size={14}/> جلسة حرة</button>
               </div>
            ) : (
               <div className="flex-1 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                     <h3 className="font-bold text-amber-500 flex items-center gap-2"><Zap size={16}/> الجلسة الحالية</h3>
                     <span className="bg-amber-500/20 text-amber-500 text-xs px-2 py-0.5 rounded-full">{focusQueue.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                     {focusQueue.map(q => (
                       <div key={q.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-start animate-in zoom-in-95">
                          <p className="text-xs font-medium text-slate-200 line-clamp-2">{q.title}</p>
                          <button onClick={() => removeFromQueue(q.id)} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                       </div>
                     ))}
                  </div>
                  <button onClick={startFocusSession} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 transition"><Play size={18}/> ابدأ التركيز</button>
               </div>
            )}
        </div>

        {/* 📋 KANBAN BOARD 📋 */}
        <div className="flex-1 overflow-x-auto h-full">
            <div className="flex gap-4 h-full min-w-[900px]">
              {Object.values(COLUMNS).map(col => (
                <div key={col.id} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={e => handleDrop(e, col.id)} className={`flex-1 rounded-2xl border ${col.color} ${col.bg} backdrop-blur-sm flex flex-col overflow-hidden relative group`}>
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                      <div className="flex items-center gap-2 font-bold text-slate-200"><col.icon size={18} className="opacity-70" />{col.title}</div>
                      <span className="bg-white/10 text-xs px-2 py-1 rounded-full font-mono">{tasks.filter(t => t.stage === col.id).length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {tasks.filter(t => t.stage === col.id).map(task => (
                        <div key={task.id} draggable onDragStart={e => handleDragStart(e, task)} className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing group/card transition-all hover:-translate-y-1 relative">
                            {task.isRecurring && <div className="absolute top-3 left-3 text-amber-500" title="هدف مستمر"><Repeat size={14} /></div>}
                            <p className="text-slate-200 font-medium leading-relaxed mb-4 text-sm mt-1">{task.title}</p>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                              <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                  <button onClick={() => setEditingTask({...task, originalTitle: task.title})} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"><Edit3 size={14}/></button>
                                  <button onClick={() => confirm("حذف نهائي؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 size={14}/></button>
                              </div>
                              <button onClick={() => completeTask(task)} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-2 py-1 rounded-md transition"><CheckCircle size={12} /> إنجاز</button>
                            </div>
                        </div>
                      ))}
                    </div>
                </div>
              ))}
            </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
           <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white"><Settings className="text-amber-500"/> إعدادات الربط</h2>
              <div className="space-y-4 mb-6">
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Telegram Bot Token</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={config.botToken} onChange={e => setConfig({...config, botToken: e.target.value})} /></div>
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chat ID</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={config.chatId} onChange={e => setConfig({...config, chatId: e.target.value})} /></div>
              </div>
              <div className="flex gap-3"><button onClick={async () => { if (!user) return; await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), config); setShowSettings(false); alert("تم الحفظ!"); }} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition">حفظ الإعدادات</button><button onClick={() => setShowSettings(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">إغلاق</button></div>
           </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
           <form onSubmit={saveTaskEdit} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm">
             <h3 className="font-bold text-lg text-white mb-4">تعديل الهدف</h3>
             <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none h-32 mb-4 resize-none" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} />
             <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setEditingTask({...editingTask, isRecurring: !editingTask.isRecurring})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${editingTask.isRecurring ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`}>{editingTask.isRecurring && <CheckCircle size={14} className="text-white"/>}</div><span className="text-sm text-slate-300">هدف مستمر</span></div>
             <div className="flex gap-2"><button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-sm">حفظ</button><button type="button" onClick={() => setEditingTask(null)} className="px-4 bg-slate-800 text-white py-2 rounded-lg font-bold text-sm">إلغاء</button></div>
           </form>
        </div>
      )}
    </div>
  );
};

export default LifeTrack;
