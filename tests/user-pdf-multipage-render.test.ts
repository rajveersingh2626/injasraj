import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import {
  convertPdfToPageImages,
  getOrLoadPdfDocument,
  isPdfBuffer,
} from '../src/lib/whiteboard/pdf-renderer';
import { convertPdfServerSide } from '../src/lib/server/pdf-to-images';

describe('User Multi-Page PDF Loading & Sub-Page Flipping Verification', () => {
  const pdfPath =
    'C:\\Users\\jasra\\.gemini\\antigravity\\brain\\cee71939-befb-4fa7-8834-21bbe5c6622a\\.user_uploaded\\media_1795507960173_24602efc.pdf';
  const fileBytes = fs.readFileSync(pdfPath);

  it('validates user PDF buffer header', () => {
    expect(isPdfBuffer(fileBytes)).toBe(true);
  });

  it('preserves buffer integrity and loads all 10 pages without buffer detachment', async () => {
    const freshBytes = new Uint8Array(fileBytes);
    const originalLen = freshBytes.byteLength;
    expect(originalLen).toBeGreaterThan(1000000);

    const pdf = await getOrLoadPdfDocument(freshBytes);
    expect(pdf).toBeDefined();
    expect(pdf.numPages).toBe(10);

    // Verify buffer was NOT detached
    expect(freshBytes.byteLength).toBe(originalLen);
    expect(freshBytes[0]).toBe(0x25); // %

    // Load Page 6 (the specific page that failed in user screenshot)
    const page6 = await pdf.getPage(6);
    expect(page6).toBeDefined();
    const viewport = page6.getViewport({ scale: 1.0 });
    expect(viewport.width).toBeGreaterThan(500);
    expect(viewport.height).toBeGreaterThan(700);

    // Verify buffer is still intact
    expect(freshBytes.byteLength).toBe(originalLen);
  });

  it('server rasterizes user PDF into 10 real high-DPI image pages', async () => {
    const freshBytes = new Uint8Array(fileBytes);
    const result = await convertPdfServerSide(freshBytes, { scale: 1.0 });

    expect(result.totalPages).toBe(10);
    expect(result.pages).toHaveLength(10);
    expect(result.title).toContain('Ability Enhancement Course');

    // Page 1 and Page 6 must be authentic raster images (PNG, > 50KB data)
    const p1 = result.pages[0];
    const p6 = result.pages[5];

    expect(p1.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(p1.dataUrl.length).toBeGreaterThan(50000);
    expect(p6.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(p6.dataUrl.length).toBeGreaterThan(50000);
  }, 45000);

  it('client convertPdfToPageImages produces all 10 pages without losing pages > 5', async () => {
    const freshBytes = new Uint8Array(fileBytes);
    const result = await convertPdfToPageImages(freshBytes, 1.0);

    expect(result.totalPages).toBe(10);
    expect(result.pages).toHaveLength(10);
    expect(result.title).toContain('Ability Enhancement Course');

    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i]).toBeDefined();
      expect(result.pages[i].startsWith('data:image/')).toBe(true);
    }
  });
});
