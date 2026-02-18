import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    deleteDoc,
    query,
    orderBy,
    updateDoc
} from 'firebase/firestore';
import { logAchievement } from './utils/achievements';
import { useIsMobile } from './hooks/useIsMobile';
import {
    ArrowRight,
    Clock,
    GripVertical,
    CheckCircle,
    X,
    Trash2,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Inbox,
    Target,
    Zap,
    Layers
} from 'lucide-react';

const HOUR_HEIGHT = 64; // px per hour slot
const HALF_HOUR_HEIGHT = HOUR_HEIGHT / 2;

const TimeBoxing = ({ onBack, user, db }) => {
    const appId = 'meditrack-v1';
    const isMobile = useIsMobile();

    // ---- State ----
    const [tasks, setTasks] = useState([]);
    const [scheduledItems, setScheduledItems] = useState({}); // { taskId: { startHour, duration, completed } }
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const [loading, setLoading] = useState(true);
    const [dragOverHour, setDragOverHour] = useState(null);
    const [resizing, setResizing] = useState(null); // { taskId, startY, startDuration }
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

    const timelineRef = useRef(null);

    // ---- Helpers ----
    const formatDateArabic = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        return `${days[d.getDay()]}، ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const isToday = (dateStr) => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return dateStr === today;
    };

    const navigateDate = (direction) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + direction);
        setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };

    const goToToday = () => {
        const now = new Date();
        setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
    };

    const formatHour = (hour) => {
        if (hour === 0) return '12:00 AM';
        if (hour < 12) return `${hour}:00 AM`;
        if (hour === 12) return '12:00 PM';
        return `${hour - 12}:00 PM`;
    };

    // ---- Firebase: Load Tasks from LifeTrack ----
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setTasks(list);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    // ---- Firebase: Load/Save Daily Plan ----
    useEffect(() => {
        if (!user) return;
        const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_plans', selectedDate);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setScheduledItems(snap.data().items || {});
            } else {
                setScheduledItems({});
            }
        });
        return () => unsub();
    }, [user, selectedDate]);

    const savePlanToFirebase = useCallback(async (newItems) => {
        if (!user) return;
        try {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_plans', selectedDate);
            await setDoc(ref, {
                items: newItems,
                date: selectedDate,
                updatedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error('Failed to save plan:', e);
        }
    }, [user, selectedDate, db]);

    // ---- Drag & Drop from Pool ----
    const handlePoolDragStart = (e, task) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.setData('source', 'pool');
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleTimelineDragOver = (e, hour) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverHour(hour);
    };

    const handleTimelineDragLeave = () => {
        setDragOverHour(null);
    };

    const handleTimelineDrop = (e, hour) => {
        e.preventDefault();
        setDragOverHour(null);

        const taskId = e.dataTransfer.getData('taskId');
        const source = e.dataTransfer.getData('source');
        if (!taskId) return;

        // Check if this slot already has something (allow if re-scheduling)
        const newItems = { ...scheduledItems };

        if (source === 'scheduled') {
            // Re-scheduling: move existing item
            const existing = newItems[taskId];
            if (existing) {
                newItems[taskId] = { ...existing, startHour: hour };
            }
        } else {
            // New from pool: default duration 1 hour
            newItems[taskId] = { startHour: hour, duration: 1, completed: false };
        }

        setScheduledItems(newItems);
        savePlanToFirebase(newItems);
    };

    // ---- Drag scheduled item to reposition ----
    const handleScheduledDragStart = (e, taskId) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.setData('source', 'scheduled');
        e.dataTransfer.effectAllowed = 'move';
    };

    // ---- Resize (vertical expand) ----
    const handleResizeStart = (e, taskId) => {
        e.preventDefault();
        e.stopPropagation();
        const item = scheduledItems[taskId];
        if (!item) return;

        setResizing({
            taskId,
            startY: e.clientY || e.touches?.[0]?.clientY,
            startDuration: item.duration
        });
    };

    useEffect(() => {
        if (!resizing) return;

        const handleResizeMove = (e) => {
            const clientY = e.clientY || e.touches?.[0]?.clientY;
            const diff = clientY - resizing.startY;
            const hourDiff = Math.round(diff / HALF_HOUR_HEIGHT) * 0.5;
            const newDuration = Math.max(0.5, resizing.startDuration + hourDiff);
            // Cap at 24 - startHour
            const item = scheduledItems[resizing.taskId];
            if (!item) return;
            const maxDuration = 24 - item.startHour;
            const finalDuration = Math.min(newDuration, maxDuration);

            setScheduledItems(prev => ({
                ...prev,
                [resizing.taskId]: { ...prev[resizing.taskId], duration: finalDuration }
            }));
        };

        const handleResizeEnd = () => {
            savePlanToFirebase(scheduledItems);
            setResizing(null);
        };

        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
        window.addEventListener('touchmove', handleResizeMove);
        window.addEventListener('touchend', handleResizeEnd);

        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
            window.removeEventListener('touchmove', handleResizeMove);
            window.removeEventListener('touchend', handleResizeEnd);
        };
    }, [resizing, scheduledItems, savePlanToFirebase]);

    // ---- Actions ----
    const removeFromTimeline = (taskId) => {
        const newItems = { ...scheduledItems };
        delete newItems[taskId];
        setScheduledItems(newItems);
        savePlanToFirebase(newItems);
    };

    const toggleComplete = async (taskId) => {
        const item = scheduledItems[taskId];
        if (!item) return;

        const newCompleted = !item.completed;
        const newItems = {
            ...scheduledItems,
            [taskId]: { ...item, completed: newCompleted }
        };
        setScheduledItems(newItems);
        savePlanToFirebase(newItems);

        // Log achievement if completing
        if (newCompleted && user) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                await logAchievement(db, user.uid, 'task', {
                    title: task.title,
                    stage: 'TimeBoxing'
                });
            }
        }
    };

    // ---- Computed ----
    const scheduledTaskIds = new Set(Object.keys(scheduledItems));
    const unscheduledTasks = tasks.filter(t => !scheduledTaskIds.has(t.id));

    // Current hour indicator
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // Count stats
    const totalScheduled = Object.keys(scheduledItems).length;
    const completedCount = Object.values(scheduledItems).filter(i => i.completed).length;

    // ---- Stage Colors ----
    const getStageColor = (stage) => {
        switch (stage) {
            case 'do_first': return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' };
            case 'schedule': return { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' };
            case 'delegate': return { bg: 'bg-gray-500', text: 'text-gray-600', light: 'bg-gray-50', border: 'border-gray-200' };
            default: return { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50', border: 'border-slate-200' };
        }
    };

    const getStageLabel = (stage) => {
        switch (stage) {
            case 'inbox': return 'وارد';
            case 'do_first': return 'مهم وعاجل 🔥';
            case 'schedule': return 'مهم 📅';
            case 'delegate': return 'غير مهم';
            default: return stage;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50" dir="rtl">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-bold text-sm">جاري تحميل الجدول...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 text-slate-800 font-sans" dir="rtl">
            {/* ---- Header ---- */}
            <nav className="bg-white border-b border-gray-200 px-4 py-2.5 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
                    {/* Right: Back + Title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition"
                            title="رجوع"
                        >
                            <ArrowRight size={18} />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="bg-indigo-600 text-white p-1.5 rounded-none">
                                <Clock size={16} />
                            </div>
                            <div>
                                <h1 className="font-bold text-sm text-slate-800 leading-tight">TimeBoxing</h1>
                                <p className="text-[9px] text-slate-400 font-medium">تنظيم الوقت</p>
                            </div>
                        </div>
                    </div>

                    {/* Center: Date Navigation */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-gray-100 rounded-none transition text-slate-500">
                            <ChevronRight size={18} />
                        </button>
                        <button onClick={goToToday} className={`px-3 py-1 text-xs font-bold rounded-none transition ${isToday(selectedDate) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
                            {isToday(selectedDate) ? 'اليوم' : formatDateArabic(selectedDate)}
                        </button>
                        <button onClick={() => navigateDate(1)} className="p-1 hover:bg-gray-100 rounded-none transition text-slate-500">
                            <ChevronLeft size={18} />
                        </button>
                    </div>

                    {/* Left: Stats + Sidebar toggle */}
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 text-[10px] font-bold">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-none">{totalScheduled} مجدول</span>
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-none">{completedCount} منجز</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition md:hidden"
                        >
                            <Layers size={18} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* ---- Main Content ---- */}
            <div className="max-w-[1600px] mx-auto flex h-[calc(100vh-52px)]">

                {/* ---- Sidebar: Task Pool ---- */}
                <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-l border-gray-200 bg-white flex-shrink-0 flex flex-col ${isMobile && sidebarOpen ? 'absolute inset-y-[52px] right-0 z-20 shadow-xl w-80' : ''}`}>
                    <div className="p-3 border-b border-gray-100 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Target size={14} className="text-indigo-500" />
                                <span className="font-bold text-sm text-slate-700">الأهداف</span>
                            </div>
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-none">{unscheduledTasks.length}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                        {unscheduledTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-300">
                                <Inbox size={32} className="mb-3 opacity-50" />
                                <p className="text-xs font-medium">كل الأهداف مجدولة!</p>
                            </div>
                        ) : (
                            unscheduledTasks.map(task => {
                                const colors = getStageColor(task.stage);
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => handlePoolDragStart(e, task)}
                                        className="bg-white p-2.5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing rounded-none group"
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className={`w-1 h-8 rounded-none mt-0.5 flex-shrink-0 ${colors.bg}`}></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-700 text-xs truncate">{task.title || 'بدون عنوان'}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none ${colors.light} ${colors.text} ${colors.border} border`}>
                                                        {getStageLabel(task.stage)}
                                                    </span>
                                                    {task.isRecurring && (
                                                        <span className="text-[8px] font-bold px-1 py-0.5 rounded-none bg-amber-50 text-amber-600 border border-amber-200">مستمر</span>
                                                    )}
                                                </div>
                                                {task.description && (
                                                    <p className="text-[9px] text-slate-400 mt-1 truncate">{task.description}</p>
                                                )}
                                            </div>
                                            <GripVertical size={14} className="text-slate-200 group-hover:text-slate-400 transition flex-shrink-0 mt-1" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ---- Timeline: 24h Grid ---- */}
                <div className="flex-1 overflow-y-auto custom-scrollbar" ref={timelineRef}>
                    <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>

                        {/* Current time indicator */}
                        {isToday(selectedDate) && (
                            <div
                                className="absolute left-0 right-0 z-10 pointer-events-none"
                                style={{ top: `${currentHour * HOUR_HEIGHT}px` }}
                            >
                                <div className="flex items-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-md flex-shrink-0"></div>
                                    <div className="flex-1 h-[2px] bg-red-500 opacity-60"></div>
                                </div>
                            </div>
                        )}

                        {/* Hour rows */}
                        {Array.from({ length: 24 }, (_, hour) => (
                            <div
                                key={hour}
                                className={`absolute w-full border-b border-gray-100 flex transition-colors ${dragOverHour === hour ? 'bg-indigo-50' : 'hover:bg-gray-50/50'}`}
                                style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                                onDragOver={(e) => handleTimelineDragOver(e, hour)}
                                onDragLeave={handleTimelineDragLeave}
                                onDrop={(e) => handleTimelineDrop(e, hour)}
                            >
                                {/* Hour label */}
                                <div className="w-20 flex-shrink-0 px-3 py-2 text-[10px] font-bold text-slate-400 border-l border-gray-100 select-none">
                                    {formatHour(hour)}
                                </div>
                                {/* Drop zone visual */}
                                <div className="flex-1 relative">
                                    {dragOverHour === hour && (
                                        <div className="absolute inset-0 border-2 border-dashed border-indigo-300 rounded-none m-1 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-indigo-400">أفلت هنا</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Scheduled items overlay */}
                        {Object.entries(scheduledItems).map(([taskId, item]) => {
                            const task = tasks.find(t => t.id === taskId);
                            if (!task) return null;

                            const colors = getStageColor(task.stage);
                            const top = item.startHour * HOUR_HEIGHT;
                            const height = item.duration * HOUR_HEIGHT;

                            return (
                                <div
                                    key={taskId}
                                    draggable
                                    onDragStart={(e) => handleScheduledDragStart(e, taskId)}
                                    className={`absolute rounded-none shadow-md transition-shadow hover:shadow-lg cursor-grab active:cursor-grabbing ${item.completed ? 'opacity-60' : ''}`}
                                    style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                        right: '84px', // account for hour label width
                                        left: '8px',
                                        zIndex: resizing?.taskId === taskId ? 20 : 5
                                    }}
                                >
                                    <div className={`h-full border-r-4 ${item.completed ? 'border-emerald-500 bg-emerald-50' : `${colors.border} border ${colors.light}`} rounded-none p-2 flex flex-col overflow-hidden`}>
                                        {/* Top row: title + actions */}
                                        <div className="flex items-start justify-between gap-1 flex-shrink-0">
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-xs truncate ${item.completed ? 'line-through text-emerald-700' : 'text-slate-700'}`}>
                                                    {task.title || 'بدون عنوان'}
                                                </p>
                                                <p className="text-[9px] text-slate-400 mt-0.5">
                                                    {formatHour(item.startHour)} — {formatHour(item.startHour + item.duration)} ({item.duration}h)
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleComplete(taskId); }}
                                                    className={`p-1 rounded-none transition ${item.completed ? 'text-emerald-500 hover:text-emerald-700 bg-emerald-100' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                                                    title={item.completed ? 'إلغاء الإنجاز' : 'إنجاز'}
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeFromTimeline(taskId); }}
                                                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-none transition"
                                                    title="إزالة من الجدول"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Description if space allows */}
                                        {item.duration >= 1.5 && task.description && (
                                            <p className="text-[9px] text-slate-400 mt-1 flex-1 overflow-hidden line-clamp-2">
                                                {task.description}
                                            </p>
                                        )}

                                        {/* Stage badge */}
                                        {item.duration >= 1 && (
                                            <div className="mt-auto pt-1 flex items-center gap-1">
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none ${colors.light} ${colors.text} border ${colors.border}`}>
                                                    {getStageLabel(task.stage)}
                                                </span>
                                                {task.isRecurring && (
                                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded-none bg-amber-50 text-amber-600 border border-amber-200">مستمر</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Resize handle */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center group/resize hover:bg-slate-200/50 transition"
                                        onMouseDown={(e) => handleResizeStart(e, taskId)}
                                        onTouchStart={(e) => handleResizeStart(e, taskId)}
                                    >
                                        <div className="w-8 h-1 rounded-full bg-slate-300 group-hover/resize:bg-indigo-400 transition"></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Mobile: Toggle sidebar FAB */}
            {isMobile && !sidebarOpen && (
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="fixed bottom-6 right-6 z-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95"
                >
                    <Target size={24} />
                </button>
            )}

            {/* Mobile: Overlay backdrop */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-10"
                    onClick={() => setSidebarOpen(false)}
                    style={{ top: '52px' }}
                ></div>
            )}
        </div>
    );
};

export default TimeBoxing;
