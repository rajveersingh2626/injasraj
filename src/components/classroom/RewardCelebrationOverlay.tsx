import React, { useEffect, useRef } from 'react';
import { Star, Trophy, Flame, Heart, Sparkles } from 'lucide-react';

export type RewardType = 'star' | 'trophy' | 'fire' | 'heart' | 'sparkles';

export interface RewardEvent {
  id: string;
  type: RewardType;
  teacherName: string;
  studentName?: string;
  targetStudentId?: string;
  starsCount?: number;
  message?: string;
  timestamp: number;
}

export interface RewardCelebrationOverlayProps {
  activeReward: RewardEvent | null;
  onDismiss: () => void;
}

export const RewardCelebrationOverlay: React.FC<RewardCelebrationOverlayProps> = ({
  activeReward,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Play celebratory audio chord (C5 - E5 - G5)
  useEffect(() => {
    if (!activeReward) return;

    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.65);
        });
      }
    } catch {
      // Audio fallback
    }

    // Auto-dismiss after 3.5s
    const timer = setTimeout(() => {
      onDismiss();
    }, 3500);

    return () => clearTimeout(timer);
  }, [activeReward, onDismiss]);

  // Particle confetti effect on canvas
  useEffect(() => {
    if (!activeReward || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    try {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

    // Palette: warm amber, gold, terracotta, ochre, ivory
    const colors = ['#b4823c', '#d97706', '#f59e0b', '#85451f', '#f5f3e6', '#fbbf24'];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRot: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.vx *= 0.98; // drag
        p.rotation += p.vRot;
        p.opacity = Math.max(0, p.opacity - 0.008);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (particles.some((p) => p.opacity > 0)) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  } catch {
    // Canvas fallback in non-browser env
  }
  }, [activeReward]);

  if (!activeReward) return null;

  const renderRewardIcon = () => {
    switch (activeReward.type) {
      case 'trophy':
        return <Trophy className="w-16 h-16 text-amber-400 fill-amber-400/20" />;
      case 'fire':
        return <Flame className="w-16 h-16 text-orange-400 fill-orange-400/20" />;
      case 'heart':
        return <Heart className="w-16 h-16 text-rose-400 fill-rose-400/20" />;
      case 'sparkles':
        return <Sparkles className="w-16 h-16 text-amber-300 fill-amber-300/20" />;
      case 'star':
      default:
        return <Star className="w-16 h-16 text-amber-400 fill-amber-400/30" />;
    }
  };

  return (
    <div
      data-testid="reward-celebration-overlay"
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-sm cursor-pointer select-none animate-in fade-in duration-200"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-0"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex flex-col items-center gap-4 max-w-sm w-full mx-4 p-8 rounded-3xl bg-stone-900/95 border border-amber-500/40 text-stone-100 shadow-2xl text-center transform transition-transform duration-200 ease-out animate-in zoom-in-95"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Animated Badge Icon Container */}
        <div className="relative p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-inner">
          {renderRewardIcon()}
        </div>

        {/* Celebratory Message & Teacher Attribution */}
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold tracking-tight text-amber-300">
            {activeReward.message || 'Great Job!'}
          </h3>
          <p className="text-xs font-medium text-stone-400">
            Awarded by {activeReward.teacherName}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 px-6 py-2 rounded-xl text-xs font-semibold bg-stone-800 text-stone-200 hover:bg-stone-700/80 border border-stone-700/60 transition-colors duration-150 active:scale-95"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
};
