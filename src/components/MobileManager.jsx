import React, { useState, useEffect } from 'react';
import { db, appId } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import {
    Plus, ChevronRight, Search, Edit2, Trash2, X, Check, ArrowLeft,
    LayoutGrid, BookOpen
} from 'lucide-react';

// EXACT SAME THEMES as main app
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

const MobileManager = ({ user, onBack }) => {
    const [activeTab, setActiveTab] = useState('subjects');

    // EXACT SAME state as main app
    const [subjects, setSubjects] = useState({});
    const [lectures, setLectures] = useState({});
    const [config, setConfig] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [modalType, setModalType] = useState('lecture');

    // Subject editing
    const [newSubject, setNewSubject] = useState({ code: '', name: '', theme: 'blue' });
    const [editingSubjectCode, setEditingSubjectCode] = useState(null);

    // EXACT SAME useEffect as main app
    useEffect(() => {
        if (!user) return;

        const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig(data);
            }
        });

        const unsubLectures = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'), (snap) => {
            const data = {};
            snap.forEach(d => data[d.id] = d.data());
            setLectures(data);
        });

        const unsubDefs = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), (snap) => {
            if (snap.exists()) {
                setSubjects(snap.data());
            }
        });

        return () => { unsubConfig(); unsubLectures(); unsubDefs(); };
    }, [user]);

    // EXACT SAME handleAddSubject as main app
    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (!newSubject.code || !newSubject.name) return alert("يرجى ملء الكود والاسم");
        const code = newSubject.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (!editingSubjectCode && subjects[code]) return alert("هذا الكود موجود بالفعل!");

        const theme = THEMES[newSubject.theme];
        const newData = { ...subjects, [code]: { ...theme, name: newSubject.name, theme: newSubject.theme } };

        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);

        if (!config || config[code] === undefined) {
            if (!editingSubjectCode) {
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), { ...config, [code]: 0 }, { merge: true });
            }
        }
        setNewSubject({ code: '', name: '', theme: 'blue' });
        setEditingSubjectCode(null);
        setShowAddModal(false);
        alert(editingSubjectCode ? "تم تعديل المادة بنجاح ✅" : "تم إضافة المادة بنجاح ✅");
    };

    // EXACT SAME deleteSubject as main app
    const deleteSubject = async (code) => {
        if (!confirm(`هل أنت متأكد من حذف مادة ${code}؟ لن يتم حذف المحاضرات القديمة ولكن لن تظهر المادة.`)) return;
        const newData = { ...subjects };
        delete newData[code];
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);
        setShowAddModal(false);
        setSelectedSubject(null);
    };

    // EXACT SAME handleSaveTaskDetails as main app
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
        setShowAddModal(false);
        alert("تم حفظ التعديلات ✅");
    };

    // Delete lecture
    const deleteLecture = async (lectureId) => {
        if (!confirm('هل أنت متأكد من حذف هذه المحاضرة؟')) return;
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId));
        setShowAddModal(false);
        alert("تم حذف المحاضرة ✅");
    };

    // Add new lecture - increases config count
    const addNewLecture = async () => {
        if (!config || !selectedSubject) return;
        const currentCount = parseInt(config[selectedSubject] || 0);
        const newCount = currentCount + 1;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), { ...config, [selectedSubject]: newCount }, { merge: true });
        alert(`تم إضافة محاضرة ${newCount} ✅`);
    };

    // EXACT SAME getSubjectStats as main app
    const getSubjectStats = (subj) => {
        const total = parseInt(config?.[subj] || 0);
        let started = 0;
        Object.values(lectures).forEach(l => {
            if (l.subject === subj && l.stage > 0) started++;
        });
        const newCount = Math.max(0, total - started);
        return { total, new: newCount };
    };

    // EXACT SAME getManageLectures as main app
    const getManageLectures = () => {
        if (!config || !selectedSubject) return [];
        const total = parseInt(config[selectedSubject] || 0);
        const list = [];
        for (let i = 1; i <= total; i++) {
            const id = `${selectedSubject}_${i}`;
            const lecture = lectures[id];
            list.push({
                id, subject: selectedSubject, number: i,
                stage: lecture ? lecture.stage : 0,
                nextReview: lecture ? lecture.nextReview : null,
                title: lecture?.title,
                description: lecture?.description,
                difficulty: lecture?.difficulty,
                isCompleted: lecture?.isCompleted
            });
        }
        return list;
    };

    const openEditModal = (task) => {
        setEditingTask({ ...task, difficulty: task.difficulty || 'normal' });
        setModalType('lecture');
        setShowAddModal(true);
    };

    const openEditSubject = (code) => {
        const subj = subjects[code];
        setNewSubject({ code: code, name: subj.name, theme: subj.theme || 'blue' });
        setEditingSubjectCode(code);
        setModalType('subject');
        setShowAddModal(true);
    };

    // Views
    const SubjectsView = () => (
        <div className="p-4 space-y-3 pb-24">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">المواد الدراسية</h2>
                <button
                    onClick={() => {
                        setNewSubject({ code: '', name: '', theme: 'blue' });
                        setEditingSubjectCode(null);
                        setModalType('subject');
                        setShowAddModal(true);
                    }}
                    className="bg-slate-900 text-white p-3 rounded-full shadow-lg shadow-slate-200 active:scale-90 transition-transform"
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {Object.entries(subjects).map(([code, data]) => {
                    const stats = getSubjectStats(code);
                    return (
                        <div
                            key={code}
                            className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden"
                        >
                            <div
                                onClick={() => setSelectedSubject(code)}
                                className="cursor-pointer active:scale-95 transition-transform"
                            >
                                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${data.badge ? data.badge.replace('bg-', 'from-') : 'from-blue-500'} to-transparent opacity-10 rounded-bl-full -mr-4 -mt-4 pointer-events-none`}></div>

                                <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center text-white font-black text-xl shadow-md ${data.badge || 'bg-slate-500'}`}>
                                    {code.substring(0, 1)}
                                </div>
                                <h3 className="font-bold text-slate-800 text-base leading-tight mb-1 pr-8">{data.name}</h3>
                                <div className="flex items-end gap-1 leading-none mb-1">
                                    <span className="text-sm font-bold text-slate-800">{stats.new}</span>
                                    <span className="text-xs text-slate-400 font-medium">/{stats.total}</span>
                                </div>
                                <p className="text-[10px] text-slate-400">جديد</p>
                            </div>

                            {/* Always visible edit button on mobile */}
                            <button
                                onClick={(e) => { e.stopPropagation(); openEditSubject(code); }}
                                className="absolute top-2 left-2 text-slate-400 hover:text-blue-600 active:text-blue-700 p-2 bg-white rounded-full shadow-sm border border-slate-100 transition-colors z-10"
                            >
                                <Edit2 size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const LectureListView = () => {
        const list = getManageLectures();

        const removeLastLecture = async () => {
            if (!config || !selectedSubject) return;
            const currentCount = parseInt(config[selectedSubject] || 0);
            if (currentCount === 0) return alert('لا توجد محاضرات لحذفها');

            if (!confirm(`هل تريد حذف المحاضرة رقم ${currentCount}؟`)) return;

            const newCount = currentCount - 1;
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), { ...config, [selectedSubject]: newCount }, { merge: true });

            // Also delete the lecture data if it exists
            const lectureId = `${selectedSubject}_${currentCount}`;
            if (lectures[lectureId]) {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', lectureId));
            }

            alert(`تم حذف المحاضرة ${currentCount} ✅`);
        };

        return (
            <div className="flex flex-col h-screen bg-slate-50">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
                    <div className="p-4 flex items-center gap-4">
                        <button onClick={() => setSelectedSubject(null)} className="p-2 bg-slate-100 rounded-full active:bg-slate-200 transition-colors">
                            <ArrowLeft size={20} className="text-slate-700" />
                        </button>
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-slate-900 leading-none">{subjects[selectedSubject]?.name}</h2>
                            <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">{selectedSubject}</p>
                        </div>
                        {list.length > 0 && (
                            <button
                                onClick={removeLastLecture}
                                className="p-2 bg-red-100 text-red-600 rounded-full shadow-sm active:scale-90 transition-transform"
                                title="حذف آخر محاضرة"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button
                            onClick={addNewLecture}
                            className="p-2 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 active:scale-90 transition-transform"
                            title="إضافة محاضرة جديدة"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
                    {list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <BookOpen size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-sm">لا توجد محاضرات</p>
                            <p className="text-xs mt-2">اضغط + لإضافة محاضرة</p>
                        </div>
                    ) : list.map(l => (
                        <div key={l.id} onClick={() => openEditModal(l)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-all">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-black text-slate-800 text-base">Lec {l.number}</span>
                                    {l.isCompleted && <Check size={14} className="text-green-500 stroke-[3]" />}
                                    {l.stage > 0 && !l.isCompleted && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-md font-bold">
                                            تكرار {l.stage}
                                        </span>
                                    )}
                                </div>
                                {l.title ? (
                                    <p className="text-slate-500 text-xs font-medium mb-1.5">{l.title}</p>
                                ) : (
                                    <p className="text-slate-300 text-xs italic mb-1.5">بدون عنوان</p>
                                )}

                                <div className="flex gap-1.5">
                                    {l.difficulty && (
                                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${l.difficulty === 'easy' ? 'bg-green-50 text-green-600' :
                                            l.difficulty === 'hard' ? 'bg-red-50 text-red-600' :
                                                'bg-blue-50 text-blue-600'
                                            }`}>
                                            {l.difficulty === 'easy' ? 'سهلة' : l.difficulty === 'hard' ? 'صعبة' : 'عادية'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                                <ChevronRight size={18} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-slate-600 font-bold">يرجى تسجيل الدخول أولاً</p>
                    <button onClick={onBack} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">
                        العودة للموقع
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" dir="rtl">

            {/* Main Content */}
            {!selectedSubject ? <SubjectsView /> : <LectureListView />}

            {/* Bottom Nav */}
            {!selectedSubject && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 pb-safe pt-3 px-8 flex justify-around items-center z-40 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
                    <button onClick={() => setActiveTab('subjects')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === 'subjects' ? 'text-slate-900' : 'text-slate-300'}`}>
                        <LayoutGrid size={24} strokeWidth={activeTab === 'subjects' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">المواد</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 text-slate-300">
                        <Search size={24} />
                        <span className="text-[10px] font-bold">بحث</span>
                    </button>
                    <button onClick={onBack} className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-red-400 transition-colors">
                        <ArrowLeft size={24} />
                        <span className="text-[10px] font-bold">خروج</span>
                    </button>
                </div>
            )}

            {/* Subject Modal */}
            {showAddModal && modalType === 'subject' && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                    <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-900">
                                {editingSubjectCode ? 'تعديل مادة' : 'مادة جديدة'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubject} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">كود المادة</label>
                                <input
                                    type="text"
                                    value={newSubject.code || ''}
                                    disabled={!!editingSubjectCode}
                                    onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-left font-mono font-bold text-lg outline-none disabled:bg-slate-200 disabled:text-slate-500"
                                    placeholder="e.g. ANA"
                                />
                                {editingSubjectCode && <p className="text-[10px] text-orange-400 font-medium mt-1">لا يمكن تغيير الكود</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">اسم المادة</label>
                                <input
                                    type="text"
                                    value={newSubject.name || ''}
                                    onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 font-bold outline-none"
                                    placeholder="علم التشريح"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">لون المادة</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {Object.keys(THEMES).map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewSubject({ ...newSubject, theme: color })}
                                            className={`h-12 rounded-xl transition-all ${THEMES[color].badge} ${newSubject.theme === color ? 'ring-4 ring-offset-2 ring-blue-400 scale-105' : 'opacity-50'
                                                }`}
                                        >
                                            <span className="text-white text-xs font-bold">{THEMES[color].name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                {editingSubjectCode && (
                                    <button type="button" onClick={() => deleteSubject(editingSubjectCode)} className="p-4 rounded-xl bg-red-50 text-red-500 hover:bg-red-100">
                                        <Trash2 size={24} />
                                    </button>
                                )}
                                <button type="submit" className="flex-1 bg-slate-900 text-white font-bold text-lg p-4 rounded-xl shadow-xl active:scale-95 transition-transform">
                                    حفظ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lecture Modal */}
            {showAddModal && modalType === 'lecture' && editingTask && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                    <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-900">تعديل محاضرة</h3>
                            <button onClick={() => setShowAddModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTaskDetails} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">المادة</label>
                                <input
                                    type="text"
                                    value={subjects[editingTask.subject]?.name || editingTask.subject}
                                    disabled
                                    className="w-full p-4 bg-slate-100 rounded-2xl border-none font-bold text-slate-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">رقم المحاضرة</label>
                                <input
                                    type="number"
                                    value={editingTask.number}
                                    disabled
                                    className="w-full p-4 bg-slate-100 rounded-2xl border-none font-bold text-center text-lg text-slate-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">العنوان</label>
                                <input
                                    type="text"
                                    value={editingTask.title || ''}
                                    onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="عنوان اختياري"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">الوصف</label>
                                <textarea
                                    value={editingTask.description || ''}
                                    onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                                    placeholder="وصف اختياري"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">الصعوبة</label>
                                <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1">
                                    {['easy', 'normal', 'hard'].map(level => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setEditingTask({ ...editingTask, difficulty: level })}
                                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${editingTask.difficulty === level
                                                ? 'bg-white text-slate-800 shadow-md scale-[1.02]'
                                                : 'text-slate-400'
                                                }`}
                                        >
                                            {level === 'easy' ? 'سهلة 🙂' : level === 'hard' ? 'صعبة 🥵' : 'عادية 😐'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => deleteLecture(editingTask.id)}
                                    className="p-4 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                    title="حذف هذه المحاضرة"
                                >
                                    <Trash2 size={24} />
                                </button>
                                <button type="submit" className="flex-1 bg-slate-900 text-white font-bold text-lg p-4 rounded-xl shadow-xl active:scale-95 transition-transform">
                                    حفظ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileManager;
