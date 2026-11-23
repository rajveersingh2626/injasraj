import React from 'react';
import {
  Grid,
  Square,
  MoreHorizontal,
  AlignJustify,
  Grid3X3,
  Copy,
  Trash2,
  Plus,
  FileDown,
  Image as ImageIcon,
  Layers,
  Sparkles,
} from 'lucide-react';
import { WhiteboardPage, createDefaultWhiteboardPage } from '../../../types/whiteboard';
import { GlassCard } from '../../ui/GlassCard';
import { GlassButton } from '../../ui/GlassButton';

export type GridPatternType = 'blank' | 'dots' | 'lined' | 'grid';

export interface ToolsTabProps {
  currentGrid?: GridPatternType;
  onChangeGrid?: (grid: GridPatternType) => void;
  pages?: WhiteboardPage[];
  currentPageId?: string;
  onSelectPage?: (pageId: string) => void;
  onClonePage?: (pageId: string) => void;
  onDeletePage?: (pageId: string) => void;
  onAddPage?: () => void;
  onExportPdf?: () => void;
  onExportImage?: () => void;
  className?: string;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({
  currentGrid = 'blank',
  onChangeGrid,
  pages = [],
  currentPageId,
  onSelectPage,
  onClonePage,
  onDeletePage,
  onAddPage,
  onExportPdf,
  onExportImage,
  className = '',
}) => {
  const activePages =
    pages.length > 0
      ? pages
      : [createDefaultWhiteboardPage('default-page-1', 1, 'Page 1')];

  const effectiveCurrentPageId = currentPageId || activePages[0]?.id;

  const gridOptions: { type: GridPatternType; label: string; icon: React.ReactNode }[] = [
    {
      type: 'blank',
      label: 'Blank',
      icon: <Square className="w-4 h-4" />,
    },
    {
      type: 'dots',
      label: 'Dots',
      icon: <MoreHorizontal className="w-4 h-4" />,
    },
    {
      type: 'lined',
      label: 'Lined',
      icon: <AlignJustify className="w-4 h-4" />,
    },
    {
      type: 'grid',
      label: 'Grid',
      icon: <Grid3X3 className="w-4 h-4" />,
    },
  ];

  return (
    <div
      data-testid="tools-tab"
      className={`flex flex-col h-full gap-5 p-4 overflow-y-auto select-none bg-stone-50/50 text-stone-900 ${className}`}
    >
      {/* 1. Background Grid Selector */}
      <section
        data-testid="grid-selector-section"
        aria-label="Background Grid Pattern"
        className="flex flex-col gap-2.5 pb-4 border-b border-stone-200"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-600">
          <Grid className="w-3.5 h-3.5 text-amber-600" />
          <span>Canvas Grid Mode</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5" data-testid="grid-options-container">
          {gridOptions.map((opt) => {
            const isActive = currentGrid === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                data-testid={`grid-option-${opt.type}`}
                aria-pressed={isActive}
                aria-label={`Select ${opt.label} grid`}
                onClick={() => onChangeGrid?.(opt.type)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 active:scale-95 shadow-sm ${
                  isActive
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-amber-500/10'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                {opt.icon}
                <span className="text-[10px]">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Multi-Page Thumbnail Strip & Controls */}
      <section
        data-testid="page-thumbnails-section"
        aria-label="Multi-Page Manager"
        className="flex flex-col gap-2.5 pb-4 border-b border-stone-200"
      >
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-stone-500">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Pages ({activePages.length})</span>
          </div>

          {onAddPage && (
            <button
              type="button"
              data-testid="add-page-btn"
              onClick={onAddPage}
              className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Page</span>
            </button>
          )}
        </div>

        <div
          data-testid="page-thumbnails-strip"
          className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1"
        >
          {activePages.map((page, idx) => {
            const isActive = page.id === effectiveCurrentPageId;
            const pageNumber = page.pageNumber || idx + 1;

            return (
              <div
                key={page.id}
                data-testid={`page-thumbnail-card-${page.id}`}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all shadow-sm ${
                  isActive
                    ? 'border-amber-400 bg-amber-50/70 text-stone-900'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-stone-300'
                }`}
              >
                {/* Clickable jump trigger */}
                <button
                  type="button"
                  data-testid={`jump-page-${page.id}`}
                  onClick={() => onSelectPage?.(page.id)}
                  aria-label={`Jump to page ${pageNumber}`}
                  className="flex items-center gap-2.5 flex-1 text-left cursor-pointer min-w-0"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {pageNumber}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-stone-900 truncate">
                      {page.title || `Page ${pageNumber}`}
                    </span>
                    {page.backgroundPdfUrl && (
                      <span className="text-[10px] text-stone-500 truncate">
                        Document Page
                      </span>
                    )}
                  </div>
                </button>

                {/* Clone & Delete Action Buttons */}
                <div className="flex items-center gap-1">
                  {onClonePage && (
                    <button
                      type="button"
                      data-testid={`clone-page-${page.id}`}
                      aria-label={`Clone page ${pageNumber}`}
                      onClick={() => onClonePage(page.id)}
                      title="Clone page"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onDeletePage && (
                    <button
                      type="button"
                      data-testid={`delete-page-${page.id}`}
                      aria-label={`Delete page ${pageNumber}`}
                      onClick={() => onDeletePage(page.id)}
                      disabled={activePages.length <= 1}
                      title="Delete page"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Export Buttons Section */}
      <section
        data-testid="export-section"
        aria-label="Export Whiteboard Content"
        className="flex flex-col gap-2.5"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-stone-500">
          <FileDown className="w-3.5 h-3.5" />
          <span>Export Options</span>
        </div>

        <div className="flex flex-col gap-2">
          <GlassButton
            type="button"
            variant="default"
            size="sm"
            data-testid="export-pdf-btn"
            onClick={onExportPdf}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs border-stone-200 bg-white text-stone-800 hover:bg-stone-50 shadow-sm"
          >
            <FileDown className="w-4 h-4 text-amber-600" />
            <span>Save as PDF</span>
          </GlassButton>

          <GlassButton
            type="button"
            variant="default"
            size="sm"
            data-testid="export-image-btn"
            onClick={onExportImage}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs border-stone-200 bg-white text-stone-800 hover:bg-stone-50 shadow-sm"
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>Export Image</span>
          </GlassButton>
        </div>
      </section>
    </div>
  );
};

export default ToolsTab;
