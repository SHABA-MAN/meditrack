import React, { useState, useEffect } from 'react';
import FocusModeOverlay from './FocusModeOverlay';
import EditTaskModal from './EditTaskModal';
import DataManagement from './DataManagement';
import { Sidebar, TopBar, FocusQueueWidget, TaskListWidget, WeeklyReviewWidget, WeeklyGoalsWidget, QuickStatsWidget } from './DashboardLayout';
import { logAchievement } from '../utils/achievements';
import { formatDate, formatTimeLog } from '../utils/date';
import { useIsMobile } from '../hooks/useIsMobile';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, onSnapshot, writeBatch, deleteDoc, query, orderBy } from 'firebase/firestore';
import { auth, db, appId } from '../firebase';
import toast from 'react-hot-toast';
import { THEMES, DEFAULT_SUBJECTS, INTERVALS, DIFFICULTY_CONFIG } from '../constants';
import { useSubjects } from '../hooks/useSubjects';
import { useLectures } from '../hooks/useLectures';
import {
    CheckCircle, BrainCircuit, Settings, BookOpen, Save, FastForward, Info, Trash2, AlertTriangle, X,
    LogIn, LogOut, User, Plus, Minus, LayoutList, GripHorizontal, Maximize2, Layers, Zap, Coffee,
    Edit2, Flag, History, Play, Calendar, CheckSquare, Clock, Download, Target, FileText, BarChart3, Home
} from 'lucide-react';

