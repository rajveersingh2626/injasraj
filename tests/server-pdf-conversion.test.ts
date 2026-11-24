import { describe, it, expect } from 'vitest';
import { convertPdfServerSide } from '../src/lib/server/pdf-to-images';

describe('Server PDF Conversion', () => {
  it('converts synthetic PDF into image data URLs', async () => {
    const rawPdfText = `%PDF-1.7
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
xref
trailer <</Size 4 /Root 1 0 R /Info <</Title (Sample Title)>>>>
%%EOF`;
    const encoder = new TextEncoder();
    const pdfBytes = encoder.encode(rawPdfText);

    try {
      const result = await convertPdfServerSide(pdfBytes);
      console.log('Result totalPages:', result.totalPages, 'pages:', result.pages.length);
      expect(result.totalPages).toBe(1);
      expect(result.pages).toHaveLength(1);
    } catch (err) {
      console.error('Error in convertPdfServerSide:', err);
      throw err;
    }
  });
});
