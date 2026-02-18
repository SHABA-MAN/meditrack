import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    query,
    orderBy
} from 'firebase/firestore';
import { logAchievement } from './utils/achievements';
import { useIsMobile } from './hooks/useIsMobile';
import {
    ArrowRight,
    Clock,
    GripVertical,
    CheckCircle,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Inbox,
    Target,
    Layers,
    BookOpen,
    PanelRightClose,
    PanelRightOpen
} from 'lucide-react';

const HOUR_HEIGHT = 64;
const HALF_HOUR_HEIGHT = HOUR_HEIGHT / 2;

const TimeBoxing = ({ onBack, user, db }) => {
    const appId = 'meditrack-v1';
    const isMobile = useIsMobile();

    // ---- State ----
    const [tasks, setTasks] = useState([]);
    const [lectures, setLectures] = useState({});
    const [subjects, setSubjects] = useState({});
    const [subjectConfig, setSubjectConfig] = useState({});
    const [scheduledItems, setScheduledItems] = useState({});
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const [loading, setLoading] = useState(true);
    const [dragOverHour, setDragOverHour] = useState(null);
    const [resizing, setResizing] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const [sidebarMode, setSidebarMode] = useState('tasks'); // 'tasks' | 'lectures'
    const [dropdownOpen, setDropdownOpen] = useState(false);

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

    // ---- Firebase: Load Tasks (LifeTrack goals) ----
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

    // ---- Firebase: Load Lectures (MediTrack) ----
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'), orderBy('subject'));
        const unsub = onSnapshot(q, (snap) => {
            const data = {};
            snap.forEach(d => { data[d.id] = { id: d.id, ...d.data() }; });
            setLectures(data);
        });
        return () => unsub();
    }, [user]);

    // ---- Firebase: Load Subjects Definitions & Config ----
    useEffect(() => {
        if (!user) return;
        const unsubDef = onSnapshot(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'),
            (snap) => { if (snap.exists()) setSubjects(snap.data()); }
        );
        const unsubCfg = onSnapshot(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'),
            (snap) => { if (snap.exists()) setSubjectConfig(snap.data()); }
        );
        return () => { unsubDef(); unsubCfg(); };
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

    // ---- Build Lecture List for Sidebar ----
    const getLectureList = () => {
        const list = [];
        Object.keys(subjectConfig).forEach(subj => {
            const total = parseInt(subjectConfig[subj]) || 0;
            for (let i = 1; i <= total; i++) {
                const id = `${subj}_${i}`;
                const lecture = lectures[id] || {};
                list.push({
                    id,
                    subject: subj,
                    number: i,
                    stage: lecture.stage !== undefined ? lecture.stage : 0,
                    title: lecture.title || '',
                    description: lecture.description || '',
                    difficulty: lecture.difficulty || 'normal',
                    isCompleted: lecture.isCompleted || false,
                    _type: 'lecture'
                });
            }
        });
        return list;
    };

    // ---- Drag & Drop from Pool ----
    const handlePoolDragStart = (e, item, type) => {
        e.dataTransfer.setData('taskId', item.id);
        e.dataTransfer.setData('source', 'pool');
        e.dataTransfer.setData('itemType', type); // 'task' or 'lecture'
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
        const itemType = e.dataTransfer.getData('itemType') || 'task';
        if (!taskId) return;

        const newItems = { ...scheduledItems };

        if (source === 'scheduled') {
            const existing = newItems[taskId];
            if (existing) {
                newItems[taskId] = { ...existing, startHour: hour };
            }
        } else {
            newItems[taskId] = { startHour: hour, duration: 1, completed: false, type: itemType };
        }

        setScheduledItems(newItems);
        savePlanToFirebase(newItems);
    };

    const handleScheduledDragStart = (e, taskId) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.setData('source', 'scheduled');
        e.dataTransfer.effectAllowed = 'move';
    };

    // ---- Resize ----
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

        if (newCompleted && user) {
            const itemData = findItemData(taskId, item.type);
            if (itemData) {
                await logAchievement(db, user.uid, item.type === 'lecture' ? 'study' : 'task', {
                    title: itemData.title || `Lec ${itemData.number}`,
                    stage: 'TimeBoxing',
                    ...(item.type === 'lecture' ? { subject: itemData.subject, number: itemData.number } : {})
                });
            }
        }
    };

    // ---- Lookup helper: find item data from either tasks or lectures ----
    const findItemData = (id, type) => {
        if (type === 'lecture') {
            return lectures[id] || getLectureList().find(l => l.id === id) || null;
        }
        return tasks.find(t => t.id === id) || null;
    };

    // ---- Computed ----
    const scheduledTaskIds = new Set(Object.keys(scheduledItems));
    const lectureList = getLectureList();
    const unscheduledTasks = tasks.filter(t => !scheduledTaskIds.has(t.id));
    const unscheduledLectures = lectureList.filter(l => !scheduledTaskIds.has(l.id));

    const currentList = sidebarMode === 'tasks' ? unscheduledTasks : unscheduledLectures;

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    const totalScheduled = Object.keys(scheduledItems).length;
    const completedCount = Object.values(scheduledItems).filter(i => i.completed).length;

    // ---- Colors ----
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

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClick = (e) => {
            if (!e.target.closest('.sidebar-dropdown')) setDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [dropdownOpen]);

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

    // ---- Render helper for a scheduled item on the timeline ----
    const renderScheduledItem = (taskId, item) => {
        const type = item.type || 'task';
        const data = findItemData(taskId, type);
        if (!data) return null;

        const isLecture = type === 'lecture';
        const top = item.startHour * HOUR_HEIGHT;
        const height = item.duration * HOUR_HEIGHT;

        let colorClasses;
        if (item.completed) {
            colorClasses = { light: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700' };
        } else if (isLecture) {
            const badge = subjects[data.subject]?.badge || 'bg-blue-600';
            colorClasses = { light: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge };
        } else {
            const sc = getStageColor(data.stage);
            colorClasses = { light: sc.light, border: sc.border, text: sc.text };
        }

        const title = isLecture
            ? `${data.title || `Lec ${data.number}`} — ${subjects[data.subject]?.name || data.subject}`
            : (data.title || 'بدون عنوان');

        return (
            <div
                key={taskId}
                draggable
                onDragStart={(e) => handleScheduledDragStart(e, taskId)}
                className={`absolute rounded-none shadow-md transition-shadow hover:shadow-lg cursor-grab active:cursor-grabbing ${item.completed ? 'opacity-60' : ''}`}
                style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    right: '84px',
                    left: '8px',
                    zIndex: resizing?.taskId === taskId ? 20 : 5
                }}
            >
                <div className={`h-full border-r-4 ${colorClasses.border} ${colorClasses.light} border rounded-none p-2 flex flex-col overflow-hidden`}>
                    <div className="flex items-start justify-between gap-1 flex-shrink-0">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                {isLecture && (
                                    <span className={`w-5 h-5 flex items-center justify-center text-[8px] font-bold text-white rounded-none flex-shrink-0 ${subjects[data.subject]?.badge || 'bg-blue-600'}`}>
                                        {data.subject}
                                    </span>
                                )}
                                <p className={`font-bold text-xs truncate ${item.completed ? 'line-through text-emerald-700' : 'text-slate-700'}`}>
                                    {title}
                                </p>
                            </div>
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

                    {item.duration >= 1.5 && (data.description || (isLecture && data.title)) && (
                        <p className="text-[9px] text-slate-400 mt-1 flex-1 overflow-hidden line-clamp-2">
                            {data.description || data.title}
                        </p>
                    )}

                    {item.duration >= 1 && (
                        <div className="mt-auto pt-1 flex items-center gap-1">
                            {isLecture ? (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-none bg-blue-50 text-blue-600 border border-blue-200">
                                    محاضرة {data.stage > 0 ? `• تكرار ${data.stage}` : '• جديدة'}
                                </span>
                            ) : (
                                <>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none ${getStageColor(data.stage).light} ${getStageColor(data.stage).text} border ${getStageColor(data.stage).border}`}>
                                        {getStageLabel(data.stage)}
                                    </span>
                                    {data.isRecurring && (
                                        <span className="text-[8px] font-bold px-1 py-0.5 rounded-none bg-amber-50 text-amber-600 border border-amber-200">مستمر</span>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div
                    className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center group/resize hover:bg-slate-200/50 transition"
                    onMouseDown={(e) => handleResizeStart(e, taskId)}
                    onTouchStart={(e) => handleResizeStart(e, taskId)}
                >
                    <div className="w-8 h-1 rounded-full bg-slate-300 group-hover/resize:bg-indigo-400 transition"></div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 text-slate-800 font-sans" dir="rtl">
            {/* ---- Header ---- */}
            <nav className="bg-white border-b border-gray-200 px-4 py-2.5 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition" title="رجوع">
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

                    <div className="flex items-center gap-2">
                        <div className="hidden md:flex items-center gap-2 text-[10px] font-bold">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-none">{totalScheduled} مجدول</span>
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-none">{completedCount} منجز</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition"
                            title={sidebarOpen ? 'إخفاء القائمة' : 'إظهار القائمة'}
                        >
                            {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ---- Main Content ---- */}
            <div className="max-w-[1600px] mx-auto flex h-[calc(100vh-52px)]">

                {/* ---- Sidebar ---- */}
                <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-l border-gray-200 bg-white flex-shrink-0 flex flex-col ${isMobile && sidebarOpen ? 'absolute inset-y-[52px] right-0 z-20 shadow-xl w-80' : ''}`}>
                    {/* Sidebar Header with Dropdown */}
                    <div className="p-3 border-b border-gray-100 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <div className="relative sidebar-dropdown">
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-none hover:border-indigo-300 transition text-sm font-bold text-slate-700"
                                >
                                    {sidebarMode === 'tasks' ? (
                                        <><Target size={14} className="text-indigo-500" /> الأهداف العادية</>
                                    ) : (
                                        <><BookOpen size={14} className="text-blue-500" /> أهداف المحاضرات</>
                                    )}
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-none z-30 w-48 overflow-hidden">
                                        <button
                                            onClick={() => { setSidebarMode('tasks'); setDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold transition ${sidebarMode === 'tasks' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-gray-50'}`}
                                        >
                                            <Target size={14} /> الأهداف العادية
                                            <span className="mr-auto bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-none">{unscheduledTasks.length}</span>
                                        </button>
                                        <button
                                            onClick={() => { setSidebarMode('lectures'); setDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold transition border-t border-slate-100 ${sidebarMode === 'lectures' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-gray-50'}`}
                                        >
                                            <BookOpen size={14} /> أهداف المحاضرات
                                            <span className="mr-auto bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-none">{unscheduledLectures.length}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-none">{currentList.length}</span>
                                {isMobile && (
                                    <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Content */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                        {currentList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-300">
                                <Inbox size={32} className="mb-3 opacity-50" />
                                <p className="text-xs font-medium">
                                    {sidebarMode === 'tasks' ? 'كل الأهداف مجدولة!' : 'كل المحاضرات مجدولة!'}
                                </p>
                            </div>
                        ) : (
                            currentList.map(item => {
                                const isLecture = sidebarMode === 'lectures';

                                if (isLecture) {
                                    // Lecture card
                                    const subj = subjects[item.subject];
                                    return (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => handlePoolDragStart(e, item, 'lecture')}
                                            className="bg-white p-2.5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing rounded-none group"
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className={`w-7 h-7 rounded-none flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 ${subj?.badge || 'bg-blue-600'}`}>
                                                    {item.subject}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-700 text-xs truncate">
                                                        {item.title || `Lecture ${item.number}`}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className="text-[9px] text-blue-600 font-bold">{subj?.name || item.subject}</span>
                                                        <span className="text-slate-300 text-[8px]">•</span>
                                                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-none bg-blue-50 text-blue-600 border border-blue-200">
                                                            {item.stage > 0 ? `تكرار ${item.stage}` : 'جديدة'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <GripVertical size={14} className="text-slate-200 group-hover:text-slate-400 transition flex-shrink-0 mt-1" />
                                            </div>
                                        </div>
                                    );
                                } else {
                                    // Task card (existing)
                                    const colors = getStageColor(item.stage);
                                    return (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => handlePoolDragStart(e, item, 'task')}
                                            className="bg-white p-2.5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing rounded-none group"
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className={`w-1 h-8 rounded-none mt-0.5 flex-shrink-0 ${colors.bg}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-700 text-xs truncate">{item.title || 'بدون عنوان'}</p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none ${colors.light} ${colors.text} ${colors.border} border`}>
                                                            {getStageLabel(item.stage)}
                                                        </span>
                                                        {item.isRecurring && (
                                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded-none bg-amber-50 text-amber-600 border border-amber-200">مستمر</span>
                                                        )}
                                                    </div>
                                                    {item.description && (
                                                        <p className="text-[9px] text-slate-400 mt-1 truncate">{item.description}</p>
                                                    )}
                                                </div>
                                                <GripVertical size={14} className="text-slate-200 group-hover:text-slate-400 transition flex-shrink-0 mt-1" />
                                            </div>
                                        </div>
                                    );
                                }
                            })
                        )}
                    </div>
                </div>

                {/* ---- Timeline: 24h Grid ---- */}
                <div className="flex-1 overflow-y-auto custom-scrollbar" ref={timelineRef}>
                    <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>

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

                        {Array.from({ length: 24 }, (_, hour) => (
                            <div
                                key={hour}
                                className={`absolute w-full border-b border-gray-100 flex transition-colors ${dragOverHour === hour ? 'bg-indigo-50' : 'hover:bg-gray-50/50'}`}
                                style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                                onDragOver={(e) => handleTimelineDragOver(e, hour)}
                                onDragLeave={handleTimelineDragLeave}
                                onDrop={(e) => handleTimelineDrop(e, hour)}
                            >
                                <div className="w-20 flex-shrink-0 px-3 py-2 text-[10px] font-bold text-slate-400 border-l border-gray-100 select-none">
                                    {formatHour(hour)}
                                </div>
                                <div className="flex-1 relative">
                                    {dragOverHour === hour && (
                                        <div className="absolute inset-0 border-2 border-dashed border-indigo-300 rounded-none m-1 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-indigo-400">أفلت هنا</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {Object.entries(scheduledItems).map(([taskId, item]) => renderScheduledItem(taskId, item))}
                    </div>
                </div>
            </div>

            {/* Mobile: FAB */}
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
