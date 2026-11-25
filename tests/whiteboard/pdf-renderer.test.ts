import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPdfBuffer,
  extractPdfMetadata,
  renderPdfPageToDataUrl,
  generateMockSvgDataUrl,
  clearPdfDocumentCache,
  type PdfPageRenderResult,
  type PdfMetadata,
} from '../../src/lib/whiteboard/pdf-renderer';

// Helper to create synthetic PDF buffers for deterministic tests
function createSyntheticPdf(options: {
  pageCount?: number;
  title?: string;
  mediaBox?: [number, number, number, number];
  omitCount?: boolean;
} = {}): Uint8Array {
  const { pageCount = 1, title, mediaBox, omitCount = false } = options;
  let text = '%PDF-1.4\n';

  if (title) {
    text += `/Title (${title})\n`;
  }

  if (!omitCount) {
    text += `/Type /Pages\n/Count ${pageCount}\n`;
  }

  for (let i = 1; i <= pageCount; i++) {
    text += `1 0 obj\n<< /Type /Page >>\nendobj\n`;
  }

  if (mediaBox) {
    text += `/MediaBox [${mediaBox.join(' ')}]\n`;
  }

  return new TextEncoder().encode(text);
}

describe('PDF Ingestion & Worksheet Background Renderer', () => {
  const originalPdfjs = (globalThis as any).window?.pdfjsLib;

  afterEach(() => {
    if ((globalThis as any).window) {
      if (originalPdfjs !== undefined) {
        (globalThis as any).window.pdfjsLib = originalPdfjs;
      } else {
        delete (globalThis as any).window.pdfjsLib;
      }
    }
    clearPdfDocumentCache();
    vi.restoreAllMocks();
  });

  describe('isPdfBuffer', () => {
    it('detects valid PDF magic bytes (%PDF-) from Uint8Array', () => {
      const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      expect(isPdfBuffer(validPdfBytes)).toBe(true);
    });

    it('detects valid PDF magic bytes from ArrayBuffer', () => {
      const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer;
      expect(isPdfBuffer(buffer)).toBe(true);
    });

    it('detects PDF magic bytes preceded by up to 1024 bytes of preamble junk', () => {
      const junk = new Uint8Array(20).fill(0x20); // 20 spaces
      const magic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const combined = new Uint8Array(junk.length + magic.length);
      combined.set(junk, 0);
      combined.set(magic, junk.length);
      expect(isPdfBuffer(combined)).toBe(true);
    });

    it('rejects buffers with invalid magic bytes', () => {
      const invalid = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG header
      expect(isPdfBuffer(invalid)).toBe(false);
    });

    it('rejects buffers shorter than 5 bytes', () => {
      const short = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      expect(isPdfBuffer(short)).toBe(false);
    });

    it('rejects empty, null, or undefined buffers', () => {
      expect(isPdfBuffer(new ArrayBuffer(0))).toBe(false);
      expect(isPdfBuffer(new Uint8Array(0))).toBe(false);
      expect(isPdfBuffer(null as any)).toBe(false);
      expect(isPdfBuffer(undefined as any)).toBe(false);
    });
  });

  describe('extractPdfMetadata', () => {
    it('throws descriptive error on invalid PDF buffer', async () => {
      const invalid = new Uint8Array([1, 2, 3, 4, 5]);
      await expect(extractPdfMetadata(invalid)).rejects.toThrow('Invalid PDF buffer: Missing %PDF- header');
    });

    it('extracts default 1-page metadata from minimal %PDF- buffer', async () => {
      const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const meta = await extractPdfMetadata(fakePdf);
      expect(meta.pageCount).toBe(1);
      expect(meta.title).toBeUndefined();
    });

    it('extracts pageCount and title from synthetic PDF buffer', async () => {
      const pdf = createSyntheticPdf({
        pageCount: 4,
        title: 'Trigonometry Worksheet - Unit 2',
      });
      const meta = await extractPdfMetadata(pdf);
      expect(meta.pageCount).toBe(4);
      expect(meta.title).toBe('Trigonometry Worksheet - Unit 2');
    });

    it('falls back to counting /Type /Page objects when /Count is omitted', async () => {
      const pdf = createSyntheticPdf({
        pageCount: 3,
        omitCount: true,
      });
      const meta = await extractPdfMetadata(pdf);
      expect(meta.pageCount).toBe(3);
    });

    it('accepts ArrayBuffer input in extractPdfMetadata', async () => {
      const pdf = createSyntheticPdf({ pageCount: 2, title: 'Sample' });
      const meta = await extractPdfMetadata(pdf.buffer as ArrayBuffer);
      expect(meta.pageCount).toBe(2);
      expect(meta.title).toBe('Sample');
    });

    it('uses window.pdfjsLib when present in environment', async () => {
      const fakeDoc = {
        numPages: 6,
        getMetadata: vi.fn().mockResolvedValue({
          info: { Title: 'Mocked PDF from PDF.js' },
        }),
      };
      (window as any).pdfjsLib = {
        getDocument: vi.fn().mockReturnValue({
          promise: Promise.resolve(fakeDoc),
        }),
      };

      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const meta = await extractPdfMetadata(pdf);
      expect(meta.pageCount).toBe(6);
      expect(meta.title).toBe('Mocked PDF from PDF.js');
    });

    it('falls back to local byte parser if window.pdfjsLib rejects', async () => {
      (window as any).pdfjsLib = {
        getDocument: vi.fn().mockReturnValue({
          promise: Promise.reject(new Error('PDF.js worker initialization failed')),
        }),
      };

      const pdf = createSyntheticPdf({ pageCount: 2, title: 'Fallback Test' });
      const meta = await extractPdfMetadata(pdf);
      expect(meta.pageCount).toBe(2);
      expect(meta.title).toBe('Fallback Test');
    });
  });

  describe('renderPdfPageToDataUrl', () => {
    it('throws error when buffer is not a valid PDF', async () => {
      const notPdf = new Uint8Array([0, 1, 2, 3, 4]);
      await expect(renderPdfPageToDataUrl(notPdf, 1)).rejects.toThrow('Invalid PDF buffer: Missing %PDF- header');
    });

    it('throws error for page number 0 (out of bounds)', async () => {
      const pdf = createSyntheticPdf({ pageCount: 3 });
      await expect(renderPdfPageToDataUrl(pdf, 0)).rejects.toThrow(
        'Invalid page number 0: Page must be between 1 and 3'
      );
    });

    it('throws error for negative page number', async () => {
      const pdf = createSyntheticPdf({ pageCount: 3 });
      await expect(renderPdfPageToDataUrl(pdf, -1)).rejects.toThrow(
        'Invalid page number -1: Page must be between 1 and 3'
      );
    });

    it('throws error for page number exceeding totalPages', async () => {
      const pdf = createSyntheticPdf({ pageCount: 2 });
      await expect(renderPdfPageToDataUrl(pdf, 3)).rejects.toThrow(
        'Invalid page number 3: Page must be between 1 and 2'
      );
      await expect(renderPdfPageToDataUrl(pdf, 999)).rejects.toThrow(
        'Invalid page number 999: Page must be between 1 and 2'
      );
    });

    it('throws error for non-integer page number', async () => {
      const pdf = createSyntheticPdf({ pageCount: 2 });
      await expect(renderPdfPageToDataUrl(pdf, 1.5)).rejects.toThrow(
        'Invalid page number 1.5: Page must be between 1 and 2'
      );
    });

    it('renders page 1 with default 2x scale crisp dimensions and valid image dataUrl', async () => {
      const pdf = createSyntheticPdf({
        pageCount: 1,
        title: 'Physics Mechanics Worksheet',
      });

      const result: PdfPageRenderResult = await renderPdfPageToDataUrl(pdf, 1);

      expect(result.pageNumber).toBe(1);
      expect(result.totalPages).toBe(1);
      // Default base 612x792 @ 2x scale = 1224x1584
      expect(result.width).toBe(1224);
      expect(result.height).toBe(1584);
      expect(result.dataUrl).toMatch(/^data:image\//);

      // Verify the generated SVG contains expected metadata
      const decodedSvg = decodeURIComponent(result.dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
      expect(decodedSvg).toContain('Physics Mechanics Worksheet');
      expect(decodedSvg).toContain('Page 1 of 1');
      expect(decodedSvg).toContain('width="1224"');
      expect(decodedSvg).toContain('height="1584"');
    });

    it('renders page with custom scale factor (e.g. 1.0x, 0.5x, 3.0x)', async () => {
      const pdf = createSyntheticPdf({ pageCount: 1 });

      const scale1 = await renderPdfPageToDataUrl(pdf, 1, 1.0);
      expect(scale1.width).toBe(612);
      expect(scale1.height).toBe(792);

      const scaleHalf = await renderPdfPageToDataUrl(pdf, 1, 0.5);
      expect(scaleHalf.width).toBe(306);
      expect(scaleHalf.height).toBe(396);

      const scale3 = await renderPdfPageToDataUrl(pdf, 1, 3.0);
      expect(scale3.width).toBe(1836);
      expect(scale3.height).toBe(2376);
    });

    it('respects custom MediaBox dimensions defined in PDF', async () => {
      const pdf = createSyntheticPdf({
        pageCount: 2,
        mediaBox: [0, 0, 800, 1000],
      });

      const res = await renderPdfPageToDataUrl(pdf, 2, 2.0);
      expect(res.pageNumber).toBe(2);
      expect(res.totalPages).toBe(2);
      expect(res.width).toBe(1600); // 800 * 2
      expect(res.height).toBe(2000); // 1000 * 2
    });

    it('renders with ArrayBuffer input', async () => {
      const pdf = createSyntheticPdf({ pageCount: 3 });
      const res = await renderPdfPageToDataUrl(pdf.buffer as ArrayBuffer, 2);
      expect(res.pageNumber).toBe(2);
      expect(res.totalPages).toBe(3);
    });

    it('uses canvas toDataURL when canvas 2D context is mocked or functional', async () => {
      const spyToDataUrl = vi
        .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
        .mockReturnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      const spyGetContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue({
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          fillText: vi.fn(),
        } as any);

      const pdf = createSyntheticPdf({ pageCount: 1 });
      const res = await renderPdfPageToDataUrl(pdf, 1);

      expect(res.dataUrl).toBe(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      );
      expect(res.width).toBe(1224);
      expect(res.height).toBe(1584);

      spyToDataUrl.mockRestore();
      spyGetContext.mockRestore();
    });

    it('uses window.pdfjsLib when present and coordinates page rendering', async () => {
      const renderPromise = Promise.resolve();
      const mockPage = {
        getViewport: vi.fn().mockReturnValue({ width: 700, height: 900 }),
        render: vi.fn().mockReturnValue({ promise: renderPromise }),
      };
      const fakeDoc = {
        numPages: 5,
        getPage: vi.fn().mockResolvedValue(mockPage),
        getMetadata: vi.fn().mockResolvedValue({
          info: { Title: 'Mocked PDF Document' },
        }),
      };
      (window as any).pdfjsLib = {
        getDocument: vi.fn().mockReturnValue({
          promise: Promise.resolve(fakeDoc),
        }),
      };

      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const res = await renderPdfPageToDataUrl(pdf, 3, 2.0);

      expect(fakeDoc.getPage).toHaveBeenCalledWith(3);
      expect(res.pageNumber).toBe(3);
      expect(res.totalPages).toBe(5);
      expect(res.width).toBe(700);
      expect(res.height).toBe(900);
      expect(res.dataUrl).toMatch(/^data:image\//);
    });
  });

  describe('generateMockSvgDataUrl helper', () => {
    it('escapes XML special characters in title and produces valid data URI', () => {
      const dataUrl = generateMockSvgDataUrl(2, 5, 800, 1000, 'Math <Test> & "Quiz"');
      expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      const decoded = decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
      expect(decoded).toContain('Math &lt;Test&gt; &amp; &quot;Quiz&quot;');
      expect(decoded).toContain('Page 2 of 5');
    });
  });
});
