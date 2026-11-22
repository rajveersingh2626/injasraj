import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Settings, PhoneOff, X, GripVertical } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';

export interface ControlBarProps {
  orientation?: 'vertical' | 'horizontal';
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
  orientation = 'vertical',
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
  const [dragTop, setDragTop] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const initialTopRef = useRef(0);

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

  // Handle vertical drag repositioning
  const handlePointerDownDrag = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    initialTopRef.current = dragTop ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 300);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = moveEvent.clientY - startYRef.current;
      const newTop = Math.max(80, Math.min(window.innerHeight - 80, initialTopRef.current + deltaY));
      setDragTop(newTop);
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const isVertical = orientation === 'vertical';

  const containerPositionStyle: React.CSSProperties = {
    paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
    ...(isVertical
      ? dragTop !== null
        ? { top: `${dragTop}px`, transform: 'translateY(-50%)' }
        : {}
      : {}),
  };

  return (
    <div
      data-testid="control-bar-container"
      style={containerPositionStyle}
      className={
        isVertical
          ? `fixed left-4 ${dragTop === null ? 'top-1/2 -translate-y-1/2' : ''} z-40 pointer-events-none ${className}`
          : `fixed bottom-0 inset-x-0 z-40 flex justify-center px-4 pt-2 pointer-events-none ${className}`
      }
    >
      <div
        data-testid="control-bar"
        className={`pointer-events-auto relative flex ${
          isVertical ? 'flex-col' : 'flex-row'
        } items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-white/90 border border-zinc-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl text-zinc-800 transition-shadow duration-200`}
      >
        {/* Drag Grip Handle */}
        {isVertical && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag control dock"
            onPointerDown={handlePointerDownDrag}
            className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 p-0.5 rounded-md hover:bg-zinc-100 transition-colors touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Device Settings Popover */}
        {isSettingsOpen && (
          <div
            ref={popoverRef}
            data-testid="device-settings-popover"
            style={{
              boxShadow:
                '0 20px 40px -8px rgba(0, 0, 0, 0.12), 0 0 1px 1px rgba(0,0,0,0.05)',
            }}
            className={
              isVertical
                ? 'absolute left-full ml-3 top-0 w-80 max-w-[calc(100vw-5rem)] p-4 rounded-2xl bg-white/95 border border-zinc-200 shadow-xl backdrop-blur-xl z-50 text-zinc-800 animate-in fade-in zoom-in-95 duration-150'
                : 'absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-white/95 border border-zinc-200 shadow-xl backdrop-blur-xl z-50 text-zinc-800 animate-in fade-in zoom-in-95 duration-150'
            }
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-200">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-zinc-800">
                <Settings className="w-4 h-4 text-indigo-600" />
                Audio & Video Settings
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-zinc-800 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
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
                  className="text-zinc-600 mb-1 font-medium flex items-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5 text-zinc-500" />
                  Microphone
                </label>
                <select
                  id="audio-device-select"
                  data-testid="audio-device-select"
                  value={selectedAudioDeviceId}
                  onChange={(e) => onSelectAudioDevice?.(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {audioDevices.length > 0 ? (
                    audioDevices.map((d, i) => (
                      <option
                        key={d.deviceId || `audio-${i}`}
                        value={d.deviceId}
                      >
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="default">
                      Default Microphone
                    </option>
                  )}
                </select>
              </div>

              {/* Camera Selector */}
              <div>
                <label
                  htmlFor="video-device-select"
                  className="text-zinc-600 mb-1 font-medium flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-zinc-500" />
                  Camera
                </label>
                <select
                  id="video-device-select"
                  data-testid="video-device-select"
                  value={selectedVideoDeviceId}
                  onChange={(e) => onSelectVideoDevice?.(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {videoDevices.length > 0 ? (
                    videoDevices.map((d, i) => (
                      <option
                        key={d.deviceId || `video-${i}`}
                        value={d.deviceId}
                      >
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="default">
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
              <MicOff className="w-5 h-5 text-red-500" />
            ) : (
              <Mic className="w-5 h-5 text-zinc-700" />
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
              <VideoOff className="w-5 h-5 text-red-500" />
            ) : (
              <Video className="w-5 h-5 text-zinc-700" />
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
              className={`w-5 h-5 ${isScreenSharing ? 'text-emerald-500' : 'text-zinc-700'}`}
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
              className={`w-5 h-5 ${isSettingsOpen ? 'text-indigo-600' : 'text-zinc-600'}`}
            />
          </BlurIcon>
        </GlassButton>

        {/* Divider */}
        <div className={isVertical ? 'w-6 h-[1px] bg-zinc-200 my-0.5 sm:my-1' : 'h-6 w-[1px] bg-zinc-200 mx-0.5 sm:mx-1'} />

        {/* Leave Class Button */}
        <GlassButton
          data-testid="leave-class-btn"
          variant="danger"
          size="md"
          aria-label="Leave class"
          onClick={onLeaveClass}
          className="rounded-xl px-4 sm:px-5 font-semibold text-white bg-rose-600/80 border-rose-500 hover:bg-rose-700 active:scale-95"
        >
          <BlurIcon activeKey="leave">
            <PhoneOff className="w-5 h-5 mr-0 sm:mr-1.5 text-white" />
          </BlurIcon>
          <span className={isVertical ? 'text-[10px] mt-0.5' : 'hidden sm:inline'}>Leave</span>
        </GlassButton>
      </div>
    </div>
  );
};

export default ControlBar;