const MediTrackApp = ({ onSwitchToLifeTrack, onSwitchToTimeBoxing, user }) => {
    const [loading, setLoading] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [showDataManagement, setShowDataManagement] = useState(false);

    const isMobile = useIsMobile();

    // Custom Hooks
    const { subjects, config, handleAddSubject: addSubjectCore, deleteSubject: removeSubjectCore, getSubjectStats: getSubjectStatsCore } = useSubjects(db, appId, user);
    const { lectures, saveLecture, deleteLecture: removeLectureCore, getReviewLectures, getNewLectures: getNewLecturesCore, getSubjectLectures } = useLectures(db, appId, user);

    // Data State (History only, others from hooks)
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

    const SUBJECTS = subjects || DEFAULT_SUBJECTS;
    const [newSubject, setNewSubject] = useState({ code: '', name: '', theme: 'blue' });
    const [editingSubjectCode, setEditingSubjectCode] = useState(null);

    const [editingTask, setEditingTask] = useState(null);

    // Weekly Review & Goals state
    const getWeekKey = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    };
    const [weeklyReview, setWeeklyReview] = useState({ done: '', missed: '' });
    const [weeklyGoals, setWeeklyGoals] = useState({ goal1: '', goal2: '', goal3: '' });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
            // Hooks automatically reset state when user becomes null
        }
    };

    // Sync tempConfig with config when loaded
    useEffect(() => {
        if (config) setTempConfig(config);
    }, [config]);

    // Show settings if config is missing (new user)
    useEffect(() => {
        if (user && config && Object.keys(config).length === 0) {
            setShowSettings(true);
            setSettingsTab('guide');
        }
    }, [user, config]);

    // Listen to History (not yet hooked)
    useEffect(() => {
        if (!user) return;
        const qHistory = query(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), orderBy('completedAt', 'desc'));
        const unsubHistory = onSnapshot(qHistory, (snap) => {
            const logs = [];
            snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
            setHistory(logs);
        });
        return () => unsubHistory();
    }, [user]);

    // Weekly Review & Goals Firebase sync
    useEffect(() => {
        if (!user) return;
        const weekKey = getWeekKey();
        const reviewRef = doc(db, 'artifacts', appId, 'users', user.uid, 'weekly_review', weekKey);
        const goalsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'weekly_goals', weekKey);
        const unsubReview = onSnapshot(reviewRef, (snap) => {
            if (snap.exists()) setWeeklyReview(snap.data());
        });
        const unsubGoals = onSnapshot(goalsRef, (snap) => {
            if (snap.exists()) setWeeklyGoals(snap.data());
        });
        return () => { unsubReview(); unsubGoals(); };
    }, [user]);

    const saveWeeklyReview = async (data) => {
        if (!user) return;
        const weekKey = getWeekKey();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'weekly_review', weekKey), data, { merge: true });
    };

    const saveWeeklyGoals = async (data) => {
        if (!user) return;
        const weekKey = getWeekKey();
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'weekly_goals', weekKey), data, { merge: true });
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        if (!user) return;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), tempConfig);
        // Immediately reflect saved config in tempConfig state
        // (config will auto-update via onSnapshot, but tempConfig needs manual sync)
        toast.success("تم حفظ الإعدادات ✅");
        setShowSettings(false);
    };

    const handleSaveTaskDetails = async (e) => {
        e.preventDefault();
        if (!user || !editingTask) return;
        try {
            await saveLecture(editingTask);
            setEditingTask(null);
        } catch (error) {
            console.error(error);
            toast.error("فشل الحفظ: " + error.message);
        }
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
        toast.success(`تم تصفير ${count} محاضرة.`);
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
        toast.success("تم التنفيذ بنجاح.");
        setShowSettings(false);
    };

    const saveSessionToCloud = async (isFree, queue) => {
        if (!user) return;
        try {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'meditrack');
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
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'meditrack');
            await deleteDoc(ref);
        } catch (e) {
            console.error("Failed to delete session", e);
        }
    };

    useEffect(() => {
        if (!user) return;
        const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'active_session', 'meditrack');
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
            // Reset: use empty string instead of null for nextReview to avoid comparison issues
            const data = { stage: 0, lastStudied: null, nextReview: '', isCompleted: false };
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
                const newQueue = [...focusQueue, task];
                setFocusQueue(newQueue);
                // Sync to cloud if session is active
                if (isFocusModeActive) saveSessionToCloud(isFreeFocus, newQueue);
            } catch (err) {
                console.error("Invalid drag data", err);
            }
        }
    };

    const removeFromQueue = (taskId) => {
        const newQueue = focusQueue.filter(t => t.id !== taskId);
        setFocusQueue(newQueue);
        // Sync to cloud if session is active
        if (isFocusModeActive) saveSessionToCloud(isFreeFocus, newQueue);
    };

    const addToQueue = (task) => {
        if (focusQueue.find(t => t.id === task.id)) return;
        const newQueue = [...focusQueue, task];
        setFocusQueue(newQueue);
        // Sync to cloud if session is active
        if (isFocusModeActive) saveSessionToCloud(isFreeFocus, newQueue);
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        try {
            await addSubjectCore(newSubject, editingSubjectCode);
            setNewSubject({ code: '', name: '', theme: 'blue' });
            setEditingSubjectCode(null);
            toast.success(editingSubjectCode ? "تم تعديل المادة بنجاح ✅" : "تم إضافة المادة بنجاح ✅");
        } catch (error) {
            toast.error(error.message);
        }
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
        try {
            await removeSubjectCore(code);
        } catch (error) {
            console.error(error);
            toast.error("حدث خطأ أثناء الحذف");
        }
    };

    // Wrapper for hook function to match component usage
    const getSubjectStats = (subj) => getSubjectStatsCore(subj, lectures);


    const openEditModal = (task) => {
        setEditingTask({ ...task, difficulty: task.difficulty || 'normal' });
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-slate-600 font-bold">جاري تحميل النظام...</div>;

    if (!user) {
        return (
            <div className="min-h-screen bg-login-gradient flex flex-col items-center justify-center p-4" dir="rtl">
                <div className="glass-card p-10 rounded-xl w-full max-w-sm text-center animate-fade-in">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow-blue animate-float">
                        <BrainCircuit size={36} />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-white mb-2">MediTrack Pro</h1>
                    <p className="text-slate-400 mb-8 text-sm">نظام السحب والإفلات الذكي للمذاكرة</p>
                    <button onClick={handleGoogleLogin} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 mb-3 hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98]">
                        <LogIn size={18} /> تسجيل الدخول (Google)
                    </button>
                    <button onClick={handleGuestLogin} className="w-full bg-slate-800/50 text-slate-300 border border-slate-600/50 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700/50 hover:text-white transition-all active:scale-[0.98]">
                        <User size={18} /> تجربة كزائر
                    </button>
                    {authError && <div className="mt-4 p-3 bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20 rounded-lg">{authError}</div>}
                </div>
            </div>
        );
    }

    const reviews = getReviewLectures();
    const news = getNewLecturesCore(config);

    return (
        <>
            <div className="min-h-screen bg-dark-gradient text-slate-200 font-sans relative flex" dir="rtl">
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

                {/* Sidebar */}
                <Sidebar onSwitchToLifeTrack={onSwitchToLifeTrack} onSwitchToTimeBoxing={onSwitchToTimeBoxing} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                    <TopBar SUBJECTS={SUBJECTS} getSubjectStats={getSubjectStats} handleLogout={handleLogout} setShowSettings={setShowSettings} setSettingsTab={setSettingsTab} />

                    <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-min">
                            {/* Row 1: Focus Queue, Reviews, New Lectures */}
                            <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                                <FocusQueueWidget focusQueue={focusQueue} handleDrop={handleDrop} handleDragOver={handleDragOver} startFocusSession={startFocusSession} startFreeFocus={startFreeFocus} removeFromQueue={removeFromQueue} SUBJECTS={SUBJECTS} DIFFICULTY_CONFIG={DIFFICULTY_CONFIG} />
                            </div>
                            <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
                                <TaskListWidget title="المراجعات" icon={BrainCircuit} iconColor="text-amber-400" accentGradient="bg-gradient-to-r from-amber-500 to-orange-500" badgeColor="text-amber-400 bg-amber-500/10" tasks={reviews} SUBJECTS={SUBJECTS} isMobile={isMobile} handleDragStart={handleDragStart} addToQueue={addToQueue} openEditModal={openEditModal} emptyMessage="كل شيء تحت السيطرة!" />
                            </div>
                            <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                                <TaskListWidget title="الجديد" icon={BookOpen} iconColor="text-blue-400" accentGradient="bg-gradient-to-r from-blue-500 to-indigo-500" badgeColor="text-blue-400 bg-blue-500/10" tasks={news} SUBJECTS={SUBJECTS} isMobile={isMobile} handleDragStart={handleDragStart} addToQueue={addToQueue} openEditModal={openEditModal} emptyMessage="لا يوجد مواد جديدة حالياً." emptyAction={<button onClick={() => { setShowSettings(true); setSettingsTab('config') }} className="mt-1 text-blue-400 text-[10px] font-bold hover:underline">ضبط الإعدادات</button>} />
                            </div>

                            {/* Row 2: Weekly Review, Weekly Goals */}
                            <div className="md:col-span-1 lg:col-span-2 animate-slide-up" style={{ animationDelay: '150ms' }}>
                                <WeeklyReviewWidget weeklyReview={weeklyReview} setWeeklyReview={setWeeklyReview} saveWeeklyReview={saveWeeklyReview} />
                            </div>
                            <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                                <WeeklyGoalsWidget weeklyGoals={weeklyGoals} setWeeklyGoals={setWeeklyGoals} saveWeeklyGoals={saveWeeklyGoals} />
                            </div>

                            {/* Row 3: Quick Stats */}
                            <div className="animate-slide-up" style={{ animationDelay: '250ms' }}>
                                <QuickStatsWidget reviews={reviews} news={news} history={history} focusQueue={focusQueue} />
                            </div>
                        </div>
                    </main>
                </div>

                {/* Settings Modal — Dark Theme */}
                {showSettings && (
                    <div className="fixed inset-0 dark-modal-overlay z-50 flex items-center justify-center p-4">
                        <div className="dark-modal w-full max-w-2xl rounded-xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up">
                            <div className="bg-dark-850 p-4 border-b border-white/5 flex justify-between items-center">
                                <div className="flex gap-3 overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'guide', label: 'الدليل' }, { id: 'mobile', label: 'الموبايل' }, { id: 'subjects', label: 'المواد' },
                                        { id: 'config', label: 'الأعداد' }, { id: 'manage', label: 'التقدم' }, { id: 'history', label: 'السجل' },
                                        { id: 'danger', label: 'تصفير', danger: true }
                                    ].map(tab => (
                                        <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
                                            className={`text-xs font-bold pb-1 whitespace-nowrap transition ${settingsTab === tab.id ? (tab.danger ? 'text-red-400 border-b-2 border-red-400' : 'text-blue-400 border-b-2 border-blue-400') : 'text-slate-500 hover:text-slate-300'}`}>
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition"><X size={18} /></button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                {settingsTab === 'guide' && (
                                    <div className="space-y-4 text-slate-300 text-sm">
                                        <h3 className="font-bold text-white">طريقة الاستخدام الجديدة 🖱️</h3>
                                        <p>النظام الآن يعتمد على السحب والإفلات للتركيز العميق.</p>
                                        <ul className="list-disc list-inside space-y-2 bg-blue-500/5 p-4 rounded-lg border border-blue-500/10 text-blue-300">
                                            <li><strong>الخطوة 1:</strong> اسحب أي عدد من المحاضرات إلى منطقة التركيز.</li>
                                            <li><strong>الخطوة 2:</strong> اضغط "ابدأ الجلسة" للدخول في وضع التركيز.</li>
                                            <li><strong>الخطوة 3:</strong> كل إنجاز سيتم حفظه تلقائياً في سجل الجلسات.</li>
                                        </ul>
                                    </div>
                                )}

                                {settingsTab === 'mobile' && (
                                    <div className="space-y-6 text-center">
                                        <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-6 rounded-xl shadow-lg inline-block mx-auto">
                                            <BrainCircuit size={48} className="mx-auto mb-2" />
                                            <h3 className="text-xl font-bold mb-1">نسخة الموبايل</h3>
                                            <p className="text-blue-200 text-sm">MediTrack Mobile Manager</p>
                                        </div>
                                        <div className="max-w-md mx-auto space-y-4">
                                            <p className="font-bold text-white">كيفية التثبيت على الآيفون:</p>
                                            <ol className="text-sm text-slate-300 space-y-2 text-right list-decimal list-inside bg-slate-800/50 p-4 border border-white/5 rounded-lg">
                                                <li>اضغط على الزر بالأسفل لفتح صفحة المدير.</li>
                                                <li>اضغط على زر المشاركة (Share) في المتصفح.</li>
                                                <li>اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong>.</li>
                                                <li>سيظهر أيقونة التطبيق على شاشتك!</li>
                                            </ol>
                                            <a href="#/manage" className="block w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 rounded-lg transition shadow-lg hover:shadow-blue-500/30">فتح صفحة المدير الآن</a>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'subjects' && (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <h3 className="font-bold text-white text-sm mb-2">المواد الحالية</h3>
                                            <div className="grid grid-cols-1 gap-2">
                                                {Object.entries(subjects).map(([code, subj]) => (
                                                    <div key={code} className="flex items-center justify-between p-3 border border-white/5 rounded-lg bg-slate-800/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${subj.badge}`}>{code}</div>
                                                            <div><p className="font-bold text-sm text-white">{subj.name}</p><p className="text-[10px] text-slate-500">Code: {code}</p></div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleEditSubject(code)} className="text-blue-400 hover:text-blue-300 p-2 border border-white/5 rounded-lg hover:bg-blue-500/10 transition"><Edit2 size={14} /></button>
                                                            <button onClick={() => deleteSubject(code)} className="text-red-400 hover:text-red-300 p-2 border border-white/5 rounded-lg hover:bg-red-500/10 transition"><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-white/5">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="font-bold text-white text-sm">{editingSubjectCode ? 'تعديل المادة' : 'إضافة مادة جديدة'}</h3>
                                                {editingSubjectCode && <button onClick={cancelEditSubject} className="text-xs text-red-400 font-bold hover:underline">إلغاء</button>}
                                            </div>
                                            <form onSubmit={handleAddSubject} className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div><label className="block text-[10px] font-bold text-slate-400 mb-1">الكود (EN)</label><input type="text" placeholder="مثلاً ANAT" value={newSubject.code} onChange={e => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })} maxLength={5} disabled={!!editingSubjectCode} className={`dark-input w-full uppercase font-mono ${editingSubjectCode ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
                                                    <div><label className="block text-[10px] font-bold text-slate-400 mb-1">الاسم</label><input type="text" placeholder="مثلاً تشريح" className="dark-input w-full" value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} /></div>
                                                </div>
                                                <div><label className="block text-[10px] font-bold text-slate-400 mb-1">اللون</label>
                                                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                        {Object.entries(THEMES).map(([key, theme]) => (
                                                            <button key={key} type="button" onClick={() => setNewSubject({ ...newSubject, theme: key })} className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border-2 transition ${newSubject.theme === key ? 'border-white scale-110' : 'border-transparent'} ${theme.badge}`} title={theme.name}>
                                                                {newSubject.theme === key && <CheckCircle size={14} className="text-white" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button type="submit" className={`w-full text-white py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${editingSubjectCode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'}`}>
                                                    {editingSubjectCode ? <Save size={16} /> : <Plus size={16} />}
                                                    {editingSubjectCode ? 'حفظ التعديلات' : 'إضافة المادة'}
                                                </button>
                                            </form>
                                            <div className="mt-4 pt-4 border-t border-white/5">
                                                <button onClick={async () => { if (!user) return; if (!confirm('هل تريد إعادة تعيين أسماء المواد الافتراضية؟')) return; await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), DEFAULT_SUBJECTS); toast.success('تم تحديث أسماء المواد بنجاح! ✅'); }} className="w-full bg-amber-600/20 text-amber-400 border border-amber-500/20 py-2 rounded-lg font-bold text-xs hover:bg-amber-600/30 transition flex items-center justify-center gap-2">
                                                    <AlertTriangle size={14} /> إعادة تعيين الأسماء الافتراضية
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'config' && (
                                    <form onSubmit={handleSaveConfig} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.keys(SUBJECTS).map(subj => (
                                                <div key={subj} className="flex items-center gap-2 border border-white/5 p-2 rounded-lg bg-slate-800/50">
                                                    <span className={`w-10 font-bold text-center text-xs py-1 rounded-md text-white ${SUBJECTS[subj].badge}`}>{subj}</span>
                                                    <input type="number" min="0" className="dark-input w-full text-center font-bold" value={tempConfig[subj]} onChange={e => setTempConfig({ ...tempConfig, [subj]: e.target.value })} />
                                                </div>
                                            ))}
                                        </div>
                                        <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 rounded-lg font-bold hover:from-blue-500 hover:to-blue-400 mt-4 transition">حفظ الأعداد</button>
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <button type="button" onClick={markFirstFiveAsStudied} className="text-amber-400 text-xs font-bold hover:underline flex items-center gap-1"><FastForward size={14} /> تفعيل مراجعة أول 5 محاضرات فوراً</button>
                                        </div>
                                    </form>
                                )}

                                {settingsTab === 'manage' && (
                                    <div>
                                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
                                            {Object.keys(SUBJECTS).map(subj => (
                                                <button key={subj} onClick={() => setSelectedManageSubject(subj)} className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${selectedManageSubject === subj ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:border-white/10'}`}>{subj}</button>
                                            ))}
                                        </div>
                                        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {getSubjectLectures(selectedManageSubject, config).length === 0 ? <p className="text-center text-slate-500 text-xs py-4">لا توجد محاضرات.</p> : getSubjectLectures(selectedManageSubject, config).map(lecture => (
                                                <div key={lecture.id} className="flex justify-between items-center p-2 border border-white/5 rounded-lg hover:bg-slate-800/50 group transition">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white">Lec {lecture.number}</span>
                                                        <div className="flex flex-wrap gap-1 items-center">
                                                            {lecture.title && <span className="text-[10px] text-blue-400">{lecture.title}</span>}
                                                            {lecture.difficulty && DIFFICULTY_CONFIG[lecture.difficulty] && (
                                                                <>{lecture.title && <span className="text-slate-600 text-[9px]">•</span>}<span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${DIFFICULTY_CONFIG[lecture.difficulty].darkBg} ${DIFFICULTY_CONFIG[lecture.difficulty].darkText} border ${DIFFICULTY_CONFIG[lecture.difficulty].darkBorder}`}>{DIFFICULTY_CONFIG[lecture.difficulty].emoji} {DIFFICULTY_CONFIG[lecture.difficulty].label}</span></>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => openEditModal(lecture)} className="p-1 text-slate-600 hover:text-blue-400 transition"><Edit2 size={14} /></button>
                                                        <div className="h-4 w-px bg-slate-700 mx-1" />
                                                        <span className="text-[10px] text-slate-500 mr-2">{lecture.stage >= 5 ? 'Done' : `Stage ${lecture.stage}`}</span>
                                                        <button onClick={() => manualStageUpdate(selectedManageSubject, lecture.number, Math.max(0, lecture.stage - 1))} className="p-1 bg-slate-800 rounded-md hover:bg-slate-700 transition"><Minus size={12} /></button>
                                                        <span className="w-4 text-center text-xs font-bold text-white">{lecture.stage}</span>
                                                        <button onClick={() => manualStageUpdate(selectedManageSubject, lecture.number, Math.min(5, lecture.stage + 1))} className="p-1 bg-slate-800 rounded-md hover:bg-slate-700 transition"><Plus size={12} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'history' && (
                                    <div>
                                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><History size={18} className="text-blue-400" /> سجل الإنجازات</h3>
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                            {history.length === 0 ? (
                                                <div className="text-center py-8 text-slate-500 border-2 border-dashed border-white/5 rounded-lg">لم تقم بأي جلسات بعد. ابدأ الآن! 🚀</div>
                                            ) : history.map(log => (
                                                <div key={log.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/5 rounded-lg hover:border-blue-500/20 transition">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${SUBJECTS[log.subject]?.badge || 'bg-slate-500'}`}>{log.subject}</div>
                                                        <div>
                                                            <p className="font-bold text-sm text-white">Lecture {log.number}</p>
                                                            <span className="text-[9px] text-blue-400 block font-bold">{SUBJECTS[log.subject]?.name}</span>
                                                            {log.title && <p className="text-[10px] text-slate-400">{log.title}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block mb-1">{log.stageCompleted === 0 ? 'مذاكرة أولى' : `مراجعة ${log.stageCompleted}`}</div>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end"><Calendar size={10} />{formatDate(log.completedAt)} - {formatTimeLog(log.completedAt)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'danger' && (
                                    <div className="space-y-2">
                                        {Object.keys(SUBJECTS).map(subj => (
                                            <div key={subj} className="flex justify-between items-center p-3 border border-red-500/20 bg-red-500/5 rounded-lg">
                                                <span className="font-bold text-red-400 text-sm">{subj}</span>
                                                <button onClick={() => resetSubjectProgress(subj)} className="text-red-400 text-xs font-bold hover:underline flex items-center gap-1"><Trash2 size={14} /> تصفير</button>
                                            </div>
                                        ))}
                                        <div className="border-t border-white/5 pt-4 mt-4">
                                            <button onClick={() => setShowDataManagement(true)} className="w-full flex items-center justify-center gap-2 bg-amber-600/20 text-amber-400 border border-amber-500/20 font-bold py-2.5 rounded-lg transition text-sm hover:bg-amber-600/30">
                                                <Download size={16} /> تصدير / استيراد البيانات
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Data Management Modal */}
            {showDataManagement && <DataManagement user={user} onClose={() => setShowDataManagement(false)} />}
        </>

    );
};

export default MediTrackApp;
