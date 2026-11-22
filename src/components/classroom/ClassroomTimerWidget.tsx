import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, Clock, Timer as TimerIcon } from 'lucide-react';
import { TimerState } from '../../types/media';

export interface ClassroomTimerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher: boolean;
  onBroadcastTimerState?: (state: TimerState) => void;
  remoteTimerState?: TimerState;
  onFinish?: () => void;
}

const PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
];

export const ClassroomTimerWidget: React.FC<ClassroomTimerWidgetProps> = ({
  isOpen,
  onClose,
  isTeacher,
  onBroadcastTimerState,
  remoteTimerState,
  onFinish,
}) => {
  const [mode, setMode] = useState<'countdown' | 'stopwatch'>('countdown');
  const [initialSeconds, setInitialSeconds] = useState<number>(300);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAlarm, setIsAlarm] = useState<boolean>(false);

  // Audio chime using Web Audio API
  const playChime = () => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.85);
      }
    } catch {
      // Audio playback fallback
    }
  };

  // Sync from remote state if student
  useEffect(() => {
    if (!isTeacher && remoteTimerState) {
      setMode(remoteTimerState.mode);
      setRemainingSeconds(remoteTimerState.remainingSeconds);
      setInitialSeconds(remoteTimerState.initialSeconds);
      setIsRunning(remoteTimerState.isRunning);
      setIsAlarm(remoteTimerState.isAlarm);
    }
  }, [isTeacher, remoteTimerState]);

  // Tick interval
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (mode === 'countdown') {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsAlarm(true);
            playChime();
            onFinish?.();
            if (isTeacher) {
              onBroadcastTimerState?.({
                mode: 'countdown',
                remainingSeconds: 0,
                initialSeconds,
                isRunning: false,
                isAlarm: true,
              });
            }
            return 0;
          }
          const next = prev - 1;
          if (isTeacher) {
            onBroadcastTimerState?.({
              mode: 'countdown',
              remainingSeconds: next,
              initialSeconds,
              isRunning: true,
              isAlarm: false,
            });
          }
          return next;
        });
      } else {
        // Stopwatch
        setRemainingSeconds((prev) => {
          const next = prev + 1;
          if (isTeacher) {
            onBroadcastTimerState?.({
              mode: 'stopwatch',
              remainingSeconds: next,
              initialSeconds: 0,
              isRunning: true,
              isAlarm: false,
            });
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode, initialSeconds, isTeacher, onBroadcastTimerState, onFinish]);

  if (!isOpen) return null;

  const handleSelectPreset = (seconds: number) => {
    if (!isTeacher) return;
    setIsRunning(false);
    setIsAlarm(false);
    setInitialSeconds(seconds);
    setRemainingSeconds(seconds);
    onBroadcastTimerState?.({
      mode: 'countdown',
      remainingSeconds: seconds,
      initialSeconds: seconds,
      isRunning: false,
      isAlarm: false,
    });
  };

  const handleTogglePlay = () => {
    if (!isTeacher) return;
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    setIsAlarm(false);
    onBroadcastTimerState?.({
      mode,
      remainingSeconds,
      initialSeconds,
      isRunning: nextRunning,
      isAlarm: false,
    });
  };

  const handleReset = () => {
    if (!isTeacher) return;
    setIsRunning(false);
    setIsAlarm(false);
    const resetSec = mode === 'countdown' ? initialSeconds : 0;
    setRemainingSeconds(resetSec);
    onBroadcastTimerState?.({
      mode,
      remainingSeconds: resetSec,
      initialSeconds,
      isRunning: false,
      isAlarm: false,
    });
  };

  const handleSwitchMode = (newMode: 'countdown' | 'stopwatch') => {
    if (!isTeacher) return;
    setIsRunning(false);
    setIsAlarm(false);
    setMode(newMode);
    const startSec = newMode === 'countdown' ? initialSeconds : 0;
    setRemainingSeconds(startSec);
    onBroadcastTimerState?.({
      mode: newMode,
      remainingSeconds: startSec,
      initialSeconds: newMode === 'countdown' ? initialSeconds : 0,
      isRunning: false,
      isAlarm: false,
    });
  };

  // Format MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeString = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div
      data-testid="classroom-timer-widget"
      className="fixed top-20 right-8 z-40 w-72 rounded-2xl bg-stone-900/90 border border-stone-800 text-stone-100 backdrop-blur-md shadow-2xl p-4 select-none animate-in fade-in zoom-in-95 duration-200"
      style={{
        boxShadow: isAlarm
          ? '0 0 0 2px rgba(220, 38, 38, 0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-800/80">
        <div className="flex items-center gap-2">
          {mode === 'countdown' ? (
            <TimerIcon className="w-4 h-4 text-amber-500" />
          ) : (
            <Clock className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-300">
            {mode === 'countdown' ? 'Classroom Timer' : 'Stopwatch'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close timer"
          className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors duration-150 active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher (Teacher only) */}
      {isTeacher && (
        <div className="flex items-center gap-1 p-1 mt-3 rounded-lg bg-stone-950/60 border border-stone-800/60">
          <button
            type="button"
            onClick={() => handleSwitchMode('countdown')}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors duration-150 active:scale-95 ${
              mode === 'countdown'
                ? 'bg-stone-800 text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'text-stone-400 hover:text-stone-300'
            }`}
          >
            Countdown
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('stopwatch')}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors duration-150 active:scale-95 ${
              mode === 'stopwatch'
                ? 'bg-stone-800 text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'text-stone-400 hover:text-stone-300'
            }`}
          >
            Stopwatch
          </button>
        </div>
      )}

      {/* Digital Clock Display */}
      <div className="py-4 text-center">
        <span
          className={`font-mono text-5xl font-bold tracking-tight transition-colors duration-150 ${
            isAlarm
              ? 'text-rose-400 animate-pulse'
              : isRunning
              ? 'text-amber-400'
              : 'text-stone-100'
          }`}
        >
          {timeString}
        </span>
      </div>

      {/* Presets (Countdown mode & Teacher only) */}
      {isTeacher && mode === 'countdown' && (
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {PRESETS.map((preset) => {
            const isSelected = initialSeconds === preset.seconds;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectPreset(preset.seconds)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? 'bg-amber-600 text-stone-950 border-amber-500 font-semibold'
                    : 'bg-stone-800/70 text-stone-300 border-stone-700/60 hover:bg-stone-700/60 hover:text-stone-100'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Action Controls (Teacher only) */}
      {isTeacher && (
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-stone-800/80">
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl border transition-all duration-150 active:scale-95 ${
              isRunning
                ? 'bg-stone-800 text-amber-300 border-amber-500/40 hover:bg-stone-700'
                : 'bg-amber-600 text-stone-950 border-amber-500 hover:bg-amber-500'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Reset Timer"
            aria-label="Reset Timer"
            className="p-2 text-stone-400 hover:text-stone-200 bg-stone-800/60 hover:bg-stone-700/60 border border-stone-700/60 rounded-xl transition-colors duration-150 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
