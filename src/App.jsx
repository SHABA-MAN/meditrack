import { useState } from 'react'
import MediTrack from './MediTrack.jsx'
import LifeTrack from './LifeTrack.jsx'

const App = () => {
  const [currentView, setCurrentView] = useState('meditrack');
  const appId = 'meditrack-v1';

  if (currentView === 'lifetrack') {
    return <LifeTrack appId={appId} onBack={() => setCurrentView('meditrack')} />;
  }

  return <MediTrack onSwitchToLifeTrack={() => setCurrentView('lifetrack')} />;
};

export default App;
