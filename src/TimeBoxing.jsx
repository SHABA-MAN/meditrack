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
    BookOpen,
    PanelRightClose,
    PanelRightOpen,
    Trash2
} from 'lucide-react';

// ---- SVG Geometry Helpers ----
const DEG = Math.PI / 180;
const CX = 250, CY = 250; // clock center
const CLOCK_R = 210; // outer radius
const INNER_R = 100; // inner radius (donut hole)
const LABEL_R = 230; // where hour numbers sit

function polarToXY(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * DEG; // -90 so 0° = top
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, outerR, innerR, startAngle, endAngle) {
    // Donut arc path
    const spread = endAngle - startAngle;
    const largeArc = spread > 180 ? 1 : 0;

    const outerStart = polarToXY(cx, cy, outerR, startAngle);
    const outerEnd = polarToXY(cx, cy, outerR, endAngle);
    const innerStart = polarToXY(cx, cy, innerR, endAngle);
    const innerEnd = polarToXY(cx, cy, innerR, startAngle);

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
        'Z'
    ].join(' ');
}

function hourToAngle(hour) {
    return (hour / 24) * 360;
}

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
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const [sidebarMode, setSidebarMode] = useState('tasks');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);

    const svgRef = useRef(null);

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
        if (hour === 0) return '12 AM';
        if (hour < 12) return `${hour} AM`;
        if (hour === 12) return '12 PM';
        return `${hour - 12} PM`;
    };

    // ---- Firebase: Load Tasks ----
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

    // ---- Firebase: Load Lectures ----
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

    // ---- Firebase: Load Subjects ----
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

    // ---- Firebase: Daily Plan ----
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
            await setDoc(ref, { items: newItems, date: selectedDate, updatedAt: new Date().toISOString() });
        } catch (e) {
            console.error('Failed to save plan:', e);
        }
    }, [user, selectedDate, db]);

    // ---- Lecture List Builder ----
    const getLectureList = () => {
        const list = [];
        Object.keys(subjectConfig).forEach(subj => {
            const total = parseInt(subjectConfig[subj]) || 0;
            for (let i = 1; i <= total; i++) {
                const id = `${subj}_${i}`;
                const lecture = lectures[id] || {};
                list.push({
                    id, subject: subj, number: i,
                    stage: lecture.stage !== undefined ? lecture.stage : 0,
                    title: lecture.title || '', description: lecture.description || '',
                    difficulty: lecture.difficulty || 'normal',
                    isCompleted: lecture.isCompleted || false, _type: 'lecture'
                });
            }
        });
        return list;
    };

    // ---- Drag & Drop ----
    const handlePoolDragStart = (e, item, type) => {
        e.dataTransfer.setData('taskId', item.id);
        e.dataTransfer.setData('source', 'pool');
        e.dataTransfer.setData('itemType', type);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleSliceDragOver = (e, hour) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverHour(hour);
    };

    const handleSliceDragLeave = () => {
        setDragOverHour(null);
    };

    const handleSliceDrop = (e, hour) => {
        e.preventDefault();
        setDragOverHour(null);
        const taskId = e.dataTransfer.getData('taskId');
        const source = e.dataTransfer.getData('source');
        const itemType = e.dataTransfer.getData('itemType') || 'task';
        if (!taskId) return;

        const newItems = { ...scheduledItems };
        if (source === 'scheduled') {
            const existing = newItems[taskId];
            if (existing) newItems[taskId] = { ...existing, startHour: hour };
        } else {
            newItems[taskId] = { startHour: hour, duration: 1, completed: false, type: itemType };
        }
        setScheduledItems(newItems);
        savePlanToFirebase(newItems);
    };

    const handleScheduledArcDragStart = (e, taskId) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.setData('source', 'scheduled');
        e.dataTransfer.effectAllowed = 'move';
    };

    // ---- Actions ----
    const removeFromTimeline = (taskId) => {
        const newItems = { ...scheduledItems };
        delete newItems[taskId];
        setScheduledItems(newItems);
        savePlanToFirebase(newItems);
        if (selectedTaskId === taskId) setSelectedTaskId(null);
    };

    const toggleComplete = async (taskId) => {
        const item = scheduledItems[taskId];
        if (!item) return;
        const newCompleted = !item.completed;
        const newItems = { ...scheduledItems, [taskId]: { ...item, completed: newCompleted } };
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

    const changeDuration = (taskId, delta) => {
        const item = scheduledItems[taskId];
        if (!item) return;
        const newDuration = Math.max(0.5, Math.min(item.duration + delta, 24 - item.startHour));
        const newItems = { ...scheduledItems, [taskId]: { ...item, duration: newDuration } };
        setScheduledItems(newItems);
        savePlanToFirebase(newItems);
    };

    // ---- Lookup ----
    const findItemData = (id, type) => {
        if (type === 'lecture') return lectures[id] || getLectureList().find(l => l.id === id) || null;
        return tasks.find(t => t.id === id) || null;
    };

    // ---- Computed ----
    const scheduledTaskIds = new Set(Object.keys(scheduledItems));
    const lectureList = getLectureList();
    const unscheduledTasks = tasks.filter(t => !scheduledTaskIds.has(t.id));
    const unscheduledLectures = lectureList.filter(l => !scheduledTaskIds.has(l.id));
    const currentList = sidebarMode === 'tasks' ? unscheduledTasks : unscheduledLectures;

    const now = new Date();
    const currentHourDecimal = now.getHours() + now.getMinutes() / 60;
    const totalScheduled = Object.keys(scheduledItems).length;
    const completedCount = Object.values(scheduledItems).filter(i => i.completed).length;

    // ---- Colors ----
    const TASK_COLORS = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
        '#a855f7', '#d946ef'
    ];

    const getItemColor = (taskId, item) => {
        if (item.completed) return '#10b981';
        if (item.type === 'lecture') {
            const data = findItemData(taskId, 'lecture');
            const badge = subjects[data?.subject]?.badge;
            // Map Tailwind badge class to hex
            const map = {
                'bg-indigo-600': '#4f46e5', 'bg-emerald-600': '#059669', 'bg-rose-600': '#e11d48',
                'bg-blue-600': '#2563eb', 'bg-amber-600': '#d97706', 'bg-purple-600': '#9333ea',
                'bg-cyan-600': '#0891b2', 'bg-pink-600': '#db2777', 'bg-slate-600': '#475569',
                'bg-orange-600': '#ea580c', 'bg-teal-600': '#0d9488',
            };
            return map[badge] || '#3b82f6';
        }
        // Hash the taskId for consistent color
        let hash = 0;
        for (let i = 0; i < taskId.length; i++) hash = taskId.charCodeAt(i) + ((hash << 5) - hash);
        return TASK_COLORS[Math.abs(hash) % TASK_COLORS.length];
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

    const getStageColor = (stage) => {
        switch (stage) {
            case 'do_first': return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' };
            case 'schedule': return { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' };
            case 'delegate': return { bg: 'bg-gray-500', text: 'text-gray-600', light: 'bg-gray-50', border: 'border-gray-200' };
            default: return { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50', border: 'border-slate-200' };
        }
    };

    // Close dropdown
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

    // ---- Render: Clock Face ----
    const renderClock = () => {
        const currentAngle = hourToAngle(currentHourDecimal);
        const handPt = polarToXY(CX, CY, CLOCK_R - 15, currentAngle);

        return (
            <svg
                ref={svgRef}
                viewBox="0 0 500 500"
                className="w-full max-w-[500px] mx-auto select-none"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))' }}
            >
                {/* Background circle */}
                <circle cx={CX} cy={CY} r={CLOCK_R} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
                <circle cx={CX} cy={CY} r={INNER_R} fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />

                {/* Hour grid lines + labels */}
                {Array.from({ length: 24 }, (_, h) => {
                    const angle = hourToAngle(h);
                    const outerPt = polarToXY(CX, CY, CLOCK_R, angle);
                    const innerPt = polarToXY(CX, CY, INNER_R, angle);
                    const labelPt = polarToXY(CX, CY, LABEL_R, angle);
                    const isMajor = h % 3 === 0;

                    return (
                        <g key={`label-${h}`}>
                            <line
                                x1={innerPt.x} y1={innerPt.y}
                                x2={outerPt.x} y2={outerPt.y}
                                stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
                                strokeWidth={isMajor ? 1.5 : 0.5}
                            />
                            {isMajor && (
                                <text
                                    x={labelPt.x} y={labelPt.y}
                                    textAnchor="middle" dominantBaseline="central"
                                    fontSize="11" fontWeight="700" fill="#64748b"
                                >
                                    {h === 0 ? '0' : h}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Drop zone slices (invisible, but interactive) */}
                {Array.from({ length: 24 }, (_, h) => {
                    const startA = hourToAngle(h);
                    const endA = hourToAngle(h + 1);
                    const d = describeArc(CX, CY, CLOCK_R, INNER_R, startA, endA);
                    const isOver = dragOverHour === h;

                    return (
                        <path
                            key={`drop-${h}`}
                            d={d}
                            fill={isOver ? 'rgba(99,102,241,0.2)' : 'transparent'}
                            stroke={isOver ? '#6366f1' : 'none'}
                            strokeWidth={isOver ? 2 : 0}
                            style={{ cursor: 'pointer' }}
                            onDragOver={(e) => handleSliceDragOver(e, h)}
                            onDragLeave={handleSliceDragLeave}
                            onDrop={(e) => handleSliceDrop(e, h)}
                            onClick={() => {
                                // If a task is dragging or nothing, do nothing on empty click
                            }}
                        />
                    );
                })}

                {/* Scheduled task arcs */}
                {Object.entries(scheduledItems).map(([taskId, item]) => {
                    const data = findItemData(taskId, item.type);
                    if (!data) return null;

                    const startA = hourToAngle(item.startHour) + 0.5;
                    const endA = hourToAngle(item.startHour + item.duration) - 0.5;
                    if (endA <= startA) return null;

                    const color = getItemColor(taskId, item);
                    const isSelected = selectedTaskId === taskId;
                    const arcD = describeArc(CX, CY, CLOCK_R - 4, INNER_R + 4, startA, endA);

                    // Label position (midpoint of arc)
                    const midAngle = (startA + endA) / 2;
                    const labelPos = polarToXY(CX, CY, (CLOCK_R + INNER_R) / 2, midAngle);
                    const arcSpan = endA - startA;

                    return (
                        <g key={`arc-${taskId}`}
                            draggable="true"
                            onDragStart={(e) => handleScheduledArcDragStart(e, taskId)}
                            onClick={() => setSelectedTaskId(isSelected ? null : taskId)}
                            style={{ cursor: 'grab' }}
                        >
                            <path
                                d={arcD}
                                fill={color}
                                opacity={item.completed ? 0.45 : 0.85}
                                stroke={isSelected ? '#1e293b' : '#ffffff'}
                                strokeWidth={isSelected ? 3 : 1.5}
                                rx="4"
                                style={{ transition: 'opacity 0.2s, stroke 0.2s' }}
                            />
                            {/* Label inside the arc if it's wide enough */}
                            {arcSpan > 12 && (
                                <text
                                    x={labelPos.x} y={labelPos.y}
                                    textAnchor="middle" dominantBaseline="central"
                                    fontSize={arcSpan > 25 ? 10 : 8}
                                    fontWeight="700"
                                    fill="#ffffff"
                                    style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                                >
                                    {item.type === 'lecture'
                                        ? (data.title || `L${data.number}`)
                                        : (data.title?.slice(0, 12) || '—')}
                                </text>
                            )}
                            {item.completed && arcSpan > 15 && (
                                <text
                                    x={labelPos.x} y={labelPos.y + 13}
                                    textAnchor="middle" dominantBaseline="central"
                                    fontSize="12" fill="#ffffff"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    ✓
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Current time hand */}
                {isToday(selectedDate) && (
                    <g>
                        <line
                            x1={CX} y1={CY}
                            x2={handPt.x} y2={handPt.y}
                            stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"
                        />
                        <circle cx={CX} cy={CY} r="5" fill="#ef4444" />
                        <circle cx={handPt.x} cy={handPt.y} r="4" fill="#ef4444" />
                    </g>
                )}

                {/* Center text */}
                <text x={CX} y={CY - 8} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill="#1e293b">
                    {isToday(selectedDate) ? `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` : formatDateArabic(selectedDate).split('،')[0]}
                </text>
                <text x={CX} y={CY + 12} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="600" fill="#94a3b8">
                    {totalScheduled} مجدول • {completedCount} ✓
                </text>
            </svg>
        );
    };

    // ---- Render: Scheduled Items list (below clock) ----
    const renderScheduledList = () => {
        const entries = Object.entries(scheduledItems);
        if (entries.length === 0) return null;

        // Sort by start hour
        const sorted = [...entries].sort((a, b) => a[1].startHour - b[1].startHour);

        return (
            <div className="mt-3 space-y-1.5 max-h-[240px] overflow-y-auto custom-scrollbar px-2">
                {sorted.map(([taskId, item]) => {
                    const data = findItemData(taskId, item.type);
                    if (!data) return null;
                    const color = getItemColor(taskId, item);
                    const isSelected = selectedTaskId === taskId;
                    const isLecture = item.type === 'lecture';
                    const title = isLecture
                        ? `${data.title || `Lec ${data.number}`} — ${subjects[data.subject]?.name || data.subject}`
                        : (data.title || 'بدون عنوان');

                    return (
                        <div
                            key={taskId}
                            onClick={() => setSelectedTaskId(isSelected ? null : taskId)}
                            className={`flex items-center gap-2 p-2 rounded-none border transition-all cursor-pointer ${isSelected ? 'border-slate-400 bg-slate-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                        >
                            {/* Color dot */}
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${item.completed ? 'line-through text-emerald-600' : 'text-slate-700'}`}>
                                    {title}
                                </p>
                                <p className="text-[9px] text-slate-400">{formatHour(item.startHour)} — {formatHour(item.startHour + item.duration)} ({item.duration}h)</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                {/* Duration controls */}
                                <button onClick={(e) => { e.stopPropagation(); changeDuration(taskId, -0.5); }}
                                    className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-none text-xs font-bold transition">−</button>
                                <span className="text-[9px] font-bold text-slate-500 w-5 text-center">{item.duration}h</span>
                                <button onClick={(e) => { e.stopPropagation(); changeDuration(taskId, 0.5); }}
                                    className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-none text-xs font-bold transition">+</button>

                                <button onClick={(e) => { e.stopPropagation(); toggleComplete(taskId); }}
                                    className={`p-1 rounded-none transition ${item.completed ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 hover:text-emerald-500'}`}
                                    title={item.completed ? 'إلغاء' : 'إنجاز'}>
                                    <CheckCircle size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); removeFromTimeline(taskId); }}
                                    className="p-1 text-slate-300 hover:text-red-500 rounded-none transition" title="إزالة">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 text-slate-800 font-sans" dir="rtl">
            {/* ---- Header ---- */}
            <nav className="bg-white border-b border-gray-200 px-4 py-2.5 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition" title="رجوع">
                            <ArrowRight size={18} />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="bg-indigo-600 text-white p-1.5 rounded-none"><Clock size={16} /></div>
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
                        <button onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition"
                            title={sidebarOpen ? 'إخفاء القائمة' : 'إظهار القائمة'}>
                            {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ---- Main ---- */}
            <div className="max-w-[1400px] mx-auto flex h-[calc(100vh-52px)]">

                {/* ---- Sidebar ---- */}
                <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-l border-gray-200 bg-white flex-shrink-0 flex flex-col ${isMobile && sidebarOpen ? 'absolute inset-y-[52px] right-0 z-20 shadow-xl w-80' : ''}`}>
                    <div className="p-3 border-b border-gray-100 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <div className="relative sidebar-dropdown">
                                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-none hover:border-indigo-300 transition text-sm font-bold text-slate-700">
                                    {sidebarMode === 'tasks' ? (
                                        <><Target size={14} className="text-indigo-500" /> الأهداف العادية</>
                                    ) : (
                                        <><BookOpen size={14} className="text-blue-500" /> أهداف المحاضرات</>
                                    )}
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {dropdownOpen && (
                                    <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-none z-30 w-48 overflow-hidden">
                                        <button onClick={() => { setSidebarMode('tasks'); setDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold transition ${sidebarMode === 'tasks' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-gray-50'}`}>
                                            <Target size={14} /> الأهداف العادية
                                            <span className="mr-auto bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-none">{unscheduledTasks.length}</span>
                                        </button>
                                        <button onClick={() => { setSidebarMode('lectures'); setDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold transition border-t border-slate-100 ${sidebarMode === 'lectures' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-gray-50'}`}>
                                            <BookOpen size={14} /> أهداف المحاضرات
                                            <span className="mr-auto bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-none">{unscheduledLectures.length}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-none">{currentList.length}</span>
                                {isMobile && <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                        {currentList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-300">
                                <Inbox size={32} className="mb-3 opacity-50" />
                                <p className="text-xs font-medium">{sidebarMode === 'tasks' ? 'كل الأهداف مجدولة!' : 'كل المحاضرات مجدولة!'}</p>
                            </div>
                        ) : (
                            currentList.map(item => {
                                const isLecture = sidebarMode === 'lectures';
                                if (isLecture) {
                                    const subj = subjects[item.subject];
                                    return (
                                        <div key={item.id} draggable onDragStart={(e) => handlePoolDragStart(e, item, 'lecture')}
                                            className="bg-white p-2.5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing rounded-none group">
                                            <div className="flex items-start gap-2">
                                                <div className={`w-7 h-7 rounded-none flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 ${subj?.badge || 'bg-blue-600'}`}>{item.subject}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-700 text-xs truncate">{item.title || `Lecture ${item.number}`}</p>
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
                                    const colors = getStageColor(item.stage);
                                    return (
                                        <div key={item.id} draggable onDragStart={(e) => handlePoolDragStart(e, item, 'task')}
                                            className="bg-white p-2.5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing rounded-none group">
                                            <div className="flex items-start gap-2">
                                                <div className={`w-1 h-8 rounded-none mt-0.5 flex-shrink-0 ${colors.bg}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-700 text-xs truncate">{item.title || 'بدون عنوان'}</p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none ${colors.light} ${colors.text} ${colors.border} border`}>{getStageLabel(item.stage)}</span>
                                                        {item.isRecurring && <span className="text-[8px] font-bold px-1 py-0.5 rounded-none bg-amber-50 text-amber-600 border border-amber-200">مستمر</span>}
                                                    </div>
                                                    {item.description && <p className="text-[9px] text-slate-400 mt-1 truncate">{item.description}</p>}
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

                {/* ---- Clock Area ---- */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-4 md:p-6 flex flex-col items-center">
                        {/* Clock */}
                        <div className="w-full max-w-[500px]">
                            {renderClock()}
                        </div>

                        {/* Scheduled items list */}
                        <div className="w-full max-w-[560px]">
                            {renderScheduledList()}
                            {totalScheduled === 0 && (
                                <div className="text-center text-slate-300 mt-6">
                                    <Clock size={36} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-xs font-medium">اسحب الأهداف من القائمة إلى الساعة</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile FAB */}
            {isMobile && !sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)}
                    className="fixed bottom-6 right-6 z-20 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95">
                    <Target size={24} />
                </button>
            )}

            {/* Mobile overlay */}
            {isMobile && sidebarOpen && (
                <div className="fixed inset-0 bg-black/30 z-10" onClick={() => setSidebarOpen(false)} style={{ top: '52px' }}></div>
            )}
        </div>
    );
};

export default TimeBoxing;
