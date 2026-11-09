import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SESSION } from '@/lib/auth/session-policy';
import { originAllowed } from '@/lib/auth/origin';
import { userFromSessionToken } from './auth';
import { appConfig, requestInfo, readQuery } from './request-context';
import { runHandler, fail } from './run';

/**
 * Wraps a framework-free handler from src/lib/api as a Next route handler:
 * rejects cross-site writes, resolves the signed-in user from the session
 * cookie, parses the JSON body (or the query string for GET; invalid JSON
 * becomes `null`, which handlers reject with 400), and serialises the result,
 * including any cookies the handler asks for.
 */
export function route(handler) {
  return async function routeHandler(request) {
    const info = requestInfo(request);
    const config = appConfig(process.env, info);

    if (!originAllowed({ method: info.method, origin: info.origin, appOrigin: config.origin, host: info.host })) {
      return send(fail(403, 'Cross-site request blocked.'));
    }

    let body = null;
    if (info.method === 'GET' || info.method === 'HEAD') {
      body = readQuery(request.url);
    } else {
      try {
        body = await request.json();
      } catch {
        body = null;
      }
    }

    const sessionToken = request.cookies.get(SESSION.cookieName)?.value ?? null;
    const user = sessionToken ? await userFromSessionToken(prisma, sessionToken) : null;

    const result = await runHandler(handler, { db: prisma, user, body, sessionToken, request: info, config });
    const response = send(result);
    // The cookie points at a dead session: clear it so the proxy stops letting it through.
    if (sessionToken && !user && !result.cookies?.some((c) => c.name === SESSION.cookieName)) {
      response.cookies.set(SESSION.cookieName, '', { path: '/', maxAge: 0 });
    }
    return response;
  };
}

function send(result) {
  const response = NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  for (const { name, value, options } of result.cookies ?? []) response.cookies.set(name, value, options);
  return response;
}
