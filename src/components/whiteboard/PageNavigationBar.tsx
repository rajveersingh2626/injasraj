import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Layers } from 'lucide-react';

export interface PageNavigationBarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAddPage?: () => void;
  onToggleThumbnails?: () => void;
  isThumbnailsOpen?: boolean;
  canAddPage?: boolean;
  className?: string;
}

export const PageNavigationBar: React.FC<PageNavigationBarProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  onAddPage,
  onToggleThumbnails,
  isThumbnailsOpen = false,
  canAddPage = true,
  className = '',
}) => {
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const emilSpringEasing = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const buttonStyle: React.CSSProperties = {
    transition: `transform 160ms ${emilSpringEasing}, background 160ms ease, border-color 160ms ease, color 160ms ease`,
    touchAction: 'manipulation',
  };

  return (
    <nav
      role="navigation"
      aria-label="Whiteboard Page Navigation"
      data-testid="page-nav-bar"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-full border border-[rgba(255,255,255,0.08)] backdrop-blur-[16px] select-none text-zinc-200 ${className}`}
      style={{
        background: 'rgba(18, 18, 24, 0.78)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 32px -4px rgba(0, 0, 0, 0.48)',
      }}
    >
      {/* Previous Page Button */}
      <button
        type="button"
        onClick={() => canGoPrev && onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
        aria-label="Previous page"
        data-testid="prev-page-btn"
        title="Previous page"
        style={buttonStyle}
        className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-[0.97] hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page Indicator */}
      <div
        data-testid="page-indicator"
        className="px-2.5 text-xs font-medium tracking-tight text-zinc-300 min-w-[80px] text-center"
      >
        <span>Page {currentPage} of {totalPages}</span>
      </div>

      {/* Next Page Button */}
      <button
        type="button"
        onClick={() => canGoNext && onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        aria-label="Next page"
        data-testid="next-page-btn"
        title="Next page"
        style={buttonStyle}
        className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-[0.97] hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-[1px] h-4 bg-white/[0.08] mx-0.5" />

      {/* Add Page Button */}
      {onAddPage && (
        <button
          type="button"
          onClick={onAddPage}
          disabled={!canAddPage}
          aria-label="Add page"
          data-testid="add-page-btn"
          title="Add new page"
          style={buttonStyle}
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-[0.97] hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {/* Thumbnail Drawer Toggle Button */}
      {onToggleThumbnails && (
        <button
          type="button"
          onClick={onToggleThumbnails}
          aria-label="Toggle thumbnails"
          data-testid="toggle-thumbnails-btn"
          aria-pressed={isThumbnailsOpen}
          title="Toggle page thumbnails"
          style={buttonStyle}
          className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-[0.97] ${
            isThumbnailsOpen
              ? 'bg-white/20 text-white border border-white/30'
              : 'hover:bg-white/10 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>
      )}
    </nav>
  );
};

export default PageNavigationBar;
