import { describe, it, expect } from 'vitest';
import {
  isPdfBuffer,
  isWordDocument,
  renderHtmlToPageImage,
  convertWordDocumentToPageImages,
  convertDocumentToPageImages,
} from '../../src/lib/whiteboard/document-renderer';

describe('Document Renderer (Pure Visual Document Ingestion)', () => {
  it('detects PDF buffers correctly', () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
    expect(isPdfBuffer(pdfHeader)).toBe(true);

    const nonPdf = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(isPdfBuffer(nonPdf)).toBe(false);
  });

  it('detects Word document buffers correctly by zip header or file extension', () => {
    const docxHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04
    expect(isWordDocument(docxHeader)).toBe(true);

    const fakeFile = new File(['content'], 'assignment.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(isWordDocument(fakeFile)).toBe(true);

    const nonDocx = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(isWordDocument(nonDocx)).toBe(false);
  });

  it('renders HTML content to visual page image data URL', async () => {
    const sampleHtml = '<h1>Chapter 1: Quadratic Equations</h1><p>Standard form: ax^2 + bx + c = 0</p>';
    const dataUrl = await renderHtmlToPageImage(sampleHtml, 1632, 2112, 'Quadratic Equations');
    expect(dataUrl).toBeDefined();
    expect(dataUrl.startsWith('data:image/')).toBe(true);
  });

  it('converts image files directly to high-DPI page images', async () => {
    const fakeImageFile = new File(['mock-img-data'], 'diagram.png', {
      type: 'image/png',
    });
    const result = await convertDocumentToPageImages(fakeImageFile);
    expect(result.title).toBe('diagram');
    expect(result.totalPages).toBe(1);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].startsWith('data:image/')).toBe(true);
  });
});
