/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/livekit/token/route';

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

  it('mints a valid LiveKit token for teacher role', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/livekit/token?room=room-123&username=Jasraj&role=teacher'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe('string');
    expect(data.url).toBe('wss://injasraj-aosxldu2.livekit.cloud');
    // JWT format has 3 parts separated by dots
    expect(data.token.split('.').length).toBe(3);
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
