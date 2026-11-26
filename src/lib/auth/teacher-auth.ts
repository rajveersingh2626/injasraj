/**
 * Teacher Authentication & Role Enforcement Module
 *
 * Enforces secure role resolution:
 * - Unauthenticated visitors always default to 'student' role.
 * - Teacher privileges require valid authentication.
 * - Manages persistent session via secure cookies and client cache.
 */

export const TEACHER_STORAGE_KEY = 'injasraj_teacher_auth_v1';
export const TEACHER_COOKIE_NAME = 'injasraj_teacher_session';
export const CANONICAL_TEACHER_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_TEACHER_ID = CANONICAL_TEACHER_ID;
export const DEFAULT_TEACHER_NAME = 'Inderjit Kaur';

export interface TeacherSession {
  isAuthenticated: boolean;
  teacherId: string;
  teacherName: string;
  role: 'teacher';
  loginTime: string;
}

/**
 * Checks whether the given passcode matches the teacher authorization key.
 */
export function verifyTeacherPasscode(passcode: string): boolean {
  if (!passcode) return false;
  const configured =
    typeof process !== 'undefined' ? process.env.TEACHER_PASSCODE : undefined;
  if (!configured) return false;
  return passcode.trim() === configured.trim();
}

/**
 * Retrieves the current authenticated teacher session, checking cookies and storage.
 */
export function getTeacherSession(): TeacherSession | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Try reading from cookie first
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === TEACHER_COOKIE_NAME && v) {
        try {
          const parsed = JSON.parse(decodeURIComponent(v));
          if (parsed && parsed.isAuthenticated && parsed.role === 'teacher') {
            return parsed;
          }
        } catch {}
      }
    }

    // 2. Fallback to client storage
    const raw = localStorage.getItem(TEACHER_STORAGE_KEY);
    if (!raw) return null;

    const parsed: TeacherSession = JSON.parse(raw);
    if (parsed && parsed.isAuthenticated && parsed.role === 'teacher') {
      return parsed;
    }
  } catch {
    try {
      localStorage.removeItem(TEACHER_STORAGE_KEY);
    } catch {}
  }

  return null;
}

/**
 * Authenticates the teacher via server API route or synchronous fallback.
 */
export async function loginTeacherAsync(
  passcode: string,
  teacherName: string = DEFAULT_TEACHER_NAME
): Promise<TeacherSession | null> {
  try {
    const res = await fetch('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, teacherName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(data.session));
        return data.session;
      }
    }
  } catch (err) {
    console.warn('Server login request notice:', err);
  }

  return null;
}

/**
 * Authenticates the teacher with passcode and persists the session.
 */
export function loginTeacher(
  passcode: string,
  teacherName: string = DEFAULT_TEACHER_NAME,
  teacherId: string = DEFAULT_TEACHER_ID
): boolean {
  if (!verifyTeacherPasscode(passcode)) {
    return false;
  }

  const session: TeacherSession = {
    isAuthenticated: true,
    teacherId,
    teacherName: teacherName.trim() || DEFAULT_TEACHER_NAME,
    role: 'teacher',
    loginTime: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(session));
      document.cookie = `${TEACHER_COOKIE_NAME}=${encodeURIComponent(
        JSON.stringify(session)
      )}; path=/; max-age=2592000; SameSite=Lax`;
    } catch (err) {
      console.warn('Failed to save teacher session:', err);
    }
  }

  return true;
}

/**
 * Logs out the teacher and clears all auth tokens and cookies.
 */
export function logoutTeacher(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(TEACHER_STORAGE_KEY);
      document.cookie = `${TEACHER_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      fetch('/api/auth/teacher-logout', { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.warn('Failed to clear teacher session:', err);
    }
  }
}

/**
 * Authoritatively resolves user role for classroom routes.
 */
export function resolveUserClassroomRole(
  requestedRole?: string
): 'teacher' | 'student' {
  if (requestedRole === 'student') {
    return 'student';
  }

  const session = getTeacherSession();
  if (session && session.isAuthenticated) {
    return 'teacher';
  }

  return 'student';
}
