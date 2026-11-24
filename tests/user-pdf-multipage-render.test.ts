import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import {
  convertPdfToPageImages,
  renderPdfPageToDataUrl,
  isPdfBuffer,
} from '../src/lib/whiteboard/pdf-renderer';

describe('User Multi-Page PDF Loading & Sub-Page Flipping Verification', () => {
  const pdfPath =
    'C:\\Users\\jasra\\.gemini\\antigravity\\brain\\cee71939-befb-4fa7-8834-21bbe5c6622a\\.user_uploaded\\media_1795507960173_24602efc.pdf';
  const fileBytes = fs.readFileSync(pdfPath);

  it('validates user PDF buffer header', () => {
    expect(isPdfBuffer(fileBytes)).toBe(true);
  });

  it('preserves buffer integrity and does not detach input bytes', async () => {
    const freshBytes = new Uint8Array(fileBytes);
    const originalLen = freshBytes.byteLength;
    expect(originalLen).toBeGreaterThan(1000000);

    // Render Page 1
    const p1 = await renderPdfPageToDataUrl(freshBytes, 1, 1.5);
    expect(p1.dataUrl).toBeDefined();
    expect(p1.totalPages).toBe(10);

    // Verify buffer was NOT detached
    expect(freshBytes.byteLength).toBe(originalLen);
    expect(freshBytes[0]).toBe(0x25); // %

    // Render Page 6 (the specific page that failed in user screenshot)
    const p6 = await renderPdfPageToDataUrl(freshBytes, 6, 1.5);
    expect(p6.dataUrl).toBeDefined();
    expect(p6.pageNumber).toBe(6);
    expect(p6.totalPages).toBe(10);
    expect(freshBytes.byteLength).toBe(originalLen);
  });

  it('converts multi-page PDF into 10 ordered pages without losing pages > 5', async () => {
    const freshBytes = new Uint8Array(fileBytes);
    const result = await convertPdfToPageImages(freshBytes, 1.5);

    expect(result.totalPages).toBe(10);
    expect(result.pages).toHaveLength(10);
    expect(result.title).toContain('Ability Enhancement Course');

    for (let i = 0; i < result.pages.length; i++) {
      expect(result.pages[i]).toBeDefined();
      expect(result.pages[i].startsWith('data:image/')).toBe(true);
    }
  });
});
