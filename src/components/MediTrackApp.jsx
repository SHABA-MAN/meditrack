import React, { useState, useEffect } from 'react';
import FocusModeOverlay from './FocusModeOverlay';
import EditTaskModal from './EditTaskModal';
import { logAchievement } from '../utils/achievements';
import { useIsMobile } from '../hooks/useIsMobile';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, onSnapshot, writeBatch, deleteDoc, query, orderBy } from 'firebase/firestore';
import { auth, db, appId } from '../firebase';
import {
    CheckCircle, BrainCircuit, Settings, BookOpen, Save, FastForward, Info, Trash2, AlertTriangle, X,
    LogIn, LogOut, User, Plus, Minus, LayoutList, GripHorizontal, Maximize2, Layers, Zap, Coffee,
    Edit2, Flag, History, Play, Calendar, CheckSquare
} from 'lucide-react';

// --- Constants ---
const THEMES = {
    indigo: { name: 'نيلي', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', badge: 'bg-indigo-600', darkBadge: 'bg-indigo-500' },
    emerald: { name: 'زمردي', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', badge: 'bg-emerald-600', darkBadge: 'bg-emerald-500' },
    rose: { name: 'وردي', color: 'bg-rose-100 text-rose-800 border-rose-200', badge: 'bg-rose-600', darkBadge: 'bg-rose-500' },
    blue: { name: 'أزرق', color: 'bg-blue-100 text-blue-800 border-blue-200', badge: 'bg-blue-600', darkBadge: 'bg-blue-500' },
    amber: { name: 'كهرماني', color: 'bg-amber-100 text-amber-800 border-amber-200', badge: 'bg-amber-600', darkBadge: 'bg-amber-500' },
    purple: { name: 'بنفسجي', color: 'bg-purple-100 text-purple-800 border-purple-200', badge: 'bg-purple-600', darkBadge: 'bg-purple-500' },
    cyan: { name: 'سماوي', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', badge: 'bg-cyan-600', darkBadge: 'bg-cyan-500' },
    pink: { name: 'زهري', color: 'bg-pink-100 text-pink-800 border-pink-200', badge: 'bg-pink-600', darkBadge: 'bg-pink-500' },
    slate: { name: 'رمادي', color: 'bg-slate-100 text-slate-800 border-slate-200', badge: 'bg-slate-600', darkBadge: 'bg-slate-500' },
    orange: { name: 'برتقالي', color: 'bg-orange-100 text-orange-800 border-orange-200', badge: 'bg-orange-600', darkBadge: 'bg-orange-500' },
    teal: { name: 'فيروزي', color: 'bg-teal-100 text-teal-800 border-teal-200', badge: 'bg-teal-600', darkBadge: 'bg-teal-500' },
};

const DEFAULT_SUBJECTS = {
    TSF: { name: 'TSF', theme: 'indigo', ...THEMES.indigo },
    CBG: { name: 'CBG', theme: 'emerald', ...THEMES.emerald },
    BIO: { name: 'BIO', theme: 'rose', ...THEMES.rose },
    ANA: { name: 'ANA', theme: 'blue', ...THEMES.blue },
    PMD: { name: 'PMD', theme: 'amber', ...THEMES.amber }
};

const INTERVALS = [1, 2, 4, 7];

const MediTrackApp = ({ onSwitchToLifeTrack, user }) => {
    const [loading, setLoading] = useState(false);
    const [authError, setAuthError] = useState(null);

    const isMobile = useIsMobile();

    // Data State
    const [config, setConfig] = useState(null);
    const [lectures, setLectures] = useState({});
    const [history, setHistory] = useState([]);

    // Focus Mode State
    const [focusQueue, setFocusQueue] = useState([]);
    const [isFocusModeActive, setIsFocusModeActive] = useState(false);
    const [isFocusAnimating, setIsFocusAnimating] = useState(false);
    const [isFreeFocus, setIsFreeFocus] = useState(false);

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('config');
    const [tempConfig, setTempConfig] = useState({});
    const [selectedManageSubject, setSelectedManageSubject] = useState('ANA');

    const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
    const SUBJECTS = subjects;
    const [newSubject, setNewSubject] = useState({ code: '', name: '', theme: 'blue' });
    const [editingSubjectCode, setEditingSubjectCode] = useState(null);

    const [editingTask, setEditingTask] = useState(null);

    const handleGoogleLogin = async () => {
        setAuthError(null);
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error(err);
            setAuthError("فشل الدخول بجوجل: " + err.message);
        }
    };

    const handleGuestLogin = async () => {
        setAuthError(null);
        try {
            await signInAnonymously(auth);
        } catch (err) {
            console.error(err);
            setAuthError("فشل الدخول كزائر.");
        }
    };

    const handleLogout = async () => {
        if (confirm("هل تريد تسجيل الخروج؟")) {
            await signOut(auth);
            setConfig(null);
            setLectures({});
            setHistory([]);
        }
    };

    useEffect(() => {
        if (!user) return;
        const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig(data);
                setTempConfig(data);
            } else {
                setShowSettings(true);
                setSettingsTab('guide');
            }
        });

        const unsubLectures = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'), (snap) => {
            const data = {};
            snap.forEach(d => data[d.id] = d.data());
            setLectures(data);
        });

        const qHistory = query(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), orderBy('completedAt', 'desc'));
        const unsubHistory = onSnapshot(qHistory, (snap) => {
            const logs = [];
            snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
            setHistory(logs);
        });

        const unsubDefs = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), (snap) => {
            if (snap.exists()) {
                setSubjects(snap.data());
            }
        });

        return () => { unsubConfig(); unsubLectures(); unsubHistory(); unsubDefs(); };
    }, [user]);

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        if (!user) return;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), tempConfig);
        alert("تم حفظ الإعدادات ✅");
        setShowSettings(false);
    };

    const handleSaveTaskDetails = async (e) => {
        e.preventDefault();
        if (!user || !editingTask) return;
        const data = {
            id: editingTask.id,
            subject: editingTask.subject,
            number: editingTask.number,
            title: editingTask.title || '',
            description: editingTask.description || '',
            difficulty: editingTask.difficulty || 'normal',
            stage: editingTask.stage !== undefined ? editingTask.stage : 0,
            nextReview: editingTask.nextReview !== undefined ? editingTask.nextReview : null
        };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', editingTask.id), data, { merge: true });
        setEditingTask(null);
    };

    const resetSubjectProgress = async (subjCode) => {
        if (!confirm(`تحذير: هل أنت متأكد من تصفير مادة ${subjCode}؟`)) return;
        const batch = writeBatch(db);
        let count = 0;
        Object.values(lectures).forEach(l => {
            if (l.subject === subjCode) {
                batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', l.id));
                count++;
            }
        });
        if (count > 0) await batch.commit();
        alert(`تم تصفير ${count} محاضرة.`);
    };

    const markFirstFiveAsStudied = async () => {
        if (!user || !window.confirm("تأكيد: وضع أول 5 محاضرات في المراجعة اليوم؟")) return;
        const batch = writeBatch(db);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dueToday = new Date();
        Object.keys(SUBJECTS).forEach(subj => {
            for (let i = 1; i <= 5; i++) {
                const id = `${subj}_${i}`;
                if (!lectures[id] || lectures[id].stage < 1) {
                    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', id);
                    batch.set(ref, {
                        id, subject: subj, number: i, stage: 1, lastStudied: yesterday.toISOString(), nextReview: dueToday.toISOString(), isCompleted: false
                    });
                }
            }
        });
        await batch.commit();
        alert("تم التنفيذ بنجاح.");
        setShowSettings(false);
    };

    const saveSessionToCloud = async (isFree, queue) => {
        if (!user) return;
        try {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current');
            await setDoc(ref, {
                type: 'meditrack',
                startTime: new Date().toISOString(),
                isFree,
                queue: queue || []
            });
        } catch (e) {
            console.error("Failed to save session", e);
        }
    };

    const deleteSessionFromCloud = async () => {
        if (!user) return;
        try {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current');
            await deleteDoc(ref);
        } catch (e) {
            console.error("Failed to delete session", e);
        }
    };

    useEffect(() => {
        if (!user) return;
        const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'current');
        const unsubSession = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.type === 'meditrack') {
                    setIsFocusModeActive(true);
                    setIsFreeFocus(data.isFree);
                    setFocusQueue(prev => {
                        const newQ = data.queue || [];
                        if (JSON.stringify(prev) !== JSON.stringify(newQ)) return newQ;
                        return prev;
                    });
                    setTimeout(() => setIsFocusAnimating(true), 50);
                }
            }
        }, (error) => {
            console.error("Session sync error:", error);
        });
        return () => unsubSession();
    }, [user?.uid]);

    const startFocusSession = () => {
        if (focusQueue.length === 0) return;
        setIsFreeFocus(false);
        setIsFocusModeActive(true);
        setTimeout(() => setIsFocusAnimating(true), 50);
        saveSessionToCloud(false, focusQueue);
    };

    const startFreeFocus = () => {
        setIsFreeFocus(true);
        setIsFocusModeActive(true);
        setTimeout(() => setIsFocusAnimating(true), 50);
        saveSessionToCloud(true, []);
    };

    const closeFocusMode = () => {
        setIsFocusAnimating(false);
        setTimeout(() => {
            setIsFocusModeActive(false);
            setIsFreeFocus(false);
            setFocusQueue([]);
            deleteSessionFromCloud();
        }, 500);
    };

    const completeTask = async (task) => {
        if (!user) return;
        const today = new Date();
        let nextStage = task.stage + 1;
        let nextDate = new Date();
        let isCompleted = false;
        if (task.stage < INTERVALS.length) {
            const interval = INTERVALS[task.stage];
            nextDate.setDate(nextDate.getDate() + interval);
        } else {
            isCompleted = true;
        }
        const data = {
            id: task.id, subject: task.subject, number: task.number, stage: nextStage, lastStudied: today.toISOString(), nextReview: isCompleted ? 'COMPLETED' : nextDate.toISOString(), isCompleted
        };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', task.id), data, { merge: true });
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), {
            taskId: task.id,
            subject: task.subject,
            number: task.number,
            title: task.title || '',
            completedAt: today.toISOString(),
            stageCompleted: task.stage
        });
        await logAchievement(db, user.uid, 'study', {
            subject: task.subject,
            number: task.number,
            title: task.title || '',
            stageCompleted: task.stage
        });
        const newQueue = focusQueue.filter(t => t.id !== task.id);
        setFocusQueue(newQueue);
        saveSessionToCloud(false, newQueue);
        if (newQueue.length === 0) {
            closeFocusMode();
        }
    };

    const manualStageUpdate = async (subject, number, newStage) => {
        if (!user) return;
        const lectureId = `${subject}_${number}`;
        const today = new Date();
        let nextDate = new Date();
        let isCompleted = false;
        let nextReviewVal = '';
        if (newStage === 0) {
            const data = { stage: 0, lastStudied: null, nextReview: null, isCompleted: false };
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data, { merge: true });
            return;
        }
        if (newStage > INTERVALS.length) {
            isCompleted = true; nextReviewVal = 'COMPLETED';
        } else {
            const interval = INTERVALS[newStage - 1] || 7;
            nextDate.setDate(nextDate.getDate() + interval);
            nextReviewVal = nextDate.toISOString();
        }
        const data = { id: lectureId, subject, number, stage: newStage, lastStudied: today.toISOString(), nextReview: nextReviewVal, isCompleted };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId), data, { merge: true });
    };

    const handleDragStart = (e, task) => {
        e.dataTransfer.setData("task", JSON.stringify(task));
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const taskData = e.dataTransfer.getData("task");
        if (taskData) {
            try {
                const task = JSON.parse(taskData);
                if (focusQueue.find(t => t.id === task.id)) return;
                setFocusQueue([...focusQueue, task]);
            } catch (err) {
                console.error("Invalid drag data", err);
            }
        }
    };

    const removeFromQueue = (taskId) => {
        setFocusQueue(focusQueue.filter(t => t.id !== taskId));
    };

    const addToQueue = (task) => {
        if (focusQueue.find(t => t.id === task.id)) return;
        setFocusQueue([...focusQueue, task]);
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (!newSubject.code || !newSubject.name) return alert("يرجى ملء الكود والاسم");
        const code = newSubject.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Check for duplicates only if we are NOT editing (or if we are renaming the code, which is disabled atm)
        if (!editingSubjectCode && subjects[code]) return alert("هذا الكود موجود بالفعل!");

        const theme = THEMES[newSubject.theme];
        const newData = { ...subjects, [code]: { name: newSubject.name, theme: newSubject.theme, ...theme } };

        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);

        if (!config || config[code] === undefined) {
            // Only init config if it's a new subject
            if (!editingSubjectCode) {
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), { ...config, [code]: 0 }, { merge: true });
            }
        }
        setNewSubject({ code: '', name: '', theme: 'blue' });
        setEditingSubjectCode(null);
        alert(editingSubjectCode ? "تم تعديل المادة بنجاح ✅" : "تم إضافة المادة بنجاح ✅");
    };

    const handleEditSubject = (code) => {
        const subj = subjects[code];
        setNewSubject({ code: code, name: subj.name, theme: subj.theme || 'blue' });
        setEditingSubjectCode(code);
    };

    const cancelEditSubject = () => {
        setNewSubject({ code: '', name: '', theme: 'blue' });
        setEditingSubjectCode(null);
    };

    const deleteSubject = async (code) => {
        if (!confirm(`هل أنت متأكد من حذف مادة ${code}؟ لن يتم حذف المحاضرات القديمة ولكن لن تظهر المادة.`)) return;
        const newData = { ...subjects };
        delete newData[code];
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);
    };

    const getSubjectStats = (subj) => {
        const total = parseInt(config?.[subj] || 0);
        let started = 0;
        Object.values(lectures).forEach(l => {
            if (l.subject === subj && l.stage > 0) started++;
        });
        const newCount = Math.max(0, total - started);
        return { total, new: newCount };
    };

    const getDueReviews = () => {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return Object.values(lectures).filter(l => {
            if (l.isCompleted || !l.nextReview || l.nextReview === 'COMPLETED') return false;
            return new Date(l.nextReview) <= endOfDay;
        }).sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    };

    const getNewSuggestions = () => {
        if (!config) return [];
        const suggestions = [];
        Object.keys(SUBJECTS).forEach(subj => {
            const total = parseInt(config[subj]) || 0;
            for (let i = 1; i <= total; i++) {
                const id = `${subj}_${i}`;
                if (!lectures[id] || lectures[id].stage === 0) {
                    const existing = lectures[id] || {};
                    suggestions.push({
                        id, subject: subj, number: i, stage: 0,
                        title: existing.title || '', description: existing.description || '', difficulty: existing.difficulty || 'normal'
                    });
                    break;
                }
            }
        });
        return suggestions;
    };

    const getManageLectures = () => {
        if (!config || !selectedManageSubject) return [];
        const total = parseInt(config[selectedManageSubject]) || 0;
        const list = [];
        for (let i = 1; i <= total; i++) {
            const id = `${selectedManageSubject}_${i}`;
            const lecture = lectures[id];
            list.push({
                id, subject: selectedManageSubject, number: i,
                stage: lecture ? lecture.stage : 0, nextReview: lecture ? lecture.nextReview : null,
                title: lecture?.title, description: lecture?.description, difficulty: lecture?.difficulty
            });
        }
        return list;
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        if (isoString === 'COMPLETED') return 'مكتمل';
        return new Date(isoString).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const formatTimeLog = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    };

    const openEditModal = (task) => {
        setEditingTask({ ...task, difficulty: task.difficulty || 'normal' });
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-slate-600 font-bold">جاري تحميل النظام...</div>;

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4" dir="rtl">
                <div className="bg-white p-10 rounded-none shadow-md border border-gray-200 w-full max-w-sm text-center">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-none flex items-center justify-center mx-auto mb-6">
                        <BrainCircuit size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">MediTrack Pro</h1>
                    <p className="text-slate-500 mb-8 text-sm">نظام السحب والإفلات الذكي للمذاكرة</p>
                    <button onClick={handleGoogleLogin} className="w-full bg-slate-800 text-white py-3 rounded-none font-bold flex items-center justify-center gap-2 mb-3 hover:bg-slate-900 transition">
                        <LogIn size={18} /> تسجيل الدخول (Google)
                    </button>
                    <button onClick={handleGuestLogin} className="w-full bg-white text-slate-600 border border-slate-300 py-3 rounded-none font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition">
                        <User size={18} /> تجربة كزائر
                    </button>
                    {authError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs font-bold border border-red-200">{authError}</div>}
                </div>
            </div>
        );
    }

    const reviews = getDueReviews();
    const news = getNewSuggestions();

    return (
        <div className="min-h-screen bg-gray-100 text-slate-800 font-sans relative" dir="rtl">
            {isFocusModeActive && (
                <FocusModeOverlay
                    isFocusAnimating={isFocusAnimating}
                    isFreeFocus={isFreeFocus}
                    focusQueue={focusQueue}
                    onSwitchToLifeTrack={onSwitchToLifeTrack}
                    closeFocusMode={closeFocusMode}
                    completeTask={completeTask}
                    SUBJECTS={SUBJECTS}
                />
            )}

            {editingTask && (
                <EditTaskModal
                    editingTask={editingTask}
                    setEditingTask={setEditingTask}
                    handleSaveTaskDetails={handleSaveTaskDetails}
                    SUBJECTS={SUBJECTS}
                />
            )}

            <nav className="bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-10 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="bg-slate-900 text-white p-1.5 rounded-none">
                        <BrainCircuit size={16} />
                    </div>
                    <div>
                        <h1 className="font-bold text-base text-slate-800 leading-tight">MediTrack</h1>
                    </div>
                </div>

                <div className="flex-1 w-full md:w-auto overflow-x-auto no-scrollbar mx-4">
                    <div className="flex gap-3 justify-start md:justify-center">
                        {Object.keys(SUBJECTS).map(subj => {
                            const stats = getSubjectStats(subj);
                            return (
                                <div key={subj} className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-none p-1 min-w-[50px] shrink-0">
                                    <span className={`text-[9px] font-black px-1.5 rounded-none mb-0.5 text-white ${SUBJECTS[subj].badge}`}>
                                        {subj}
                                    </span>
                                    <span className="text-[7px] text-slate-500 font-bold mb-0.5 truncate max-w-[45px]">{SUBJECTS[subj].name}</span>
                                    <div className="flex items-end gap-0.5 leading-none">
                                        <span className="text-xs font-bold text-slate-800">{stats.new}</span>
                                        <span className="text-[8px] text-slate-400 font-medium">/{stats.total}</span>
                                    </div>
                                    <span className="text-[7px] text-slate-400 mt-0.5">جديد</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button onClick={onSwitchToLifeTrack} className="hidden md:flex bg-slate-900 text-white px-2 py-1 rounded-none text-xs font-bold items-center gap-1.5 hover:bg-slate-800 transition shadow-sm border border-slate-700 animate-in fade-in"><Zap size={14} className="text-amber-500" /> LifeTrack</button>
                    <button onClick={() => window.dispatchEvent(new CustomEvent('switchToCalendar'))} className="hidden md:flex bg-emerald-600 text-white px-2 py-1 rounded-none text-xs font-bold items-center gap-1.5 hover:bg-emerald-700 transition shadow-sm"><Calendar size={14} /> التقويم</button>
                    <button onClick={() => { setShowSettings(true); setSettingsTab('guide'); }} className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition" title="الدليل"><Info size={16} /></button>
                    <button onClick={() => { setShowSettings(true); setSettingsTab('manage'); }} className="p-1.5 text-slate-500 hover:bg-gray-100 rounded-none transition" title="الإعدادات"><Settings size={16} /></button>
                    <div className="h-5 w-px bg-gray-300 mx-1"></div>
                    <button onClick={handleLogout} className="p-1.5 text-red-500 hover:bg-red-50 rounded-none transition" title="خروج"><LogOut size={16} /></button>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-80px)]">
                <div
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={handleDrop}
                    className={`lg:col-span-1 rounded-none transition-all duration-500 flex flex-col relative overflow-hidden group ${focusQueue.length === 0 ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300' : 'bg-white border border-slate-200 shadow-xl'}`}
                >
                    {focusQueue.length === 0 && (
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                    )}

                    {focusQueue.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 z-10">
                            <div className="w-16 h-16 bg-white rounded-none shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                                <Layers size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <h3 className="text-base font-black text-slate-800 mb-1.5 tracking-tight">منطقة التركيز</h3>
                            <p className="text-xs text-slate-500 font-medium mb-6 max-w-[180px] leading-relaxed mx-auto">
                                اسحب المحاضرات هنا لبدء جلسة عميقة
                            </p>

                            <button
                                onClick={startFreeFocus}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-none text-[10px] font-bold text-slate-600 hover:border-slate-800 hover:bg-slate-800 hover:text-white transition-all shadow-sm flex items-center gap-1.5 group-hover:translate-y-1 mx-auto"
                            >
                                <Coffee size={14} />
                                جلسة حرة (بدون مواد)
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-slate-50/50">
                            <div className="p-3 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 tracking-tight">طابور المذاكرة</h3>
                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">تجهيز {focusQueue.length} محاضرات</p>
                                </div>
                                <button
                                    onClick={startFocusSession}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-none font-bold text-[10px] shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 transition-all flex items-center gap-1.5 transform active:scale-95"
                                >
                                    <Play size={12} fill="currentColor" />
                                    ابدأ
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {focusQueue.map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-2 bg-white border border-slate-200 shadow-sm rounded-none group/item hover:border-blue-300 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold text-white rounded-none ${SUBJECTS[task.subject]?.badge || 'bg-slate-500'}`}>
                                                {task.subject}
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 text-xs block">Lec {task.number}</span>
                                                <span className="text-[9px] text-blue-600 block font-bold">{SUBJECTS[task.subject]?.name}</span>
                                                {task.title && <span className="text-[9px] font-medium text-slate-500">{task.title}</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromQueue(task.id)} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-none transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-1 bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                            <div className="p-1 bg-amber-100/50 text-amber-600 rounded-none">
                                <BrainCircuit size={14} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">المراجعات</span>
                        </div>
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-none">{reviews.length}</span>
                    </div>

                    <div className="p-3 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                        {reviews.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                                <CheckCircle size={32} className="mb-3 text-emerald-100" />
                                <p className="font-medium text-xs">كل شيء تحت السيطرة!</p>
                            </div>
                        ) : (
                            reviews.map(r => (
                                <div
                                    key={r.id}
                                    draggable={!isMobile}
                                    onDragStart={(e) => !isMobile && handleDragStart(e, r)}
                                    className={`bg-white p-2.5 rounded-none border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all group relative ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-2 flex-1">
                                            <div className={`mt-0.5 w-1 h-6 rounded-none ${SUBJECTS[r.subject]?.badge || 'bg-slate-300'}`}></div>
                                            <div className="flex-1">
                                                <span className="font-black text-slate-700 text-xs">Lec {r.number}</span>
                                                <span className={`text-[8px] font-bold px-1 py-0.5 rounded-none text-white ${SUBJECTS[r.subject]?.badge}`}>{r.subject}</span>
                                                <span className="text-[9px] text-slate-400 font-bold">{SUBJECTS[r.subject]?.name}</span>
                                                <div className="flex flex-wrap gap-1.5 text-[9px]">
                                                    {r.title ? <span className="font-medium text-slate-600">{r.title}</span> : <span className="text-slate-400 italic">بدون عنوان</span>}
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-slate-500">تكرار {r.stage}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-0.5">
                                            {isMobile && (
                                                <button
                                                    onClick={() => addToQueue(r)}
                                                    className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-none transition-colors"
                                                    title="إضافة للقائمة"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            )}
                                            <button onClick={() => openEditModal(r)} className={`text-slate-300 hover:text-blue-500 p-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <Edit2 size={10} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                            <div className="p-1 bg-blue-100/50 text-blue-600 rounded-none">
                                <BookOpen size={14} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">الجديد</span>
                        </div>
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-none">{news.length}</span>
                    </div>

                    <div className="p-3 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                        {news.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                                <p className="font-medium text-xs">لا يوجد مواد جديدة حالياً.</p>
                                <button onClick={() => { setShowSettings(true); setSettingsTab('config') }} className="mt-1.5 text-blue-500 text-[10px] font-bold hover:underline">ضبط الإعدادات</button>
                            </div>
                        ) : (
                            news.map(n => (
                                <div
                                    key={n.id}
                                    draggable={!isMobile}
                                    onDragStart={(e) => !isMobile && handleDragStart(e, n)}
                                    className={`bg-white p-2 rounded-none border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group flex items-center justify-between ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className={`w-7 h-7 rounded-none flex items-center justify-center text-[9px] font-black text-white shadow-sm ${SUBJECTS[n.subject]?.badge}`}>
                                            {n.subject}
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-bold text-slate-700 text-xs block">Lecture {n.number}</span>
                                            <span className="text-[9px] text-blue-600 block font-bold mb-0.5">{SUBJECTS[n.subject]?.name}</span>
                                            {n.title && <span className="text-[9px] text-slate-500 block">{n.title}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-0.5">
                                        {isMobile && (
                                            <button
                                                onClick={() => addToQueue(n)}
                                                className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-none transition-colors"
                                                title="إضافة للقائمة"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        )}
                                        <button onClick={() => openEditModal(n)} className={`text-slate-300 hover:text-blue-500 p-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Edit2 size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </main>

            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-none shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <div className="flex gap-4 overflow-x-auto">
                                <button onClick={() => setSettingsTab('guide')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab === 'guide' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>الدليل</button>
                                <button onClick={() => setSettingsTab('subjects')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab === 'subjects' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>المواد</button>
                                <button onClick={() => setSettingsTab('config')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab === 'config' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>الأعداد</button>
                                <button onClick={() => setSettingsTab('manage')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab === 'manage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>التقدم</button>
                                <button onClick={() => setSettingsTab('history')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>السجل</button>
                                <button onClick={() => setSettingsTab('danger')} className={`text-sm font-bold pb-1 whitespace-nowrap ${settingsTab === 'danger' ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-500'}`}>تصفير</button>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto bg-white flex-1">
                            {settingsTab === 'guide' && (
                                <div className="space-y-4 text-slate-600 text-sm">
                                    <h3 className="font-bold text-slate-800">طريقة الاستخدام الجديدة 🖱️</h3>
                                    <p>النظام الآن يعتمد على السحب والإفلات للتركيز العميق.</p>
                                    <ul className="list-disc list-inside space-y-2 bg-blue-50 p-4 rounded-none border border-blue-100 text-blue-800">
                                        <li><strong>الخطوة 1:</strong> اسحب أي عدد من المحاضرات (1، 2، أو أكثر) إلى منطقة التركيز.</li>
                                        <li><strong>الخطوة 2:</strong> اضغط "ابدأ الجلسة" للدخول في وضع التركيز.</li>
                                        <li><strong>الخطوة 3:</strong> كل إنجاز سيتم حفظه تلقائياً في سجل الجلسات.</li>
                                    </ul>
                                </div>
                            )}

                            {settingsTab === 'subjects' && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h3 className="font-bold text-slate-800 text-sm mb-2">المواد الحالية</h3>
                                        <div className="grid grid-cols-1 gap-2">
                                            {Object.entries(subjects).map(([code, subj]) => (
                                                <div key={code} className="flex items-center justify-between p-3 border rounded-none bg-gray-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-bold text-white ${subj.badge}`}>{code}</div>
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-800">{subj.name}</p>
                                                            <p className="text-[10px] text-slate-400">Code: {code}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => deleteSubject(code)} className="text-red-400 hover:text-red-600 bg-white p-2 border rounded-none hover:bg-red-50 transition" title="حذف المادة">
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleEditSubject(code)} className="text-blue-400 hover:text-blue-600 bg-white p-2 border rounded-none hover:bg-blue-50 transition ml-2" title="تعديل المادة">
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-none border border-slate-200">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-bold text-slate-800 text-sm">{editingSubjectCode ? 'تعديل المادة' : 'إضافة مادة جديدة'}</h3>
                                            {editingSubjectCode && <button onClick={cancelEditSubject} className="text-xs text-red-500 font-bold hover:underline">إلغاء</button>}
                                        </div>
                                        <form onSubmit={handleAddSubject} className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">الكود (EN)</label>
                                                    <input
                                                        type="text"
                                                        placeholder="مثلاً ANAT"
                                                        value={newSubject.code}
                                                        onChange={e => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })}
                                                        maxLength={5}
                                                        disabled={!!editingSubjectCode}
                                                        className={`w-full px-3 py-2 rounded-none border text-sm uppercase font-mono ${editingSubjectCode ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">الاسم</label>
                                                    <input
                                                        type="text"
                                                        placeholder="مثلاً تشريح"
                                                        className="w-full px-3 py-2 rounded-none border text-sm"
                                                        value={newSubject.name}
                                                        onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">اللون</label>
                                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                    {Object.entries(THEMES).map(([key, theme]) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => setNewSubject({ ...newSubject, theme: key })}
                                                            className={`w-8 h-8 shrink-0 rounded-none flex items-center justify-center border-2 transition ${newSubject.theme === key ? 'border-slate-800 scale-110' : 'border-transparent'} ${theme.badge}`}
                                                            title={theme.name}
                                                        >
                                                            {newSubject.theme === key && <CheckCircle size={14} className="text-white" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button type="submit" className={`w-full text-white py-2 rounded-none font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 ${editingSubjectCode ? 'bg-blue-600' : 'bg-slate-900'}`}>
                                                {editingSubjectCode ? <Save size={16} /> : <Plus size={16} />}
                                                {editingSubjectCode ? 'حفظ التعديلات' : 'إضافة المادة'}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {settingsTab === 'config' && (
                                <form onSubmit={handleSaveConfig} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.keys(SUBJECTS).map(subj => (
                                            <div key={subj} className="flex items-center gap-2 border p-2 rounded-none">
                                                <span className={`w-10 font-bold text-center text-xs py-1 rounded-none ${SUBJECTS[subj].color}`}>{subj}</span>
                                                <input type="number" min="0" className="w-full text-center outline-none font-bold text-slate-700" value={tempConfig[subj]} onChange={e => setTempConfig({ ...tempConfig, [subj]: e.target.value })} />
                                            </div>
                                        ))}
                                    </div>
                                    <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-none font-bold hover:bg-slate-900 mt-4">حفظ الأعداد</button>
                                    <div className="mt-6 pt-4 border-t">
                                        <button type="button" onClick={markFirstFiveAsStudied} className="text-amber-600 text-xs font-bold hover:underline flex items-center gap-1"><FastForward size={14} /> تفعيل مراجعة أول 5 محاضرات فوراً</button>
                                    </div>
                                </form>
                            )}

                            {settingsTab === 'manage' && (
                                <div>
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                                        {Object.keys(SUBJECTS).map(subj => (
                                            <button key={subj} onClick={() => setSelectedManageSubject(subj)} className={`px-3 py-1 rounded-none text-xs font-bold border transition ${selectedManageSubject === subj ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                                                {subj}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                        {getManageLectures().length === 0 ? <p className="text-center text-slate-400 text-xs py-4">لا توجد محاضرات.</p> : getManageLectures().map(lecture => (
                                            <div key={lecture.id} className="flex justify-between items-center p-2 border rounded-none hover:bg-slate-50 group">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">Lec {lecture.number}</span>
                                                    {lecture.title && <span className="text-[10px] text-blue-600">{lecture.title}</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => openEditModal(lecture)} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={14} /></button>
                                                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                                                    <span className="text-[10px] text-slate-400 mr-2">{lecture.stage >= 5 ? 'Done' : `Stage ${lecture.stage}`}</span>
                                                    <button onClick={() => manualStageUpdate(selectedManageSubject, lecture.number, Math.max(0, lecture.stage - 1))} className="p-1 bg-gray-100 rounded-none hover:bg-gray-200"><Minus size={12} /></button>
                                                    <span className="w-4 text-center text-xs font-bold">{lecture.stage}</span>
                                                    <button onClick={() => manualStageUpdate(selectedManageSubject, lecture.number, Math.min(5, lecture.stage + 1))} className="p-1 bg-gray-100 rounded-none hover:bg-gray-200"><Plus size={12} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {settingsTab === 'history' && (
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <History size={18} className="text-blue-500" />
                                        سجل الإنجازات
                                    </h3>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                        {history.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-none">
                                                لم تقم بأي جلسات بعد. ابدأ الآن! 🚀
                                            </div>
                                        ) : (
                                            history.map((log) => (
                                                <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-none hover:border-blue-200 transition">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-bold text-white ${SUBJECTS[log.subject]?.badge || 'bg-slate-400'}`}>
                                                            {log.subject}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-700">Lecture {log.number}</p>
                                                            <span className="text-[9px] text-blue-600 block font-bold mb-0.5">{SUBJECTS[log.subject]?.name}</span>
                                                            {log.title && <p className="text-[10px] text-slate-500">{log.title}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-none inline-block mb-1">
                                                            {log.stageCompleted === 0 ? 'مذاكرة أولى' : `مراجعة ${log.stageCompleted}`}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                                                            <Calendar size={10} />
                                                            {formatDate(log.completedAt)} - {formatTimeLog(log.completedAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {settingsTab === 'danger' && (
                                <div className="space-y-2">
                                    {Object.keys(SUBJECTS).map(subj => (
                                        <div key={subj} className="flex justify-between items-center p-3 border border-red-100 bg-red-50 rounded-none">
                                            <span className="font-bold text-red-800 text-sm">{subj}</span>
                                            <button onClick={() => resetSubjectProgress(subj)} className="text-red-600 text-xs font-bold hover:underline flex items-center gap-1"><Trash2 size={14} /> تصفير</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MediTrackApp;
