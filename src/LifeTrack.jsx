import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Target, 
  Settings, 
  ServerOff, 
  RefreshCw, 
  LogOut, 
  Layers, 
  Trash2, 
  Repeat, 
  CheckCircle, 
  Edit3, 
  Play, 
  Coffee, 
  Inbox, 
  Flame, 
  Calendar, 
  Clock 
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase'; // Ensure this path is correct based on your project structure
import { getVideoId, getPlaylistId, ytRegex } from './utils/youtube';

// Components
import YouTubeLibrary from './components/YouTubeLibrary';
import SettingsModal from './components/SettingsModal';
import EditTaskModal from './components/EditTaskModal';
import FocusMode from './components/FocusMode';

const API_URL = 'http://localhost:3001/api/telegram'; // Your proxy server

const COLUMNS = {
  urgent: { id: 'urgent', title: 'مهم وعاجل', icon: Flame, color: 'border-red-500', bg: 'bg-red-500/10' },
  schedule: { id: 'schedule', title: 'مهم غير عاجل', icon: Calendar, color: 'border-blue-500', bg: 'bg-blue-500/10' },
  delegate: { id: 'delegate', title: 'غير مهم', icon: Layers, color: 'border-slate-500', bg: 'bg-slate-500/10' }, 
  inbox: { id: 'inbox', title: 'Start Here', icon: Inbox, color: 'border-slate-500', bg: 'bg-slate-500/10' }
};

