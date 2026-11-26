/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/livekit/token/route';
import { CANONICAL_TEACHER_ID, TEACHER_COOKIE_NAME } from '../src/lib/auth/teacher-auth';
import { signTeacherSessionCookie } from '../src/lib/auth/teacher-session-server';

describe('/api/livekit/token Route Handler', () => {
  beforeEach(() => {
    process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'mock_api_key_for_testing';
    process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'mock_secret_key_for_testing_1234567890';
    process.env.NEXT_PUBLIC_LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://injasraj-aosxldu2.livekit.cloud';
  });

  it('returns 400 when room parameter is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/livekit/token?username=Teacher1');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/room.*required/i);
  });

  it('returns 400 when username parameter is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/livekit/token?room=room-123');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/username.*required/i);
  });

  it('downgrades unauthenticated ?role=teacher to non-admin student grant', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/livekit/token?room=room-123&username=Jasraj&role=teacher'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.token.split('.').length).toBe(3);
    const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.video?.roomAdmin).toBe(false);
  });

  it('grants roomAdmin for authenticated teacher cookie', async () => {
    const signed = signTeacherSessionCookie({
      isAuthenticated: true,
      teacherId: CANONICAL_TEACHER_ID,
      teacherName: 'Inderjit Kaur',
      role: 'teacher',
      loginTime: new Date().toISOString(),
    });
    const req = new NextRequest(
      'http://localhost:3000/api/livekit/token?room=room-123&username=Jasraj&role=teacher',
      { headers: { cookie: `${TEACHER_COOKIE_NAME}=${signed}` } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.video?.roomAdmin).toBe(true);
  });

  it('mints a valid LiveKit token for student role', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/livekit/token?room=room-123&username=StudentAlice&role=student'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe('string');
  });
});
