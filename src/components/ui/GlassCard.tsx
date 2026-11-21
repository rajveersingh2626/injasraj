import React, { forwardRef } from 'react';

export type GlassCardVariant = 'default' | 'subtle' | 'interactive';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant;
  interactive?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<GlassCardVariant, string> = {
  default: 'bg-[#121218]/72 border-[rgba(255,255,255,0.08)] text-zinc-100',
  subtle: 'bg-[#09090b]/60 border-[rgba(255,255,255,0.05)] text-zinc-300',
  interactive:
    'bg-[#121218]/72 border-[rgba(255,255,255,0.08)] text-zinc-100 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[rgba(255,255,255,0.16)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1a1a24]/80 active:scale-[0.97] cursor-pointer touch-manipulation',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = 'default',
      interactive = false,
      children,
      className = '',
      style,
      onClick,
      ...rest
    },
    ref
  ) => {
    const isInteractive = interactive || variant === 'interactive' || Boolean(onClick);
    const resolvedVariant: GlassCardVariant = isInteractive ? 'interactive' : variant;

    const defaultInlineStyle: React.CSSProperties = {
      boxShadow:
        'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 32px -4px rgba(0, 0, 0, 0.48)',
      transition: isInteractive
        ? 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background 160ms ease, border-color 160ms ease'
        : 'border-color 160ms ease',
      WebkitTapHighlightColor: 'transparent',
      ...(isInteractive ? { touchAction: 'manipulation' } : {}),
      ...style,
    };

    return (
      <div
        ref={ref}
        onClick={onClick}
        style={defaultInlineStyle}
        className={`relative rounded-2xl border backdrop-blur-[16px] overflow-hidden ${variantStyles[resolvedVariant]} ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
export default GlassCard;
