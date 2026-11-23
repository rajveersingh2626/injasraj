/**
 * High-Fidelity Flattened PDF Annotation Exporter via pdf-lib
 *
 * Stamps vector canvas annotations directly onto original PDF pages or creates
 * a crisp multi-page PDF document for classroom download.
 */

import { PDFDocument } from 'pdf-lib';

export interface PageAnnotationExport {
  pageNumber: number; // 1-based
  annotationDataUrl?: string; // transparent PNG data URL of drawn strokes
  width?: number;
  height?: number;
}

export interface ExportPdfOptions {
  title?: string;
  sourcePdfBytes?: ArrayBuffer | Uint8Array;
  defaultWidth?: number;
  defaultHeight?: number;
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
 * Exports an annotated multi-page PDF with canvas drawings stamped onto each page.
 */
export async function exportAnnotatedPdf(
  annotations: PageAnnotationExport[],
  options: ExportPdfOptions = {}
): Promise<Uint8Array> {
  const { sourcePdfBytes, title = 'Classroom Annotated Document', defaultWidth = 612, defaultHeight = 792 } = options;

  let pdfDoc: PDFDocument;

  if (sourcePdfBytes && sourcePdfBytes.byteLength > 0) {
    pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
  } else {
    pdfDoc = await PDFDocument.create();
  }

  pdfDoc.setTitle(title);
  pdfDoc.setProducer('Injasraj Classroom LearnCube Engine');

  const pageCount = pdfDoc.getPageCount();

  // If no pages exist yet, add pages according to annotations
  if (pageCount === 0) {
    const totalPages = Math.max(1, annotations.length);
    for (let i = 0; i < totalPages; i++) {
      pdfDoc.addPage([defaultWidth, defaultHeight]);
    }
  }

  const existingPages = pdfDoc.getPages();

  for (const ann of annotations) {
    const pageIndex = ann.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= existingPages.length) continue;

    const page = existingPages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (ann.annotationDataUrl && ann.annotationDataUrl.startsWith('data:image/png')) {
      try {
        const pngBytes = dataUrlToUint8Array(ann.annotationDataUrl);
        const embeddedPng = await pdfDoc.embedPng(pngBytes);
        page.drawImage(embeddedPng, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });
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
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
