import React from 'react';
import {
    CheckCircle, BrainCircuit, Settings, BookOpen, Info, X, LogOut, Plus, Layers, Zap, Coffee,
    Edit2, History, Play, Calendar, Clock, Target, FileText, BarChart3, Home
} from 'lucide-react';
import { DIFFICULTY_CONFIG } from '../constants';

// ═══════════════════════════════════════════════
//  Sidebar Navigation Component
// ═══════════════════════════════════════════════
export const Sidebar = ({ onSwitchToLifeTrack, onSwitchToTimeBoxing, sidebarCollapsed, setSidebarCollapsed }) => (
    <aside className={`sidebar-nav flex flex-col items-center py-4 gap-1 shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-[52px]' : 'w-[68px]'}`}>
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 shadow-glow-blue cursor-pointer" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <BrainCircuit size={18} className="text-white" />
        </div>
        <button className="sidebar-item active" title="الرئيسية"><Home size={18} />{!sidebarCollapsed && <span>الرئيسية</span>}</button>
        <button onClick={onSwitchToLifeTrack} className="sidebar-item" title="LifeTrack"><Zap size={18} className="text-amber-500" />{!sidebarCollapsed && <span>LifeTrack</span>}</button>
        <button onClick={onSwitchToTimeBoxing} className="sidebar-item" title="TimeBoxing"><Clock size={18} className="text-indigo-400" />{!sidebarCollapsed && <span>TimeBox</span>}</button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('switchToCalendar'))} className="sidebar-item" title="التقويم"><Calendar size={18} className="text-emerald-400" />{!sidebarCollapsed && <span>التقويم</span>}</button>
        <div className="flex-1" />
        <button onClick={() => window.dispatchEvent(new CustomEvent('switchToCalendar'))} className="sidebar-item" title="الإنجازات"><BarChart3 size={18} className="text-cyan-400" />{!sidebarCollapsed && <span>إنجازات</span>}</button>
    </aside>
);

// ═══════════════════════════════════════════════
//  Top Bar Component
// ═══════════════════════════════════════════════
export const TopBar = ({ SUBJECTS, getSubjectStats, handleLogout, setShowSettings, setSettingsTab }) => (
    <header className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-dark-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-sm text-white">MediTrack</h1>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {Object.keys(SUBJECTS).map(subj => {
                    const stats = getSubjectStats(subj);
                    return (
                        <div key={subj} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 border border-white/5 shrink-0">
                            <span className={`text-[8px] font-black px-1 rounded text-white ${SUBJECTS[subj].badge}`}>{subj}</span>
                            <span className="text-[10px] font-bold text-slate-300">{stats.new}<span className="text-slate-500">/{stats.total}</span></span>
                        </div>
                    );
                })}
            </div>
        </div>
        <div className="flex items-center gap-1.5">
            <button onClick={() => { setShowSettings(true); setSettingsTab('guide'); }} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition" title="الدليل"><Info size={15} /></button>
            <button onClick={() => { setShowSettings(true); setSettingsTab('manage'); }} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-md transition" title="الإعدادات"><Settings size={15} /></button>
            <div className="h-4 w-px bg-slate-700 mx-0.5" />
            <button onClick={handleLogout} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition" title="خروج"><LogOut size={15} /></button>
        </div>
    </header>
);

