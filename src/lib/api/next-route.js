import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isAdminRequest } from '@/lib/auth/legacy';
import { runHandler } from './run';

/**
 * Wraps a framework-free handler from src/lib/api as a Next route handler:
 * parses the JSON body (invalid JSON becomes `null`, which handlers reject
 * with 400), reads the admin cookie, and serialises the result.
 */
export function route(handler) {
  return async function routeHandler(request) {
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const result = await runHandler(handler, { db: prisma, isAdmin: await isAdminRequest(), body });
    return NextResponse.json(result.body, { status: result.status });
  };
}
