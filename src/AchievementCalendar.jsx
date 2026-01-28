import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, BookOpen, CheckCircle, Zap, ArrowRight } from 'lucide-react';
import { getMonthAchievements } from './utils/achievements';

const AchievementCalendar = ({ user, db, onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [achievements, setAchievements] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // جلب البيانات عند تغيير الشهر
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getMonthAchievements(db, user.uid, currentYear, currentMonth);
      setAchievements(data);
      setLoading(false);
    };
    
    if (user && db) {
      fetchData();
    }
  }, [currentYear, currentMonth, user, db]);

  // الحصول على أيام الشهر
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // إضافة أيام فارغة في البداية
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // إضافة أيام الشهر
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day);
    }
    
    return days;
  };

  const changeMonth = (delta) => {
    setCurrentDate(new Date(currentYear, currentMonth + delta, 1));
    setSelectedDate(null);
  };

  const getDateKey = (day) => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getDayAchievements = (day) => {
    if (!day) return null;
    const dateKey = getDateKey(day);
    return achievements[dateKey];
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           currentMonth === today.getMonth() && 
           currentYear === today.getFullYear();
  };

  const days = getDaysInMonth();
  const monthName = currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  // عرض تفاصيل اليوم المحدد
  const renderDayDetails = () => {
    if (!selectedDate) return null;
    
    const dateKey = getDateKey(selectedDate);
    const dayData = achievements[dateKey];
    
    if (!dayData || !dayData.items || dayData.items.length === 0) {
      return (
        <div className="text-center py-8 text-slate-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد إنجازات في هذا اليوم</p>
        </div>
      );
    }

    // تجميع حسب النوع
    const studyItems = dayData.items.filter(item => item.type === 'study');
    const taskItems = dayData.items.filter(item => item.type === 'task');

    return (
      <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
        {/* جلسات المذاكرة */}
        {studyItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
              <BookOpen size={16} className="text-blue-500" />
              <h4 className="font-bold text-slate-700 text-sm">جلسات المذاكرة ({studyItems.length})</h4>
            </div>
            <div className="space-y-2">
              {studyItems.map((item, idx) => (
                <div key={idx} className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-blue-900">
                      {item.subject} - Lec {item.number}
                    </span>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {item.stageCompleted === 0 ? 'مذاكرة أولى' : `مراجعة ${item.stageCompleted}`}
                    </span>
                  </div>
                  {item.title && <p className="text-xs text-blue-700 mb-1">{item.title}</p>}
                  <p className="text-xs text-blue-500">
                    {new Date(item.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* المهام المكتملة */}
        {taskItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
              <CheckCircle size={16} className="text-emerald-500" />
              <h4 className="font-bold text-slate-700 text-sm">المهام المكتملة ({taskItems.length})</h4>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {taskItems.map((item, idx) => (
                <div key={idx} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-emerald-900 break-words line-clamp-2">
                        {item.title || 'مهمة بدون عنوان'}
                      </p>
                      {item.stage && (
                        <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full inline-block mt-1">
                          {item.stage}
                        </span>
                      )}
                      <p className="text-xs text-emerald-500 mt-1">
                        {new Date(item.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowRight size={20} className="text-slate-600" />
            </button>
            <div className="bg-slate-900 text-white p-2 rounded-md">
              <Calendar size={20} />
            </div>
            <h1 className="font-bold text-lg text-slate-800">تقويم الإنجازات</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* التقويم */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            {/* التحكم في الشهر */}
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronRight size={20} className="text-slate-600" />
              </button>
              
              <h2 className="text-xl font-bold text-slate-800">{monthName}</h2>
              
              <button 
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
            </div>

            {/* أيام الأسبوع */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-slate-500 py-2">
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* شبكة الأيام */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, idx) => {
                  const dayData = getDayAchievements(day);
                  const hasAchievements = dayData && dayData.items && dayData.items.length > 0;
                  const today = isToday(day);
                  const selected = selectedDate === day;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => day && setSelectedDate(day)}
                      disabled={!day}
                      className={`
                        aspect-square rounded-xl text-sm font-medium transition-all relative
                        ${!day ? 'invisible' : ''}
                        ${today ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                        ${selected ? 'bg-slate-900 text-white scale-105 shadow-lg' : ''}
                        ${!selected && hasAchievements ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200' : ''}
                        ${!selected && !hasAchievements ? 'bg-slate-50 text-slate-600 hover:bg-slate-100' : ''}
                      `}
                    >
                      <span className="relative z-10">{day}</span>
                      
                      {/* مؤشر الإنجازات */}
                      {hasAchievements && !selected && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                          {dayData.items.filter(i => i.type === 'study').length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          )}
                          {dayData.items.filter(i => i.type === 'task').length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          )}
                        </div>
                      )}
                      
                      {/* عدد الإنجازات */}
                      {hasAchievements && dayData.items.length > 3 && !selected && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {dayData.items.length}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-slate-600">مذاكرة</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-600">مهام</span>
              </div>
            </div>
          </div>

          {/* تفاصيل اليوم */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">
                {selectedDate ? `${selectedDate} ${currentDate.toLocaleDateString('ar-EG', { month: 'long' })}` : 'اختر يوماً'}
              </h3>
              {selectedDate && (
                <button 
                  onClick={() => setSelectedDate(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            
            {renderDayDetails()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementCalendar;
