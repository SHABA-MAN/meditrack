import React from 'react';
import { Edit2, X } from 'lucide-react';

const EditTaskModal = ({
    editingTask,
    setEditingTask,
    handleSaveTaskDetails,
    SUBJECTS
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-none shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Edit2 size={16} className="text-blue-500" /> تعديل المحاضرة
                    </h3>
                    <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
                </div>
                <form onSubmit={handleSaveTaskDetails} className="p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-none text-xs font-bold text-white ${SUBJECTS[editingTask.subject]?.badge}`}>{editingTask.subject}</span>
                        <span className="font-bold text-sm text-slate-700">Lecture {editingTask.number}</span>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">اسم المحاضرة (اختياري)</label>
                        <input
                            type="text"
                            className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm focus:border-blue-500 outline-none"
                            placeholder="مثلاً: Intro to Bones"
                            value={editingTask.title || ''}
                            onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">وصف / ملاحظات</label>
                        <textarea
                            className="w-full border border-slate-200 rounded-none px-3 py-2 text-sm focus:border-blue-500 outline-none h-20 resize-none"
                            placeholder="ملاحظات سريعة..."
                            value={editingTask.description || ''}
                            onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">مستوى الصعوبة</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setEditingTask({ ...editingTask, difficulty: 'easy' })}
                                className={`flex-1 py-2 text-xs font-bold rounded-none border transition ${editingTask.difficulty === 'easy' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                سهلة 🙂
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditingTask({ ...editingTask, difficulty: 'normal' })}
                                className={`flex-1 py-2 text-xs font-bold rounded-none border transition ${editingTask.difficulty === 'normal' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                عادية 😐
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditingTask({ ...editingTask, difficulty: 'hard' })}
                                className={`flex-1 py-2 text-xs font-bold rounded-none border transition ${editingTask.difficulty === 'hard' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                صعبة 🥵
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-none font-bold text-sm hover:bg-slate-800 transition mt-2">
                        حفظ التعديلات
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditTaskModal;
