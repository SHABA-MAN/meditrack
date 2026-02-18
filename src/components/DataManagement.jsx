import React, { useState } from 'react';
import { Download, Upload, Loader2, X, FileJson, CheckCircle } from 'lucide-react';
import { db, appId } from '../firebase';
import { exportAllData, importData } from '../services/settingsService';
import toast from 'react-hot-toast';

const DataManagement = ({ user, onClose }) => {
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    const handleExport = async () => {
        if (!user) return;
        setExporting(true);
        try {
            const data = await exportAllData(db, user.uid);
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meditrack-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('تم تصدير البيانات بنجاح! 📦');
        } catch (e) {
            console.error('Export failed:', e);
            toast.error('فشل تصدير البيانات');
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.tasks && !data.lectures && !data.settings) {
                toast.error('ملف غير صالح — لا يحتوي على بيانات معروفة');
                return;
            }

            if (!confirm('سيتم دمج البيانات المستوردة مع بياناتك الحالية. هل تريد المتابعة؟')) return;

            const count = await importData(db, user.uid, data);
            toast.success(`تم استيراد ${count} عنصر بنجاح! 📥`);
        } catch (e) {
            console.error('Import failed:', e);
            toast.error('فشل استيراد البيانات — تأكد من صحة الملف');
        } finally {
            setImporting(false);
            e.target.value = ''; // Reset file input
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-6"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileJson className="w-5 h-5 text-amber-400" />
                        إدارة البيانات
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Export */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h3 className="text-sm font-bold text-emerald-400 mb-2">📦 تصدير البيانات</h3>
                    <p className="text-xs text-slate-400 mb-3">
                        تصدير جميع المهام والمحاضرات والإعدادات والإنجازات إلى ملف JSON.
                    </p>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-2.5 rounded-lg transition text-sm"
                    >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {exporting ? 'جارٍ التصدير...' : 'تصدير الآن'}
                    </button>
                </div>

                {/* Import */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h3 className="text-sm font-bold text-blue-400 mb-2">📥 استيراد البيانات</h3>
                    <p className="text-xs text-slate-400 mb-3">
                        استيراد بيانات من ملف JSON سابق. سيتم دمجها مع البيانات الحالية.
                    </p>
                    <label className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold py-2.5 rounded-lg transition text-sm cursor-pointer">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {importing ? 'جارٍ الاستيراد...' : 'اختيار ملف'}
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            disabled={importing}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Info */}
                <div className="flex items-start gap-2 text-xs text-slate-500">
                    <CheckCircle className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                    <span>البيانات لا تُرسل لأي خادم خارجي — التصدير والاستيراد يتم محلياً.</span>
                </div>
            </div>
        </div>
    );
};

export default DataManagement;
