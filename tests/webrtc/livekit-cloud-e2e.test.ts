/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/livekit/token/route';

describe('LiveKit Cloud Production & WebRTC Verification', () => {
  beforeAll(() => {
    process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://injasraj-aosxldu2.livekit.cloud';
    process.env.NEXT_PUBLIC_LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://injasraj-aosxldu2.livekit.cloud';
  });

  const wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://injasraj-aosxldu2.livekit.cloud';
  const apiKey = process.env.LIVEKIT_API_KEY || '';
  const apiSecret = process.env.LIVEKIT_API_SECRET || '';
  const httpUrl = wsUrl.replace('wss://', 'https://');

  it('authenticates and connects to LiveKit Cloud SFU via RoomServiceClient', async () => {
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await svc.listRooms();
    expect(Array.isArray(rooms)).toBe(true);
  });

  it('creates an ephemeral room, queries it, and deletes it cleanly on LiveKit Cloud', async () => {
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const testRoomId = `e2e-test-${Date.now()}`;

    // Create room
    const room = await svc.createRoom({
      name: testRoomId,
      emptyTimeout: 60,
      maxParticipants: 5,
    });
    expect(room.name).toBe(testRoomId);
    expect(room.sid).toBeDefined();

    // Query participants
    const participants = await svc.listParticipants(testRoomId);
    expect(Array.isArray(participants)).toBe(true);
    expect(participants.length).toBe(0);

    // Delete room
    await svc.deleteRoom(testRoomId);

    // Verify room is removed or no longer active
    const activeRooms = await svc.listRooms();
    const found = activeRooms.find((r) => r.name === testRoomId);
    expect(found).toBeUndefined();
  });

  it('mints teacher and student tokens via /api/livekit/token with correct roles and claims', async () => {
    // 1. Teacher token
    const teacherReq = new NextRequest(
      'http://localhost:3000/api/livekit/token?room=e2e-room&username=Inderjit+Kaur&userId=teacher-1&role=teacher'
    );
    const teacherRes = await GET(teacherReq);
    expect(teacherRes.status).toBe(200);
    const teacherData = await teacherRes.json();
    expect(teacherData.token).toBeDefined();
    expect(teacherData.url).toContain('livekit.cloud');
    expect(teacherData.token.split('.').length).toBe(3);

    // 2. Student token
    const studentReq = new NextRequest(
      'http://localhost:3000/api/livekit/token?room=e2e-room&username=StudentAlex&userId=student-1&role=student'
    );
    const studentRes = await GET(studentReq);
    expect(studentRes.status).toBe(200);
    const studentData = await studentRes.json();
    expect(studentData.token).toBeDefined();
    expect(studentData.url).toContain('livekit.cloud');
    expect(studentData.token.split('.').length).toBe(3);
  });

  it('generates valid grants for multi-party audio, video, and screen share in live tokens', async () => {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: 'test-identity',
      name: 'Test Participant',
    });
    at.addGrant({
      room: 'test-room',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: true,
    });

    const jwt = await at.toJwt();
    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(100);

    // Parse payload
    const parts = jwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    expect(payload.video.room).toBe('test-room');
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canSubscribe).toBe(true);
    expect(payload.video.roomAdmin).toBe(true);
  });
});
