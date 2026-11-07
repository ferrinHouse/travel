import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Liveness/readiness probe target: confirms the app can reach SQLite.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
