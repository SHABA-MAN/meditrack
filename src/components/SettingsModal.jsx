import React from 'react';
import { Settings, Youtube, RefreshCw } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { getVideoId, getPlaylistId, ytRegex } from '../utils/youtube';

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  config, 
  setConfig, 
  user, 
  appId, 
  db, 
  tasks 
}) => {
  if (!isOpen) return null;

  const saveSettings = async () => {
    if (!user) return;
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'telegram'), config);
        onClose();
        alert("تم الحفظ!");
    } catch (e) {
        alert("فشل الحفظ: " + e.message);
    }
  };

  const fixYouTubeData = async () => {
    if (!confirm("سيقوم هذا بفحص جميع الأهداف وتحديث بيانات اليوتيوب الناقصة. هل أنت متأكد؟")) return;
    let fixCount = 0;
    
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
  };

  return (
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
                onClick={fixYouTubeData}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <RefreshCw size={12}/> إصلاح ومسح أهداف اليوتيوب
              </button>
           </div>

           <div className="flex gap-3">
               <button onClick={saveSettings} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition">حفظ الإعدادات</button>
               <button onClick={onClose} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">إغلاق</button>
           </div>
       </div>
    </div>
  );
};

export default SettingsModal;
