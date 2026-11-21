import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Video, X, ShieldAlert, Check } from 'lucide-react';

export interface VideoSyncState {
  url: string;
  isPlaying: boolean;
  currentTime: number;
  timestamp: number;
}

export interface ClassroomVideoSyncProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher: boolean;
  onBroadcastVideoState?: (state: VideoSyncState) => void;
  remoteVideoState?: VideoSyncState;
}

export const ClassroomVideoSync: React.FC<ClassroomVideoSyncProps> = ({
  isOpen,
  onClose,
  isTeacher,
  onBroadcastVideoState,
  remoteVideoState,
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Synchronize when remoteVideoState arrives from tutor
  useEffect(() => {
    if (remoteVideoState && !isTeacher) {
      if (remoteVideoState.url && remoteVideoState.url !== activeUrl) {
        setActiveUrl(remoteVideoState.url);
      }
      setIsPlaying(remoteVideoState.isPlaying);
      setCurrentTime(remoteVideoState.currentTime);
      if (videoRef.current) {
        try {
          if (Math.abs(videoRef.current.currentTime - remoteVideoState.currentTime) > 1.5) {
            videoRef.current.currentTime = remoteVideoState.currentTime;
          }
          if (remoteVideoState.isPlaying) {
            const p = videoRef.current.play();
            if (p && typeof p.catch === 'function') {
              p.catch(() => {});
            }
          } else {
            videoRef.current.pause();
          }
        } catch {}
      }
    }
  }, [remoteVideoState, isTeacher, activeUrl]);

  if (!isOpen) return null;

  const handleLoadVideo = () => {
    if (!videoUrl.trim()) return;
    setActiveUrl(videoUrl.trim());
    setIsPlaying(false);
    onBroadcastVideoState?.({
      url: videoUrl.trim(),
      isPlaying: false,
      currentTime: 0,
      timestamp: Date.now(),
    });
  };

  const handleTogglePlay = () => {
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    const curr = videoRef.current?.currentTime || currentTime;
    if (videoRef.current) {
      try {
        if (nextPlay) {
          const p = videoRef.current.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } else {
          videoRef.current.pause();
        }
      } catch {}
    }
    onBroadcastVideoState?.({
      url: activeUrl,
      isPlaying: nextPlay,
      currentTime: curr,
      timestamp: Date.now(),
    });
  };

  return (
    <div
      data-testid="classroom-video-sync-hud"
      className="fixed bottom-24 left-4 z-40 w-96 bg-stone-900/95 border border-stone-800 rounded-2xl p-4 shadow-2xl shadow-black/80 text-stone-100 flex flex-col gap-3 backdrop-blur-md"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Video className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-stone-200">
            Synchronized Lesson Video
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Video Player"
          className="p-1 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Teacher URL Input Bar */}
      {isTeacher ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            data-testid="video-url-input"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste video or MP4 URL..."
            className="flex-1 bg-stone-800/80 border border-stone-700/60 rounded-xl px-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            onClick={handleLoadVideo}
            data-testid="load-video-btn"
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs active:scale-95 transition-all shadow-sm"
          >
            Load
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Controlled by tutor in real-time</span>
        </div>
      )}

      {/* Video Viewport */}
      {activeUrl ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-stone-800">
          <video
            ref={videoRef}
            src={activeUrl}
            data-testid="sync-video-player"
            className="w-full h-full object-contain"
            controls={false}
            playsInline
          />
          {/* Controls Bar for Teacher */}
          {isTeacher && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between p-1.5 rounded-lg bg-stone-950/80 backdrop-blur-sm border border-stone-800/80">
              <button
                onClick={handleTogglePlay}
                data-testid="video-play-toggle-btn"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video rounded-xl border border-dashed border-stone-800 flex flex-col items-center justify-center text-center p-4 text-stone-500 gap-1.5">
          <Video className="w-6 h-6 opacity-40" />
          <p className="text-xs">No video loaded yet</p>
        </div>
      )}
    </div>
  );
};
