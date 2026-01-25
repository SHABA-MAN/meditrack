import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
