import React, { useState, useEffect } from 'react';
import { logAchievement } from './utils/achievements';
import { useIsMobile } from './hooks/useIsMobile';
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
  Coffee,
  Youtube,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Calendar
} from 'lucide-react';

// --- REUSED FROM PARENT (PASSED AS PROPS) ---
// We will receive user, db, and appId from the parent component
// to ensure we share the same authenticated session and data scope.
const COLUMNS = {
  inbox: { id: 'inbox', title: 'وارد الرسائل', color: 'border-slate-500', bg: 'bg-slate-900/50', icon: Inbox },
  do_first: { id: 'do_first', title: 'مهم وعاجل 🔥', color: 'border-red-500', bg: 'bg-red-950/20', icon: Zap },
  schedule: { id: 'schedule', title: 'مهم غير عاجل 📅', color: 'border-blue-500', bg: 'bg-blue-950/20', icon: Clock },
  delegate: { id: 'delegate', title: 'غير مهم 🗑️', color: 'border-gray-500', bg: 'bg-gray-800/20', icon: Trash2 },
};

const API_URL = 'http://localhost:3001/api/telegram';

const getVideoId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getPlaylistId = (url) => {
  if (!url) return null;
  const regExp = /[?&]list=([^#&?]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

// Helper to render text with clickable links
const renderTextWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          onClick={(e) => e.stopPropagation()}
          className="text-blue-400 hover:text-blue-300 underline mx-1 font-bold"
        >
          (اضغط هنا للذهاب)
        </a>
      );
    }
    return part;
  });
};

