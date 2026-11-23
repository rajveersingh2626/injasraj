import React from 'react';
import { Download, CheckCircle, Clock, FileText, Star, X } from 'lucide-react';

export interface EndClassSummaryModalProps {
  isOpen: boolean;
  durationSeconds: number;
  pagesCount: number;
  starsAwarded: number;
  onDownloadPdf: () => void;
  onClose: () => void;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) {
    return `${s}s`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export const EndClassSummaryModal: React.FC<EndClassSummaryModalProps> = ({
  isOpen,
  durationSeconds,
  pagesCount,
  starsAwarded,
  onDownloadPdf,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
    >
      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl shadow-black/80 text-stone-100 flex flex-col gap-6 animate-modal-scale">
        {/* Close Button */}
        <button
          onClick={onClose}
          data-testid="close-summary-modal-btn"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors active:scale-95"
          aria-label="Close Summary Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with celebration badge */}
        <div className="flex flex-col items-center text-center gap-2 pt-2">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-1">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h2
            id="summary-modal-title"
            className="text-xl font-bold tracking-tight text-stone-100"
          >
            Class Completed!
          </h2>
          <p className="text-sm text-stone-400">
            Great job! Here is a summary of today's learning session.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-stone-800/60 border border-stone-700/40 text-center">
            <Clock className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-xs text-stone-400 font-medium">Duration</span>
            <span className="text-sm font-semibold text-stone-100 mt-0.5">
              {formatDuration(durationSeconds)}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-stone-800/60 border border-stone-700/40 text-center">
            <FileText className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-xs text-stone-400 font-medium">Worksheets</span>
            <span className="text-sm font-semibold text-stone-100 mt-0.5">
              {pagesCount}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-stone-800/60 border border-stone-700/40 text-center">
            <Star className="w-5 h-5 text-amber-400 mb-1 fill-amber-400" />
            <span className="text-xs text-stone-400 font-medium">Stars</span>
            <span className="text-sm font-semibold text-stone-100 mt-0.5">
              {starsAwarded}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={onDownloadPdf}
            data-testid="download-summary-pdf-btn"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold shadow-lg shadow-amber-950/20 active:scale-[0.97] transition-all"
          >
            <Download className="w-4 h-4" />
            Download Lesson PDF
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700/80 text-stone-300 font-medium text-sm active:scale-[0.97] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
