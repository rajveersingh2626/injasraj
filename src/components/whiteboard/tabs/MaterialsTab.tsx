import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, BookOpen, Loader2, History, Trash2, FileCode } from 'lucide-react';
import { GlassCard } from '../../ui/GlassCard';
import { GlassButton } from '../../ui/GlassButton';
import { PastClassRecord } from '@/lib/classroom/past-classes';

export interface WorksheetMaterial {
  id: string;
  title: string;
  url: string;
  description?: string;
  category?: string;
  pageCount?: number;
  pages?: string[];
}

export interface MaterialsTabProps {
  onLoadWorksheet: (fileOrUrl: File | string) => void;
  worksheets?: WorksheetMaterial[];
  isLoading?: boolean;
  pastClasses?: PastClassRecord[];
  onRestoreWhiteboard?: (pastClass: PastClassRecord) => void;
  isTeacher?: boolean;
  className?: string;
}

// Sample worksheets deleted as requested. Export empty array for backwards compatibility.
export const DEFAULT_WORKSHEETS: WorksheetMaterial[] = [];

export const MaterialsTab: React.FC<MaterialsTabProps> = ({
  onLoadWorksheet,
  worksheets,
  isLoading = false,
  pastClasses = [],
  onRestoreWhiteboard,
  isTeacher = true,
  className = '',
}) => {
  const [activeWorksheets, setActiveWorksheets] = useState<WorksheetMaterial[]>(
    () => worksheets ?? DEFAULT_WORKSHEETS
  );

  useEffect(() => {
    if (worksheets) {
      setActiveWorksheets(worksheets);
    }
  }, [worksheets]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onLoadWorksheet(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadSelectedFile = () => {
    if (selectedFile) {
      onLoadWorksheet(selectedFile);
    }
  };

  return (
    <div
      data-testid="materials-tab"
      className={`flex flex-col h-full gap-4 p-4 overflow-y-auto select-none ${className}`}
    >
      {/* Upload Document Section */}
      <section
        data-testid="pdf-upload-section"
        aria-label="Upload Document"
        className="flex flex-col gap-2.5 pb-4 border-b border-stone-200"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-600">
          <Upload className="w-3.5 h-3.5 text-amber-600" />
          <span>Upload Document</span>
        </div>

        <div className="flex flex-col items-center justify-center p-4 border border-dashed border-stone-300 rounded-xl text-center gap-3 bg-stone-50/70 hover:bg-stone-50 transition-colors">
          {/* Hidden HTML File Input for PDF, DOCX, DOC, Images */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,.pdf,.doc,.docx"
            data-testid="pdf-file-input"
            aria-label="Upload Document"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
            <FileText className="w-5 h-5" />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-stone-800">
              {selectedFile ? selectedFile.name : 'Upload Document'}
            </span>
            <span className="text-xs text-stone-500">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                : 'Supports PDF, Word (.docx/.doc), and WebP/PNG images'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              type="button"
              variant="default"
              size="sm"
              data-testid="upload-pdf-trigger-btn"
              onClick={handleUploadClick}
              disabled={isLoading}
              className="text-xs border-stone-300 bg-white text-stone-800 hover:bg-stone-100 shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {selectedFile ? 'Change Document' : 'Choose Document'}
            </GlassButton>

            {selectedFile && (
              <GlassButton
                type="button"
                variant="primary"
                size="sm"
                data-testid="load-pdf-button"
                onClick={handleLoadSelectedFile}
                disabled={isLoading}
                className="text-xs bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                Load into Whiteboard
              </GlassButton>
            )}
          </div>
        </div>
      </section>

      {/* Uploaded Documents List */}
      <section
        data-testid="worksheet-library-section"
        aria-label="Document Library"
        className="flex flex-col gap-3 flex-1"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-stone-600 tracking-wider uppercase">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-stone-500" />
            <span>Uploaded Documents ({activeWorksheets.length})</span>
          </div>
          {isLoading && (
            <div data-testid="materials-loading" className="flex items-center gap-1 text-amber-600 text-[10px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading Document...</span>
            </div>
          )}
        </div>

        {activeWorksheets.length > 0 ? (
          <div className="flex flex-col gap-2.5" data-testid="worksheets-list">
            {activeWorksheets.map((item) => (
              <div
                key={item.id}
                data-testid={`worksheet-card-${item.id}`}
                className="flex flex-col p-3 rounded-xl gap-2 border border-stone-200 bg-white text-stone-900 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {item.category && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-700 border border-amber-500/25">
                          {item.category}
                        </span>
                      )}
                      {item.pageCount && (
                        <span className="text-[10px] text-stone-500">
                          {item.pageCount} pages
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-stone-900 mt-1 truncate">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-stone-600 mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid={`delete-worksheet-${item.id}`}
                    aria-label={`Delete worksheet ${item.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveWorksheets((prev) => prev.filter((w) => w.id !== item.id));
                    }}
                    className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-stone-100 transition-colors cursor-pointer"
                    title="Delete this document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid={`load-worksheet-${item.id}`}
                    data-load-worksheet-id={item.id}
                    onClick={() => onLoadWorksheet(item.url)}
                    disabled={isLoading}
                    className="w-full text-xs py-1.5 bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    Load into Whiteboard
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 text-stone-500 text-xs">
            No documents uploaded yet. Choose a document above to upload and start annotating.
          </div>
        )}
      </section>

      {/* Past Whiteboards History */}
      {isTeacher && pastClasses && pastClasses.length > 0 && (
        <section
          data-testid="past-whiteboards-section"
          aria-label="Past Whiteboards History"
          className="flex flex-col gap-2.5 pt-3 border-t border-stone-200"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-600">
            <History className="w-3.5 h-3.5 text-amber-600" />
            <span>Past Whiteboards ({pastClasses.length})</span>
          </div>

          <div className="flex flex-col gap-2" data-testid="past-whiteboards-list">
            {pastClasses.map((item) => (
              <div
                key={item.id}
                data-testid={`past-whiteboard-card-${item.roomId}`}
                className="flex flex-col p-3 rounded-xl gap-2 border border-stone-200 bg-white text-stone-900 shadow-sm"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-stone-500 font-mono">
                      {item.roomId}
                    </span>
                    <h4 className="text-xs font-semibold text-stone-900 truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-amber-600 font-medium">
                      {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} • {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid={`restore-past-wb-${item.roomId}`}
                    onClick={() => onRestoreWhiteboard?.(item)}
                    className="w-full text-xs py-1 bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold shadow-sm"
                  >
                    <History className="w-3.5 h-3.5 mr-1" />
                    Restore Whiteboard
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MaterialsTab;
