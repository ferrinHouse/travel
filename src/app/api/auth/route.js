import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { passcode } = await request.json();
    const adminPasscode = process.env.ADMIN_PASSCODE || 'admin';

    if (passcode === adminPasscode) {
      const cookieStore = await cookies();
      cookieStore.set('admin_authenticated', 'true', {
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
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('admin_authenticated')?.value === 'true';
  return NextResponse.json({ authenticated: isAuthenticated });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_authenticated');
  return NextResponse.json({ success: true });
}
