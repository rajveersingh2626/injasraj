import { NextRequest, NextResponse } from 'next/server';
import {
  CANONICAL_TEACHER_ID,
  DEFAULT_TEACHER_NAME,
  TEACHER_COOKIE_NAME,
} from '@/lib/auth/teacher-auth';
import { signTeacherSessionCookie } from '@/lib/auth/teacher-session-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { passcode, teacherName } = body;

    const validPasscode =
      process.env.TEACHER_PASSCODE ||
      (process.env.NODE_ENV !== 'production' ? 'injasraj123' : '');

    if (!validPasscode) {
      return NextResponse.json(
        { error: 'Teacher passcode is not configured on server' },
        { status: 500 }
      );
    }

    if (!passcode || typeof passcode !== 'string' || passcode.trim() !== validPasscode.trim()) {
      return NextResponse.json({ error: 'Invalid teacher passcode' }, { status: 401 });
    }

    const resolvedName = (typeof teacherName === 'string' && teacherName.trim()) || DEFAULT_TEACHER_NAME;
    const session = {
      isAuthenticated: true,
      teacherId: CANONICAL_TEACHER_ID,
      teacherName: resolvedName,
      role: 'teacher' as const,
      loginTime: new Date().toISOString(),
    };

    const res = NextResponse.json({ success: true, session });
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookies.set(TEACHER_COOKIE_NAME, signTeacherSessionCookie(session), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Authentication error' },
      { status: 500 }
    );
  }
}
