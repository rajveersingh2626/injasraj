import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Star } from 'lucide-react';

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

  // Star rewards
  starsCount?: number;
  onAwardStar?: () => void;
  canAwardStar?: boolean;

  // Local media controls under/on video
  onToggleMic?: () => void;
  onToggleCamera?: () => void;

  // Teacher remote media controls for students
  canControlRemoteMedia?: boolean;
  onRemoteToggleMic?: () => void;
  onRemoteToggleCamera?: () => void;
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
  starsCount = 0,
  onAwardStar,
  canAwardStar = false,
  onToggleMic,
  onToggleCamera,
  canControlRemoteMedia = false,
  onRemoteToggleMic,
  onRemoteToggleCamera,
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

      {/* Top-Right Star Reward Badge (Visible to All) */}
      {starsCount !== undefined && starsCount > 0 && (
        <div
          data-testid={`star-badge-${participantName}`}
          className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 border border-amber-300 text-stone-950 font-bold text-xs shadow-lg backdrop-blur-md animate-in fade-in zoom-in duration-150 select-none"
          title={`${starsCount} stars awarded to ${participantName}`}
        >
          <Star className="w-3.5 h-3.5 fill-current text-stone-950" />
          <span>{starsCount}</span>
        </div>
      )}

      {/* Bottom Name & Audio Indicator Badge */}
      <div
        data-testid="participant-badge-container"
        className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2 max-w-[calc(100%-7rem)]"
      >
        <div
          data-testid="participant-name-badge"
          className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/70 border border-white/10 backdrop-blur-md text-zinc-100 text-xs font-medium truncate"
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

          <span data-testid="participant-name" className="truncate text-[11px]">
            {participantName} {isLocal && '(You)'}
          </span>

          {roleBadge && (
            <span
              data-testid="participant-role-badge"
              className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-500/40 text-amber-300 shrink-0"
            >
              {roleBadge}
            </span>
          )}
        </div>
      </div>

      {/* Direct Controls Dock on/under video */}
      <div
        data-testid={`video-controls-dock-${participantName}`}
        className="absolute bottom-2 right-2 z-20 flex items-center gap-1 p-1 rounded-xl bg-black/70 border border-white/10 backdrop-blur-md shadow-md"
      >
        {isLocal ? (
          <>
            {onToggleMic && (
              <button
                type="button"
                data-testid="video-card-mic-btn"
                aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMic();
                }}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer active:scale-95 ${
                  isAudioMuted
                    ? 'bg-rose-500/80 text-white hover:bg-rose-600'
                    : 'bg-white/10 text-stone-200 hover:bg-white/20'
                }`}
              >
                {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            {onToggleCamera && (
              <button
                type="button"
                data-testid="video-card-cam-btn"
                aria-label={isVideoDisabled ? 'Turn on camera' : 'Turn off camera'}
                title={isVideoDisabled ? 'Turn on camera' : 'Turn off camera'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCamera();
                }}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer active:scale-95 ${
                  isVideoDisabled
                    ? 'bg-rose-500/80 text-white hover:bg-rose-600'
                    : 'bg-white/10 text-stone-200 hover:bg-white/20'
                }`}
              >
                {isVideoDisabled ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </button>
            )}
          </>
        ) : (
          <>
            {canAwardStar && onAwardStar && (
              <button
                type="button"
                data-testid={`award-star-btn-${participantName}`}
                aria-label={`Award star to ${participantName}`}
                title={`Award star to ${participantName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAwardStar();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 active:scale-95 transition-all shadow cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-current text-stone-950" />
                <span className="text-[10px]">Star</span>
              </button>
            )}
            {canControlRemoteMedia && (
              <>
                {onRemoteToggleMic && (
                  <button
                    type="button"
                    data-testid={`remote-mic-control-${participantName}`}
                    aria-label={`Mute or unmute ${participantName}`}
                    title={`Mute or unmute ${participantName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoteToggleMic();
                    }}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer active:scale-95 ${
                      isAudioMuted
                        ? 'bg-rose-500/80 text-white hover:bg-rose-600'
                        : 'bg-white/10 text-stone-200 hover:bg-white/20'
                    }`}
                  >
                    {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
                {onRemoteToggleCamera && (
                  <button
                    type="button"
                    data-testid={`remote-cam-control-${participantName}`}
                    aria-label={`Toggle camera for ${participantName}`}
                    title={`Toggle camera for ${participantName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoteToggleCamera();
                    }}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer active:scale-95 ${
                      isVideoDisabled
                        ? 'bg-rose-500/80 text-white hover:bg-rose-600'
                        : 'bg-white/10 text-stone-200 hover:bg-white/20'
                    }`}
                  >
                    {isVideoDisabled ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCard;
