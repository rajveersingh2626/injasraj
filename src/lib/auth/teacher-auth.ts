/**
 * Teacher Authentication & Role Enforcement Module
 *
 * Enforces secure role resolution:
 * - Unauthenticated visitors always default to 'student' role.
 * - Teacher privileges require valid authentication (passcode or Supabase session).
 * - Manages persistent browser session via localStorage and document cookies.
 */

export const TEACHER_STORAGE_KEY = 'injasraj_teacher_auth_v1';
export const TEACHER_COOKIE_NAME = 'injasraj_teacher_session';
export const DEFAULT_TEACHER_PASSCODE =
  process.env.NEXT_PUBLIC_TEACHER_PASSCODE || 'injasraj123';
export const DEFAULT_TEACHER_ID = 'teacher-injasraj';
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
  return passcode.trim() === DEFAULT_TEACHER_PASSCODE;
}

/**
 * Retrieves the current authenticated teacher session, if present and valid.
 */
export function getTeacherSession(): TeacherSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(TEACHER_STORAGE_KEY);
    if (!raw) return null;

    const parsed: TeacherSession = JSON.parse(raw);
    if (parsed && parsed.isAuthenticated && parsed.role === 'teacher') {
      return parsed;
    }
  } catch {
    // Corrupted storage; reset
    localStorage.removeItem(TEACHER_STORAGE_KEY);
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
      // Set session cookie for SSR/routing visibility
      document.cookie = `${TEACHER_COOKIE_NAME}=1; path=/; max-age=2592000; SameSite=Lax`;
    } catch (err) {
      console.warn('Failed to save teacher session to storage:', err);
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
    } catch (err) {
      console.warn('Failed to clear teacher session:', err);
    }
  }
}

/**
 * Authoritatively resolves user role for classroom routes:
 * 1. If explicit 'student' requested, honors student preview.
 * 2. If authenticated as teacher, grants 'teacher' role.
 * 3. In all other cases (unauthenticated or unknown), strictly enforces 'student' role.
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
