import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTeacherSession,
  loginTeacher,
  logoutTeacher,
  verifyTeacherPasscode,
  resolveUserClassroomRole,
  TEACHER_STORAGE_KEY,
} from '../../src/lib/auth/teacher-auth';

describe('Teacher Authentication & Role Enforcement', () => {
  beforeEach(() => {
    process.env.TEACHER_PASSCODE = 'injasraj123';
    logoutTeacher();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    logoutTeacher();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('defaults to null session when unauthenticated', () => {
    expect(getTeacherSession()).toBeNull();
  });

  it('verifies teacher passcode correctly', () => {
    expect(verifyTeacherPasscode('injasraj123')).toBe(true);
    expect(verifyTeacherPasscode('wrong-pass')).toBe(false);
  });

  it('logs in teacher with correct passcode and stores session', () => {
    const success = loginTeacher('injasraj123', 'Injasraj');
    expect(success).toBe(true);

    const session = getTeacherSession();
    expect(session).not.toBeNull();
    expect(session?.isAuthenticated).toBe(true);
    expect(session?.teacherName).toBe('Injasraj');
    expect(session?.role).toBe('teacher');
  });

  it('fails login with invalid passcode', () => {
    const success = loginTeacher('invalid-passcode');
    expect(success).toBe(false);
    expect(getTeacherSession()).toBeNull();
  });

  it('logs out teacher cleanly', () => {
    loginTeacher('injasraj123', 'Injasraj');
    expect(getTeacherSession()).not.toBeNull();

    logoutTeacher();
    expect(getTeacherSession()).toBeNull();
  });

  it('enforces student-by-default role for unauthenticated users', () => {
    // No role param, not logged in -> student
    const role1 = resolveUserClassroomRole(undefined);
    expect(role1).toBe('student');

    // Requested 'teacher' in query params, BUT not logged in -> strictly 'student'
    const role2 = resolveUserClassroomRole('teacher');
    expect(role2).toBe('student');

    // Explicit 'student' in query params -> 'student'
    const role3 = resolveUserClassroomRole('student');
    expect(role3).toBe('student');
  });

  it('grants teacher role only when authenticated as teacher', () => {
    loginTeacher('injasraj123', 'Injasraj');

    // Authenticated teacher requesting teacher role or default -> 'teacher'
    expect(resolveUserClassroomRole('teacher')).toBe('teacher');
    expect(resolveUserClassroomRole(undefined)).toBe('teacher');

    // Authenticated teacher explicitly asking for student preview
    expect(resolveUserClassroomRole('student')).toBe('student');
  });
});
