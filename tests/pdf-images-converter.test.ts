import { describe, it, expect, vi } from 'vitest';
import { convertPdfToPageImages, isPdfBuffer } from '../src/lib/whiteboard/pdf-renderer';

describe('PDF Ingestion to Raw Images Converter', () => {
  it('detects PDF magic header correctly', () => {
    const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(isPdfBuffer(validPdfBytes)).toBe(true);

    const invalidBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
    expect(isPdfBuffer(invalidBytes)).toBe(false);
  });

  it('converts PDF buffer into ordered array of page images with progress callback', async () => {
    // Generate simple synthetic PDF byte buffer with 3 pages
    const rawPdfText = `%PDF-1.7
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
4 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
5 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
xref
trailer <</Size 6 /Root 1 0 R /Info <</Title (Sample Geometry Worksheet)>>>>
%%EOF`;

    const encoder = new TextEncoder();
    const pdfBytes = encoder.encode(rawPdfText);

    const progressTracker: { current: number; total: number }[] = [];
    const onProgress = (current: number, total: number) => {
      progressTracker.push({ current, total });
    };

    const result = await convertPdfToPageImages(pdfBytes, 2.0, onProgress);

    expect(result).toBeDefined();
    expect(result.totalPages).toBe(3);
    expect(result.pages).toHaveLength(3);
    expect(result.title).toMatch(/Sample Geometry Worksheet|Document/);

    // Each page must be a data URL image
    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i]).toMatch(/^data:image\/(png|svg\+xml|jpeg)/);
    }

    // Verify progress tracking fired
    expect(progressTracker.length).toBeGreaterThanOrEqual(1);
    expect(progressTracker[progressTracker.length - 1]).toEqual({ current: 3, total: 3 });
  }, 30000);
});
