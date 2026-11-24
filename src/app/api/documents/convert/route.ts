import { NextRequest, NextResponse } from 'next/server';
import { convertPdfServerSide } from '@/lib/server/pdf-to-images';
import { isPdfBuffer } from '@/lib/whiteboard/pdf-renderer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let pdfBytes: Uint8Array | null = null;
    let fileName: string | undefined;
    let scale = 1.5;
    let format: 'png' | 'jpg' = 'png';

    let isFormData = contentType.includes('multipart/form-data');
    if (!isFormData && !contentType.includes('application/json')) {
      try {
        const cloned = request.clone();
        const fd = await cloned.formData();
        if (fd && (fd.has('file') || fd.has('pdf'))) {
          isFormData = true;
        }
      } catch {}
    }

    if (isFormData) {
      const formData = await request.formData();
      const file = (formData.get('file') || formData.get('pdf')) as any;
      if (!file) {
        return NextResponse.json(
          { error: 'No PDF file found in form data (expected field "file" or "pdf")' },
          { status: 400 }
        );
      }
      fileName = typeof file.name === 'string' ? file.name : 'document.pdf';
      if (typeof file.arrayBuffer === 'function') {
        const ab = await file.arrayBuffer();
        pdfBytes = new Uint8Array(ab);
      } else if (typeof file === 'string') {
        pdfBytes = Buffer.from(file, 'binary');
      } else if (Buffer.isBuffer(file)) {
        pdfBytes = new Uint8Array(file);
      }

      const scaleParam = formData.get('scale');
      if (scaleParam) {
        const parsed = parseFloat(scaleParam.toString());
        if (!isNaN(parsed) && parsed > 0) scale = parsed;
      }
      const formatParam = formData.get('format');
      if (formatParam === 'jpg' || formatParam === 'jpeg') {
        format = 'jpg';
      }
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      if (!body.fileData || typeof body.fileData !== 'string') {
        return NextResponse.json(
          { error: 'Invalid JSON request: "fileData" (base64 or data URL) is required' },
          { status: 400 }
        );
      }
      fileName = body.fileName || body.title;
      if (body.scale && typeof body.scale === 'number') {
        scale = body.scale;
      }
      if (body.format === 'jpg' || body.format === 'jpeg') {
        format = 'jpg';
      }

      // Parse base64 or data URL
      const base64Data = body.fileData.includes(',')
        ? body.fileData.split(',')[1]
        : body.fileData;
      const buffer = Buffer.from(base64Data, 'base64');
      pdfBytes = new Uint8Array(buffer);
    } else {
      // Raw binary stream
      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        pdfBytes = new Uint8Array(arrayBuffer);
      }
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      return NextResponse.json(
        { error: 'Empty or missing PDF document payload' },
        { status: 400 }
      );
    }

    if (!isPdfBuffer(pdfBytes)) {
      return NextResponse.json(
        { error: 'Invalid document: Uploaded file is not a valid PDF (%PDF- header missing)' },
        { status: 400 }
      );
    }

    const docTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : undefined;
    const result = await convertPdfServerSide(pdfBytes, {
      scale,
      format,
      title: docTitle,
    });

    return NextResponse.json({
      success: true,
      title: result.title,
      totalPages: result.totalPages,
      pages: result.pages,
    });
  } catch (err: any) {
    console.error('Server-side PDF conversion error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to convert PDF document on server' },
      { status: 500 }
    );
  }
}
