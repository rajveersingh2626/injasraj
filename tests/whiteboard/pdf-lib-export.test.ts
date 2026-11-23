import { describe, it, expect } from 'vitest';
import { exportAnnotatedPdf, dataUrlToUint8Array } from '../../src/lib/whiteboard/pdf-lib-export';

describe('pdf-lib Export Engine (Annotated Multi-Page PDF Exporter)', () => {
  it('converts data URLs to byte arrays cleanly', () => {
    // 1x1 transparent PNG data URL
    const pngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const bytes = dataUrlToUint8Array(pngDataUrl);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(10);
    // PNG signature: [0x89, 0x50, 0x4E, 0x47]
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
  });

  it('creates an annotated PDF document from annotations and sets metadata', async () => {
    const pngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const pdfBytes = await exportAnnotatedPdf(
      [
        { pageNumber: 1, annotationDataUrl: pngDataUrl },
        { pageNumber: 2, annotationDataUrl: pngDataUrl },
      ],
      {
        title: 'Math Lesson 4',
      }
    );

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(100);

    // Verify PDF header %PDF-
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});
