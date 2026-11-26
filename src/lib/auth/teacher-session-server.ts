import crypto from 'crypto';
import type { TeacherSession } from './teacher-auth';

function getSessionSecret(): string {
  return (
    process.env.TEACHER_SESSION_SECRET ||
    process.env.LIVEKIT_API_SECRET ||
    process.env.TEACHER_PASSCODE ||
    'injasraj-dev-session-secret'
  );
}

/**
 * Signs a TeacherSession payload into an HMAC-SHA256 authenticated token
 * (`<base64url(json)>.<hex_hmac>`).
 */
export function signTeacherSessionCookie(session: TeacherSession): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Verifies a signed teacher session cookie and returns the parsed TeacherSession,
 * or null if missing, malformed, or tampered with.
 */
export function verifyTeacherSessionCookie(cookieValue: string | undefined | null): TeacherSession | null {
  if (!cookieValue || typeof cookieValue !== 'string') {
    return null;
  }

  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx <= 0) {
    return null;
  }

  const payload = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);
  if (!payload || !sig) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('hex');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed && parsed.isAuthenticated === true && parsed.role === 'teacher') {
      return parsed as TeacherSession;
    }
  } catch {
    return null;
  }

  return null;
}
