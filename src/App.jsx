import React, { useState, useEffect } from 'react';
import LifeTrack from './LifeTrack';
import AchievementCalendar from './AchievementCalendar';
import MediTrackApp from './components/MediTrackApp';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

import MobileManager from './components/MobileManager';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('meditrack');

  useEffect(() => {
    // Check for "Manage" route
    if (window.location.pathname === '/manage') {
      setCurrentView('mobile-manager');
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for calendar switch event
  useEffect(() => {
    const handleCalendarSwitch = () => {
      setCurrentView('calendar');
    };

    window.addEventListener('switchToCalendar', handleCalendarSwitch);
    return () => window.removeEventListener('switchToCalendar', handleCalendarSwitch);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-slate-600 font-bold">جاري تحميل النظام...</div>;

  if (currentView === 'mobile-manager') {
    return <MobileManager user={user} onBack={() => { window.history.pushState({}, '', '/'); setCurrentView('meditrack'); }} />;
  }

  if (currentView === 'lifetrack') {
    return <LifeTrack onBack={() => setCurrentView('meditrack')} user={user} db={db} />;
  }

  if (currentView === 'calendar') {
    return <AchievementCalendar onBack={() => setCurrentView('meditrack')} user={user} db={db} />;
  }

  return <MediTrackApp
    onSwitchToLifeTrack={() => setCurrentView('lifetrack')}
    user={user}
  />;
};

export default App;
