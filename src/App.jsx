import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import LifeTrack from './LifeTrack';
import AchievementCalendar from './AchievementCalendar';
import TimeBoxing from './TimeBoxing';
import MediTrackApp from './components/MediTrackApp';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

import MobileManager from './components/MobileManager';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('meditrack');

  useEffect(() => {
    // Check for "Manage" route using hash
    const checkRoute = () => {
      if (window.location.hash === '#/manage') {
        setCurrentView('mobile-manager');
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', checkRoute);
    };
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
    return <MobileManager user={user} onBack={() => { window.location.hash = ''; setCurrentView('meditrack'); }} />;
  }

  if (currentView === 'lifetrack') {
    return <LifeTrack onBack={() => setCurrentView('meditrack')} user={user} db={db} />;
  }

  if (currentView === 'timeboxing') {
    return <TimeBoxing onBack={() => setCurrentView('meditrack')} user={user} db={db} />;
  }

  if (currentView === 'calendar') {
    return <AchievementCalendar onBack={() => setCurrentView('meditrack')} user={user} db={db} />;
  }

  return <>
    <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#f1f5f9', borderRadius: '12px', fontSize: '14px', direction: 'rtl' } }} />
    <MediTrackApp
      onSwitchToLifeTrack={() => setCurrentView('lifetrack')}
      onSwitchToTimeBoxing={() => setCurrentView('timeboxing')}
      user={user}
    />
  </>;
};

export default App;
