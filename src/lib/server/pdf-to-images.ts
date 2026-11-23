import { pdf } from 'pdf-to-img';
import { PDFDocument } from 'pdf-lib';
import { isPdfBuffer } from '../whiteboard/pdf-renderer';

export interface ServerPdfPageImage {
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface ServerPdfConvertResult {
  title: string;
  totalPages: number;
  pages: ServerPdfPageImage[];
}

export interface ConvertPdfOptions {
  scale?: number;
  format?: 'png' | 'jpg';
  title?: string;
}

/**
 * Server-side PDF rasterization pipeline.
 *
 * Adopts the workflow patterns from doggy8088/pdf-to-images (Node/TypeScript server-side
 * rasterization) and spatie/pdf-to-image (clean sequential per-page extraction API).
 * Offloads all CPU-intensive image decompression and canvas rendering from client browsers
 * to prevent main thread freezing.
 */
export async function convertPdfServerSide(
  pdfBytes: Uint8Array | ArrayBuffer | Buffer,
  options: ConvertPdfOptions = {}
): Promise<ServerPdfConvertResult> {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

  if (!isPdfBuffer(bytes)) {
    throw new Error('Invalid PDF buffer: Missing %PDF- header');
  }

  const scale = options.scale ?? 2.0;
  const format = options.format ?? 'png';

  // 1. Extract accurate per-page dimensions and title using pdf-lib
  let extractedTitle = options.title;
  let pageDimensions: Array<{ width: number; height: number }> = [];

  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (!extractedTitle) {
      extractedTitle = pdfDoc.getTitle() || undefined;
    }
    const docPages = pdfDoc.getPages();
    pageDimensions = docPages.map((p) => ({
      width: Math.round(p.getWidth() * scale),
      height: Math.round(p.getHeight() * scale),
    }));
  } catch {
    // Graceful fallback if pdf-lib metadata parse encounters non-standard structure
  }

  // 2. Sequential per-page rasterization using pdf-to-img
  const doc = await pdf(Buffer.from(bytes), {
    scale,
    format: format === 'jpg' ? 'jpg' : 'png',
  });

  const totalPages = doc.length;
  const resolvedTitle = extractedTitle || (doc.metadata as any)?.Title || 'Document';
  const pages: ServerPdfPageImage[] = [];

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  let pageIndex = 1;

  for await (const imageBuffer of doc) {
    const dim = pageDimensions[pageIndex - 1] || {
      width: Math.round(612 * scale),
      height: Math.round(792 * scale),
    };

    const base64 = Buffer.from(imageBuffer).toString('base64');
    pages.push({
      pageNumber: pageIndex,
      width: dim.width,
      height: dim.height,
      dataUrl: `data:${mimeType};base64,${base64}`,
    });

    pageIndex++;
  }

  return {
    title: resolvedTitle,
    totalPages,
    pages,
  };
}
