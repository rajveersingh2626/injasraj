import { NextRequest, NextResponse } from 'next/server';
import { TEACHER_COOKIE_NAME } from '@/lib/auth/teacher-auth';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(TEACHER_COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ isAuthenticated: false, session: null });
    }

    const session = JSON.parse(sessionCookie.value);
    if (session && session.isAuthenticated && session.role === 'teacher') {
      return NextResponse.json({ isAuthenticated: true, session });
    }

    return NextResponse.json({ isAuthenticated: false, session: null });
  } catch {
    return NextResponse.json({ isAuthenticated: false, session: null });
  }
}
