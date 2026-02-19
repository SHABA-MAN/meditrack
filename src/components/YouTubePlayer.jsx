import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, SkipForward, SkipBack, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import useAppStore from '../stores/useAppStore';

/**
 * Global YouTube player overlay.
 * Uses the YouTube IFrame API for full playback control:
 * - Play/Pause, Seek, Volume
 * - Duration display  
 * - Auto-progress tracking saved to Zustand store
 */
const YouTubePlayer = () => {
    const { activeVideo, closeVideoPlayer, updateVideoProgress, videoProgress } = useAppStore();
    const playerRef = useRef(null);
    const containerRef = useRef(null);
    const intervalRef = useRef(null);

    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Load YouTube IFrame API
    useEffect(() => {
        if (!activeVideo) return;

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => initPlayer();
        } else {
            initPlayer();
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (playerRef.current?.destroy) {
                try { playerRef.current.destroy(); } catch (e) { /* ignore */ }
            }
            playerRef.current = null;
            setIsReady(false);
        };
    }, [activeVideo?.videoId, activeVideo?.playlistId]);

    const initPlayer = useCallback(() => {
        if (!activeVideo || !containerRef.current) return;

        // Destroy previous
        if (playerRef.current?.destroy) {
            try { playerRef.current.destroy(); } catch (e) { /* ignore */ }
        }

        // Build player config
        // For playlists: videoId is omitted, list + listType go in playerVars
        // For single videos: videoId goes in root config
        const isPlaylist = !!activeVideo.playlistId;
        const rootConfig = isPlaylist ? {} : { videoId: activeVideo.videoId };
        const progressKey = activeVideo.videoId || activeVideo.playlistId;

        const playerVarsConfig = {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            ...(isPlaylist
                ? { list: activeVideo.playlistId, listType: 'playlist' }
                : { start: activeVideo.startAt || 0 }
            ),
        };

        playerRef.current = new window.YT.Player('yt-player-iframe', {
            height: '100%',
            width: '100%',
            ...rootConfig,
            playerVars: playerVarsConfig,
            events: {
                onReady: (event) => {
                    setIsReady(true);
                    setDuration(event.target.getDuration());
                    setIsPlaying(true);

                    // Restore position (single video only)
                    if (!isPlaylist && progressKey) {
                        const saved = videoProgress[progressKey];
                        if (saved?.currentTime > 10) {
                            event.target.seekTo(saved.currentTime, true);
                        }
                    }
                },
                onStateChange: (event) => {
                    setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        setDuration(event.target.getDuration());
                    }
                },
            }
        });

        // Progress tracking interval
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
                const time = playerRef.current.getCurrentTime();
                const dur = playerRef.current.getDuration();
                setCurrentTime(time);
                setDuration(dur);

                if (progressKey && dur > 0) {
                    updateVideoProgress(progressKey, {
                        currentTime: time,
                        duration: dur,
                        percent: Math.round((time / dur) * 100)
                    });
                }
            }
        }, 1000);
    }, [activeVideo, videoProgress, updateVideoProgress]);

    if (!activeVideo) return null;

    const togglePlay = () => {
        if (!playerRef.current) return;
        if (isPlaying) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    };

    const toggleMute = () => {
        if (!playerRef.current) return;
        if (isMuted) {
            playerRef.current.unMute();
        } else {
            playerRef.current.mute();
        }
        setIsMuted(!isMuted);
    };

    const seekTo = (seconds) => {
        if (playerRef.current?.seekTo) {
            playerRef.current.seekTo(seconds, true);
        }
    };

    const skip = (delta) => {
        seekTo(Math.max(0, currentTime + delta));
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-[100] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-72 overflow-hidden">
                <div className="flex items-center gap-2 p-2">
                    <div className="w-12 h-8 bg-slate-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {activeVideo.videoId ? (
                            <img src={`https://img.youtube.com/vi/${activeVideo.videoId}/default.jpg`} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <Play size={12} className="text-slate-500" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{activeVideo.title || 'Video'}</p>
                        <p className="text-slate-500 text-[10px]">{formatTime(currentTime)} / {formatTime(duration)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={togglePlay} className="p-1 text-white hover:text-emerald-400 transition">
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button onClick={() => setIsMinimized(false)} className="p-1 text-slate-400 hover:text-white transition">
                            <Maximize2 size={14} />
                        </button>
                        <button onClick={closeVideoPlayer} className="p-1 text-slate-400 hover:text-red-400 transition">
                            <X size={14} />
                        </button>
                    </div>
                </div>
                {/* Mini progress bar */}
                <div className="h-0.5 bg-slate-800 w-full">
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center" dir="ltr">
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 z-10">
                <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate max-w-[60vw]" title={activeVideo.title}>
                        {activeVideo.title || 'YouTube Player'}
                    </h3>
                    <p className="text-slate-500 text-xs">{formatTime(currentTime)} / {formatTime(duration)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsMinimized(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="تصغير">
                        <Minimize2 size={18} />
                    </button>
                    <button onClick={closeVideoPlayer} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition" title="إغلاق">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Video Container */}
            <div ref={containerRef} className="w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                <div id="yt-player-iframe" className="w-full h-full" />
            </div>

            {/* Bottom Controls */}
            <div className="w-full max-w-4xl mt-4 px-4">
                {/* Progress Bar */}
                <div className="relative w-full h-2 bg-slate-800 rounded-full cursor-pointer group"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        seekTo(percent * duration);
                    }}
                >
                    <div className="absolute h-full bg-red-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                    <div className="absolute h-4 w-4 bg-red-500 rounded-full top-1/2 transform -translate-y-1/2 shadow-lg opacity-0 group-hover:opacity-100 transition" style={{ left: `calc(${progressPercent}% - 8px)` }} />
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-4 mt-4">
                    <button onClick={() => skip(-10)} className="p-2 text-slate-400 hover:text-white transition" title="10 ثوانٍ للخلف">
                        <SkipBack size={20} />
                    </button>
                    <button onClick={togglePlay} className="p-3 bg-white text-black rounded-full hover:bg-slate-200 transition shadow-lg" title={isPlaying ? 'إيقاف' : 'تشغيل'}>
                        {isPlaying ? <Pause size={24} /> : <Play size={24} fill="black" />}
                    </button>
                    <button onClick={() => skip(10)} className="p-2 text-slate-400 hover:text-white transition" title="10 ثوانٍ للأمام">
                        <SkipForward size={20} />
                    </button>
                    <button onClick={toggleMute} className="p-2 text-slate-400 hover:text-white transition ml-4" title={isMuted ? 'تفعيل الصوت' : 'كتم'}>
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default YouTubePlayer;
