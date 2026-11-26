import { NextResponse } from 'next/server';
import { TEACHER_COOKIE_NAME } from '@/lib/auth/teacher-auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(TEACHER_COOKIE_NAME);
  return res;
}
