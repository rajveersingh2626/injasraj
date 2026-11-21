import React, { useState, useRef, useEffect } from 'react';
import { ConnectionQuality } from '../../types/media';
import { Wifi, Activity, ShieldAlert, Radio, Video, Zap } from 'lucide-react';

export interface NetworkQualityHUDProps {
  quality: ConnectionQuality;
  className?: string;
}

export function getStatusColor(quality: ConnectionQuality): {
  colorClass: string;
  label: string;
} {
  if (quality.status === 'failed' || quality.packetLossPercent > 5 || quality.rttMs > 350) {
    return {
      colorClass: 'bg-rose-400',
      label: 'Poor',
    };
  }

  if (
    quality.connectionType === 'relay' ||
    quality.isAudioPrioritized ||
    quality.status === 'fair' ||
    quality.rttMs >= 150 ||
    quality.packetLossPercent >= 1
  ) {
    return {
      colorClass: 'bg-amber-400',
      label: 'Relayed Link (Fair)',
    };
  }

  return {
    colorClass: 'bg-emerald-400',
    label: 'Direct P2P (Good)',
  };
}

export const NetworkQualityHUD: React.FC<NetworkQualityHUDProps> = ({
  quality,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { colorClass } = getStatusColor(quality);
  const isRelayed = quality.connectionType === 'relay';
  const isDirect =
    quality.connectionType === 'direct' ||
    quality.connectionType === 'host' ||
    quality.connectionType === 'srflx' ||
    quality.connectionType === 'prflx';

  const modeLabel = isRelayed
    ? 'Relayed Link (TURN)'
    : isDirect
    ? 'Direct Peer-to-Peer'
    : 'Connecting / Unknown';

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Floating Glass Pill HUD Trigger */}
      <button
        type="button"
        data-testid="hud-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Network Quality Telemetry"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 16px -2px rgba(0, 0, 0, 0.4)',
          transition:
            'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 160ms ease, border-color 160ms ease',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium border border-[rgba(255,255,255,0.08)] bg-[#121218]/72 backdrop-blur-[16px] text-zinc-200 select-none cursor-pointer active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1c1c24]/80 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[rgba(255,255,255,0.16)]"
      >
        {/* Organic pulsing status indicator dot */}
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClass}`}
          />
          <span
            data-testid="status-dot"
            className={`relative inline-flex rounded-full h-2 w-2 ${colorClass}`}
          />
        </span>

        {/* Latency and Mode Summary */}
        <span className="tabular-nums tracking-tight">
          {Math.round(quality.rttMs)}ms
        </span>

        <span className="text-[10px] uppercase font-sans tracking-wider px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 text-zinc-400">
          {isRelayed ? 'Relay' : 'P2P'}
        </span>
      </button>

      {/* Origin-Aware Expanding Telemetry Popover */}
      {isOpen && (
        <div
          data-testid="hud-popover"
          style={{
            transformOrigin: 'top right',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 12px 32px -4px rgba(0, 0, 0, 0.64)',
            transition: 'transform 180ms cubic-bezier(0.23, 1, 0.32, 1), opacity 180ms ease',
          }}
          className="absolute right-0 mt-2 w-72 p-3.5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#09090b]/90 backdrop-blur-[20px] text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-200">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Network Telemetry</span>
            </div>
            <span
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                isRelayed
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isRelayed ? 'TURN Relay' : 'Direct P2P'}
            </span>
          </div>

          {/* Audio Priority Notice */}
          {quality.isAudioPrioritized && (
            <div className="mb-3 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
              <Radio className="w-4 h-4 shrink-0 text-amber-400 mt-0.5 animate-pulse" />
              <div>
                <p className="font-semibold leading-tight">
                  Audio Prioritized - Conserving Bandwidth
                </p>
                <p className="text-[11px] text-amber-300/80 mt-0.5 leading-snug">
                  Video quality is optimized to protect bandwidth on relayed links.
                </p>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 px-1.5 rounded-lg bg-white/[0.03]">
              <span className="text-zinc-400">Connection Mode</span>
              <span className="font-medium text-zinc-200 text-right">{modeLabel}</span>
            </div>

            <div className="flex justify-between items-center py-1 px-1.5 rounded-lg bg-white/[0.03]">
              <span className="text-zinc-400">Round-Trip Latency</span>
              <span className="font-mono text-zinc-200">
                {Math.round(quality.rttMs)} ms
              </span>
            </div>

            <div className="flex justify-between items-center py-1 px-1.5 rounded-lg bg-white/[0.03]">
              <span className="text-zinc-400">Packet Loss</span>
              <span
                className={`font-mono ${
                  quality.packetLossPercent > 5
                    ? 'text-rose-400 font-semibold'
                    : quality.packetLossPercent > 1
                    ? 'text-amber-400'
                    : 'text-zinc-200'
                }`}
              >
                {quality.packetLossPercent.toFixed(1)} %
              </span>
            </div>

            {quality.videoResolution && (
              <div className="flex justify-between items-center py-1 px-1.5 rounded-lg bg-white/[0.03]">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Video className="w-3 h-3 text-zinc-400" /> Resolution
                </span>
                <span className="font-mono text-zinc-200">
                  {quality.videoResolution.width} x {quality.videoResolution.height}
                </span>
              </div>
            )}

            {quality.fps !== undefined && (
              <div className="flex justify-between items-center py-1 px-1.5 rounded-lg bg-white/[0.03]">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-zinc-400" /> Frame Rate
                </span>
                <span className="font-mono text-zinc-200">
                  {quality.fps} FPS
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkQualityHUD;
