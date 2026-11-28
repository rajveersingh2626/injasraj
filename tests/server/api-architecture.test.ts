import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { AppError, BadRequestError, formatErrorEnvelope, HttpStatus } from '@/server/errors';
import { logger } from '@/server/logger';
import { roomRepository } from '@/server/repositories/room-repository';
import { roomService } from '@/server/services/room-service';
import { cronSweeperService } from '@/server/services/cron-sweeper-service';
import { GET as roomSweeperGet } from '@/app/api/cron/room-sweeper/route';
import { POST as createRoomPost, GET as listRoomsGet } from '@/app/api/rooms/route';

describe('Phase 4: API Architecture, Service Layer & Backend Patterns Suite', () => {
  beforeEach(async () => {
    await roomRepository.clearAll();
    process.env.CRON_SECRET = 'test_cron_secret_12345';
  });

  describe('Centralized Error Envelopes & Formatting', () => {
    it('formats AppError with correct status code and details in envelope', () => {
      const err = new BadRequestError('Invalid classroom ID', 'INVALID_ROOM_ID', { field: 'roomId' });
      const envelope = formatErrorEnvelope(err, 'req-test-1');

      expect(envelope.success).toBe(false);
      expect(envelope.error.code).toBe('INVALID_ROOM_ID');
      expect(envelope.error.message).toBe('Invalid classroom ID');
      expect(envelope.error.details).toEqual({ field: 'roomId' });
      expect(envelope.meta.requestId).toBe('req-test-1');
    });

    it('redacts sensitive credentials in structured logger', () => {
      const entry = logger.info('User authenticated', {
        username: 'Inderjit',
        password: 'SuperSecretPassword',
        secret: 'Key123',
      });

      expect(entry.context?.username).toBe('Inderjit');
      expect(entry.context?.password).toBe('[REDACTED]');
      expect(entry.context?.secret).toBe('[REDACTED]');
    });
  });

  describe('Service Layer & Idempotency Key Handling', () => {
    it('creates a new room and returns clean room record', async () => {
      const room = await roomService.createRoom({
        title: 'Punjabi Poetry & Grammar',
        teacherId: 'teacher-inderjit',
        teacherName: 'Inderjit Kaur',
        ttlMinutes: 15,
      });

      expect(room.id).toBeDefined();
      expect(room.title).toBe('Punjabi Poetry & Grammar');
      expect(room.status).toBe('pending');
      expect(room.ttlMinutes).toBe(15);
    });

    it('enforces idempotency on duplicate room creation requests', async () => {
      const idempotencyKey = '11111111-2222-3333-4444-555555555555';
      const first = await roomService.createRoom({
        title: 'Idempotent Room',
        teacherId: 'teacher-1',
        teacherName: 'Teacher',
        idempotencyKey,
      });

      const second = await roomService.createRoom({
        title: 'Idempotent Room Duplicate',
        teacherId: 'teacher-1',
        teacherName: 'Teacher',
        idempotencyKey,
      });

      expect(first.id).toBe(second.id);
      expect(first.title).toBe(second.title);
    });

    it('records participant join, activates pending room, and computes expiresAt timestamp', async () => {
      const room = await roomService.createRoom({
        title: 'Active Room Session',
        teacherId: 'teacher-1',
        teacherName: 'Teacher',
        ttlMinutes: 20,
      });

      const joinResult = await roomService.recordJoin(room.id, {
        identity: 'student-alex',
        name: 'Alex',
        role: 'student',
      });

      expect(joinResult.room.status).toBe('active');
      expect(joinResult.room.joinedAt).toBeDefined();
      expect(joinResult.room.expiresAt).toBeDefined();

      const joinTime = new Date(joinResult.room.joinedAt!).getTime();
      const expireTime = new Date(joinResult.room.expiresAt!).getTime();
      expect(expireTime - joinTime).toBe(20 * 60 * 1000);
    });
  });

  describe('Vercel Cron Sweeper Handler (/api/cron/room-sweeper)', () => {
    it('rejects unauthorized invocation with 401 status when CRON_SECRET is missing or wrong', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/room-sweeper', {
        headers: {
          authorization: 'Bearer wrong_secret',
        },
      });

      const res = await roomSweeperGet(req);
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED_CRON');
    });

    it('authenticates and executes sweep of expired rooms successfully', async () => {
      // Seed an expired room
      const room = await roomService.createRoom({
        title: 'Stale Room 1',
        teacherId: 'teacher-1',
        teacherName: 'Teacher',
      });
      // Activate it and backdate expiration
      await roomService.recordJoin(room.id, { identity: 'user-1', name: 'User', role: 'teacher' });
      await roomRepository.update(room.id, {
        expiresAt: new Date(Date.now() - 10000).toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/cron/room-sweeper', {
        headers: {
          authorization: 'Bearer test_cron_secret_12345',
        },
      });

      const res = await roomSweeperGet(req);
      expect(res.status).toBe(HttpStatus.OK);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.archivedRoomsCount).toBe(1);
      expect(data.data.affectedRoomIds).toContain(room.id);

      const updated = await roomRepository.findById(room.id);
      expect(updated?.status).toBe('archived');
    });
  });

  describe('RESTful Rooms Endpoint (/api/rooms)', () => {
    it('creates room via POST and validates request body', async () => {
      const req = new NextRequest('http://localhost:3000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Punjabi Conversational Practice',
          teacherId: '00000000-0000-0000-0000-000000000001',
          teacherName: 'Inderjit Kaur',
          type: 'instant',
          ttlMinutes: 15,
        }),
      });

      const res = await createRoomPost(req);
      expect(res.status).toBe(HttpStatus.CREATED);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Punjabi Conversational Practice');
    });

    it('lists rooms via GET', async () => {
      await roomService.createRoom({
        title: 'Room List Test',
        teacherId: 'teacher-1',
        teacherName: 'Teacher',
      });

      const res = await listRoomsGet();
      expect(res.status).toBe(HttpStatus.OK);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.totalCount).toBeGreaterThanOrEqual(1);
    });
  });
});