const LifeTrack = ({ appId, onBack }) => {
  // Core State
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState({ botToken: '', chatId: '', youtubeApiKey: '' });
  const [syncing, setSyncing] = useState(false);
  const [serverError, setServerError] = useState(false);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusQueue, setFocusQueue] = useState([]);
  const [showYouTubeDropdown, setShowYouTubeDropdown] = useState(false);
  
  // Edit State
  const [editingTask, setEditingTask] = useState(null);
  
  // Video Player State
  const [activeVideo, setActiveVideo] = useState(null);

  // --- Effects ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
      else setShowSettings(true);
    });
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTasks(list);
    });
    return () => { unsubConfig(); unsubTasks(); };
  }, [user, appId]);

  // Close YouTube dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showYouTubeDropdown && !e.target.closest('.youtube-dropdown-container')) {
        setShowYouTubeDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showYouTubeDropdown]);

  // Auto-fetch thumbnails for YouTube tasks
  useEffect(() => {
    if (!user || !config.youtubeApiKey) return;
    
    const fetchThumbnails = async () => {
      const ytTasks = tasks.filter(t => (t.videoId || t.playlistId) && !t.thumbnail);
      
      for (const task of ytTasks) {
        try {
          let thumbnail = null;
          
          if (task.playlistId) {
            const res = await fetch('http://localhost:3001/api/youtube/playlistInfo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playlistId: task.playlistId, apiKey: config.youtubeApiKey })
            });
            if (res.ok) {
              const data = await res.json();
              thumbnail = data.thumbnail;
            }
          } else if (task.videoId) {
            const res = await fetch('http://localhost:3001/api/youtube/videoInfo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId: task.videoId, apiKey: config.youtubeApiKey })
            });
            if (res.ok) {
              const data = await res.json();
              thumbnail = data.thumbnail;
            }
          }
          
          if (thumbnail) {
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), {
              thumbnail: thumbnail,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.warn('Failed to fetch thumbnail for', task.id, e);
        }
      }
    };
    
    fetchThumbnails();
  }, [tasks, user, config.youtubeApiKey, appId]);

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

      for (const update of updates) {
        if (update.update_id > maxId) maxId = update.update_id;
        if (update.message && update.message.text) {
           const text = update.message.text;
           const messageId = update.message.message_id;
           
           // Check if already processed
           const exists = tasks.find(t => t.telegramId === messageId);
           if (exists) continue;
           
           // Extract all YouTube URLs
           const allMatches = text.match(ytRegex);
           
           if (!allMatches || allMatches.length === 0) {
             // Normal text message
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
           } else if (allMatches.length === 1) {
             // Single video or playlist
             const videoUrl = allMatches[0];
             const videoId = getVideoId(videoUrl);
             const playlistId = getPlaylistId(videoUrl);
             let title = text.replace(videoUrl, '').trim();
             
             // Fetch playlist/video title & thumbnail from YouTube
             let thumbnail = null;
             if (playlistId && config.youtubeApiKey) {
               try {
                 const ytRes = await fetch('http://localhost:3001/api/youtube/playlistInfo', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ playlistId, apiKey: config.youtubeApiKey })
                 });
                 if (ytRes.ok) {
                   const ytData = await ytRes.json();
                   title = title || ytData.title;
                   thumbnail = ytData.thumbnail;
                 }
               } catch (e) {
                 console.warn('Failed to fetch playlist info', e);
               }
             } else if (videoId && config.youtubeApiKey) {
                try {
                  const ytRes = await fetch('http://localhost:3001/api/youtube/videoInfo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId, apiKey: config.youtubeApiKey })
                  });
                  if (ytRes.ok) {
                    const ytData = await ytRes.json();
                    title = title || ytData.title;
                    thumbnail = ytData.thumbnail;
                  }
                } catch (e) {
                  console.warn('Failed to fetch video info', e);
                }
             }
             
             if (!title) title = playlistId ? 'قائمة تشغيل يوتيوب' : 'فيديو يوتيوب';
             
             const newTask = {
               telegramId: messageId,
               title: title,
               description: '',
               videoUrl: videoUrl,
               videoId: videoId,
               playlistId: playlistId,
               thumbnail: thumbnail,
               stage: 'inbox',
               isRecurring: false,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
             };
             await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', `${messageId}`), newTask);
             newCount++;
           } else {
             // Multiple playlists - split them
             const lines = text.split('\n');
             let currentDescription = '';
             let taskIndex = 0;
             
             for (let i = 0; i < lines.length; i++) {
               const line = lines[i].trim();
               if (!line) continue;
               
               const lineMatch = line.match(ytRegex);
               
               if (lineMatch) {
                 // This line contains a YouTube URL
                 const videoUrl = lineMatch[0];
                 const videoId = getVideoId(videoUrl);
                 const playlistId = getPlaylistId(videoUrl);
                 let title = line.replace(videoUrl, '').trim();
                 
                 // Fetch playlist title from YouTube if available
                 let thumbnail = null;
                 if (playlistId && config.youtubeApiKey) {
                   try {
                     const ytRes = await fetch('http://localhost:3001/api/youtube/playlistInfo', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ playlistId, apiKey: config.youtubeApiKey })
                     });
                     if (ytRes.ok) {
                       const ytData = await ytRes.json();
                       title = title || ytData.title;
                       thumbnail = ytData.thumbnail;
                     }
                   } catch (e) {
                     console.warn('Failed to fetch playlist info', e);
                   }
                 } else if (videoId && config.youtubeApiKey) {
                   try {
                     const ytRes = await fetch('http://localhost:3001/api/youtube/videoInfo', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ videoId, apiKey: config.youtubeApiKey })
                     });
                     if (ytRes.ok) {
                       const ytData = await ytRes.json();
                       title = title || ytData.title;
                       thumbnail = ytData.thumbnail;
                     }
                   } catch (e) {
                     console.warn('Failed to fetch video info', e);
                   }
                 }
                 
                 if (!title) title = playlistId ? `قائمة تشغيل ${taskIndex + 1}` : `فيديو ${taskIndex + 1}`;
                 
                 const subTaskId = `${messageId}_${taskIndex}`;
                 const newTask = {
                   telegramId: messageId,
                   title: title,
                   description: currentDescription.trim(),
                   videoUrl: videoUrl,
                   videoId: videoId,
                   playlistId: playlistId,
                   thumbnail: thumbnail,
                   stage: 'inbox',
                   isRecurring: false,
                   isSplit: true,
                   originalText: text,
                   createdAt: new Date().toISOString(),
                   updatedAt: new Date().toISOString()
                 };
                 
                 await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTaskId), newTask);
                 taskIndex++;
                 newCount++;
                 
                 // Reset description for next playlist
                 currentDescription = '';
               } else {
                 // This is a description line (text before the URL)
                 currentDescription += (currentDescription ? '\n' : '') + line;
               }
             }
           }
        }
      }
      if (maxId > (config.lastUpdateId || 0)) {
         await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), { ...config, lastUpdateId: maxId });
      }
      if (newCount > 0) alert(`تم استيراد ${newCount} هدف جديد!`);
      else alert("لا توجد رسائل جديدة");
    } catch (error) {
       console.error(error);
       setServerError(true);
    } finally {
       setSyncing(false);
    }
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), { stage: stageId, updatedAt: new Date().toISOString() });
  };
  
  const handleQueueDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    if(task && !focusQueue.find(q => q.id === taskId)) setFocusQueue([...focusQueue, task]);
  };

  const removeFromQueue = (taskId) => {
    setFocusQueue(focusQueue.filter(t => t.id !== taskId));
  };

  const completeTask = async (task) => {
    if (task.isRecurring) {
        if(task.playlistId && task.videoId) {
            // Track playlist progress
            const newWatched = [...(task.watchedEpisodes || []), new Date().toISOString()];
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { 
                watchedEpisodes: newWatched,
                lastCompletedAt: new Date().toISOString()
            });
        } else {
            // Normal recurring
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { lastCompletedAt: new Date().toISOString() });
        }
    } else {
      // Archive
      if (task.playlistId && task.watchedEpisodes && task.playlistLength && task.watchedEpisodes.length < task.playlistLength) {
         // Not fully complete playlist
            const newWatched = [...(task.watchedEpisodes || []), new Date().toISOString()];
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { 
                watchedEpisodes: newWatched,
                updatedAt: new Date().toISOString()
            });
      } else {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
          // Save to history? (Optional future feature)
      }
    }
  };

  const saveTaskEdit = async (editedTask) => {
     await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editedTask.id), editedTask);
     setEditingTask(null);
  };

  const extractPlaylist = async (task) => {
    if (!config.youtubeApiKey) {
       alert("يرجى إضافة YouTube API Key في الإعدادات أولاً!");
       return;
    }
    
    if (!confirm(`سيتم تحويل "${task.title}" إلى مجموعة واستخراج الفيديوهات منها. هل أنت متأكد؟`)) return;
    
    // Simple loading indication
    document.activeElement.innerText = "جاري الاستخراج...";
    document.activeElement.disabled = true;

    try {
       const res = await fetch('http://localhost:3001/api/youtube/playlistItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistId: task.playlistId, apiKey: config.youtubeApiKey })
       });
       
       if (!res.ok) throw new Error("Failed to fetch playlist items");
       
       const { items } = await res.json();
       
       // 1. Convert parent task to Group
       await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), {
          isGroup: true,
          type: 'group', 
          playlistLength: items.length,
          extractedAt: new Date().toISOString(),
          description: task.description || `مجموعة تحتوي على ${items.length} فيديو`,
          // Clear playlistId/videoId to prevent it from showing in YouTube dropdown as a playable single item? 
          // Or keep it? If we keep it, it shows in dropdown. 
          // Let's keep playlistId but remove videoId if present.
          videoId: null,
          updatedAt: new Date().toISOString()
       });
       
       // 2. Create sub-tasks
       let batchCount = 0;
       for (const item of items) {
          const subTaskId = `${task.id}_${item.videoId}`; 
          
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTaskId), {
             title: item.title,
             description: item.description?.substring(0, 200) || '',
             videoId: item.videoId,
             thumbnail: item.thumbnail,
             groupId: task.id, // Link to parent
             stage: task.stage,
             isRecurring: false,
             createdAt: new Date().toISOString(), // You might want to offset times for sorting
             updatedAt: new Date().toISOString(),
             position: item.position // For sorting
          });
          batchCount++;
       }
       
       alert(`تم إنشاء المجموعة واستخراج ${batchCount} فيديو بنجاح!`);
       setEditingTask(null);
    } catch (e) {
       alert("حدث خطأ أثناء الاستخراج: " + e.message);
       console.error(e);
    }
  };

  const startSession = () => {
    if(focusQueue.length === 0) return;
    setFocusMode(true);
  };
  
  const startFreeFocus = () => {
    setFocusMode(true);
  };

  const closeFocusMode = () => {
    setFocusMode(false);
    setActiveVideo(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans dir-rtl relative">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={onBack} className="bg-slate-800 p-2 rounded text-slate-400 hover:text-white">رجوع للموقع</button>
           <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 border border-amber-500/20"><Target size={24} /></div>
           <h1 className="font-bold text-xl tracking-wide">LifeTrack</h1>
        </div>
        <div className="flex items-center gap-3">
           {serverError && <div className="text-xs text-red-500 font-bold bg-red-950/30 px-3 py-1.5 rounded-full border border-red-900/50 animate-pulse"><ServerOff size={14} /> الخادم غير متصل</div>}
           
           {/* 🎬 YOUTUBE DROPDOWN COMPONENT 🎬 */}
           <YouTubeLibrary 
             isOpen={showYouTubeDropdown}
             onClose={() => setShowYouTubeDropdown(false)}
             tasks={tasks.filter(t => !t.groupId)} // Don't show sub-tasks in main list to avoid clutter? Or show them?
             // Actually, sub-tasks (videos) SHOULD show in the dropdown list if they are videos.
             // But if they are in a group, maybe we want to see the group or the videos?
             // Let's pass all tasks for now, filtering logic is inside the component.
             // Wait, YouTubeLibrary filters by videoId/playlistId. Group sub-tasks HAVE videoId. So they will show.
             // The group parent (if converted) has NO videoId (I set it to null in extractPlaylist), so it won't show as a video, which is good.
             // It ends up showing the exploded videos in the dropdown. Excellent.
             user={user}
             db={db}
             appId={appId}
             COLUMNS={COLUMNS}
             focusQueue={focusQueue}
             setFocusQueue={setFocusQueue}
             setEditingTask={setEditingTask}
             syncTelegram={syncTelegram}
             syncing={syncing}
           />
           
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
               <>
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-300 flex items-center gap-2"><Zap size={18} className="text-amber-500"/> جلسة التركيز</h3>
                    <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full">{focusQueue.length}</span>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 custom-scrollbar">
                    {focusQueue.map((task) => (
                       <div key={task.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center group">
                          <div>
                             <p className="font-bold text-sm text-slate-200 line-clamp-1">{task.title}</p>
                             <span className="text-[10px] text-slate-500">{task.playlistId ? 'قائمة تشغيل' : 'هدف فردي'}</span>
                          </div>
                          <button onClick={() => removeFromQueue(task.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><X size={14}/></button>
                       </div>
                    ))}
                 </div>
                 <button onClick={startSession} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:shadow-amber-600/20 transition flex items-center justify-center gap-2">
                    <Play size={18} fill="white"/> ابدأ الجلسة
                 </button>
               </>
            )}
        </div>

        {/* 📋 KANBAN BOARD 📋 */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
          {Object.values(COLUMNS).filter(c => c.id !== 'inbox').map(col => (
             <div 
               key={col.id} 
               className="flex-1 min-w-[300px] h-full flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800"
               onDragOver={e => e.preventDefault()}
               onDrop={e => handleDrop(e, col.id)}
             >
                <div className={`p-4 border-b border-slate-800 flex items-center justify-between ${col.bg}`}>
                   <div className="flex items-center gap-2 font-bold text-slate-200">
                      <col.icon size={18} className={col.color.replace('border-', 'text-')}/> {col.title}
                   </div>
                   <span className="bg-white/10 text-xs px-2 py-1 rounded-full font-mono">{tasks.filter(t => t.stage === col.id && !t.groupId).length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {/* Filter for root tasks (no groupId) */}
                  {tasks.filter(t => {
                    // Show groups if they match the column
                    if (t.isGroup) return t.stage === col.id;
                    // Show regular tasks (including videos/playlists) if they match the column and are not sub-tasks
                    return t.stage === col.id && !t.groupId;
                  }).map(task => {
                    // If it is a GROUP
                    if (task.isGroup) {
                       const subTasks = tasks.filter(t => t.groupId === task.id).sort((a,b) => (a.position || 0) - (b.position || 0));
                       const completedSubTasks = subTasks.filter(t => t.lastCompletedAt); // Basic check, might need better completed logic for subtasks
                       
                       return (
                         <div key={task.id} className="bg-slate-900/80 border-2 border-slate-700/50 rounded-xl overflow-hidden mb-3">
                            <div className="p-3 bg-slate-800 flex items-center justify-between cursor-pointer" onClick={() => setEditingTask(task)}>
                               <div className="flex items-center gap-2">
                                  <Layers size={16} className="text-amber-500"/>
                                  <span className="font-bold text-sm text-slate-200">{task.title}</span>
                               </div>
                               <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">{subTasks.length} عنصر</span>
                            </div>
                            
                            {/* Group Progress */}
                            <div className="h-1 bg-slate-700 w-full">
                               <div className="h-full bg-amber-500 transition-all" style={{ width: `${(completedSubTasks.length / subTasks.length) * 100 || 0}%` }}></div>
                            </div>

                            <div className="p-2 space-y-2 bg-slate-900/50 group-tasks-container">
                               {subTasks.map(subTask => (
                                  <div key={subTask.id} draggable onDragStart={e => handleDragStart(e, subTask)} className="bg-slate-800 border border-slate-700 p-2 rounded flex items-center gap-3 hover:border-slate-600 transition group/item">
                                     {subTask.thumbnail ? (
                                        <div className="relative w-12 h-8 rounded overflow-hidden shrink-0 group/thumb">
                                           <img src={subTask.thumbnail} className="w-full h-full object-cover" alt=""/>
                                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition">
                                              <Play size={12} className="text-white"/>
                                           </div>
                                        </div>
                                     ) : (
                                        <div className="w-12 h-8 bg-slate-700 rounded flex items-center justify-center shrink-0"><Youtube size={14} className="text-slate-500"/></div>
                                     )}
                                     
                                     <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-300 line-clamp-1">{subTask.title}</p>
                                     </div>
                                     
                                     <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition">
                                        <button onClick={() => { if(!focusQueue.find(q=>q.id===subTask.id)) setFocusQueue([...focusQueue, subTask]); }} className="p-1 hover:bg-amber-500/20 text-slate-500 hover:text-amber-500 rounded"><Zap size={12}/></button>
                                        <button onClick={() => confirm("حذف؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTask.id))} className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded"><Trash2 size={12}/></button>
                                     </div>
                                  </div>
                               ))}
                               {subTasks.length === 0 && <div className="text-center text-xs text-slate-500 py-2">مجموعة فارغة</div>}
                            </div>
                         </div>
                       );
                    }

                    // NORMAL TASK (Existing Logic)
                    return (
                    <div key={task.id} draggable onDragStart={e => handleDragStart(e, task)} className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-xl overflow-hidden shadow-sm cursor-grab active:cursor-grabbing group/card transition-all hover:-translate-y-1 relative">
                        {(task.videoId || task.playlistId) ? (
                           <div className="relative aspect-video bg-black group/video">
                              <img src={`https://img.youtube.com/vi/${task.videoId}/hqdefault.jpg`} className="w-full h-full object-cover opacity-80" alt=""/>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/video:bg-black/10 transition">
                                 <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition">
                                    <Play size={16} fill="white" />
                                 </div>
                              </div>
                           </div>
                        ) : null}

                        <div className="p-4">
                          {task.isRecurring && <div className="absolute top-3 left-3 text-amber-500 z-10" title="هدف مستمر"><Repeat size={14} /></div>}
                          <p className={`text-slate-200 font-medium leading-relaxed mb-2 text-sm ${!task.videoId ? 'mt-1' : ''}`}>{task.title}</p>
                          
                          {/* 📝 DESCRIPTION 📝 */}
                          {task.description && (
                            <p className="text-slate-400 text-xs leading-relaxed mb-4 whitespace-pre-wrap">{task.description}</p>
                          )}
                          
                          {/* 📊 PLAYLIST PROGRESS 📊 */}
                          {task.playlistId && task.playlistLength > 0 && (
                             <div className="mb-4 bg-slate-800 rounded-full h-2 overflow-hidden flex w-full">
                                <div 
                                  className="bg-emerald-500 h-full transition-all duration-500" 
                                  style={{ width: `${(task.watchedEpisodes?.length || 0) / task.playlistLength * 100}%` }}
                                />
                             </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                            <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                <button onClick={() => setEditingTask({...task, originalTitle: task.title})} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"><Edit3 size={14}/></button>
                                <button onClick={() => confirm("حذف نهائي؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id))} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 size={14}/></button>
                            </div>
                            <div className="flex items-center gap-2">
                              {task.playlistId && task.playlistLength > 0 && (
                                 <span className="text-[10px] text-slate-500 font-mono">
                                    {task.watchedEpisodes?.length || 0}/{task.playlistLength}
                                 </span>
                              )}
                              <button onClick={() => completeTask(task)} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-2 py-1 rounded-md transition"><CheckCircle size={12} /> إنجاز</button>
                            </div>
                          </div>
                        </div>
                    </div>
                  );
                })}
                </div>
             </div>
          ))}
        </div>
      </main>

      {/* ⚙️ SETTINGS MODAL ⚙️ */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        config={config} 
        setConfig={setConfig} 
        user={user}
        appId={appId}
        db={db}
        tasks={tasks}
      />

      {/* ✏️ EDIT MODAL ✏️ */}
      <EditTaskModal 
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTaskEdit}
        onExtract={extractPlaylist}
      />

      {/* 🧘‍♂️ FOCUS MODE 🧘‍♂️ */}
      <FocusMode 
        isOpen={focusMode}
        onClose={closeFocusMode}
        focusQueue={focusQueue}
        completeTask={completeTask}
        removeFromQueue={removeFromQueue}
        activeVideo={activeVideo}
        setActiveVideo={setActiveVideo}
      />
    </div>
  );
};

export default LifeTrack;
