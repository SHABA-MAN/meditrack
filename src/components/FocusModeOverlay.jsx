import React from 'react';
import { Zap, X, CheckCircle, Flag } from 'lucide-react';

const FocusModeOverlay = ({
    isFocusAnimating,
    isFreeFocus,
    focusQueue,
    onSwitchToLifeTrack,
    closeFocusMode,
    completeTask,
    SUBJECTS
}) => {
    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col transition-all duration-500 ease-in-out transform ${isFocusAnimating
                    ? 'bg-slate-950 translate-x-0'
                    : 'bg-slate-950 -translate-x-full'
                }`}
        >
            {/* Top Bar (Minimal) */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-sm uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-none bg-slate-900/50 backdrop-blur-md">
                        {isFreeFocus ? 'Free Session' : `Active Tasks: ${focusQueue.length}`}
                    </span>

                    {/* SWITCHER BUTTON */}
                    <button
                        onClick={onSwitchToLifeTrack}
                        className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-none text-xs font-bold transition-all backdrop-blur-md"
                        title="الذهاب إلى LifeTrack (ستبقى الجلسة محفوظة)"
                    >
                        <Zap size={14} fill="currentColor" />
                        LifeTrack
                    </button>
                </div>

                <div className="pointer-events-auto">
                    <button
                        onClick={closeFocusMode}
                        className="p-2 text-slate-500 hover:text-white transition hover:bg-slate-800 rounded-none"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col h-full pt-20 pb-10 px-6">
                {isFreeFocus ? (
                    // FREE FOCUS UI (Minimal)
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                        <Zap size={64} className="text-amber-500 mb-8 opacity-90 animate-pulse" />
                        <h2 className="text-4xl font-light tracking-wide mb-4">جلسة تركيز حرة</h2>
                        <p className="text-slate-500 mb-12 max-w-md text-center leading-relaxed">
                            استمتع بالهدوء والتركيز العميق. لا يوجد مهام، فقط أنت والمادة العلمية.
                        </p>
                        <button
                            onClick={closeFocusMode}
                            className="px-8 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/30 rounded-none text-sm font-bold transition-all duration-300"
                        >
                            إنهاء الجلسة
                        </button>
                    </div>
                ) : (
                    // ALL TASKS GRID VIEW (Pure & Clean)
                    <div className="w-full h-full overflow-y-auto">
                        <div className="flex flex-wrap justify-center items-center content-center min-h-full gap-6 pb-10">
                            {focusQueue.map((task) => (
                                <div
                                    key={task.id}
                                    className="bg-slate-900/50 border border-slate-800 hover:border-slate-600 backdrop-blur-sm p-8 rounded-none shadow-2xl w-full max-w-md flex flex-col items-center text-center relative group transition-all duration-300 hover:-translate-y-1"
                                >
                                    {/* Subject Badge */}
                                    <div className={`inline-block px-4 py-1.5 rounded-none text-xs font-bold mb-6 text-white shadow-lg ${SUBJECTS[task.subject]?.darkBadge || 'bg-slate-700'}`}>
                                        {task.subject}
                                    </div>

                                    {/* Title & Number */}
                                    <h2 className="text-5xl font-black text-white mb-2 tracking-tight">
                                        Lec {task.number}
                                    </h2>
                                    {task.title && <p className="text-lg text-emerald-400 font-medium mb-1">{task.title}</p>}

                                    {/* Meta Info */}
                                    <div className="flex items-center justify-center gap-3 text-slate-500 text-xs mb-8 uppercase tracking-widest">
                                        <span>{task.stage === 0 ? 'New' : `Review ${task.stage}`}</span>
                                        {task.difficulty && (
                                            <span className={`flex items-center gap-1 ${task.difficulty === 'hard' ? 'text-red-400' : task.difficulty === 'easy' ? 'text-green-400' : ''}`}>
                                                {task.difficulty === 'hard' && <Flag size={10} fill="currentColor" />}
                                                {task.difficulty === 'hard' ? 'HARD' : task.difficulty === 'easy' ? 'EASY' : 'NORMAL'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Description (Minimal) */}
                                    {task.description && (
                                        <p className="text-slate-400 text-sm max-w-xs mx-auto mb-10 leading-relaxed font-light border-t border-slate-800 pt-4">
                                            {task.description}
                                        </p>
                                    )}

                                    {/* Minimal Done Button */}
                                    <button
                                        onClick={() => completeTask(task)}
                                        className="w-16 h-16 rounded-none bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center transition-all duration-300 transform group-hover:scale-110"
                                        title="إتمام"
                                    >
                                        <CheckCircle size={32} />
                                    </button>
                                    <span className="text-[10px] text-slate-600 mt-3 font-medium uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Mark Done</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FocusModeOverlay;
