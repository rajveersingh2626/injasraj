import { describe, it, expect } from 'vitest';
import {
  CreateRoomRequestContract,
  WhiteboardSyncDeltaContract,
  WhiteboardPageContract,
  CreateBookingRequestContract,
  RoomSweeperResultContract,
  ApiResponseEnvelope,
} from '@/contracts/classroom-contracts';
import { z } from 'zod';

describe('Classroom UI Consumers Contract Suite', () => {
  describe('Room Management Contracts', () => {
    it('validates a correct instant room creation request', () => {
      const validPayload = {
        title: 'Punjabi 101 - Gurmukhi Alphabet',
        teacherId: 'teacher-inderjit',
        teacherName: 'Inderjit Kaur',
        type: 'instant',
        ttlMinutes: 15,
        idempotencyKey: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      };
      const result = CreateRoomRequestContract.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('instant');
        expect(result.data.ttlMinutes).toBe(15);
      }
    });

    it('rejects invalid room creation payloads (missing teacherId or bad TTL)', () => {
      const invalidPayload = {
        title: 'Missing Teacher',
        ttlMinutes: -5,
      };
      const result = CreateRoomRequestContract.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Whiteboard Synchronization Contracts', () => {
    it('validates a valid whiteboard sync delta packet', () => {
      const delta = {
        type: 'object-added',
        roomId: 'room-punjabi-1',
        pageId: 'page-1',
        senderId: 'teacher-1',
        senderRole: 'teacher',
        payload: {
          type: 'path',
          path: [['M', 0, 0], ['L', 100, 100]],
          stroke: '#18181b',
        },
        timestamp: Date.now(),
      };
      const result = WhiteboardSyncDeltaContract.safeParse(delta);
      expect(result.success).toBe(true);
    });

    it('validates whiteboard page structure with storage offloading metadata', () => {
      const page = {
        id: 'page-doc-1',
        title: 'Slide 1 - Introduction',
        pageIndex: 0,
        isLocked: false,
        storagePath: 'rooms/room-1/pages/page-doc-1/canvas.json',
        pdfDocumentId: 'pdf-worksheet-1',
        pdfPageIndex: 1,
      };
      const result = WhiteboardPageContract.safeParse(page);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isLocked).toBe(false);
        expect(result.data.storagePath).toBe('rooms/room-1/pages/page-doc-1/canvas.json');
      }
    });
  });

  describe('Booking Portal Contracts', () => {
    it('validates student booking request with valid datetime strings', () => {
      const booking = {
        teacherId: 'teacher-inderjit',
        studentName: 'Harpreet Singh',
        studentEmail: 'harpreet@example.com',
        studentTimezone: 'America/Toronto',
        scheduledStart: '2026-12-01T14:00:00.000Z',
        scheduledEnd: '2026-12-01T14:45:00.000Z',
        subject: 'Punjabi Conversational Practice',
        notes: 'Interested in mastering Gurmukhi vowel markers.',
      };
      const result = CreateBookingRequestContract.safeParse(booking);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email and invalid date formats', () => {
      const invalidBooking = {
        teacherId: 'teacher-1',
        studentName: 'H',
        studentEmail: 'not-an-email',
        studentTimezone: 'UTC',
        scheduledStart: 'not-a-date',
        scheduledEnd: 'not-a-date',
      };
      const result = CreateBookingRequestContract.safeParse(invalidBooking);
      expect(result.success).toBe(false);
    });
  });

  describe('Cron Sweeper & Envelope Contracts', () => {
    it('validates room sweeper response structure', () => {
      const sweeperResult = {
        sweptAt: new Date().toISOString(),
        expiredRoomsCount: 2,
        archivedRoomsCount: 2,
        affectedRoomIds: ['room-old-1', 'room-old-2'],
        durationMs: 42,
      };
      const parseResult = RoomSweeperResultContract.safeParse(sweeperResult);
      expect(parseResult.success).toBe(true);

      const Envelope = ApiResponseEnvelope(RoomSweeperResultContract);
      const envelopeResult = Envelope.safeParse({
        success: true,
        data: sweeperResult,
      });
      expect(envelopeResult.success).toBe(true);
    });
  });
});
