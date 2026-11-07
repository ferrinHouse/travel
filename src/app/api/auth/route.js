import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isAdminRequest } from '@/lib/auth/legacy';

export async function POST(request) {
  try {
    const { passcode } = await request.json();
    const adminPasscode = process.env.ADMIN_PASSCODE || 'admin';

    if (passcode === adminPasscode) {
      const cookieStore = await cookies();
      cookieStore.set(ADMIN_COOKIE, 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/'
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Invalid passcode' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error processing request' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ authenticated: await isAdminRequest() });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return NextResponse.json({ success: true });
}
