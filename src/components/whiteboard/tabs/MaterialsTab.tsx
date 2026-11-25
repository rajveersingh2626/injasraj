import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, BookOpen, Loader2, History, Trash2, FileCode } from 'lucide-react';
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
      className={`flex flex-col h-full gap-4 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 hover:scrollbar-thumb-stone-400 scrollbar-track-transparent select-none ${className}`}
    >
      {/* Upload Document Section */}
      <section
        data-testid="pdf-upload-section"
        aria-label="Upload Document"
        className="flex flex-col gap-2.5 pb-4 border-b border-stone-200"
      >
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-amber-800">
          <Upload className="w-3.5 h-3.5 text-amber-800" />
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

          <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-800 font-semibold">
            <FileText className="w-5 h-5 text-amber-800" />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-stone-900">
              {selectedFile ? selectedFile.name : 'Upload Document'}
            </span>
            <span className="text-xs text-stone-600 font-medium">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                : 'Supports PDF, Word (.docx/.doc), and WebP/PNG images'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="upload-pdf-trigger-btn"
              onClick={handleUploadClick}
              disabled={isLoading}
              className="inline-flex items-center justify-center text-xs font-semibold px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 shadow-sm transition-all duration-150 active:scale-[0.97] cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {selectedFile ? 'Change Document' : 'Choose Document'}
            </button>

            {selectedFile && (
              <button
                type="button"
                data-testid="load-pdf-button"
                onClick={handleLoadSelectedFile}
                disabled={isLoading}
                className="inline-flex items-center justify-center text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 border border-amber-600/30 shadow-sm transition-all duration-150 active:scale-[0.97] cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-stone-950" />
                )}
                Load into Whiteboard
              </button>
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
        <div className="flex items-center justify-between text-xs font-bold text-stone-800 tracking-wider uppercase">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-stone-700" />
            <span>Uploaded Documents ({activeWorksheets.length})</span>
          </div>
          {isLoading && (
            <div data-testid="materials-loading" className="flex items-center gap-1 text-amber-800 text-[10px] font-semibold">
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                          {item.category}
                        </span>
                      )}
                      {item.pageCount && (
                        <span className="text-[10px] text-stone-600 font-medium">
                          {item.pageCount} pages
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-stone-900 mt-1 truncate">
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
                    className="p-1 rounded text-stone-500 hover:text-rose-600 hover:bg-stone-100 transition-colors cursor-pointer"
                    title="Delete this document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    data-testid={`load-worksheet-${item.id}`}
                    data-load-worksheet-id={item.id}
                    onClick={() => onLoadWorksheet(item.url)}
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center text-xs font-semibold py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 border border-amber-600/30 shadow-sm transition-all duration-150 active:scale-[0.97] cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Load into Whiteboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 text-stone-600 text-xs font-medium">
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
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-amber-800">
            <History className="w-3.5 h-3.5 text-amber-800" />
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
                    <h4 className="text-xs font-bold text-stone-900 truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-amber-800 font-semibold">
                      {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} • {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    data-testid={`restore-past-wb-${item.roomId}`}
                    onClick={() => onRestoreWhiteboard?.(item)}
                    className="w-full inline-flex items-center justify-center text-xs font-semibold py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 border border-amber-600/30 shadow-sm transition-all duration-150 active:scale-[0.97] cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    Restore Whiteboard
                  </button>
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
