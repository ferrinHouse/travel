import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkHealth } from '@/lib/api/health';

// Liveness/readiness probe target (see k8s/base/deployment.yaml).
export async function GET() {
  const result = await checkHealth({ db: prisma });
  return NextResponse.json(result.body, { status: result.status });
}
