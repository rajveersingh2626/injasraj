import { describe, it, expect } from 'vitest';
import { exportMultiPagePdf, isPdfBuffer } from '../../src/lib/whiteboard/pdf-renderer';
import { WhiteboardPage } from '../../src/types/whiteboard';

describe('Multi-Page Lesson PDF Exporter', () => {
  const mockPages: WhiteboardPage[] = [
    {
      id: 'page-1',
      pageNumber: 1,
      title: 'Trigonometry Overview',
      canvasJson: { objects: [{ type: 'rect', left: 100, top: 100, width: 200, height: 100 }] },
    },
    {
      id: 'page-2',
      pageNumber: 2,
      title: 'Sine & Cosine Proofs',
      canvasJson: { objects: [{ type: 'circle', left: 300, top: 300, radius: 50 }] },
    },
    {
      id: 'page-3',
      pageNumber: 3,
      title: 'Practice Problems',
      canvasJson: { objects: [] },
    },
  ];

  it('compiles all whiteboard pages into a single valid multi-page PDF Blob', async () => {
    const pdfBlob = await exportMultiPagePdf(mockPages, 'room-calculus-101');
    expect(pdfBlob).toBeDefined();
    expect(pdfBlob.type).toBe('application/pdf');

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Verify PDF header magic bytes '%PDF-'
    expect(isPdfBuffer(uint8)).toBe(true);

    // Verify it contains 3 distinct pages
    const text = new TextDecoder().decode(uint8);
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    expect(pageMatches).toBeDefined();
    expect(pageMatches?.length).toBe(3);

    // Verify titles/metadata are embedded
    expect(text).toContain('Trigonometry Overview');
    expect(text).toContain('Practice Problems');
    expect(text).toContain('%%EOF');
  });

  it('handles empty pages array gracefully with a single fallback blank page', async () => {
    const pdfBlob = await exportMultiPagePdf([], 'empty-room');
    expect(pdfBlob).toBeDefined();
    const arrayBuffer = await pdfBlob.arrayBuffer();
    expect(isPdfBuffer(new Uint8Array(arrayBuffer))).toBe(true);
  });
});
