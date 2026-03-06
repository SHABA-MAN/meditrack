// Shared constants used across the application

// Theme colors for subjects
export const THEMES = {
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

// Default subjects for new users
export const DEFAULT_SUBJECTS = {
    TSF: { name: 'تشريح', theme: 'indigo', ...THEMES.indigo },
    CBG: { name: 'كيمياء حيوية', theme: 'emerald', ...THEMES.emerald },
    BIO: { name: 'أحياء', theme: 'rose', ...THEMES.rose },
    ANA: { name: 'تشريح', theme: 'blue', ...THEMES.blue },
    PMD: { name: 'طب مجتمع', theme: 'amber', ...THEMES.amber }
};

// Spaced repetition intervals (in days)
export const INTERVALS = [1, 2, 4, 7];

// Difficulty levels and their display configuration
export const DIFFICULTY_LEVELS = ['easy', 'normal', 'hard'];

export const DIFFICULTY_CONFIG = {
    easy: { label: 'سهلة', emoji: '🙂', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    normal: { label: 'عادية', emoji: '😐', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    hard: { label: 'صعبة', emoji: '🥵', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
};
