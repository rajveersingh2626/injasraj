import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, BookOpen, Loader2 } from 'lucide-react';
import { GlassCard } from '../../ui/GlassCard';
import { GlassButton } from '../../ui/GlassButton';

export interface WorksheetMaterial {
  id: string;
  title: string;
  url: string;
  description?: string;
  category?: string;
  pageCount?: number;
}

export interface MaterialsTabProps {
  onLoadWorksheet: (fileOrUrl: File | string) => void;
  worksheets?: WorksheetMaterial[];
  isLoading?: boolean;
  className?: string;
}

export const DEFAULT_WORKSHEETS: WorksheetMaterial[] = [
  {
    id: 'algebra-quadratics',
    title: 'Algebra 1: Quadratic Equations Practice',
    description: 'Factoring, quadratic formula, and vertex form exercises',
    url: 'https://cdn.example.com/worksheets/algebra-quadratics.pdf',
    category: 'Mathematics',
    pageCount: 3,
  },
  {
    id: 'physics-kinematics',
    title: 'Physics: Kinematics & Motion Graphs',
    description: 'Velocity-time graphs and uniform acceleration problems',
    url: 'https://cdn.example.com/worksheets/physics-kinematics.pdf',
    category: 'Physics',
    pageCount: 4,
  },
  {
    id: 'calculus-derivatives',
    title: 'Calculus: Derivatives & Rates of Change',
    description: 'Product, quotient, and chain rule guided problem set',
    url: 'https://cdn.example.com/worksheets/calculus-derivatives.pdf',
    category: 'Calculus',
    pageCount: 5,
  },
];

export const MaterialsTab: React.FC<MaterialsTabProps> = ({
  onLoadWorksheet,
  worksheets = DEFAULT_WORKSHEETS,
  isLoading = false,
  className = '',
}) => {
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
      {/* Upload PDF Section */}
      <section
        data-testid="pdf-upload-section"
        aria-label="Upload PDF Worksheet"
        className="flex flex-col gap-2.5 pb-4 border-b border-white/[0.08]"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-indigo-400">
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>Upload Lesson Material</span>
        </div>

        <GlassCard
          variant="subtle"
          className="flex flex-col items-center justify-center p-4 border border-dashed border-white/[0.16] rounded-xl text-center gap-3 bg-white/[0.02]"
        >
          {/* Hidden HTML File Input for PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            data-testid="pdf-file-input"
            aria-label="Upload PDF Worksheet"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-zinc-200">
              {selectedFile ? selectedFile.name : 'Upload PDF Worksheet'}
            </span>
            <span className="text-[11px] text-zinc-500">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                : 'Supports multi-page vector PDF background'}
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
              className="text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              {selectedFile ? 'Change PDF' : 'Choose PDF File'}
            </GlassButton>

            {selectedFile && (
              <GlassButton
                type="button"
                variant="primary"
                size="sm"
                data-testid="load-pdf-button"
                onClick={handleLoadSelectedFile}
                disabled={isLoading}
                className="text-xs"
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
        </GlassCard>
      </section>

      {/* Worksheet Library */}
      <section
        data-testid="worksheet-library-section"
        aria-label="Worksheet Library"
        className="flex flex-col gap-3 flex-1"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 tracking-wider uppercase">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sample Worksheets ({worksheets.length})</span>
          </div>
          {isLoading && (
            <div data-testid="materials-loading" className="flex items-center gap-1 text-indigo-400 text-[10px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5" data-testid="worksheets-list">
          {worksheets.map((item) => (
            <GlassCard
              key={item.id}
              variant="default"
              data-testid={`worksheet-card-${item.id}`}
              className="flex flex-col p-3 rounded-xl gap-2 border border-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.category && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                        {item.category}
                      </span>
                    )}
                    {item.pageCount && (
                      <span className="text-[10px] text-zinc-500">
                        {item.pageCount} pages
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-100 mt-1 truncate">
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
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
                  className="w-full text-xs py-1.5"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Load into Whiteboard
                </GlassButton>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
};

export default MaterialsTab;