// ═══════════════════════════════════════════════
//  Widget: Focus Queue (Drop Zone)
// ═══════════════════════════════════════════════
export const FocusQueueWidget = ({ focusQueue, handleDrop, handleDragOver, startFocusSession, startFreeFocus, removeFromQueue, SUBJECTS, DIFFICULTY_CONFIG: DC }) => (
    <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="widget-card flex flex-col h-full min-h-[200px]"
    >
        <div className="widget-card-accent bg-gradient-to-r from-violet-500 to-purple-500" />
        <div className="p-3 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
                <Layers size={14} className="text-purple-400" />
                <span className="text-xs font-bold text-slate-200">منطقة التركيز</span>
            </div>
            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">{focusQueue.length}</span>
        </div>
        {focusQueue.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mb-3 animate-breathe">
                    <Layers size={20} className="text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 mb-3">اسحب المحاضرات هنا</p>
                <button onClick={startFreeFocus} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-400 hover:border-purple-500/50 hover:text-purple-300 transition-all flex items-center gap-1.5">
                    <Coffee size={12} /> جلسة حرة
                </button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {focusQueue.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg border border-white/5 group hover:border-purple-500/20 transition">
                            <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 flex items-center justify-center text-[9px] font-bold text-white rounded-md ${SUBJECTS[task.subject]?.badge || 'bg-slate-500'}`}>{task.subject}</div>
                                <div>
                                    <span className="font-bold text-slate-200 text-[11px] block">Lec {task.number}</span>
                                    <span className="text-[9px] text-slate-500">{SUBJECTS[task.subject]?.name}</span>
                                </div>
                            </div>
                            <button onClick={() => removeFromQueue(task.id)} className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-red-400 rounded transition"><X size={12} /></button>
                        </div>
                    ))}
                </div>
                <div className="p-2 border-t border-white/5">
                    <button onClick={startFocusSession} className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-bold text-[11px] text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]">
                        <Play size={12} fill="currentColor" /> ابدأ الجلسة
                    </button>
                </div>
            </div>
        )}
    </div>
);

// ═══════════════════════════════════════════════
//  Widget: Task List (Reviews or New)
// ═══════════════════════════════════════════════
export const TaskListWidget = ({ title, icon: Icon, iconColor, accentGradient, badgeColor, tasks, SUBJECTS, isMobile, handleDragStart, addToQueue, openEditModal, emptyMessage, emptyAction }) => (
    <div className="widget-card flex flex-col h-full min-h-[200px]">
        <div className={`widget-card-accent ${accentGradient}`} />
        <div className="p-3 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2"><Icon size={14} className={iconColor} /><span className="text-xs font-bold text-slate-200">{title}</span></div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{tasks.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {tasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-6">
                    <CheckCircle size={24} className="mb-2 text-slate-700" />
                    <p className="text-[11px]">{emptyMessage}</p>
                    {emptyAction}
                </div>
            ) : tasks.map(r => (
                <div key={r.id} draggable={!isMobile} onDragStart={(e) => !isMobile && handleDragStart(e, r)}
                    className={`p-2 rounded-lg bg-slate-800/40 border border-white/5 hover:border-blue-500/20 transition-all group ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex gap-2 flex-1">
                            <div className={`mt-0.5 w-1 h-5 rounded-full ${SUBJECTS[r.subject]?.badge || 'bg-slate-600'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-200 text-[11px]">Lec {r.number}</span>
                                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded text-white ${SUBJECTS[r.subject]?.badge}`}>{r.subject}</span>
                                    {r.stage > 0 && <span className="text-[9px] text-slate-500">تكرار {r.stage}</span>}
                                </div>
                                {r.title && <p className="text-[9px] text-slate-400 truncate mt-0.5">{r.title}</p>}
                                {r.difficulty && DIFFICULTY_CONFIG[r.difficulty] && (
                                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${DIFFICULTY_CONFIG[r.difficulty].darkBg} ${DIFFICULTY_CONFIG[r.difficulty].darkText} border ${DIFFICULTY_CONFIG[r.difficulty].darkBorder}`}>
                                        {DIFFICULTY_CONFIG[r.difficulty].emoji}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                            {isMobile && <button onClick={() => addToQueue(r)} className="p-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition"><Plus size={12} /></button>}
                            <button onClick={() => openEditModal(r)} className={`text-slate-600 hover:text-blue-400 p-1 transition ${isMobile ? '' : 'opacity-0 group-hover:opacity-100'}`}><Edit2 size={10} /></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ═══════════════════════════════════════════════
//  Widget: Weekly Review
// ═══════════════════════════════════════════════
export const WeeklyReviewWidget = ({ weeklyReview, setWeeklyReview, saveWeeklyReview }) => (
    <div className="widget-card flex flex-col">
        <div className="widget-card-accent bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="p-3 flex items-center gap-2 border-b border-white/5">
            <FileText size={14} className="text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">المراجعة الأسبوعية</span>
        </div>
        <div className="p-3 space-y-3">
            <div>
                <label className="text-[10px] font-bold text-emerald-400 mb-1 block">✓ ايش أنجزت؟</label>
                <textarea className="dark-input w-full h-16 resize-none text-[11px]" placeholder="اكتب إنجازاتك هذا الأسبوع..." value={weeklyReview.done}
                    onChange={e => setWeeklyReview({ ...weeklyReview, done: e.target.value })}
                    onBlur={() => saveWeeklyReview(weeklyReview)} />
            </div>
            <div>
                <label className="text-[10px] font-bold text-rose-400 mb-1 block">✗ ايش فاتك؟ وليش؟</label>
                <textarea className="dark-input w-full h-16 resize-none text-[11px]" placeholder="فرص التحسين..." value={weeklyReview.missed}
                    onChange={e => setWeeklyReview({ ...weeklyReview, missed: e.target.value })}
                    onBlur={() => saveWeeklyReview(weeklyReview)} />
            </div>
        </div>
    </div>
);

// ═══════════════════════════════════════════════
//  Widget: Weekly Goals
// ═══════════════════════════════════════════════
export const WeeklyGoalsWidget = ({ weeklyGoals, setWeeklyGoals, saveWeeklyGoals }) => (
    <div className="widget-card flex flex-col">
        <div className="widget-card-accent bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="p-3 flex items-center gap-2 border-b border-white/5">
            <Target size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-slate-200">أولويات الأسبوع</span>
        </div>
        <div className="p-3 space-y-2">
            {['goal1', 'goal2', 'goal3'].map((key, i) => (
                <div key={key} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-400 shrink-0">{i + 1}</span>
                    <input className="dark-input flex-1 text-[11px] py-1.5" placeholder={`الأولوية ${i + 1}...`} value={weeklyGoals[key]}
                        onChange={e => setWeeklyGoals({ ...weeklyGoals, [key]: e.target.value })}
                        onBlur={() => saveWeeklyGoals(weeklyGoals)} />
                </div>
            ))}
        </div>
    </div>
);

// ═══════════════════════════════════════════════
//  Widget: Quick Stats
// ═══════════════════════════════════════════════
export const QuickStatsWidget = ({ reviews, news, history, focusQueue }) => {
    const todayCount = history.filter(h => new Date(h.completedAt).toDateString() === new Date().toDateString()).length;
    return (
        <div className="widget-card">
            <div className="widget-card-accent bg-gradient-to-r from-cyan-500 to-blue-500" />
            <div className="p-3 flex items-center gap-2 border-b border-white/5">
                <BarChart3 size={14} className="text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">إحصائيات سريعة</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
                {[
                    { label: 'مراجعات اليوم', value: reviews.length, color: 'text-amber-400' },
                    { label: 'جديد', value: news.length, color: 'text-blue-400' },
                    { label: 'أُنجز اليوم', value: todayCount, color: 'text-emerald-400' },
                    { label: 'في الطابور', value: focusQueue.length, color: 'text-purple-400' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-800/40 rounded-lg p-2 text-center border border-white/5">
                        <p className={`stat-number text-lg ${s.color}`}>{s.value}</p>
                        <p className="text-[9px] text-slate-500 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
