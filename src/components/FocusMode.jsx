import React, { useState } from 'react';
import { X, Youtube, Maximize2, Minimize2, CheckCircle, Clock } from 'lucide-react';
import ReactPlayer from 'react-player';

const FocusMode = ({ 
  isOpen, 
  onClose, 
  focusQueue, 
  completeTask, 
  removeFromQueue, 
  activeVideo, 
  setActiveVideo 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  
  // Basic timer logic (useEffect would be needed in LifeTrack or here if fully extracted, 
  // but for now we'll keep it simple or assume timer logic is passed down or handled here)
  // Since we are extracting, let's keep the UI primarily. 
  // Note: The original timer logic was interval based in the main component. 
  // For a proper extraction, we should move the timer logic here.
  
  React.useEffect(() => {
    let interval;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      // Play sound?
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
         <div className="flex items-center gap-4">
            <div className="bg-amber-500/20 p-2 rounded text-amber-500 font-bold px-4 flex items-center gap-2">
               <Clock size={16}/> 
               <span className="text-xl font-mono">{formatTime(timeLeft)}</span>
            </div>
            <button onClick={() => setTimerActive(!timerActive)} className={`px-4 py-2 rounded font-bold transition ${timerActive ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}>
               {timerActive ? 'إيقاف' : 'بدء المؤقت'}
            </button>
         </div>
         <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X/></button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex flex-col items-center">
         <div className="w-full max-w-4xl space-y-8">
            {focusQueue.map((task, index) => (
               <div key={task.id} className={`bg-slate-900 border ${index === 0 ? 'border-amber-500/50 shadow-[0_0_30px_-5px_rgba(245,158,11,0.1)]' : 'border-slate-800 opacity-50'} rounded-2xl overflow-hidden transition-all duration-500`}>
                  {/* VIDEO PLAYER */}
                  {task.videoId && index === 0 ? (
                    <div className="relative aspect-video bg-black group">
                       <ReactPlayer 
                          url={`${task.videoUrl}${task.playlistId ? `&list=${task.playlistId}` : ''}`}
                          width="100%" 
                          height="100%" 
                          controls={true}
                          playing={activeVideo === task.id}
                          onPlay={() => { setActiveVideo(task.id); setTimerActive(true); }}
                          onPause={() => { setActiveVideo(null); setTimerActive(false); }}
                          config={{
                              youtube: {
                                  playerVars: { showinfo: 1, modestbranding: 1, rel: 0 }
                              }
                          }}
                       />
                       <button onClick={() => setIsFullscreen(!isFullscreen)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition">
                         {isFullscreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
                       </button>
                    </div>
                  ) : null}

                  <div className="p-6 w-full">
                    <h2 className="text-xl font-bold text-white mb-2 leading-relaxed flex items-center justify-center gap-2">
                      {task.videoId && <Youtube className="text-red-600" size={24}/>}
                      {task.title}
                    </h2>
                    {task.description && <p className="text-slate-400 text-sm mb-6 whitespace-pre-wrap text-center">{task.description}</p>}
                    
                    <div className="mt-4 flex justify-center gap-4">
                       <button onClick={async () => {
                           await completeTask(task);
                           removeFromQueue(task.id);
                           if(focusQueue.length <= 1) onClose();
                       }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-emerald-500/20 transition-all transform hover:scale-105">
                         <CheckCircle size={20}/> إنجاز المهمة
                       </button>
                    </div>
                  </div>
               </div>
            ))}
            
            {focusQueue.length === 0 && (
               <div className="text-center text-slate-500 py-20">
                  <p>لا توجد مهام في قائمة التركيز</p>
                  <button onClick={onClose} className="mt-4 text-amber-500 hover:underline">العودة وإضافة مهام</button>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default FocusMode;
