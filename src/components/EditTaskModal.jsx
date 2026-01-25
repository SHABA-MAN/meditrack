import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Repeat } from 'lucide-react';
import { getPlaylistId, getVideoId } from '../utils/youtube';

const EditTaskModal = ({ 
  task, 
  onClose, 
  onSave 
}) => {
  const [editingTask, setEditingTask] = useState(task);

  useEffect(() => {
    setEditingTask(task);
  }, [task]);

  if (!task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(editingTask);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
       <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm">
         <h3 className="font-bold text-lg text-white mb-4">تعديل الهدف</h3>
         
         <label className="block text-xs font-bold text-slate-400 uppercase mb-2">العنوان</label>
         <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none h-24 mb-4 resize-none" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} placeholder="عنوان الهدف" />
         
         <label className="block text-xs font-bold text-slate-400 uppercase mb-2">الوصف (اختياري)</label>
         <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none h-20 mb-4 resize-none" value={editingTask.description || ''} onChange={e => setEditingTask({...editingTask, description: e.target.value})} placeholder="وصف الهدف أو ملاحظات" />
         
         <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setEditingTask({...editingTask, isRecurring: !editingTask.isRecurring})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${editingTask.isRecurring ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`}>{editingTask.isRecurring && <CheckCircle size={14} className="text-white"/>}</div><span className="text-sm text-slate-300">هدف مستمر</span></div>

         {/* 📺 PLAYLIST TRACKER SETTINGS 📺 */}
         <div className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => {
               if (!editingTask.playlistId) {
                  // Try auto-detect from description or title
                  const textToCheck = (editingTask.originalText || '') + ' ' + (editingTask.description || '') + ' ' + (editingTask.videoUrl || '');
                  const foundId = getPlaylistId(textToCheck) || getPlaylistId(editingTask.videoUrl || '');
                  setEditingTask({...editingTask, playlistId: foundId || 'manual'});
               } else {
                  setEditingTask({...editingTask, playlistId: null, playlistLength: 0, watchedEpisodes: []});
               }
            }}>
               <div className={`w-5 h-5 rounded border flex items-center justify-center ${editingTask.playlistId ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                   {editingTask.playlistId && <CheckCircle size={14} className="text-white"/>}
               </div>
               <span className="text-sm font-bold text-slate-200">تفعيل تتبع السلسلة</span>
            </div>
            
            {editingTask.playlistId && (
               <div className="space-y-3 pl-7 animate-in slide-in-from-top-2">
                  <div>
                      <label className="block text-xs text-slate-500 mb-1">عدد حلقات السلسلة</label>
                      <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white" value={editingTask.playlistLength || 0} onChange={e => setEditingTask({...editingTask, playlistLength: parseInt(e.target.value) || 0})} />
                  </div>
                  <div>
                      <label className="block text-xs text-slate-500 mb-1">Playlist ID (اختياري)</label>
                      <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-400 font-mono" value={editingTask.playlistId === 'manual' ? '' : editingTask.playlistId} onChange={e => setEditingTask({...editingTask, playlistId: e.target.value})} placeholder="الرابط أو ID" />
                  </div>
               </div>
            )}
         </div>

         <div className="flex gap-3">
             <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition">حفظ التعديلات</button>
             <button type="button" onClick={onClose} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">إلغاء</button>
         </div>
       </form>
    </div>
  );
};

export default EditTaskModal;
