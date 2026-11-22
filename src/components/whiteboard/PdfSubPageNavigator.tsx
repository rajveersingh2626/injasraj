import React from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export interface PdfSubPageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  documentTitle?: string;
  className?: string;
}

export const PdfSubPageNavigator: React.FC<PdfSubPageNavigatorProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  documentTitle,
  className = '',
}) => {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <nav
      role="navigation"
      aria-label="PDF Document Page Navigation"
      data-testid="pdf-subpage-navigator"
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 border border-zinc-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl text-zinc-800 transition-all duration-200 select-none ${className}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-0.5 border-r border-zinc-200 text-xs font-medium text-zinc-500 max-w-[160px] truncate">
        <FileText className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        <span className="truncate">{documentTitle || 'Worksheet'}</span>
      </div>

      {/* Prev Page Button */}
      <button
        type="button"
        aria-label="Previous PDF Page"
        onClick={() => canGoPrev && onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
        className={`p-1.5 rounded-xl transition-all duration-150 active:scale-95 ${
          canGoPrev
            ? 'hover:bg-zinc-100 text-zinc-800 cursor-pointer'
            : 'opacity-35 text-zinc-400 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page indicator */}
      <span className="text-xs font-semibold px-2 text-zinc-700 min-w-[70px] text-center">
        Page {currentPage} of {totalPages}
      </span>

      {/* Next Page Button */}
      <button
        type="button"
        aria-label="Next PDF Page"
        onClick={() => canGoNext && onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className={`p-1.5 rounded-xl transition-all duration-150 active:scale-95 ${
          canGoNext
            ? 'hover:bg-zinc-100 text-zinc-800 cursor-pointer'
            : 'opacity-35 text-zinc-400 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
};
