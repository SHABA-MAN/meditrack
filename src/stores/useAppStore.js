import { create } from 'zustand';

/**
 * App-wide UI store for shared state across views.
 * This avoids prop-drilling and keeps components decoupled.
 */
const useAppStore = create((set, get) => ({
    // --- Active Video Player ---
    activeVideo: null, // { videoId, title, taskId, playlistId?, startAt? }
    videoProgress: {},  // { [videoId]: { currentTime, duration, percent } }

    openVideoPlayer: (video) => set({ activeVideo: video }),
    closeVideoPlayer: () => set({ activeVideo: null }),

    updateVideoProgress: (videoId, progress) => set((state) => ({
        videoProgress: {
            ...state.videoProgress,
            [videoId]: progress
        }
    })),

    // --- Global Loading ---
    globalLoading: false,
    setGlobalLoading: (loading) => set({ globalLoading: loading }),

    // --- Current View ---
    currentView: 'meditrack',
    setCurrentView: (view) => set({ currentView: view }),
}));

export default useAppStore;