const LifeTrack = ({ onBack, user, db }) => {
  // Use the SAME appId as the main app to keep data consolidated
  // Or keep it separate but under the same User UID. 
  // User asked to link it to the same Google Account, so using the passed 'user' object is Key.
  // We can keep 'lifetrack-v1' as a sub-collection or separate artifact ID if we want separation of concerns,
  // BUT to ensure it's "the same account", we just rely on `user.uid`.
  
  const appId = 'meditrack-v1'; // Unified App ID

  // Core State
  // const [user, setUser] = useState(null); // REMOVED LOCAL USER STATE
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState({ botToken: '', chatId: '', youtubeApiKey: '' });
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
  
  // Mobile Detection
  const isMobile = useIsMobile();
  
  // YouTube Dropdown State
  const [showYouTubeDropdown, setShowYouTubeDropdown] = useState(false);
  
  // Mobile Tab State (for Kanban columns)
  const [activeTab, setActiveTab] = useState('inbox');
  
  // Group Expansion State
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Manual Add State
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualText, setManualText] = useState('');

  // --- Effects ---
  // Authenticated User is now passed down, so we don't need onAuthStateChanged here.
  useEffect(() => {
     if (!user) setLoading(false); 
  }, [user]);

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
      
      // Sync active focus queue with updates
      setFocusQueue(prevQueue => {
        if (prevQueue.length === 0) return prevQueue;
        return prevQueue.map(q => {
          const updated = list.find(t => t.id === q.id);
          return updated ? { ...updated, isSubTask: q.isSubTask } : q;
        });
      });
    });
    return () => { unsubConfig(); unsubTasks(); };
  }, [user]);
  
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
  }, [tasks, user, config.youtubeApiKey]);

  // Auto-fetch thumbnails for SoundCloud tasks
  useEffect(() => {
     if (!user) return;
     const fetchSCThumbnails = async () => {
        const scTasks = tasks.filter(t => t.soundCloudUrl && !t.thumbnail);
        for (const task of scTasks) {
           try {
              const res = await fetch('http://localhost:3001/api/soundcloud/resolve', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ url: task.soundCloudUrl })
              });
              if (res.ok) {
                 const data = await res.json();
                 if (data.thumbnail) {
                    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), {
                       thumbnail: data.thumbnail,
                       updatedAt: new Date().toISOString()
                    });
                 }
              }
           } catch (e) {
              console.warn('Failed to fetch SC thumbnail', e);
           }
        }
     };
     fetchSCThumbnails();
  }, [tasks, user]);

  // --- Logic ---
  
  const processImportedTask = async (text, sourceId) => {
      if (!text) return 0;
      let newCount = 0;
      const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g;
      const scRegex = /(https?:\/\/(?:www\.)?(?:soundcloud\.com|snd\.sc)[^\s]+)/g;
      
      const allMatches = text.match(ytRegex) || [];
      const scMatches = text.match(scRegex) || [];
      
      // Removed the blocking return: if (allMatches.length === 0 && scMatches.length === 0) return 0;


      if (!allMatches || allMatches.length === 0) {
        // Check for list format (Goal + Subtasks)
        const lines = text.split('\n').filter(l => l.trim());
        const title = lines[0] ? lines[0].trim() : "New Task";
        
        const subTasks = [];
        let description = '';
        
        // Start from 2nd line
        for (let i = 1; i < lines.length; i++) {
           const line = lines[i].trim();
           if (line.startsWith('-')) {
               // It's a subtask
               subTasks.push({
                   id: `${sourceId}_sub_${i}`,
                   title: line.substring(1).trim(),
                   completed: false
               });
           } else {
               // It's part of description
               description += (description ? '\n' : '') + line;
           }
        }
        
        const isGroup = subTasks.length > 0;

        const newTask = {
          telegramId: sourceId, // Use sourceId as ID reference 
          title: title,
          description: description,
          stage: 'inbox',
          isRecurring: false,
          isGroup: isGroup,
          subTasks: subTasks, 
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', `${sourceId}`), newTask);
        newCount++;
      } else if (allMatches.length === 1) {
        // Single video or playlist
        const videoUrl = allMatches[0];
        const videoId = getVideoId(videoUrl);
        const playlistId = getPlaylistId(videoUrl);
        let title = text.replace(videoUrl, '').trim();
        
        // Fetch playlist title from YouTube if it's a playlist
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
          telegramId: sourceId,
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
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', `${sourceId}`), newTask);
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
          const scMatch = line.match(scRegex);
          
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
            
            // Use preceding description as title if available and short enough < 100 chars
            if (!title && currentDescription && currentDescription.length < 100) {
               title = currentDescription.trim();
               currentDescription = ''; // Consumed as title
            }

            if (!title) title = playlistId ? `قائمة تشغيل ${taskIndex + 1}` : `فيديو ${taskIndex + 1}`;
            
            const subTaskId = `${sourceId}_${taskIndex}`;
            const newTask = {
              telegramId: sourceId,
              title: title,
              description: currentDescription.trim(), // Remaining description (empty if consumed)
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
          } else if (scMatch) {
             // This line contains a SoundCloud URL
             const scUrl = scMatch[0];
             let title = line.replace(scUrl, '').trim();
             let thumbnail = null;
             
             // Fetch SoundCloud Metadata
             try {
                const scRes = await fetch('http://localhost:3001/api/soundcloud/resolve', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ url: scUrl })
                });
                if (scRes.ok) {
                   const scData = await scRes.json();
                   title = title || scData.title;
                   thumbnail = scData.thumbnail;
                }
             } catch (e) {
                console.warn('Failed to fetch SoundCloud info', e);
             }

             // Use preceding description as title if available and short enough < 100 chars
             if (!title && currentDescription && currentDescription.length < 100) {
                title = currentDescription.trim();
                currentDescription = ''; // Consumed as title
             }

             if (!title) title = `SoundCloud Track ${taskIndex + 1}`;

             const subTaskId = `${sourceId}_${taskIndex}`;
             const newTask = {
               telegramId: sourceId,
               title: title,
               description: currentDescription.trim(),
               soundCloudUrl: scUrl, // New Field
               stage: 'inbox',
               isRecurring: false,
               isSplit: true,
               originalText: text,
               thumbnail: thumbnail,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
             };

             await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTaskId), newTask);
             taskIndex++;
             newCount++;
             currentDescription = '';
          } else {
            // This is a description line (text before the URL)
            currentDescription += (currentDescription ? '\n' : '') + line;
          }
        }
      }
      return newCount;
  };

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
           const messageId = update.message.message_id;
           
           // Check if already processed
           const exists = tasks.find(t => t.telegramId === messageId);
           if (exists) continue;
           
           newCount += await processImportedTask(update.message.text, messageId);
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

  const handleManualAdd = async () => {
      if (!manualText.trim()) return;
      setSyncing(true); // Reusing syncing state for loading indicator
      try {
          const manualId = `manual_${Date.now()}`;
          const added = await processImportedTask(manualText, manualId);
          if (added > 0) {
              setManualText('');
              setShowAddModal(false);
              alert('تمت إضافة الهدف بنجاح! 🎉');
          }
      } catch (e) {
          console.error(e);
          alert('حدث خطأ أثناء الإضافة');
      } finally {
          setSyncing(false);
      }
  };

  const extractVideos = async (task) => {
     if (!task.originalText) return;
     const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g;
     const matches = task.originalText.match(ytRegex);
     
     if (!matches || matches.length < 2) {
        alert("لا توجد قائمة فيديوهات لاستخراجها (أقل من رابطين).");
        return;
     }

     if (!confirm(`تم العثور على ${matches.length} فيديوهات. هل تريد تحويل هذا الهدف إلى سلسلة أهداف منفصلة؟`)) return;

     const lines = task.originalText.split('\n').filter(l => l.trim().length > 0);
     let seriesTitle = lines.find(l => !ytRegex.test(l)) || "سلسلة يوتيوب";
     if (seriesTitle.length > 50) seriesTitle = seriesTitle.substring(0, 50) + "...";

     let vidIndex = 0;
     for (const line of lines) {
       const lineMatch = line.match(ytRegex);
       if (lineMatch) {
         const url = lineMatch[0];
         const videoId = getVideoId(url);
         let title = line.replace(url, '').replace(/^[\d\-.)]+\s*/, '').trim(); 
         if (!title) title = `فيديو ${vidIndex + 1}`;

         const subTaskId = `${task.telegramId}_${vidIndex}`;
         const newTask = {
            id: subTaskId,
            telegramId: task.telegramId,
            title: title,
            description: `السلسلة: ${seriesTitle}`,
            videoUrl: url,
            videoId: videoId,
            stage: task.stage, // Keep same stage
            isRecurring: false,
            isSplit: true,
            originalText: task.originalText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
         };
         await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTaskId), newTask);
         vidIndex++;
       }
     }
     
     // Remove Original Container Task
     await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
     setEditingTask(null);
     alert("تم تقسيم السلسلة بنجاح! 🎉");
  };

  const convertPlaylistToVideos = async (task) => {
    if (!task.playlistId) {
      alert("هذا الهدف ليس قائمة تشغيل يوتيوب");
      return;
    }
    
    if (!config.youtubeApiKey) {
      alert("الرجاء إضافة YouTube API Key في الإعدادات أولاً");
      setShowSettings(true);
      return;
    }
    
    if (!confirm(`هل تريد تحويل قائمة التشغيل "${task.title}" إلى فيديوهات منفصلة؟`)) return;
    
    try {
      // Fetch playlist videos
      const res = await fetch('http://localhost:3001/api/youtube/playlistItems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playlistId: task.playlistId, 
          apiKey: config.youtubeApiKey,
          maxResults: 200
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch playlist videos');
      }
      
      const data = await res.json();
      const videos = data.videos || [];
      
      if (videos.length === 0) {
        alert("لم يتم العثور على فيديوهات في القائمة");
        return;
      }
      
      // Create separate tasks for each video
      let createdCount = 0;
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const subTaskId = `${task.id}_video_${i}`;
        const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
        
        const newTask = {
          telegramId: task.telegramId,
          title: video.title || `فيديو ${i + 1}`,
          description: task.description || '',
          videoUrl: videoUrl,
          videoId: video.videoId,
          thumbnail: video.thumbnail,
          stage: task.stage,
          isRecurring: false,
          isSplit: true,
          parentPlaylistId: task.playlistId,
          parentPlaylistTitle: task.title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', subTaskId), newTask);
        createdCount++;
      }
      
      // Delete original playlist task
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
      setEditingTask(null);
      alert(`تم تحويل القائمة إلى ${createdCount} فيديو منفصل! 🎉`);
    } catch (error) {
      console.error('Failed to convert playlist:', error);
      alert(`خطأ: ${error.message}`);
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

  const saveTaskEdit = async (e) => {
    e.preventDefault();
    if (!editingTask || !user) return;
    
    try {
       const updateData = {
          title: editingTask.title,
          description: editingTask.description || '',
          isRecurring: !!editingTask.isRecurring,
          isGroup: !!editingTask.isGroup,
          subTasks: editingTask.subTasks || [],
          playlistId: editingTask.playlistId || null,
          playlistLength: editingTask.playlistLength ? parseInt(editingTask.playlistLength) : 0,
          watchedEpisodes: editingTask.watchedEpisodes || [],
          updatedAt: new Date().toISOString()
       };
       
       await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), updateData);
       setEditingTask(null);
    } catch (e) {
       console.error("Failed to save task", e);
       alert("فشل حفظ التعديلات");
    }
  };

  // --- Handlers ---
  // --- Session Persistence ---
  
  const saveSessionToCloud = async (isFree, queue) => {
    if (!user) return;
    try {
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current');
      await setDoc(ref, {
        type: 'lifetrack',
        startTime: new Date().toISOString(),
        isFree,
        queue: queue || []
      });
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const deleteSessionFromCloud = async () => {
    if (!user) return;
    try {
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current');
      await deleteDoc(ref);
    } catch (e) {
       console.error("Failed to delete session", e);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current');

    // Restore Session
    const unsubSession = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
         const data = snap.data();
         if (data.type === 'lifetrack') {
            setIsFocusModeActive(true);
            setIsFreeFocus(data.isFree);
            setFocusQueue(prev => {
                const newQ = data.queue || [];
                if (JSON.stringify(prev) !== JSON.stringify(newQ)) return newQ;
                return prev;
            });
            setTimeout(() => setIsFocusAnimating(true), 50);
         }
      }
    }, (error) => {
        console.error("Session sync error:", error);
    });
    return () => unsubSession();
  }, [user?.uid]);

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
      setFocusQueue([]);
      deleteSessionFromCloud();
    }, 500); 
  };

  const completeTask = async (task) => {
    if (task.isRecurring) {
       if (confirm("هذا هدف مستمر. هل أتممت جلسة منه؟")) alert("أحسنت! تم تسجيل الإنجاز ✅");
    } else {
       if (confirm("إتمام الهدف وحذف الرسالة نهائياً؟")) {
          // 1. Log Achievement for Calendar
          await logAchievement(db, user.uid, 'task', {
            title: task.title,
            stage: COLUMNS[task.stage]?.title || task.stage
          });

          // 2. Delete Locally
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
          
          // 3. Remove from Focus Queue & Sync
          const newQueue = focusQueue.filter(q => q.id !== task.id);
          setFocusQueue(newQueue);
          
          if (isFocusModeActive) { // Sync only if active to avoid unnecessary writes
             saveSessionToCloud(isFreeFocus, newQueue);
             if (newQueue.length === 0 && !isFreeFocus) {
                 closeFocusMode();
             }
          }

          // 4. Check Telegram Sync
          if (task.isSplit) {
             const siblings = tasks.filter(t => t.telegramId === task.telegramId && t.id !== task.id);
             if (siblings.length === 0) {
                await deleteTelegramMessage(task.id, task.telegramId);
             } else {
                try {
                   if (task.videoUrl && task.originalText) {
                      const newLines = task.originalText.split('\n').filter(l => !l.includes(task.videoUrl));
                      const newText = newLines.join('\n');
                      if (newText.trim() !== task.originalText.trim()) {
                         await updateTelegramMessage(task.telegramId, newText);
                      }
                   }
                } catch (e) { console.warn("Partial edit failed", e); }
             }
          } else {
             await deleteTelegramMessage(task.id, task.telegramId);
          }
       }
    }
  };

  const handleQueueDrop = (e) => {
     e.preventDefault();
     e.stopPropagation();
     e.currentTarget.classList.remove('border-amber-500', 'bg-amber-950/20');
     
     const taskId = e.dataTransfer.getData("taskId");
     if (!taskId) return;
     
     const task = tasks.find(t => t.id === taskId);
     if (!task || focusQueue.find(q => q.id === taskId)) return;
     
     // Add the task directly (don't flatten groups)
     setFocusQueue([...focusQueue, task]);
  };

  const removeFromQueue = (id) => {
     setFocusQueue(focusQueue.filter(q => q.id !== id));
  };
  
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("taskId", task.id);
    e.dataTransfer.effectAllowed = "all"; // Allow both move and copy
  };
  
  const handleTaskDrop = async (e, targetTask) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedTaskId = e.dataTransfer.getData("taskId");
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;
    
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) return;
    
    // Convert target task to group if not already
    const newSubTasks = targetTask.isGroup 
      ? [...(targetTask.subTasks || [])]
      : [];
    
    // Add dragged task as subtask
    const newSubTask = {
      id: draggedTask.id,
      title: draggedTask.title,
      completed: false
    };
    
    // Check if already exists
    if (!newSubTasks.find(st => st.id === draggedTask.id)) {
      newSubTasks.push(newSubTask);
      
      // Update target task to be a group
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', targetTask.id), {
        isGroup: true,
        subTasks: newSubTasks,
        updatedAt: new Date().toISOString()
      });
      
      // Delete or hide the dragged task (we'll keep it but mark it as part of group)
      // Actually, let's keep it but move it to same stage and mark relationship
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', draggedTask.id), {
        parentGroupId: targetTask.id,
        stage: targetTask.stage,
        updatedAt: new Date().toISOString()
      });
      
      // Expand the group
      setExpandedGroups(new Set([...expandedGroups, targetTask.id]));
    }
  };
  
  const handleDrop = async (e, stageId) => {
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId), { stage: stageId, updatedAt: new Date().toISOString() });
  };
  
  const toggleGroupExpansion = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };
  


  const renderTaskCard = (task, isFocusMode = false, props = {}) => (
    <div 
      key={task.id}
      className={`bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-none overflow-hidden shadow-sm group/card transition-all relative min-h-[120px] ${isFocusMode ? 'hover:scale-[1.01]' : 'hover:-translate-y-0.5 cursor-grab active:cursor-grabbing'}`}
      {...props}
    >
        {/* 🖼️ THUMBNAIL / VIDEO 🖼️ */}
        {(task.videoId || task.playlistId) ? (
            <div className={`w-full aspect-video relative group/video bg-slate-950 ${isFocusMode ? 'border-b border-slate-800' : ''}`}>
                {isFocusMode ? (
                    <iframe 
                        src={task.playlistId 
                        ? `https://www.youtube.com/embed/videoseries?list=${task.playlistId}`
                        : `https://www.youtube.com/embed/${task.videoId}`
                        } 
                        className="w-full h-full"
                        allowFullScreen
                        title={task.title}
                    />
                ) : (
                    <>
                    {task.playlistId ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 flex-col gap-2">
                            <Layers size={32} />
                            <span className="text-xs font-bold uppercase tracking-widest">Playlist</span>
                        </div>
                    ) : (
                        <img 
                            src={`https://img.youtube.com/vi/${task.videoId}/mqdefault.jpg`} 
                            className="w-full h-full object-cover opacity-80 group-hover/card:opacity-100 transition" 
                            alt="thumbnail"
                        />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/video:bg-black/10 transition">
                        <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition">
                            <Play size={16} fill="white" />
                        </div>
                    </div>
                    </>
                )}
            </div>
        ) : task.soundCloudUrl ? (
            <div className={`w-full aspect-video relative group/video bg-slate-950 ${isFocusMode ? 'border-b border-slate-800' : ''}`}>
                {isFocusMode ? (
                   <iframe
                     width="100%"
                     height="100%"
                     scrolling="no"
                     frameBorder="no"
                     allow="autoplay"
                     src={`https://w.soundcloud.com/player/?url=${task.soundCloudUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`}
                   />
                ) : (
                   <>
                     {task.thumbnail ? (
                        <img 
                            src={task.thumbnail} 
                            className="w-full h-full object-cover opacity-80 group-hover/card:opacity-100 transition" 
                            alt="thumbnail"
                        />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-600/20 to-slate-900 text-orange-500 flex-col gap-2">
                            <Zap size={32} />
                            <span className="text-xs font-bold uppercase tracking-widest">SoundCloud</span>
                        </div>
                     )}
                     <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/video:bg-black/10 transition">
                        <div className="w-10 h-10 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition">
                            <Play size={16} fill="white" />
                        </div>
                     </div>
                   </>
                )}
            </div>
        ) : null}

        <div className="p-3">
            {task.isRecurring && <div className="absolute top-2 left-2 text-amber-500 z-10" title="هدف مستمر"><Repeat size={12} /></div>}
            <div className="flex items-start justify-between gap-2 mb-2">
            <p className={`text-slate-200 font-medium leading-relaxed text-sm flex-1 flex items-center gap-1.5`}>
                {task.isGroup && (
                <button
                    onClick={(e) => { e.stopPropagation(); toggleGroupExpansion(task.id); }}
                    className="p-0.5 hover:bg-slate-800 rounded transition text-purple-400"
                >
                    {expandedGroups.has(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                )}
                {task.isGroup && <Layers size={14} className="text-purple-500 flex-shrink-0" />}
                <span className="line-clamp-2">{task.title}</span>
            </p>
            </div>
            
            {/* 📝 DESCRIPTION 📝 */}
            {task.description && !task.isGroup && (
            <p className="text-slate-400 text-xs leading-relaxed mb-2 whitespace-pre-wrap line-clamp-2">
              {renderTextWithLinks(task.description)}
            </p>
            )}
            
            {/* 📦 SUBTASKS (GROUP) 📦 */}
            {task.isGroup && task.subTasks && task.subTasks.length > 0 && expandedGroups.has(task.id) && (
            <div className="mb-2 bg-slate-800/50 rounded-none p-1 border border-slate-700">
                <div className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1">
                <Layers size={11} />
                الأهداف الفرعية ({task.subTasks.filter(st => st.completed).length}/{task.subTasks.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                {task.subTasks.map((subTask, idx) => (
                    <div key={subTask.id || idx} className="flex items-center gap-1 text-xs bg-slate-900/50 p-1 rounded-none">
                    <button
                        onClick={async (e) => {
                        e.stopPropagation();
                        const newSubTasks = [...task.subTasks];
                        newSubTasks[idx].completed = !newSubTasks[idx].completed;
                        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), {
                            subTasks: newSubTasks,
                            updatedAt: new Date().toISOString()
                        });
                        }}
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition flex-shrink-0 ${
                        subTask.completed 
                            ? 'bg-emerald-600 border-emerald-500' 
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                    >
                        {subTask.completed && <CheckCircle size={8} className="text-white" />}
                    </button>
                    <span className={`flex-1 ${subTask.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                        {renderTextWithLinks(subTask.title || `هدف فرعي ${idx + 1}`)}
                    </span>
                    </div>
                ))}
                </div>
            </div>
            )}
            
            {task.isGroup && (!task.subTasks || task.subTasks.length === 0) && (
            <div className="mb-3 text-xs text-slate-500 italic text-center py-2 bg-slate-800/30 rounded">
                اسحب هدف هنا لإضافته للمجموعة
            </div>
            )}
            
            {/* 📊 PLAYLIST PROGRESS 📊 */}
            {task.playlistId && task.playlistLength > 0 && (
                <div className="mb-3 bg-slate-800 rounded-full h-1.5 overflow-hidden flex w-full">
                <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${(task.watchedEpisodes?.length || 0) / task.playlistLength * 100}%` }}
                />
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
            <div className={`flex gap-1.5 transition-opacity ${isFocusMode || isMobile ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}>
                <button onClick={() => setEditingTask({...task, originalTitle: task.title})} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"><Edit3 size={12}/></button>
                <button onClick={() => confirm("حذف نهائي؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id))} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
            </div>
            <div className="flex items-center gap-2">
                {task.playlistId && task.playlistLength > 0 && (
                    <span className="text-[9px] text-slate-500 font-mono">
                    {task.watchedEpisodes?.length || 0}/{task.playlistLength}
                    </span>
                )}
                {task.isGroup && (
                <span className="text-[9px] text-purple-400 font-mono bg-purple-950/30 px-1.5 py-0.5 rounded">
                    {task.subTasks?.length || 0}
                </span>
                )}
                <button onClick={() => completeTask(task)} className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-2 py-0.5 rounded transition"><CheckCircle size={10} /> إنجاز</button>
            </div>
            </div>
        </div>
    </div>
  );

  // --- Render ---
  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-bold">Loading...</div>;
  if (!user) return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <Target size={64} className="text-amber-500 mb-6" />
        <h1 className="text-4xl font-bold mb-2">LifeTrack</h1>
        <p className="text-slate-500">Please log in from the main screen.</p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 rounded-lg text-white font-bold mt-4">Back to Dashboard</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative" dir="rtl">
      
      {/* 🌑 FULL FOCUS OVERLAY 🌑 */}
      {isFocusModeActive && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-all duration-500 ease-in-out transform ${
            isFocusAnimating ? 'bg-slate-950 translate-x-0' : 'bg-slate-950 -translate-x-full'
        }`}>
          {/* Top Bar (Minimal) */}
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 pointer-events-none">
             <div className="pointer-events-auto flex items-center gap-3">
               <span className="text-slate-400 font-mono text-sm uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full bg-slate-900/50 backdrop-blur-md">
                 {isFreeFocus ? 'Free Session' : `Active Tasks: ${focusQueue.length}`}
               </span>

               {/* SWITCHER BUTTON */}
               <button 
                 onClick={onBack}
                 className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-full text-xs font-bold transition-all backdrop-blur-md"
                 title="العودة إلى MediTrack (ستبقى الجلسة محفوظة)"
               >
                 <BrainCircuit size={14} />
                 MediTrack
               </button>
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

          <div className="flex-1 flex flex-col h-full pt-20 pb-10 px-6 overflow-y-auto">
             {isFreeFocus ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                 <Zap size={64} className="text-amber-500 mb-8 opacity-90 animate-pulse" />
                 <h2 className="text-4xl font-light tracking-wide mb-4">جلسة تركيز حرة</h2>
                 <p className="text-slate-500 mb-12 max-w-md text-center leading-relaxed">استمتع بالهدوء. لا مهام، فقط إنجاز.</p>
                 <button onClick={closeFocusMode} className="px-8 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/30 rounded-full text-sm font-bold transition-all duration-300">إنهاء الجلسة</button>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10 max-w-7xl mx-auto items-start">
                  {focusQueue.map((task) => renderTaskCard(task, true))}
               </div>
             )}
          </div>
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 px-3 py-2 flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={onBack} className="bg-slate-800 p-2 rounded text-slate-400 hover:text-white">رجوع للموقع</button>
           <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 border border-amber-500/20"><Target size={24} /></div>
           <h1 className="font-bold text-xl tracking-wide">LifeTrack</h1>
        </div>
        <div className="flex items-center gap-3">
           {serverError && <div className="text-xs text-red-500 font-bold bg-red-950/30 px-3 py-1.5 rounded-full border border-red-900/50 animate-pulse"><ServerOff size={14} /> الخادم غير متصل</div>}
           
           {/* 🎬 YOUTUBE LIBRARY DROPDOWN (Start of YouTube/SoundCloud Library Code) 🎬 */}
           {/* This section handles the dropdown for accessing all media tasks (YouTube/SoundCloud) from any column */}
           <div className="relative youtube-dropdown-container">
             <button 
               onClick={() => setShowYouTubeDropdown(!showYouTubeDropdown)}
               className="flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold transition bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/30 relative"
               title="مكتبة اليوتيوب"
             >
               <Youtube size={20} />
               {tasks.filter(t => t.videoId || t.playlistId || t.soundCloudUrl).length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] min-w-[16px] h-4 flex items-center justify-center rounded-full border border-slate-900 shadow-sm px-1">
                     {tasks.filter(t => t.videoId || t.playlistId || t.soundCloudUrl).length}
                   </span>
               )}
             </button>
             
             {showYouTubeDropdown && (
               <div className="absolute left-0 top-full mt-2 w-[420px] max-h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2">
                 {/* Header */}
                 <div className="bg-gradient-to-r from-red-950/50 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Youtube className="text-red-500" size={20} />
                     <h3 className="font-bold text-white">مكتبة اليوتيوب</h3>
                   </div>
                   <button onClick={() => setShowYouTubeDropdown(false)} className="text-slate-500 hover:text-white transition">
                     <X size={18} />
                   </button>
                 </div>
                 
                 {/* Content */}
                 <div className="overflow-y-auto max-h-[520px] custom-scrollbar">
                    {Object.values(COLUMNS).filter(col => col.id !== 'inbox').map(col => {
                      const ytTasks = tasks.filter(t => (t.videoId || t.playlistId || t.soundCloudUrl) && t.stage === col.id);
                      if (ytTasks.length === 0) return null;
                     
                     return (
                       <div key={col.id} className="border-b border-slate-800 last:border-0">
                         <div className={`p-3 ${col.bg} border-l-4 ${col.color} flex items-center gap-2`}>
                           <col.icon size={16} className="opacity-70" />
                           <span className="font-bold text-sm text-slate-200">{col.title}</span>
                           <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full ml-auto">{ytTasks.length}</span>
                         </div>
                         <div className="p-2 space-y-2">
                           {ytTasks.map(task => (
                             <div 
                               key={task.id} 
                               className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 rounded-lg overflow-hidden transition-all group cursor-pointer"
                             >
                               <div className="flex items-center gap-3 p-2">
                                  {/* Thumbnail */}
                                  {/* Thumbnail */}
                                  {task.thumbnail ? (
                                     <img src={task.thumbnail} className="w-20 h-14 object-cover rounded" alt=""/>
                                  ) : task.soundCloudUrl ? (
                                       <div className="w-20 h-14 bg-orange-900/20 rounded flex items-center justify-center text-orange-500">
                                          <Zap size={20}/>
                                       </div>
                                  ) : task.videoId ? (
                                   <img 
                                     src={`https://img.youtube.com/vi/${task.videoId}/mqdefault.jpg`} 
                                     className="w-20 h-14 object-cover rounded" 
                                     alt=""
                                   />
                                 ) : (
                                   <div className="w-20 h-14 bg-slate-700 rounded flex items-center justify-center">
                                     <Layers size={20} className="text-slate-500" />
                                   </div>
                                 )}
                                 
                                 {/* Info */}
                                 <div className="flex-1 min-w-0">
                                   <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-relaxed">{task.title}</p>
                                   {task.description && (
                                     <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">{task.description}</p>
                                   )}
                                 </div>
                                 
                                 {/* Actions */}
                                 <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   {/* Edit & Delete */}
                                   <div className="flex gap-1 justify-end mb-1 border-b border-white/10 pb-1">
                                      <button onClick={(e) => { e.stopPropagation(); setEditingTask({...task, originalTitle: task.title}); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"><Edit3 size={12}/></button>
                                      <button onClick={(e) => { e.stopPropagation(); confirm("حذف نهائي؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id)); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                                   </div>
                                   
                                   {/* Move to other stages */}
                                   <div className="flex gap-1 justify-end">
                                     {Object.values(COLUMNS).filter(c => c.id !== 'inbox' && c.id !== col.id).map(targetCol => (
                                       <button
                                         key={targetCol.id}
                                         onClick={async (e) => {
                                           e.stopPropagation();
                                           await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { 
                                             stage: targetCol.id, 
                                             updatedAt: new Date().toISOString() 
                                           });
                                         }}
                                         className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                                         title={targetCol.title}
                                       >
                                         <targetCol.icon size={12} />
                                       </button>
                                     ))}
                                   </div>
                                   {/* Add to Focus */}
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       if (!focusQueue.find(q => q.id === task.id)) {
                                         let newQueue = [...focusQueue, task];
                                         // Add subtasks if it's a group
                                         if (task.isGroup && task.subTasks && task.subTasks.length > 0) {
                                           task.subTasks.forEach(subTask => {
                                             const subTaskObj = tasks.find(t => t.id === subTask.id);
                                             if (subTaskObj && !newQueue.find(q => q.id === subTask.id)) {
                                               newQueue.push(subTaskObj);
                                             }
                                           });
                                         }
                                         setFocusQueue(newQueue);
                                       }
                                     }}
                                     className="p-1 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded transition text-[10px] font-bold mt-1"
                                     title="إضافة للتركيز"
                                   >
                                     <Zap size={12} />
                                   </button>
                                 </div>
                               </div>
                               
                               {/* Show Subtasks if group */}
                               {task.isGroup && task.subTasks && task.subTasks.length > 0 && (
                                 <div className="px-2 pb-2 space-y-1 border-t border-slate-700 pt-2 mt-1">
                                   <div className="text-[10px] text-purple-400 font-bold mb-1 flex items-center gap-1">
                                     <Layers size={10} />
                                     الأهداف الفرعية ({task.subTasks.filter(st => st.completed).length}/{task.subTasks.length})
                                   </div>
                                   {task.subTasks.map((subTask, idx) => {
                                     const subTaskObj = tasks.find(t => t.id === subTask.id);
                                     return (
                                       <div key={subTask.id || idx} className="flex items-center gap-2 text-[10px] bg-slate-900/50 p-1.5 rounded">
                                         <div className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                                           subTask.completed 
                                             ? 'bg-emerald-600 border-emerald-500' 
                                             : 'border-slate-600'
                                         }`}>
                                           {subTask.completed && <CheckCircle size={8} className="text-white" />}
                                         </div>
                                         <span className={`flex-1 ${subTask.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                           {subTask.title || `هدف فرعي ${idx + 1}`}
                                         </span>
                                         {subTaskObj && (subTaskObj.videoId || subTaskObj.playlistId) && (
                                           <Youtube size={10} className="text-red-500 flex-shrink-0" />
                                         )}
                                       </div>
                                     );
                                   })}
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                   
                   {/* Inbox Section */}
                   {(() => {
                     const inboxYtTasks = tasks.filter(t => (t.videoId || t.playlistId || t.soundCloudUrl) && t.stage === 'inbox');
                     if (inboxYtTasks.length === 0) return null;
                     
                     return (
                       <div className="border-b border-slate-800">
                         <div className="p-3 bg-slate-900/50 border-l-4 border-slate-500 flex items-center gap-2">
                           <Inbox size={16} className="opacity-70" />
                           <span className="font-bold text-sm text-slate-200">وارد الرسائل</span>
                           <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full ml-auto">{inboxYtTasks.length}</span>
                         </div>
                         <div className="p-2 space-y-2">
                           {inboxYtTasks.map(task => (
                             <div 
                               key={task.id} 
                               className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 rounded-lg overflow-hidden transition-all group cursor-pointer"
                             >
                               <div className="flex items-center gap-3 p-2">
                                 {/* Thumbnail */}
                                 {task.thumbnail ? (
                                   <img 
                                     src={task.thumbnail} 
                                     className="w-20 h-14 object-cover rounded" 
                                     alt=""
                                   />
                                 ) : task.soundCloudUrl ? (
                                     <div className="w-20 h-14 bg-orange-900/20 rounded flex items-center justify-center text-orange-500">
                                        <Zap size={20}/>
                                     </div>
                                  ) : task.videoId ? (
                                   <img 
                                     src={`https://img.youtube.com/vi/${task.videoId}/default.jpg`} 
                                     className="w-20 h-14 object-cover rounded" 
                                     alt=""
                                   />
                                 ) : (
                                   <div className="w-20 h-14 bg-slate-700 rounded flex items-center justify-center">
                                     <Layers size={20} className="text-slate-500" />
                                   </div>
                                 )}
                                 
                                 <div className="flex-1 min-w-0">
                                   <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-relaxed">{task.title}</p>
                                   {task.description && (
                                     <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">{task.description}</p>
                                   )}
                                 </div>
                                 
                                 {/* Actions */}
                                 <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   {/* Edit & Delete */}
                                   <div className="flex gap-1 justify-end mb-1 border-b border-white/10 pb-1">
                                      <button onClick={(e) => { e.stopPropagation(); setEditingTask({...task, originalTitle: task.title}); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"><Edit3 size={12}/></button>
                                      <button onClick={(e) => { e.stopPropagation(); confirm("حذف نهائي؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id)); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                                   </div>
                                   
                                   <div className="flex gap-1 justify-end">
                                     {Object.values(COLUMNS).filter(c => c.id !== 'inbox').map(targetCol => (
                                       <button
                                         key={targetCol.id}
                                         onClick={async (e) => {
                                           e.stopPropagation();
                                           await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { 
                                             stage: targetCol.id, 
                                             updatedAt: new Date().toISOString() 
                                           });
                                         }}
                                         className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                                         title={targetCol.title}
                                       >
                                         <targetCol.icon size={12} />
                                       </button>
                                     ))}
                                   </div>
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       if (!focusQueue.find(q => q.id === task.id)) {
                                         let newQueue = [...focusQueue, task];
                                         // Add subtasks if it's a group
                                         if (task.isGroup && task.subTasks && task.subTasks.length > 0) {
                                           task.subTasks.forEach(subTask => {
                                             const subTaskObj = tasks.find(t => t.id === subTask.id);
                                             if (subTaskObj && !newQueue.find(q => q.id === subTask.id)) {
                                               newQueue.push(subTaskObj);
                                             }
                                           });
                                         }
                                         setFocusQueue(newQueue);
                                       }
                                     }}
                                     className="p-1 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded transition text-[10px] font-bold mt-1"
                                     title="إضافة للتركيز"
                                   >
                                     <Zap size={12} />
                                   </button>
                                 </div>
                               </div>
                               
                               {/* Show Subtasks if group */}
                               {task.isGroup && task.subTasks && task.subTasks.length > 0 && (
                                 <div className="px-2 pb-2 space-y-1 border-t border-slate-700 pt-2 mt-1">
                                   <div className="text-[10px] text-purple-400 font-bold mb-1 flex items-center gap-1">
                                     <Layers size={10} />
                                     الأهداف الفرعية ({task.subTasks.filter(st => st.completed).length}/{task.subTasks.length})
                                   </div>
                                   {task.subTasks.map((subTask, idx) => {
                                     const subTaskObj = tasks.find(t => t.id === subTask.id);
                                     return (
                                       <div key={subTask.id || idx} className="flex items-center gap-2 text-[10px] bg-slate-900/50 p-1.5 rounded">
                                         <div className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                                           subTask.completed 
                                             ? 'bg-emerald-600 border-emerald-500' 
                                             : 'border-slate-600'
                                         }`}>
                                           {subTask.completed && <CheckCircle size={8} className="text-white" />}
                                         </div>
                                         <span className={`flex-1 ${subTask.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                           {subTask.title || `هدف فرعي ${idx + 1}`}
                                         </span>
                                         {subTaskObj && (subTaskObj.videoId || subTaskObj.playlistId) && (
                                           <Youtube size={10} className="text-red-500 flex-shrink-0" />
                                         )}
                                       </div>
                                     );
                                   })}
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   })()}
                    
                    {tasks.filter(t => t.videoId || t.playlistId || t.soundCloudUrl).length === 0 && (
                     <div className="p-8 text-center text-slate-500">
                       <Youtube size={48} className="mx-auto mb-4 opacity-30" />
                       <p className="text-sm">لا توجد فيديوهات أو قوائم تشغيل</p>
                     </div>
                   )}
                 </div>
               </div>
             )}
           </div>
           
           <button onClick={syncTelegram} disabled={syncing} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${syncing ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}><RefreshCw size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? 'جاري المزامنة...' : 'سحب'}</button>
           <button onClick={() => window.dispatchEvent(new CustomEvent('switchToCalendar'))} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition border border-emerald-500/30 shadow-lg shadow-emerald-900/20" title="تقويم الإنجازات"><Calendar size={16} /> التقويم</button>
           <button onClick={() => setShowAddModal(true)} className="flex items-center justify-center w-10 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition border border-emerald-500/30 shadow-lg shadow-emerald-900/20" title="إضافة هدف جديد"><Plus size={24} /></button>
           <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Settings size={20}/></button>
        </div>
      </header>
      
      <main className={`p-3 h-[calc(100vh-80px)] overflow-hidden flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        
        {/* 🔥 SESSION BUILDER ZONE 🔥 - Hidden on mobile, shown as modal/bottom sheet */}
        {!isMobile && (
        <div 
           className="w-80 flex-shrink-0 h-full flex flex-col rounded-none border-2 border-dashed border-slate-700 bg-slate-900/40 hover:border-amber-500/50 hover:bg-slate-900/60 transition-all backdrop-blur-sm session-zone"
           onDragEnter={e => {
             // Don't prevent default here, just add visual feedback
             e.currentTarget.classList.add('border-amber-500', 'bg-amber-950/20');
           }}
           onDragOver={e => { 
             e.preventDefault(); 
             e.stopPropagation();
             e.dataTransfer.dropEffect = 'copy'; 
           }}
           onDragLeave={e => {
             if (!e.currentTarget.contains(e.relatedTarget)) {
               e.currentTarget.classList.remove('border-amber-500', 'bg-amber-950/20');
             }
           }}
           onDrop={handleQueueDrop}
        >
            {focusQueue.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-800 flex items-center justify-center mb-4 border border-amber-500/30">
                    <Zap size={32} className="text-amber-500"/>
                  </div>
                  <h3 className="font-bold text-xl text-slate-200 mb-2">منطقة الجلسة</h3>
                  <p className="text-sm text-center max-w-[240px] mb-6 text-slate-500 leading-relaxed">اسحب الأهداف هنا لبناء جلسة تركيز مخصصة</p>
                  <button 
                    onClick={startFreeFocus} 
                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-600 rounded-full hover:bg-slate-800 hover:border-amber-500/50 text-sm font-bold transition text-slate-300 hover:text-amber-400"
                  >
                    <Coffee size={16}/> جلسة حرة
                  </button>
               </div>
            ) : (
               <div className="flex-1 flex flex-col h-full p-4">
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800">
                     <h3 className="font-bold text-amber-500 flex items-center gap-2 text-lg">
                        <Zap size={18} className="text-amber-500"/> الجلسة الحالية
                     </h3>
                     <span className="bg-amber-500/20 text-amber-500 text-xs px-2.5 py-1 rounded-full font-bold border border-amber-500/30">
                        {focusQueue.length}
                     </span>
                  </div>
                  <div className="flex-1 overflow-y-auto mb-3 custom-scrollbar">
                     <div className="grid grid-cols-3 gap-2">
                        {focusQueue.map(q => (
                          <div 
                            key={q.id}                             className="bg-slate-800/80 p-2 rounded-lg border border-slate-700 hover:border-amber-500/50 transition group/item relative aspect-square flex flex-col"
                           >
                              {q.soundCloudUrl ? (
                                 q.thumbnail ? <img src={q.thumbnail} className="w-full h-16 object-cover rounded mb-1.5" alt=""/> : <div className="w-full h-16 bg-orange-900/20 rounded mb-1.5 flex items-center justify-center"><Zap size={24} className="text-orange-500"/></div>
                              ) : q.videoId && (
                               <img 
                                 src={`https://img.youtube.com/vi/${q.videoId}/default.jpg`} 
                                 className="w-full h-16 object-cover rounded mb-1.5" 
                                 alt="" 
                               />
                             )}
                             {q.isSubTask && (
                               <div className="absolute top-1 right-1 bg-purple-600/80 text-white text-[8px] px-1 py-0.5 rounded">
                                 <Layers size={8} />
                               </div>
                             )}
                             <p className="text-[10px] font-medium text-slate-200 line-clamp-3 flex-1 leading-tight">
                               {q.title}
                             </p>
                             <button 
                               onClick={() => removeFromQueue(q.id)} 
                               className="absolute top-1 left-1 text-slate-500 hover:text-red-400 transition opacity-0 group-hover/item:opacity-100 bg-slate-900/80 rounded p-0.5"
                             >
                               <X size={10}/>
                             </button>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button 
                       onClick={startFocusSession} 
                       className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition text-sm"
                     >
                        <Play size={16} fill="white"/> ابدأ التركيز
                     </button>
                     {focusQueue.length > 0 && (
                        <button 
                          onClick={() => setFocusQueue([])} 
                          className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
                          title="مسح الجلسة"
                        >
                           <X size={16}/>
                        </button>
                     )}
                  </div>
               </div>
            )}
        </div>
        )}

         {/* 📋 KANBAN BOARD 📋 */}
        <div className="flex-1 overflow-x-auto h-full flex flex-col">
            {/* Mobile Tab Bar */}
            {isMobile && (
              <div className="flex gap-2 p-2 bg-slate-900/50 border-b border-slate-800 overflow-x-auto">
                {Object.values(COLUMNS).map(col => (
                  <button
                    key={col.id}
                    onClick={() => setActiveTab(col.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                      activeTab === col.id 
                        ? `${col.bg} ${col.color} border ${col.color.replace('text-', 'border-')}` 
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <col.icon size={16} />
                    {col.title}
                    <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
                      {tasks.filter(t => t.stage === col.id && !t.videoId && !t.playlistId && !t.parentGroupId && !focusQueue.find(q => q.id === t.id)).length}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            <div className={`flex gap-4 h-full ${isMobile ? 'flex-col overflow-y-auto' : 'min-w-[900px]'}`}>
              {Object.values(COLUMNS)
                .filter(col => !isMobile || col.id === activeTab) // Show only active tab on mobile
                .map(col => (
                <div 
                  key={col.id} 
                  onDragOver={e => { 
                    if (!isMobile) {
                      e.preventDefault(); 
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }} 
                  onDrop={e => !isMobile && handleDrop(e, col.id)} 
                  className={`flex-1 rounded-2xl border ${col.color} ${col.bg} backdrop-blur-sm flex flex-col overflow-hidden relative group ${isMobile ? 'min-h-[400px]' : ''}`}
                >
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                      <div className="flex items-center gap-1 font-bold text-slate-200"><col.icon size={18} className="opacity-70" />{col.title}</div>
                      <span className="bg-white/10 text-xs px-2 py-1 rounded-full font-mono">
                        {tasks.filter(t => t.stage === col.id && !t.videoId && !t.playlistId && !t.parentGroupId && !focusQueue.find(q => q.id === t.id)).length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {tasks.filter(t => t.stage === col.id && !t.videoId && !t.playlistId && !t.parentGroupId && !focusQueue.find(q => q.id === t.id)).map(task => renderTaskCard(task, false, {
                        draggable: !isMobile,
                        onDragStart: e => !isMobile && handleDragStart(e, task),
                        onDragOver: e => {
                            if (!isMobile) {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.add('border-purple-500', 'bg-purple-950/20');
                            }
                        },
                        onDragLeave: e => {
                            if (!isMobile) {
                              e.currentTarget.classList.remove('border-purple-500', 'bg-purple-950/20');
                            }
                        },
                        onDrop: e => {
                            if (!isMobile) {
                              e.currentTarget.classList.remove('border-purple-500', 'bg-purple-950/20');
                              handleTaskDrop(e, task);
                            }
                        }
                      }))}
                    </div>
                </div>
              ))}
             </div>
        </div>
        
        {/* Mobile Session Queue FAB */}
        {isMobile && focusQueue.length > 0 && (
          <button
            onClick={() => setIsFocusModeActive(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-2xl flex items-center justify-center z-50 animate-pulse"
          >
            <div className="relative">
              <Zap size={28} fill="white" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {focusQueue.length}
              </span>
            </div>
          </button>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
           <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white"><Settings className="text-amber-500"/> إعدادات الربط</h2>
               <div className="space-y-4 mb-6">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Telegram Bot Token</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={config.botToken} onChange={e => setConfig({...config, botToken: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chat ID</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={config.chatId} onChange={e => setConfig({...config, chatId: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">YouTube API Key (اختياري)</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500 outline-none" value={config.youtubeApiKey || ''} onChange={e => setConfig({...config, youtubeApiKey: e.target.value})} placeholder="لجلب أسماء القوائم تلقائياً" /></div>
               </div>
               
               <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-800">
                  <h3 className="font-bold text-slate-300 mb-2 flex items-center gap-2"><Youtube size={16}/> أدوات الصيانة</h3>
                  <button 
                    onClick={async () => {
                      if (!confirm("سيقوم هذا بفحص جميع الأهداف وتحديث بيانات اليوتيوب الناقصة. هل أنت متأكد؟")) return;
                      let fixCount = 0;
                      const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g;
                      
                      for (const task of tasks) {
                        // Fix 1: Check if it has a youtube link but no videoId/playlistId
                        if (!task.videoId && !task.playlistId && (task.title.match(ytRegex) || (task.originalText && task.originalText.match(ytRegex)))) {
                           const text = task.originalText || task.title;
                           const matches = text.match(ytRegex);
                           if (matches && matches.length > 0) {
                             const url = matches[0];
                             const vid = getVideoId(url);
                             const pid = getPlaylistId(url);
                             
                             if (vid || pid) {
                               await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), {
                                 videoId: vid,
                                 playlistId: pid,
                                 videoUrl: url,
                                 updatedAt: new Date().toISOString()
                               });
                               fixCount++;
                             }
                           }
                        }
                      }
                      alert(`تم تحديث ${fixCount} هدف بنجاح!`);
                    }}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={12}/> إصلاح ومسح أهداف اليوتيوب
                  </button>
               </div>

               <div className="flex gap-3"><button onClick={async () => { if (!user) return; await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), config); setShowSettings(false); alert("تم الحفظ!"); }} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition">حفظ الإعدادات</button><button onClick={() => setShowSettings(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">إغلاق</button></div>
           </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <form onSubmit={saveTaskEdit} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
             <h3 className="font-bold text-lg text-white mb-4">تعديل الهدف</h3>
             
             <label className="block text-xs font-bold text-slate-400 uppercase mb-2">العنوان</label>
             <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none h-24 mb-4 resize-none" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} placeholder="عنوان الهدف" />
             
             <label className="block text-xs font-bold text-slate-400 uppercase mb-2">الوصف (اختياري)</label>
             <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none h-20 mb-4 resize-none" value={editingTask.description || ''} onChange={e => setEditingTask({...editingTask, description: e.target.value})} placeholder="وصف الهدف أو ملاحظات" />
             
             <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setEditingTask({...editingTask, isRecurring: !editingTask.isRecurring})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${editingTask.isRecurring ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`}>{editingTask.isRecurring && <CheckCircle size={14} className="text-white"/>}</div><span className="text-sm text-slate-300">هدف مستمر</span></div>

             {/* 📦 GROUP SETTINGS 📦 */}
             <div className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => {
                   const newIsGroup = !editingTask.isGroup;
                   setEditingTask({
                      ...editingTask, 
                      isGroup: newIsGroup,
                      subTasks: newIsGroup ? (editingTask.subTasks || []) : []
                   });
                }}>
                   <div className={`w-5 h-5 rounded border flex items-center justify-center ${editingTask.isGroup ? 'bg-purple-600 border-purple-600' : 'border-slate-600'}`}>
                      {editingTask.isGroup && <Layers size={12} className="text-white"/>}
                   </div>
                   <span className="text-sm font-bold text-slate-300">تحويل إلى مجموعة (أهداف مكدسة)</span>
                </div>
                
                {editingTask.isGroup && (
                   <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                         <label className="text-xs font-bold text-slate-400 uppercase">الأهداف الفرعية</label>
                         <button
                            type="button"
                            onClick={() => {
                               const newSubTasks = [...(editingTask.subTasks || []), { id: Date.now(), title: '', completed: false }];
                               setEditingTask({...editingTask, subTasks: newSubTasks});
                            }}
                            className="p-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded transition flex items-center gap-1"
                         >
                            <Plus size={12}/>
                            <span className="text-xs font-bold">إضافة</span>
                         </button>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                         {(editingTask.subTasks || []).map((subTask, idx) => (
                            <div key={subTask.id} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                               <input
                                  type="text"
                                  value={subTask.title}
                                  onChange={(e) => {
                                     const newSubTasks = [...(editingTask.subTasks || [])];
                                     newSubTasks[idx].title = e.target.value;
                                     setEditingTask({...editingTask, subTasks: newSubTasks});
                                  }}
                                  placeholder={`هدف فرعي ${idx + 1}`}
                                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                               />
                               <button
                                  type="button"
                                  onClick={() => {
                                     const newSubTasks = (editingTask.subTasks || []).filter((_, i) => i !== idx);
                                     setEditingTask({...editingTask, subTasks: newSubTasks});
                                  }}
                                  className="p-1 hover:bg-red-600/20 text-red-400 rounded transition"
                               >
                                  <Minus size={14}/>
                               </button>
                            </div>
                         ))}
                         
                         {(editingTask.subTasks || []).length === 0 && (
                            <p className="text-xs text-slate-500 text-center py-4">لا توجد أهداف فرعية. اضغط "إضافة" لإضافة هدف فرعي</p>
                         )}
                      </div>
                      
                      {(editingTask.subTasks || []).length > 0 && (
                         <div className="text-right text-[10px] text-slate-500 pt-1">
                            {editingTask.subTasks.filter(st => st.completed).length} من {(editingTask.subTasks || []).length} مكتمل
                         </div>
                      )}
                   </div>
                )}
             </div>

             {/* 📺 PLAYLIST TRACKER SETTINGS 📺 */}
             <div className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => {
                   if (!editingTask.playlistId) {
                      // Try auto-detect from description
                      const foundId = getPlaylistId(editingTask.originalText || editingTask.description || '') || getPlaylistId(editingTask.videoUrl || '');
                      setEditingTask({...editingTask, playlistId: foundId || 'manual'});
                   } else {
                      setEditingTask({...editingTask, playlistId: null, playlistLength: 0, watchedEpisodes: []});
                   }
                }}>
                   <div className={`w-5 h-5 rounded border flex items-center justify-center ${editingTask.playlistId ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                      {editingTask.playlistId && <Layers size={12} className="text-white"/>}
                   </div>
                   <span className="text-sm font-bold text-slate-300">تفعيل نظام السلسلة / القائمة</span>
                </div>
                
                {editingTask.playlistId && (
                   <>
                     <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-bold text-slate-400 uppercase">عدد فيديوهات السلسلة</label>
                      <input 
                        type="number" 
                        className="bg-slate-900 border border-slate-700 w-20 rounded text-center text-white py-1 outline-none focus:border-amber-500"
                        value={editingTask.playlistLength || ''}
                        onChange={e => setEditingTask({...editingTask, playlistLength: e.target.value})}
                        placeholder="0"
                      />
                   </div>
                   
                   {editingTask.playlistLength > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">تقدم المشاهدة</label>
                        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                           {Array.from({ length: parseInt(editingTask.playlistLength) }).map((_, i) => {
                             const idx = i + 1;
                             const isWatched = editingTask.watchedEpisodes?.includes(idx);
                             return (
                               <button 
                                 type="button"
                                 key={idx}
                                 onClick={() => {
                                   let newWatched = editingTask.watchedEpisodes ? [...editingTask.watchedEpisodes] : [];
                                   if (isWatched) newWatched = newWatched.filter(n => n !== idx);
                                   else newWatched.push(idx);
                                   setEditingTask({...editingTask, watchedEpisodes: newWatched});
                                 }}
                                 className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center transition border ${
                                   isWatched 
                                   ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/50 shadow-md' 
                                   : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                 }`}
                               >
                                 {idx}
                               </button>
                             );
                           })}
                        </div>
                        <div className="text-right text-[10px] text-slate-500 pt-1">
                          تم مشاهدة {editingTask.watchedEpisodes?.length || 0} من {editingTask.playlistLength}
                        </div>
                      </div>
                   )}
                   </>
                )}
                </div>
             <div className="flex gap-2 mb-4">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-sm">حفظ</button>
                <button type="button" onClick={() => setEditingTask(null)} className="px-4 bg-slate-800 text-white py-2 rounded-lg font-bold text-sm">إلغاء</button>
             </div>

             {/* 🎬 EXTRACTION BUTTON 🎬 */}
             {editingTask?.originalText && editingTask.originalText.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g)?.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => extractVideos(editingTask)}
                  className="w-full bg-slate-800 border-t border-slate-700 pt-3 mt-2 text-slate-400 text-xs font-bold hover:text-amber-500 hover:bg-slate-800/50 flex items-center justify-center gap-2 transition"
                >
                   <Layers size={14}/> استخراج قائمة الفيديوهات ({editingTask.originalText.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\s]+)/g).length})
                </button>
             )}

             {/* 🎵 CONVERT PLAYLIST TO VIDEOS BUTTON 🎵 */}
             {editingTask?.playlistId && (
                <button 
                  type="button" 
                  onClick={() => convertPlaylistToVideos(editingTask)}
                  className="w-full bg-red-600/20 border-t border-slate-700 pt-3 mt-2 text-red-400 text-xs font-bold hover:text-red-300 hover:bg-red-600/30 flex items-center justify-center gap-2 transition"
                >
                   <Youtube size={14}/> تحويل قائمة التشغيل إلى فيديوهات منفصلة
                </button>
             )}
           </form>
        </div>
      )}
       {/* Add Manual Task Modal */}
       {showAddModal && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 p-3 rounded-none w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                     <Plus className="text-emerald-500" size={24}/> إضافة هدف جديد
                  </h3>
                  <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300"><X size={20}/></button>
               </div>
               
               <p className="text-xs text-slate-400 mb-4 bg-slate-800/50 p-3 rounded border border-slate-800">
                  يمكنك الكتابة مباشرة أو لصق روابط يوتيوب. <br/>
                  لإنشاء قائمة مكدسة، استخدم (-) في بداية السطور الفرعية.
               </p>
               
               <textarea 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-emerald-500 outline-none h-40 mb-4 resize-none leading-relaxed" 
                  value={manualText} 
                  onChange={e => setManualText(e.target.value)} 
                  placeholder={`اكتب هدفك هنا...\n\nمثال لقائمة مكدسة:\nعنوان الهدف\n- مهمة أولى\n- مهمة ثانية`}
                  autoFocus
               />
               
               <div className="flex gap-3">
                  <button 
                     onClick={handleManualAdd} 
                     disabled={syncing || !manualText.trim()}
                     className={`flex-1 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 ${syncing || !manualText.trim() ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'}`}
                  >
                     {syncing ? <RefreshCw size={16} className="animate-spin"/> : <Plus size={18}/>}
                     إضافة الهدف
                  </button>
               </div>
            </div>
         </div>
       )}

    </div>
  );
};

export default LifeTrack;
