import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, VideoOff, Monitor } from 'lucide-react';

export interface VideoCardProps {
  stream?: MediaStream | null;
  track?: MediaStreamTrack | null;
  participantName: string;
  roleBadge?: string;
  isLocal?: boolean;
  isCameraOff?: boolean;
  isVideoOff?: boolean;
  isAudioMuted?: boolean;
  isAudioActive?: boolean;
  isScreenSharing?: boolean;
  avatarUrl?: string;
  className?: string;
  onClick?: () => void;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || '?';
}

export const VideoCard: React.FC<VideoCardProps> = ({
  stream,
  track,
  participantName,
  roleBadge,
  isLocal = false,
  isCameraOff,
  isVideoOff,
  isAudioMuted = false,
  isAudioActive = false,
  isScreenSharing = false,
  avatarUrl,
  className = '',
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determine if video is disabled/off
  // Explicit props take precedence; fallback to track enabled state or stream video tracks
  const isVideoDisabled =
    isCameraOff !== undefined
      ? isCameraOff
      : isVideoOff !== undefined
      ? isVideoOff
      : track !== undefined
      ? !track || !track.enabled
      : stream !== undefined
      ? !stream || !stream.getVideoTracks().some((t) => t.enabled)
      : true;

  // Attach stream or track to video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      videoEl.srcObject = stream;
    } else if (track) {
      if (typeof MediaStream !== 'undefined') {
        try {
          videoEl.srcObject = new MediaStream([track]);
        } catch {
          videoEl.srcObject = { getTracks: () => [track], getVideoTracks: () => [track] } as any;
        }
      } else {
        videoEl.srcObject = { getTracks: () => [track], getVideoTracks: () => [track] } as any;
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, track]);

  return (
    <div
      data-testid="video-card"
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-[#09090c] border border-white/10 shadow-lg select-none transition-all duration-200 ${
        isAudioActive && !isAudioMuted ? 'ring-2 ring-emerald-500/50 border-emerald-400/40' : ''
      } ${className}`}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        data-testid="video-element"
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full transition-opacity duration-300 ${
          isScreenSharing ? 'object-contain bg-black' : 'object-cover'
        } ${isVideoDisabled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={isLocal && !isScreenSharing ? { transform: 'scaleX(-1)' } : undefined}
      />

      {/* Camera-Off Avatar Fallback */}
      {isVideoDisabled && (
        <div
          data-testid="avatar-fallback"
          className="absolute inset-0 flex flex-col items-center justify-center bg-[#101016] p-4 text-center z-10 select-none"
        >
          <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-indigo-900/60 to-zinc-800/80 border border-white/10 shadow-xl mb-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={participantName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span
                data-testid="avatar-initials"
                className="text-2xl sm:text-3xl font-semibold text-zinc-200"
              >
                {getInitials(participantName)}
              </span>
            )}
            <span
              data-testid="avatar-camera-off-icon"
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-rose-500/90 border border-white/20 text-white shadow"
              title="Camera off"
            >
              <VideoOff className="w-3.5 h-3.5" />
            </span>
          </div>
          <span
            data-testid="avatar-participant-name"
            className="text-sm font-medium text-zinc-200 max-w-[85%] truncate"
          >
            {participantName}
          </span>
          <span className="text-xs text-zinc-500 mt-0.5">Camera is turned off</span>
        </div>
      )}

      {/* Screen Sharing Badge Indicator */}
      {isScreenSharing && (
        <div
          data-testid="screen-share-badge"
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200 text-xs font-medium backdrop-blur-md"
        >
          <Monitor className="w-3.5 h-3.5 text-sky-400" />
          <span>Screen Sharing</span>
        </div>
      )}

      {/* Bottom Name & Audio Indicator Badge */}
      <div
        data-testid="participant-badge-container"
        className="absolute bottom-3 left-3 z-20 flex items-center gap-2 max-w-[calc(100%-1.5rem)]"
      >
        <div
          data-testid="participant-name-badge"
          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/65 border border-white/10 backdrop-blur-md text-zinc-100 text-xs font-medium truncate"
        >
          {/* Audio Activity / Muted Indicator */}
          {isAudioMuted ? (
            <span data-testid="audio-muted-badge" title="Muted">
              <MicOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            </span>
          ) : isAudioActive ? (
            <span
              data-testid="audio-activity-indicator"
              title="Speaking"
              className="flex items-center gap-0.5"
            >
              <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-pulse delay-75" />
              <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse delay-150" />
            </span>
          ) : (
            <span data-testid="audio-idle-badge" title="Microphone Active">
              <Mic className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </span>
          )}

          <span data-testid="participant-name" className="truncate">
            {participantName} {isLocal && '(You)'}
          </span>

          {roleBadge && (
            <span
              data-testid="participant-role-badge"
              className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 shrink-0"
            >
              {roleBadge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
