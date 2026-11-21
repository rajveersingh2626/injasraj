import React, { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { IMediaSession, ConnectionQuality, createDefaultQuality } from '../../types/media';
import { NetworkQualityHUD } from '../ui/NetworkQualityHUD';
import { VideoCard } from './VideoCard';
import { ControlBar } from './ControlBar';

export interface ClassroomContainerProps {
  mediaSession: IMediaSession;
  localParticipantName?: string;
  remoteParticipantName?: string;
  localRoleBadge?: string;
  remoteRoleBadge?: string;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  initialQuality?: ConnectionQuality;
  audioDevices?: MediaDeviceInfo[];
  videoDevices?: MediaDeviceInfo[];
  onLeave?: () => void;
  className?: string;
}

export const ClassroomContainer: React.FC<ClassroomContainerProps> = ({
  mediaSession,
  localParticipantName = 'You',
  remoteParticipantName = 'Remote Participant',
  localRoleBadge,
  remoteRoleBadge,
  localStream,
  remoteStream: propRemoteStream,
  initialQuality,
  audioDevices: propAudioDevices,
  videoDevices: propVideoDevices,
  onLeave,
  className = '',
}) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(
    propRemoteStream || null
  );
  const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null);
  const [quality, setQuality] = useState<ConnectionQuality>(
    initialQuality || createDefaultQuality()
  );

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>(propAudioDevices || []);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>(propVideoDevices || []);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');

  // Sync prop changes
  useEffect(() => {
    if (propRemoteStream !== undefined) {
      setRemoteStream(propRemoteStream);
    }
  }, [propRemoteStream]);

  useEffect(() => {
    if (initialQuality) {
      setQuality(initialQuality);
    }
  }, [initialQuality]);

  useEffect(() => {
    if (propAudioDevices) {
      setAudioDevices(propAudioDevices);
      if (propAudioDevices.length > 0 && !selectedAudioDeviceId) {
        setSelectedAudioDeviceId(propAudioDevices[0].deviceId);
      }
    }
    if (propVideoDevices) {
      setVideoDevices(propVideoDevices);
      if (propVideoDevices.length > 0 && !selectedVideoDeviceId) {
        setSelectedVideoDeviceId(propVideoDevices[0].deviceId);
      }
    }
  }, [propAudioDevices, propVideoDevices]);

  // Wire to mediaSession event callbacks
  useEffect(() => {
    if (!mediaSession) return;

    mediaSession.onRemoteTrack((track, stream) => {
      setRemoteTrack(track);
      setRemoteStream(stream);
    });

    mediaSession.onQualityMetrics((metrics) => {
      setQuality(metrics);
    });
  }, [mediaSession]);

  // Enumerate devices if not provided via props
  useEffect(() => {
    if (
      (!propAudioDevices || propAudioDevices.length === 0) &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.enumerateDevices
    ) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const audio = devices.filter((d) => d.kind === 'audioinput');
          const video = devices.filter((d) => d.kind === 'videoinput');
          setAudioDevices(audio);
          setVideoDevices(video);
          if (audio.length > 0 && !selectedAudioDeviceId) {
            setSelectedAudioDeviceId(audio[0].deviceId);
          }
          if (video.length > 0 && !selectedVideoDeviceId) {
            setSelectedVideoDeviceId(video[0].deviceId);
          }
        })
        .catch(() => {});
    }
  }, [propAudioDevices, propVideoDevices]);

  // Mic toggle handler
  const handleToggleMic = () => {
    if (!mediaSession) return;
    const result = mediaSession.toggleMic();
    if (typeof result === 'boolean') {
      setIsMicMuted(!result);
    } else {
      setIsMicMuted((prev) => !prev);
    }
  };

  // Camera toggle handler
  const handleToggleCamera = () => {
    if (!mediaSession) return;
    const result = mediaSession.toggleCamera();
    if (typeof result === 'boolean') {
      setIsCameraOff(!result);
    } else {
      setIsCameraOff((prev) => !prev);
    }
  };

  // Screen share toggle handler
  const handleToggleScreenShare = async () => {
    if (!mediaSession) return;
    if (isScreenSharing) {
      try {
        await mediaSession.stopScreenShare();
      } finally {
        setIsScreenSharing(false);
      }
    } else {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const screenTrack = stream.getVideoTracks()[0];
          if (screenTrack) {
            screenTrack.onended = async () => {
              await mediaSession.stopScreenShare();
              setIsScreenSharing(false);
            };
            await mediaSession.publishScreenShare(screenTrack);
            setIsScreenSharing(true);
          }
        } else {
          // Fallback for mock/test environments
          const mockTrack = {
            id: 'mock-screen-track',
            kind: 'video',
            stop: () => {},
          } as unknown as MediaStreamTrack;
          await mediaSession.publishScreenShare(mockTrack);
          setIsScreenSharing(true);
        }
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  // Device switch handlers
  const handleSelectAudioDevice = async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    if (mediaSession?.switchDevice) {
      await mediaSession.switchDevice('audioinput', deviceId);
    }
  };

  const handleSelectVideoDevice = async (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId);
    if (mediaSession?.switchDevice) {
      await mediaSession.switchDevice('videoinput', deviceId);
    }
  };

  // Leave class handler
  const handleLeaveClass = () => {
    if (mediaSession?.disconnect) {
      mediaSession.disconnect();
    }
    onLeave?.();
  };

  return (
    <div
      data-testid="classroom-container"
      style={{
        height: '100dvh',
        overscrollBehavior: 'none',
      }}
      className={`relative w-full h-[100dvh] bg-[#09090b] text-white overflow-hidden select-none touch-manipulation ${className}`}
    >
      {/* Degraded Network / Audio-Priority Top Notification Banner */}
      {quality.isAudioPrioritized && (
        <div
          data-testid="audio-priority-banner"
          role="alert"
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
          className="absolute top-0 inset-x-0 z-40 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/90 text-amber-950 font-medium text-xs sm:text-sm backdrop-blur-md shadow-md animate-in slide-in-from-top duration-200"
        >
          <Radio className="w-4 h-4 shrink-0 text-amber-950 animate-pulse" />
          <span>
            Audio Prioritized — Video bandwidth reduced to preserve clear audio on degraded network.
          </span>
        </div>
      )}

      {/* Network Quality HUD (Anchored with safe-area-inset-top) */}
      <div
        data-testid="network-hud-anchor"
        style={{
          top: quality.isAudioPrioritized
            ? 'calc(2.75rem + env(safe-area-inset-top, 0px))'
            : 'calc(0.75rem + env(safe-area-inset-top, 0px))',
        }}
        className="absolute left-3 sm:left-4 z-30 pointer-events-auto transition-all duration-200"
      >
        <NetworkQualityHUD quality={quality} />
      </div>

      {/* Main Responsive 1:1 Video Stage:
          - Mobile portrait (<640px): Remote video takes full stage; local camera is a floating PiP in top-right corner.
          - Tablet & Desktop (>=640px): Side-by-side 1:1 grid.
      */}
      <div
        data-testid="video-stage"
        className="relative w-full h-full sm:grid sm:grid-cols-2 sm:gap-4 sm:p-4 pb-20 sm:pb-24 pt-12 sm:pt-16"
      >
        {/* Remote Video Container: Full stage on mobile, grid column 1 on tablet/desktop */}
        <div
          data-testid="remote-video-container"
          className="absolute inset-0 w-full h-full sm:relative sm:inset-auto sm:h-full flex items-center justify-center"
        >
          <VideoCard
            stream={remoteStream}
            track={remoteTrack}
            participantName={remoteParticipantName}
            roleBadge={remoteRoleBadge}
            isLocal={false}
            isAudioMuted={false}
            isAudioActive={false}
            className="w-full h-full rounded-none sm:rounded-2xl"
          />
        </div>

        {/* Local Video Container: Floating PiP on mobile (<640px), grid column 2 on tablet/desktop (>=640px) */}
        <div
          data-testid="local-video-container"
          style={{
            marginTop: 'env(safe-area-inset-top, 0px)',
          }}
          className="absolute top-4 right-4 z-20 w-28 h-40 xs:w-36 xs:h-48 sm:relative sm:top-auto sm:right-auto sm:z-auto sm:w-full sm:h-full shadow-2xl rounded-2xl overflow-hidden border border-white/10 sm:border-transparent transition-all duration-200"
        >
          <VideoCard
            stream={localStream}
            participantName={localParticipantName}
            roleBadge={localRoleBadge}
            isLocal={true}
            isCameraOff={isCameraOff}
            isAudioMuted={isMicMuted}
            isScreenSharing={isScreenSharing}
            className="w-full h-full rounded-2xl"
          />
        </div>
      </div>

      {/* Control Bar (Anchored with safe-area-inset-bottom) */}
      <ControlBar
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onLeaveClass={handleLeaveClass}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        onSelectAudioDevice={handleSelectAudioDevice}
        onSelectVideoDevice={handleSelectVideoDevice}
      />
    </div>
  );
};

export default ClassroomContainer;
