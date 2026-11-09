import fs from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SESSION } from '@/lib/auth/session-policy';
import { originAllowed } from '@/lib/auth/origin';
import { userFromSessionToken } from './auth';
import { appConfig, requestInfo, readQuery, readLimited } from './request-context';
import { runHandler, fail } from './run';

/**
 * Wraps a framework-free handler from src/lib/api as a Next route handler:
 * rejects cross-site writes, resolves the signed-in user from the session
 * cookie, parses the JSON body (or the query string for GET; invalid JSON
 * becomes `null`, which handlers reject with 400), and serialises the result,
 * including any cookies the handler asks for.
 *
 * Options:
 * - `upload: true` — the body is a raw file: handlers get the query string as
 *   `body` and `file: { bytes, truncated }` (reading stops past MAX_UPLOAD_MB).
 * - `cache` — Cache-Control for file results (`{ status, file: { path, type } }`),
 *   which are streamed from disk instead of sent as JSON.
 * Dynamic route segments (`[id]`, …) are merged into `body`.
 */
export function route(handler, { upload = false, cache = 'no-store' } = {}) {
  return async function routeHandler(request, context) {
    const info = requestInfo(request);
    const config = appConfig(process.env, info);

    if (!originAllowed({ method: info.method, origin: info.origin, appOrigin: config.origin, host: info.host })) {
      return send(fail(403, 'Cross-site request blocked.'));
    }

    let body = null;
    let file;
    if (info.method === 'GET' || info.method === 'HEAD' || upload) {
      body = readQuery(request.url);
    } else {
      try {
        body = await request.json();
      } catch {
        body = null;
      }
    }
    const params = context?.params ? await context.params : null;
    if (params) body = { ...body, ...params };
    if (upload) {
      const declared = Number(request.headers.get('content-length'));
      file =
        declared > config.maxUploadBytes
          ? { bytes: null, truncated: true }
          : await readLimited(request.body, config.maxUploadBytes);
    }

    const sessionToken = request.cookies.get(SESSION.cookieName)?.value ?? null;
    const user = sessionToken ? await userFromSessionToken(prisma, sessionToken) : null;

    const result = await runHandler(handler, { db: prisma, user, body, file, sessionToken, request: info, config });
    const response = result.file ? sendFile(result.file, { cache, download: body?.download === '1' }) : send(result);
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

function sendFile(file, { cache, download }) {
  const { size } = fs.statSync(file.path);
  const headers = {
    'Content-Type': file.type,
    'Content-Length': String(size),
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  };
  if (download) headers['Content-Disposition'] = `attachment; filename="photo${file.path.endsWith('.jpg') ? '.jpg' : '.webp'}"`;
  return new NextResponse(Readable.toWeb(fs.createReadStream(file.path)), { status: 200, headers });
}
