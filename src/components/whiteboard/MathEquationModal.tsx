import React, { useState } from 'react';
import { X, Sigma, Check } from 'lucide-react';
import katex from 'katex';

export interface MathEquationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertEquation: (latex: string, svgDataUrl: string) => void;
}

interface MathSymbolButton {
  label: string;
  name: string;
  snippet: string;
}

const MATH_SYMBOLS: MathSymbolButton[] = [
  { label: 'Fraction', name: 'fraction', snippet: '\\frac{a}{b}' },
  { label: '√x', name: 'square root', snippet: '\\sqrt{x}' },
  { label: 'x²', name: 'exponent', snippet: 'x^{2}' },
  { label: 'xᵢ', name: 'subscript', snippet: 'x_{i}' },
  { label: '∫ dx', name: 'integral', snippet: '\\int_{a}^{b} f(x) dx' },
  { label: '∑', name: 'summation', snippet: '\\sum_{i=1}^{n} x_i' },
  { label: 'α', name: 'alpha', snippet: '\\alpha' },
  { label: 'β', name: 'beta', snippet: '\\beta' },
  { label: 'θ', name: 'theta', snippet: '\\theta' },
  { label: 'π', name: 'pi', snippet: '\\pi' },
  { label: '∞', name: 'infinity', snippet: '\\infty' },
  { label: '≠', name: 'not equal', snippet: '\\neq' },
  { label: '≤', name: 'less than equal', snippet: '\\le' },
  { label: '≥', name: 'greater than equal', snippet: '\\ge' },
];

export function generateFormulaSvgDataUrl(latex: string): string {
  const clean = latex.trim() || 'f(x) = 0';
  let renderedMath = '';
  try {
    renderedMath = katex.renderToString(clean, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    renderedMath = clean
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="130" viewBox="0 0 450 130">
    <rect width="100%" height="100%" rx="12" fill="rgba(24, 23, 21, 0.95)" stroke="rgba(180, 130, 60, 0.4)" stroke-width="2"/>
    <foreignObject x="10" y="10" width="430" height="110">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;height:100%;color:#f5f3e6;font-size:24px;">
        ${renderedMath}
      </div>
    </foreignObject>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const MathEquationModal: React.FC<MathEquationModalProps> = ({
  isOpen,
  onClose,
  onInsertEquation,
}) => {
  const [latex, setLatex] = useState<string>('\\frac{a}{b}');

  if (!isOpen) return null;

  const handleAppendSnippet = (snippet: string) => {
    setLatex((prev) => (prev ? `${prev} ${snippet}` : snippet));
  };

  const handleInsert = () => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    const svgDataUrl = generateFormulaSvgDataUrl(trimmed);
    onInsertEquation(trimmed, svgDataUrl);
    onClose();
  };

  return (
    <div
      data-testid="math-equation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-sm select-none animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg mx-4 rounded-3xl bg-stone-900/95 border border-stone-800 text-stone-100 shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Sigma className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-stone-100">
              Insert Math Formula (LaTeX)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors duration-150 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Math Symbol Palette */}
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-stone-950/70 border border-stone-800/80">
          {MATH_SYMBOLS.map((sym) => (
            <button
              key={sym.name}
              type="button"
              aria-label={sym.name}
              onClick={() => handleAppendSnippet(sym.snippet)}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 border border-stone-700/50 transition-colors active:scale-95"
              title={`Insert ${sym.label}`}
            >
              {sym.label}
            </button>
          ))}
        </div>

        {/* LaTeX Code Input Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-400">
            LaTeX Expression:
          </label>
          <textarea
            rows={3}
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            placeholder="Type LaTeX formula, e.g. E = mc^2 or \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
            className="w-full px-3 py-2 text-sm font-mono bg-stone-950/80 text-amber-200 border border-stone-800 rounded-xl focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 resize-none"
          />
        </div>

        {/* Live Vector Preview Box */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-400">
            Preview:
          </label>
          <div className="flex items-center justify-center p-4 rounded-xl bg-stone-950/60 border border-stone-800 min-h-[70px]">
            <div
              className="font-serif italic text-xl text-stone-100 tracking-wide text-center"
              dangerouslySetInnerHTML={{
                __html: (() => {
                  try {
                    return katex.renderToString(latex || 'f(x) = 0', {
                      displayMode: true,
                      throwOnError: false,
                    });
                  } catch {
                    return latex || 'Type LaTeX above to see preview';
                  }
                })(),
              }}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800/70 transition-colors active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-stone-950 border border-amber-500 transition-colors shadow-sm active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Insert on Canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
