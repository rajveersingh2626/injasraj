// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { exportAnnotatedPdf } from '../../src/lib/whiteboard/pdf-lib-export';
import { convertPdfServerSide } from '../../src/lib/server/pdf-to-images';
import { POST } from '../../src/app/api/documents/convert/route';
import { NextRequest } from 'next/server';

describe('Server-Side PDF Conversion Pipeline (/api/documents/convert)', () => {
  const dummy1x1Png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  async function generateTestPdf(pageCount: number = 2, title: string = 'Test Exam'): Promise<Uint8Array> {
    const annotations = Array.from({ length: pageCount }, (_, i) => ({
      pageNumber: i + 1,
      annotationDataUrl: dummy1x1Png,
    }));
    return await exportAnnotatedPdf(annotations, { title });
  }

  describe('convertPdfServerSide engine', () => {
    it('converts a 2-page PDF into ordered page images with page numbers, dimensions, and data URLs', async () => {
      const pdfBytes = await generateTestPdf(2, 'Calculus Assignment');
      const result = await convertPdfServerSide(pdfBytes, { scale: 1.5 });

      expect(result.title).toBe('Calculus Assignment');
      expect(result.totalPages).toBe(2);
      expect(result.pages).toHaveLength(2);

      // Strict sequential page order
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.pages[0].width).toBeGreaterThan(0);
      expect(result.pages[0].height).toBeGreaterThan(0);

      expect(result.pages[1].pageNumber).toBe(2);
      expect(result.pages[1].dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('throws when given an invalid non-PDF buffer', async () => {
      const garbage = new TextEncoder().encode('Not a PDF file');
      await expect(convertPdfServerSide(garbage)).rejects.toThrow(/Invalid PDF buffer/);
    });
  });

  describe('POST /api/documents/convert endpoint', () => {
    it('handles JSON body with base64 fileData payload', async () => {
      const pdfBytes = await generateTestPdf(3, 'Physics Worksheet');
      const base64Pdf = Buffer.from(pdfBytes).toString('base64');

      const req = new NextRequest('http://localhost:3000/api/documents/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'physics.pdf',
          fileData: `data:application/pdf;base64,${base64Pdf}`,
          scale: 1.0,
        }),
      });

      const response = await POST(req);
      const json = await response.json();
      expect(json.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.totalPages).toBe(3);
      expect(json.pages).toHaveLength(3);
      expect(json.pages[0].pageNumber).toBe(1);
      expect(json.pages[1].pageNumber).toBe(2);
      expect(json.pages[2].pageNumber).toBe(3);
    });

    it('handles multipart/form-data upload', async () => {
      const pdfBytes = await generateTestPdf(2, 'Chemistry Midterm');
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', blob, 'chemistry.pdf');
      formData.append('scale', '1.0');

      const nativeReq = new Request('http://localhost:3000/api/documents/convert', {
        method: 'POST',
        body: formData,
      });
      const req = new NextRequest(nativeReq);

      const response = await POST(req);
      const json = await response.json();
      expect(json.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.totalPages).toBe(2);
      expect(json.pages).toHaveLength(2);
    });

    it('returns 400 when uploaded file is not a PDF', async () => {
      const blob = new Blob(['not a pdf'], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, 'notes.txt');

      const req = new NextRequest('http://localhost:3000/api/documents/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(req);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain('not a valid PDF');
    });

    it('returns 400 when payload is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('fileData');
    });
  });
});
