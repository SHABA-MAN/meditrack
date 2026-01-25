import React from 'react';
import { Youtube, X, Layers, Edit3, Trash2, Zap, Inbox, CheckCircle, Clock } from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

const YouTubeLibrary = ({ 
  isOpen, 
  onClose, 
  tasks, 
  user, 
  db, 
  appId, 
  COLUMNS, 
  focusQueue, 
  setFocusQueue, 
  setEditingTask,
  syncTelegram,
  syncing 
}) => {
  return (
    <div className="relative youtube-dropdown-container">
      <button 
        onClick={onClose} // Toggle logic should be handled by parent or this button just calls a toggle prop
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/30"
      >
        <Youtube size={18} />
        <span>قوائم اليوتيوب</span>
        <span className="bg-red-500/30 text-red-300 text-xs px-2 py-0.5 rounded-full">
          {tasks.filter(t => t.videoId || t.playlistId).length}
        </span>
      </button>
      
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[420px] max-h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-950/50 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Youtube className="text-red-500" size={20} />
              <h3 className="font-bold text-white">مكتبة اليوتيوب</h3>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition">
              <X size={18} />
            </button>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto max-h-[520px] custom-scrollbar">
            {Object.values(COLUMNS).filter(col => col.id !== 'inbox').map(col => {
              const ytTasks = tasks.filter(t => (t.videoId || t.playlistId) && t.stage === col.id);
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
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        db={db} 
                        appId={appId} 
                        user={user} 
                        setEditingTask={setEditingTask}
                        focusQueue={focusQueue}
                        setFocusQueue={setFocusQueue}
                        COLUMNS={COLUMNS}
                        currentColId={col.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Inbox Section */}
            {(() => {
              const inboxYtTasks = tasks.filter(t => (t.videoId || t.playlistId) && t.stage === 'inbox');
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
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        db={db} 
                        appId={appId} 
                        user={user} 
                        setEditingTask={setEditingTask}
                        focusQueue={focusQueue}
                        setFocusQueue={setFocusQueue}
                        COLUMNS={COLUMNS}
                        currentColId={'inbox'}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
            
            {tasks.filter(t => t.videoId || t.playlistId).length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <Youtube size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">لا توجد فيديوهات أو قوائم تشغيل</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for individual task items in the dropdown
const TaskItem = ({ task, db, appId, user, setEditingTask, focusQueue, setFocusQueue, COLUMNS, currentColId }) => {
  return (
    <div 
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
            {Object.values(COLUMNS).filter(c => c.id !== 'inbox' && c.id !== currentColId).map(targetCol => (
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
                setFocusQueue([...focusQueue, task]);
              }
            }}
            className="p-1 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded transition text-[10px] font-bold mt-1"
            title="إضافة للتركيز"
          >
            <Zap size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default YouTubeLibrary;
