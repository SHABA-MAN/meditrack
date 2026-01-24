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
  Repeat
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyCTaaYioZuXIIbs3G1RCfe9E5neCAtrRYY",
  authDomain: "organizatio-79680.firebaseapp.com",
  projectId: "organizatio-79680",
  storageBucket: "organizatio-79680.firebasestorage.app",
  messagingSenderId: "168221682458",
  appId: "1:168221682458:web:d394d960fd25289906daa3"
};

// Initialize Firebase specifically for LifeTrack to avoid conflicts if needed, 
// allows reusing the same app instance if keys are identical.
// For simplicity, we use the same config.
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
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState({ botToken: '', chatId: '' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

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

      for (const update of updates) {
        if (update.update_id > maxId) maxId = update.update_id;
        if (update.message && update.message.text) {
           const exists = tasks.find(t => t.telegramId === update.message.message_id);
           if (!exists) {
             const newTask = {
               telegramId: update.message.message_id,
               title: update.message.text,
               description: '',
               stage: 'inbox',
               isRecurring: false,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
             };
             await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', `${update.message.message_id}`), newTask);
             newCount++;
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

  const handleDragStart = (e, task) => e.dataTransfer.setData("taskId", task.id);
  const handleDrop = async (e, stageId) => {
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), { stage: stageId, updatedAt: new Date().toISOString() });
  };

  const completeTask = async (task) => {
    if (task.isRecurring) {
       if (confirm("هذا هدف مستمر. هل أتممت جلسة منه؟")) alert("أحسنت! تم تسجيل الإنجاز ✅");
    } else {
       if (confirm("إتمام الهدف وحذف الرسالة نهائياً؟")) {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
          await deleteTelegramMessage(task.id, task.telegramId);
       }
    }
  };

  const saveTaskEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { title: editingTask.title, description: editingTask.description, isRecurring: editingTask.isRecurring });
    if (editingTask.originalTitle !== editingTask.title) await updateTelegramMessage(editingTask.telegramId, editingTask.title);
    setEditingTask(null);
  };

  const handleLogin = async () => { try { await signInAnonymously(auth); } catch (e) { alert(e.message); } };

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-bold">Loading...</div>;
  if (!user) return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <Target size={64} className="text-amber-500 mb-6" />
        <h1 className="text-4xl font-bold mb-2">LifeTrack</h1>
        <button onClick={handleLogin} className="px-8 py-3 bg-amber-600 rounded-lg text-white font-bold mt-4">Login</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
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
      <main className="p-6 h-[calc(100vh-80px)] overflow-x-auto">
        <div className="flex gap-6 h-full min-w-[1200px]">
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
      </main>
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
