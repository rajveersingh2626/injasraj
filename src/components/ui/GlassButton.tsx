import React, { forwardRef } from 'react';

export type GlassButtonVariant = 'default' | 'primary' | 'danger' | 'active' | 'ghost';
export type GlassButtonSize = 'sm' | 'md' | 'lg';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<GlassButtonVariant, string> = {
  default:
    'bg-[#121218]/72 border-[rgba(255,255,255,0.08)] text-zinc-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1c1c24]/80 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[rgba(255,255,255,0.16)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white',
  primary:
    'bg-indigo-600/30 border-indigo-400/40 text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-indigo-600/45 [@media(hover:hover)_and_(pointer:fine)]:hover:border-indigo-400/60',
  danger:
    'bg-[rgba(239,68,68,0.2)] border-[rgba(239,68,68,0.4)] text-red-200 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[rgba(239,68,68,0.35)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[rgba(239,68,68,0.6)] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white',
  active:
    'bg-[rgba(52,211,153,0.15)] border-[rgba(52,211,153,0.4)] text-emerald-300 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[rgba(52,211,153,0.25)] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[rgba(52,211,153,0.6)]',
  ghost:
    'bg-transparent border-transparent text-zinc-400 shadow-none [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/5 [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/10 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white',
};

const sizeStyles: Record<GlassButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5 min-h-[32px]',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2 min-h-[40px]',
  lg: 'text-base px-5 py-3 rounded-2xl gap-2.5 min-h-[48px]',
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      children,
      className = '',
      disabled = false,
      style,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isGhost = variant === 'ghost';

    const baseBoxShadow = isGhost
      ? 'none'
      : 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 20px -2px rgba(0, 0, 0, 0.4)';

    const defaultInlineStyle: React.CSSProperties = {
      boxShadow: baseBoxShadow,
      transition:
        'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 160ms ease, border-color 160ms ease',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
      ...style,
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        touch-action="manipulation"
        data-touch-action="manipulation"
        style={defaultInlineStyle}
        className={`relative inline-flex items-center justify-center font-medium border backdrop-blur-[16px] select-none touch-manipulation cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
export default GlassButton;
