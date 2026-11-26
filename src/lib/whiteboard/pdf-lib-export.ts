/**
 * High-Fidelity Flattened PDF Annotation Exporter via pdf-lib
 *
 * Stamps vector canvas annotations directly onto original PDF pages or creates
 * a crisp multi-page PDF document for classroom download.
 */

import { PDFDocument } from 'pdf-lib';
import { renderCanvasObject } from './engine/shape-renderers';

export interface PageAnnotationExport {
  pageNumber: number; // 1-based
  annotationDataUrl?: string; // transparent PNG data URL of drawn strokes
  backgroundImageUrl?: string; // background image data URL (from document page)
  width?: number;
  height?: number;
}

export interface ExportPdfOptions {
  title?: string;
  author?: string;
  sourcePdfBytes?: ArrayBuffer | Uint8Array;
  defaultWidth?: number;
  defaultHeight?: number;
  pageWidth?: number;
  pageHeight?: number;
}

/**
 * Converts a data URL to Uint8Array bytes
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index === -1) {
    // If raw or url-encoded SVG, encode string
    const commaIndex = dataUrl.indexOf(',');
    const raw = decodeURIComponent(dataUrl.substring(commaIndex + 1));
    return new TextEncoder().encode(raw);
  }
  const base64 = dataUrl.substring(base64Index + 8);
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a WebP or non-PNG data URL to PNG using offscreen canvas for pdf-lib compatibility.
 */
export async function convertWebpToPng(dataUrl: string): Promise<string> {
  if (!dataUrl || typeof document === 'undefined') return dataUrl;
  if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/jpeg')) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1200;
        canvas.height = img.naturalHeight || 1600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch {}
      resolve(dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Renders serialized canvas JSON objects into a high-fidelity PNG data URL offscreen.
 */
export function renderCanvasJsonToDataUrl(
  canvasJson: any,
  width: number = 1920,
  height: number = 1080
): string | null {
  if (typeof document === 'undefined' || !canvasJson) return null;
  const objects = Array.isArray(canvasJson.objects) ? canvasJson.objects : [];
  if (objects.length === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    for (const obj of objects) {
      try {
        renderCanvasObject(ctx, obj);
      } catch {}
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Exports an annotated multi-page PDF with canvas drawings stamped onto each page.
 */
export async function exportAnnotatedPdf(
  annotations: PageAnnotationExport[],
  options: ExportPdfOptions = {}
): Promise<Uint8Array> {
  const {
    sourcePdfBytes,
    title = 'Classroom Annotated Document',
    author,
    defaultWidth = options.pageWidth || 612,
    defaultHeight = options.pageHeight || 792,
  } = options;

  let pdfDoc: PDFDocument;

  if (sourcePdfBytes && sourcePdfBytes.byteLength > 0) {
    pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
  } else {
    pdfDoc = await PDFDocument.create();
  }

  pdfDoc.setTitle(title);
  if (author) {
    pdfDoc.setAuthor(author);
  }
  pdfDoc.setProducer('Injasraj Classroom LearnCube Engine');

  const pageCount = pdfDoc.getPageCount();

  // If no pages exist yet, add pages according to annotations
  if (pageCount === 0) {
    const totalPages = Math.max(1, annotations.length);
    for (let i = 0; i < totalPages; i++) {
      const ann = annotations[i];
      const pW = ann?.width || defaultWidth;
      const pH = ann?.height || defaultHeight;
      pdfDoc.addPage([pW, pH]);
    }
  }

  const existingPages = pdfDoc.getPages();

  for (const ann of annotations) {
    const pageIndex = ann.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= existingPages.length) continue;

    const page = existingPages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // 1. Draw page background image if provided
    if (ann.backgroundImageUrl) {
      try {
        let bgUrl = ann.backgroundImageUrl;
        if (bgUrl.startsWith('data:image/webp')) {
          bgUrl = await convertWebpToPng(bgUrl);
        }
        if (bgUrl.startsWith('data:image/png') || bgUrl.startsWith('data:image/jpeg')) {
          const bgBytes = dataUrlToUint8Array(bgUrl);
          const embeddedBg = bgUrl.startsWith('data:image/png')
            ? await pdfDoc.embedPng(bgBytes)
            : await pdfDoc.embedJpg(bgBytes);
          page.drawImage(embeddedBg, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });
        }
      } catch (err) {
        console.warn(`Failed to embed background for page ${ann.pageNumber}:`, err);
      }
    }

    // 2. Stamp drawing annotation layer on top
    if (ann.annotationDataUrl) {
      try {
        let annUrl = ann.annotationDataUrl;
        if (annUrl.startsWith('data:image/webp')) {
          annUrl = await convertWebpToPng(annUrl);
        }
        if (annUrl.startsWith('data:image/png') || annUrl.startsWith('data:image/jpeg')) {
          const pngBytes = dataUrlToUint8Array(annUrl);
          const embeddedPng = annUrl.startsWith('data:image/png')
            ? await pdfDoc.embedPng(pngBytes)
            : await pdfDoc.embedJpg(pngBytes);
          page.drawImage(embeddedPng, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });
        }
      } catch (err) {
        console.warn(`Failed to embed annotation for page ${ann.pageNumber}:`, err);
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Triggers a browser download of the PDF binary
 */
export function downloadPdfBlob(pdfBytes: Uint8Array, filename: string = 'whiteboard-notes.pdf'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
