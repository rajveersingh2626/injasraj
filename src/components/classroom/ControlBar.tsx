import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Settings, PhoneOff, X } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';

export interface ControlBarProps {
  isMicMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  onLeaveClass?: () => void;
  audioDevices?: MediaDeviceInfo[];
  videoDevices?: MediaDeviceInfo[];
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
  onSelectAudioDevice?: (deviceId: string) => void;
  onSelectVideoDevice?: (deviceId: string) => void;
  className?: string;
}

interface BlurIconProps {
  children: React.ReactNode;
  activeKey: any;
}

const BlurIcon: React.FC<BlurIconProps> = ({ children, activeKey }) => {
  return (
    <span
      key={String(activeKey)}
      style={{
        filter: 'blur(0px)',
        transition:
          'filter 180ms cubic-bezier(0.23, 1, 0.32, 1), transform 180ms cubic-bezier(0.23, 1, 0.32, 1), opacity 180ms ease',
      }}
      className="inline-flex items-center justify-center"
    >
      {children}
    </span>
  );
};

export const ControlBar: React.FC<ControlBarProps> = ({
  isMicMuted = false,
  isCameraOff = false,
  isScreenSharing = false,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveClass,
  audioDevices = [],
  videoDevices = [],
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onSelectAudioDevice,
  onSelectVideoDevice,
  className = '',
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close settings popover on click outside or Escape
  useEffect(() => {
    if (!isSettingsOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  return (
    <div
      data-testid="control-bar-container"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      className={`fixed bottom-0 inset-x-0 z-40 flex justify-center px-4 pt-2 pointer-events-none ${className}`}
    >
      <div
        data-testid="control-bar"
        className="pointer-events-auto relative flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl bg-[#09090b]/85 border border-white/10 backdrop-blur-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        {/* Device Settings Popover */}
        {isSettingsOpen && (
          <div
            ref={popoverRef}
            data-testid="device-settings-popover"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 16px 36px -4px rgba(0, 0, 0, 0.7)',
            }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-[#0e0e14]/95 border border-white/10 backdrop-blur-[20px] z-50 text-zinc-100 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
                <Settings className="w-4 h-4 text-indigo-400" />
                Audio & Video Settings
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Microphone Selector */}
            <div className="space-y-3 text-xs">
              <div>
                <label
                  htmlFor="audio-device-select"
                  className="block text-zinc-400 mb-1 font-medium flex items-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5 text-zinc-300" />
                  Microphone
                </label>
                <select
                  id="audio-device-select"
                  data-testid="audio-device-select"
                  value={selectedAudioDeviceId}
                  onChange={(e) => onSelectAudioDevice?.(e.target.value)}
                  className="w-full bg-[#161620] border border-white/10 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-indigo-400/60"
                >
                  {audioDevices.length > 0 ? (
                    audioDevices.map((d, i) => (
                      <option
                        key={d.deviceId || `audio-${i}`}
                        value={d.deviceId}
                        className="bg-zinc-900 text-white"
                      >
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="default" className="bg-zinc-900 text-white">
                      Default Microphone
                    </option>
                  )}
                </select>
              </div>

              {/* Camera Selector */}
              <div>
                <label
                  htmlFor="video-device-select"
                  className="block text-zinc-400 mb-1 font-medium flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-zinc-300" />
                  Camera
                </label>
                <select
                  id="video-device-select"
                  data-testid="video-device-select"
                  value={selectedVideoDeviceId}
                  onChange={(e) => onSelectVideoDevice?.(e.target.value)}
                  className="w-full bg-[#161620] border border-white/10 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-indigo-400/60"
                >
                  {videoDevices.length > 0 ? (
                    videoDevices.map((d, i) => (
                      <option
                        key={d.deviceId || `video-${i}`}
                        value={d.deviceId}
                        className="bg-zinc-900 text-white"
                      >
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="default" className="bg-zinc-900 text-white">
                      Default Camera
                    </option>
                  )}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Microphone Toggle Button */}
        <GlassButton
          data-testid="toggle-mic-btn"
          variant={isMicMuted ? 'danger' : 'default'}
          size="md"
          aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
          onClick={onToggleMic}
          className="rounded-xl px-3.5 sm:px-4"
        >
          <BlurIcon activeKey={isMicMuted}>
            {isMicMuted ? (
              <MicOff className="w-5 h-5 text-red-200" />
            ) : (
              <Mic className="w-5 h-5 text-zinc-100" />
            )}
          </BlurIcon>
        </GlassButton>

        {/* Camera Toggle Button */}
        <GlassButton
          data-testid="toggle-camera-btn"
          variant={isCameraOff ? 'danger' : 'default'}
          size="md"
          aria-label={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          onClick={onToggleCamera}
          className="rounded-xl px-3.5 sm:px-4"
        >
          <BlurIcon activeKey={isCameraOff}>
            {isCameraOff ? (
              <VideoOff className="w-5 h-5 text-red-200" />
            ) : (
              <Video className="w-5 h-5 text-zinc-100" />
            )}
          </BlurIcon>
        </GlassButton>

        {/* Screen Share Button */}
        <GlassButton
          data-testid="toggle-screenshare-btn"
          variant={isScreenSharing ? 'active' : 'default'}
          size="md"
          aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          onClick={onToggleScreenShare}
          className="rounded-xl px-3.5 sm:px-4"
        >
          <BlurIcon activeKey={isScreenSharing}>
            <Monitor
              className={`w-5 h-5 ${isScreenSharing ? 'text-emerald-300' : 'text-zinc-100'}`}
            />
          </BlurIcon>
        </GlassButton>

        {/* Device Settings Button */}
        <GlassButton
          data-testid="device-settings-btn"
          variant={isSettingsOpen ? 'primary' : 'default'}
          size="md"
          aria-label="Device settings"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className="rounded-xl px-3.5 sm:px-4"
        >
          <BlurIcon activeKey={isSettingsOpen}>
            <Settings
              className={`w-5 h-5 ${isSettingsOpen ? 'text-indigo-300' : 'text-zinc-200'}`}
            />
          </BlurIcon>
        </GlassButton>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-white/10 mx-0.5 sm:mx-1" />

        {/* Leave Class Button */}
        <GlassButton
          data-testid="leave-class-btn"
          variant="danger"
          size="md"
          aria-label="Leave class"
          onClick={onLeaveClass}
          className="rounded-xl px-4 sm:px-5 font-semibold text-white bg-rose-600/40 border-rose-500/50 hover:bg-rose-600/60"
        >
          <BlurIcon activeKey="leave">
            <PhoneOff className="w-5 h-5 mr-0 sm:mr-1.5 text-white" />
          </BlurIcon>
          <span className="hidden sm:inline">Leave</span>
        </GlassButton>
      </div>
    </div>
  );
};

export default ControlBar;
