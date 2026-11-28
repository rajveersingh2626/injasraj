/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginPOST } from '@/app/api/auth/teacher-login/route';
import { GET as sessionGET } from '@/app/api/auth/teacher-session/route';
import { POST as logoutPOST } from '@/app/api/auth/teacher-logout/route';
import { CANONICAL_TEACHER_ID, TEACHER_COOKIE_NAME } from '@/lib/auth/teacher-auth';
import { signTeacherSessionCookie } from '@/lib/auth/teacher-session-server';

describe('Teacher Authentication Server API Routes', () => {
  beforeEach(() => {
    process.env.TEACHER_PASSCODE = 'Mt22@raman';
  });

  it('rejects login with invalid passcode with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/teacher-login', {
      method: 'POST',
      body: JSON.stringify({ passcode: 'bad-password' }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/invalid.*passcode/i);
  });

  it('rejects login with obsolete passcode with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/teacher-login', {
      method: 'POST',
      body: JSON.stringify({ passcode: 'injasraj123' }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/invalid.*passcode/i);
  });

  it('authenticates teacher with valid passcode Mt22@raman and returns session and cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/teacher-login', {
      method: 'POST',
      body: JSON.stringify({ passcode: 'Mt22@raman', teacherName: 'Inderjit Kaur' }),
    });
    const res = await loginPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.session.teacherId).toBe(CANONICAL_TEACHER_ID);
    expect(data.session.teacherName).toBe('Inderjit Kaur');
    expect(data.session.role).toBe('teacher');

    // Cookie set (signed & httpOnly)
    const cookie = res.cookies.get(TEACHER_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toContain('.');
  });

  it('rejects unsigned/forged session cookie', async () => {
    const forgedObj = {
      isAuthenticated: true,
      teacherId: CANONICAL_TEACHER_ID,
      teacherName: 'Forged',
      role: 'teacher',
      loginTime: new Date().toISOString(),
    };
    const req = new NextRequest('http://localhost:3000/api/auth/teacher-session', {
      headers: {
        cookie: `${TEACHER_COOKIE_NAME}=${JSON.stringify(forgedObj)}`,
      },
    });
    const res = await sessionGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isAuthenticated).toBe(false);
    expect(data.session).toBeNull();
  });

  it('returns unauthenticated when session cookie is absent', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/teacher-session');
    const res = await sessionGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isAuthenticated).toBe(false);
    expect(data.session).toBeNull();
  });

  it('returns valid session when session cookie is present', async () => {
    const signed = signTeacherSessionCookie({
      isAuthenticated: true,
      teacherId: CANONICAL_TEACHER_ID,
      teacherName: 'Inderjit Kaur',
      role: 'teacher',
      loginTime: new Date().toISOString(),
    });
    const req = new NextRequest('http://localhost:3000/api/auth/teacher-session', {
      headers: {
        cookie: `${TEACHER_COOKIE_NAME}=${signed}`,
      },
    });
    const res = await sessionGET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isAuthenticated).toBe(true);
    expect(data.session.teacherId).toBe(CANONICAL_TEACHER_ID);
  });

  it('clears session cookie on logout', async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
