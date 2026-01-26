import React, { useState } from 'react';
import { 
  Book, 
  BookOpen, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  Layers
} from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

// --- BOOK CARD COMPONENT ---
export const BookCard = ({ task, isFocusMode, user, db, appId, onEdit, expandedGroups, toggleGroupExpansion, COLUMNS }) => {
  
  const totalPages = parseInt(task.totalPages) || 0;
  // Calculate approximate page progress based on subtask completion
  // Logic: 100% subtasks = 100% pages. 
  // If user wants specific page tracking, they can add it to subtasks titles e.g. "Read 1-50"
  const completedSubtasks = task.subTasks ? task.subTasks.filter(st => st.completed).length : 0;
  const totalSubtasks = task.subTasks ? task.subTasks.length : 0;
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
  const pagesRead = Math.round((progressPercent / 100) * totalPages);

  // Get Stage Info
  const currentStage = COLUMNS ? COLUMNS[task.stage] : null;

  // Generate a consistent cover color based on title hash if not provided
  const getCoverColor = (str) => {
      if (task.coverColor) return task.coverColor;
      const colors = ['bg-amber-700', 'bg-blue-800', 'bg-red-800', 'bg-emerald-800', 'bg-slate-700', 'bg-purple-800'];
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length];
  };

  const coverColor = getCoverColor(task.title);

  return (
    <div 
      className={`relative group/book transition-all ${isFocusMode ? 'hover:scale-[1.01]' : 'hover:-translate-y-1'}`}
    >
        {/* Book Spine Effect (Left Border) */}
        <div className={`absolute left-0 top-0 bottom-0 w-3 rounded-l-md z-10 ${coverColor} shadow-inner opacity-80`}></div>
        
        <div className={`
             bg-slate-900 border border-slate-700 rounded-md overflow-hidden shadow-lg pl-3 
             ${isFocusMode ? 'min-h-[160px]' : ''}
        `}>
            {/* Header / Cover Area */}
            <div className={`p-3 border-b border-slate-800 flex gap-3 ${coverColor} bg-opacity-20 relative`}>
                
                {/* Stage Badge (Top Right) */}
                {currentStage && (
                    <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border bg-slate-900/80 backdrop-blur-sm ${currentStage.color.replace('border-', 'text-').replace('border-', 'border-')}`}>
                        <currentStage.icon size={8} />
                        <span>{currentStage.title}</span>
                    </div>
                )}

                <div className={`w-10 h-14 rounded shadow-lg flex items-center justify-center ${coverColor} text-white/50 border border-white/10 shrink-0`}>
                    <Book size={20} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-slate-100 leading-tight line-clamp-2 text-sm">{task.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <span className="font-mono">{pagesRead}</span> / <span className="font-mono">{totalPages}</span> صفحة
                    </p>
                    {/* Progress Bar */}
                    <div className="h-1 bg-slate-800 rounded-full mt-2 w-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Content / Subtasks */}
            <div className="p-3">
                {/* Toggle Group */}
                {task.subTasks && task.subTasks.length > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleGroupExpansion(task.id); }}
                        className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-white mb-2 py-1 px-2 rounded hover:bg-slate-800 transition"
                    >
                        <span className="flex items-center gap-1">
                             <Layers size={12} />
                             الأقسام / الفصول ({completedSubtasks}/{totalSubtasks})
                        </span>
                        {expandedGroups.has(task.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                )}

                {/* Subtasks List */}
                {expandedGroups.has(task.id) && task.subTasks && (
                     <div className="space-y-1 mb-3 max-h-40 overflow-y-auto custom-scrollbar bg-slate-950/30 p-2 rounded border border-slate-800">
                        {task.subTasks.map((subTask, idx) => (
                            <div key={idx} className="flex items-center gap-2 group/sub">
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
                                    className={`w-3 h-3 rounded border flex items-center justify-center transition shrink-0 ${
                                        subTask.completed 
                                            ? 'bg-emerald-600 border-emerald-500' 
                                            : 'border-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    {subTask.completed && <CheckCircle size={8} className="text-white" />}
                                </button>
                                <span className={`text-xs ${subTask.completed ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                                    {subTask.title}
                                </span>
                            </div>
                        ))}
                     </div>
                )}
                
                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800">
                    <div className={`flex gap-1 ${isFocusMode ? 'opacity-100' : 'opacity-0 group-hover/book:opacity-100 transition-opacity'}`}>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400"><Edit3 size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); confirm("حذف الكتاب؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id)); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                    </div>
                    
                    {progressPercent >= 100 ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded-full border border-emerald-500/20">
                            <CheckCircle size={10} /> تم القراءة
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-500 font-mono">
                            {Math.round(progressPercent)}%
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

// --- LIBRARY DROPDOWN COMPONENT ---
export const LibraryDropdown = ({ 
    books, 
    show, 
    onClose, 
    onEdit, 
    user, 
    db, 
    appId, 
    addToFocus, 
    COLUMNS,
    onMoveStage 
}) => {
  if (!show) return null;

  return (
    <div className="absolute left-0 top-full mt-2 w-[450px] max-h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/50 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="bg-amber-600/20 p-1.5 rounded-lg border border-amber-600/30">
                    <Book className="text-amber-500" size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">مكتبة الكتب</h3>
                    <p className="text-[10px] text-slate-400">تابع قراءاتك وتقدمك</p>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition">
                <X size={18} />
            </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[520px] custom-scrollbar p-0">
            {books.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center text-slate-500">
                    <BookOpen size={40} className="mb-4 opacity-20" />
                    <p className="text-sm">المكتبة فارغة</p>
                    <p className="text-xs mt-1">أضف كتباً جديدة لتبدأ رحلة القراءة</p>
                </div>
            ) : (
                Object.values(COLUMNS).filter(col => col.id !== 'inbox').map(col => {
                    const colBooks = books.filter(b => b.stage === col.id);
                    if (colBooks.length === 0) return null;

                    return (
                        <div key={col.id} className="border-b border-slate-800 last:border-0">
                            <div className={`px-4 py-2 ${col.bg} border-l-4 ${col.color} flex items-center gap-2 sticky top-0 backdrop-blur-sm z-10`}>
                                <col.icon size={14} className="opacity-70" />
                                <span className="font-bold text-xs text-slate-200">{col.title}</span>
                                <span className="bg-white/10 text-[10px] px-1.5 py-0.5 rounded-full ml-auto">{colBooks.length}</span>
                            </div>
                            
                            <div className="p-3 grid grid-cols-1 gap-2">
                                {colBooks.map(book => (
                                    <div key={book.id} className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 rounded-lg p-3 group transition flex gap-3 items-start">
                                        {/* Mini Spine */}
                                        <div className="w-1 self-stretch rounded-full bg-amber-700 opacity-50"></div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-200 text-sm truncate">{book.title}</h4>
                                                
                                                {/* Mini Actions */}
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => onEdit(book)} className="text-slate-400 hover:text-blue-400"><Edit3 size={12}/></button>
                                                    <button onClick={() => confirm("حذف؟") && deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', book.id))} className="text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500" 
                                                        style={{width: `${(book.subTasks && book.subTasks.length > 0) ? (book.subTasks.filter(s=>s.completed).length / book.subTasks.length * 100) : 0}%`}}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                     {book.subTasks ? book.subTasks.filter(s=>s.completed).length : 0}/{book.subTasks ? book.subTasks.length : 0}
                                                </span>
                                            </div>
                                            
                                            {/* Footer Actions */}
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                                                 <div className="flex gap-1">
                                                    {Object.values(COLUMNS).filter(c => c.id !== 'inbox' && c.id !== col.id).map(targetCol => (
                                                        <button 
                                                            key={targetCol.id}
                                                            onClick={() => onMoveStage(book.id, targetCol.id)}
                                                            className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition"
                                                            title={`نقل لـ ${targetCol.title}`}
                                                        >
                                                            <targetCol.icon size={10} />
                                                        </button>
                                                    ))}
                                                 </div>
                                                 
                                                 <button
                                                    onClick={() => addToFocus(book)}
                                                    className="flex items-center gap-1 text-[10px] bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white px-2 py-0.5 rounded transition"
                                                 >
                                                    <Plus size={10} /> إضافة للتركيز
                                                 </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
             {/* Inbox Section (If any) */}
             {books.filter(b => b.stage === 'inbox').length > 0 && (
                 <div className="border-t border-slate-700 p-2">
                     <p className="text-[10px] text-slate-500 text-center mb-2">كتب في الوارد</p>
                     {books.filter(b => b.stage === 'inbox').map(book => (
                         <div key={book.id} className="bg-slate-800 p-2 rounded mb-1 flex justify-between items-center">
                             <span className="text-xs text-slate-300">{book.title}</span>
                             <button onClick={() => addToFocus(book)} className="text-amber-500 hover:text-white"><Plus size={14}/></button>
                         </div>
                     ))}
                 </div>
             )}
        </div>
    </div>
  );
};
