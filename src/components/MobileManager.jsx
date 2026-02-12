import React, { useState, useEffect } from 'react';
import { db, appId } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import {
    Library, Settings, Plus, ChevronRight, Search,
    MoreHorizontal, Edit2, Trash2, X, Check, ArrowLeft,
    LayoutGrid, BookOpen
} from 'lucide-react';

// Import THEMES from main app
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
    const [subjects, setSubjects] = useState({});
    const [lectures, setLectures] = useState({});
    const [config, setConfig] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [modalType, setModalType] = useState('lecture');

    // Input States
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (!user) return;

        // Load subject definitions
        const unsubSubjects = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), (snap) => {
            if (snap.exists()) setSubjects(snap.data());
        });

        // Load config (lecture counts)
        const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), (snap) => {
            if (snap.exists()) setConfig(snap.data());
        });

        // Load lectures
        const unsubLectures = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'lectures'), (snap) => {
            const data = {};
            snap.forEach(d => data[d.id] = d.data());
            setLectures(data);
        });

        return () => { unsubSubjects(); unsubConfig(); unsubLectures(); };
    }, [user]);

    // Actions
    const handleSave = async () => {
        if (!user) return;

        if (modalType === 'subject') {
            const code = formData.code?.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!code || !formData.name) return alert('يرجى ملء الكود والاسم');

            // Check for duplicates
            if (!editingItem && subjects[code]) return alert('هذا الكود موجود بالفعل!');

            const theme = THEMES[formData.theme || 'blue'];
            const newData = { ...subjects, [code]: { ...theme, name: formData.name, theme: formData.theme || 'blue' } };

            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);

            // Initialize config if new subject
            if (!editingItem && (!config || config[code] === undefined)) {
                await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'subjects'), { ...config, [code]: 0 }, { merge: true });
            }

            alert(editingItem ? 'تم تعديل المادة بنجاح ✅' : 'تم إضافة المادة بنجاح ✅');
        } else {
            // Save Lecture - EXACTLY like main app
            if (!formData.subject || !formData.number) return alert('المادة والرقم مطلوبان');

            const id = editingItem?.id || `${formData.subject}_${formData.number}`;
            const data = {
                id,
                subject: formData.subject,
                number: parseInt(formData.number),
                title: formData.title || '',
                description: formData.description || '',
                difficulty: formData.difficulty || 'normal',
                stage: editingItem?.stage !== undefined ? editingItem.stage : 0,
                nextReview: editingItem?.nextReview || null,
                isCompleted: editingItem?.isCompleted || false,
                lastStudied: editingItem?.lastStudied || null
            };

            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', id), data, { merge: true });
            alert(editingItem ? 'تم تعديل المحاضرة ✅' : 'تم إضافة المحاضرة ✅');
        }

        setShowAddModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleDelete = async (item, type) => {
        if (!confirm('هل أنت متأكد من الحذف؟')) return;

        if (type === 'lecture') {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lectures', item.id));
            alert('تم حذف المحاضرة ✅');
        } else {
            if (!confirm(`هل أنت متأكد من حذف مادة ${item.code}؟ لن يتم حذف المحاضرات القديمة ولكن لن تظهر المادة.`)) return;

            const newData = { ...subjects };
            delete newData[item.code];
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'definitions'), newData);
            setSelectedSubject(null);
            alert('تم حذف المادة ✅');
        }
        setShowAddModal(false);
    };

    const openAddLecture = (subjCode = null) => {
        setModalType('lecture');
        setFormData({ subject: subjCode || Object.keys(subjects)[0], number: '', difficulty: 'normal', title: '', description: '' });
        setEditingItem(null);
        setShowAddModal(true);
    };

    const openEditLecture = (lecture) => {
        setModalType('lecture');
        setFormData({ ...lecture });
        setEditingItem(lecture);
        setShowAddModal(true);
    };

    const openEditSubject = (code) => {
        setModalType('subject');
        setFormData({ code, ...subjects[code] });
        setEditingItem({ id: code, code });
        setShowAddModal(true);
    };

    // Views
    const SubjectsView = () => (
        <div className="p-4 space-y-3 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">المواد الدراسية</h2>
                <button
                    onClick={() => { setModalType('subject'); setFormData({ theme: 'blue' }); setEditingItem(null); setShowAddModal(true); }}
                    className="bg-slate-900 text-white p-3 rounded-full shadow-lg shadow-slate-200 active:scale-90 transition-transform"
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {Object.entries(subjects).map(([code, data]) => {
                    const count = Object.values(lectures).filter(l => l.subject === code).length;
                    const total = config?.[code] || 0;
                    return (
                        <div
                            key={code}
                            onClick={() => setSelectedSubject(code)}
                            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 active:scale-95 transition-all duration-200 relative group overflow-hidden"
                        >
                            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${data.badge ? data.badge.replace('bg-', 'from-') : 'from-blue-500'} to-transparent opacity-10 rounded-bl-full -mr-4 -mt-4`}></div>

                            <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center text-white font-black text-xl shadow-md ${data.badge || 'bg-slate-500'}`}>
                                {code.substring(0, 1)}
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{data.name}</h3>
                            <p className="text-xs text-slate-400 font-bold">{count} محاضرة {total > 0 && `من ${total}`}</p>

                            <button
                                onClick={(e) => { e.stopPropagation(); openEditSubject(code); }}
                                className="absolute top-3 left-3 text-slate-300 hover:text-slate-600 p-1 bg-white/50 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
        const list = Object.values(lectures)
            .filter(l => l.subject === selectedSubject)
            .sort((a, b) => a.number - b.number);

        return (
            <div className="flex flex-col h-screen bg-slate-50">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 pt-safe-top sticky top-0 z-20">
                    <div className="p-4 flex items-center gap-4">
                        <button onClick={() => setSelectedSubject(null)} className="p-2 bg-slate-100 rounded-full active:bg-slate-200 transition-colors">
                            <ArrowLeft size={20} className="text-slate-700" />
                        </button>
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-slate-900 leading-none">{subjects[selectedSubject]?.name}</h2>
                            <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">{selectedSubject}</p>
                        </div>
                        <button
                            onClick={() => openAddLecture(selectedSubject)}
                            className="p-2 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 active:scale-90 transition-transform"
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
                            <p className="font-bold text-sm">لا توجد محاضرات بعد</p>
                            <p className="text-xs mt-2">اضغط + لإضافة محاضرة جديدة</p>
                        </div>
                    ) : list.map(l => (
                        <div key={l.id} onClick={() => openEditLecture(l)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-all">
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
                                {l.title && <p className="text-slate-500 text-xs font-medium mb-1.5">{l.title}</p>}

                                <div className="flex gap-1.5">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${l.difficulty === 'easy' ? 'bg-green-50 text-green-600' :
                                        l.difficulty === 'hard' ? 'bg-red-50 text-red-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                        {l.difficulty === 'easy' ? 'سهلة' : l.difficulty === 'hard' ? 'صعبة' : 'عادية'}
                                    </span>
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

            {/* Bottom Nav (Only visible on main screen) */}
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

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAddModal(false)}>
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                {modalType === 'subject' ? (editingItem ? 'تعديل مادة' : 'مادة جديدة') : (editingItem ? 'تعديل محاضرة' : 'محاضرة جديدة')}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {modalType === 'subject' ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">كود المادة</label>
                                        <input
                                            type="text"
                                            value={formData.code || ''}
                                            disabled={!!editingItem}
                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-left font-mono font-bold text-lg outline-none transition-all placeholder:text-slate-300"
                                            placeholder="e.g. ANA"
                                        />
                                        {editingItem && <p className="text-[10px] text-orange-400 font-medium mt-1">لا يمكن تغيير الكود للمواد الموجودة</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">اسم المادة</label>
                                        <input
                                            type="text"
                                            value={formData.name || ''}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 font-bold outline-none transition-all placeholder:text-slate-300"
                                            placeholder="مثال: علم التشريح"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">لون المادة</label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {Object.keys(THEMES).map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, theme: color })}
                                                    className={`h-12 rounded-xl transition-all ${THEMES[color].badge} ${formData.theme === color ? 'ring-4 ring-offset-2 ring-blue-400 scale-105' : 'opacity-50'
                                                        }`}
                                                >
                                                    <span className="text-white text-xs font-bold">{THEMES[color].name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">المادة</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.subject || ''}
                                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500"
                                                    disabled={!!editingItem}
                                                >
                                                    {Object.keys(subjects).map(code => (
                                                        <option key={code} value={code}>{subjects[code].name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <ChevronRight size={16} className="rotate-90" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">رقم #</label>
                                            <input
                                                type="number"
                                                value={formData.number || ''}
                                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                                                className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 font-bold text-center text-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                disabled={!!editingItem}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">عنوان المحاضرة</label>
                                        <input
                                            type="text"
                                            value={formData.title || ''}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-300"
                                            placeholder="عنوان اختياري"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">وصف المحاضرة</label>
                                        <textarea
                                            value={formData.description || ''}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-300 min-h-[80px]"
                                            placeholder="وصف اختياري"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">الصعوبة</label>
                                        <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1">
                                            {['easy', 'normal', 'hard'].map(level => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, difficulty: level })}
                                                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${formData.difficulty === level
                                                        ? 'bg-white text-slate-800 shadow-md transform scale-[1.02]'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {level === 'easy' ? 'سهلة 🙂' : level === 'hard' ? 'صعبة 🥵' : 'عادية 😐'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="pt-6 flex gap-3">
                                {editingItem && (
                                    <button
                                        onClick={() => handleDelete(editingItem, modalType)}
                                        className="p-4 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 size={24} />
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-slate-900 text-white font-bold text-lg p-4 rounded-xl shadow-xl shadow-slate-200 active:scale-95 transition-transform"
                                >
                                    حفظ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileManager;
