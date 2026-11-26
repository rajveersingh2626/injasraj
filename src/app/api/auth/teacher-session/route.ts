import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_COOKIE_NAME } from '@/lib/auth/teacher-auth';
import { verifyTeacherSessionCookie } from '@/lib/auth/teacher-session-server';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(TEACHER_COOKIE_NAME);
    const session = verifyTeacherSessionCookie(sessionCookie?.value);
    if (session) {
      return NextResponse.json({ isAuthenticated: true, session });
    }

    return NextResponse.json({ isAuthenticated: false, session: null });
  } catch {
    return NextResponse.json({ isAuthenticated: false, session: null });
  }
}
