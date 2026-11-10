// Guards the deployment settings that keep SQLite-on-NFS safe. Plain text
// checks (no YAML parser dependency); they fail loudly if someone removes them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/test-db.mjs';

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
const deployment = read('k8s', 'base', 'deployment.yaml');

test('single replica with Recreate strategy (never two pods on the SQLite file)', () => {
  assert.match(deployment, /^\s*replicas:\s*1\s*$/m);
  assert.match(deployment, /strategy:\s*\n\s*type:\s*Recreate/);
});

test('startup, readiness and liveness probes hit /api/health on port 3000', () => {
  for (const probe of ['startupProbe', 'readinessProbe', 'livenessProbe']) {
    const block = deployment.slice(deployment.indexOf(`${probe}:`)).split(/\n\s{10}\w+Probe:|\n\s{10}volumeMounts:/)[0];
    assert.ok(deployment.includes(`${probe}:`), `${probe} missing`);
    assert.match(block, /path:\s*\/api\/health/, `${probe} path`);
    assert.match(block, /port:\s*3000/, `${probe} port`);
  }
});

test('container runs in Central time', () => {
  assert.match(deployment, /name:\s*TZ\s*\n\s*value:\s*"America\/Chicago"/);
});

test('database volume is mounted where DATABASE_URL points', () => {
  assert.match(deployment, /value:\s*"file:\/app\/database\/travel\.db"/);
  assert.match(deployment, /mountPath:\s*\/app\/database/);
});

test('Dockerfile ships and runs the entrypoint', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, /COPY .*docker-entrypoint\.sh/);
  assert.match(dockerfile, /ENTRYPOINT \["\/app\/docker-entrypoint\.sh"\]/);
});

test('entrypoint never accepts data loss or swallows push failures', () => {
  const script = read('docker-entrypoint.sh')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  assert.ok(!script.includes('--accept-data-loss'));
  assert.ok(!/db push[^\n]*\|\|/.test(script), 'push failure must not be ignored');
  assert.match(script, /^set -e$/m);
});

// ---- per-user auth (PR 3) ----

const kustomization = read('k8s', 'kustomization.yaml');

test('the shared admin passcode is gone', () => {
  assert.ok(!deployment.includes('ADMIN_PASSCODE'));
});

test('SETUP_TOKEN comes from travel-secrets and is optional (only needed for first run)', () => {
  const block = deployment.slice(deployment.indexOf('name: SETUP_TOKEN'), deployment.indexOf('name: SETUP_TOKEN') + 200);
  assert.match(block, /secretKeyRef:\s*\n\s*name: travel-secrets\s*\n\s*key: SETUP_TOKEN\s*\n\s*optional: true/);
});

test('APP_ORIGIN comes from the travel-config ConfigMap', () => {
  assert.match(deployment, /name: APP_ORIGIN\s*\n\s*valueFrom:\s*\n\s*configMapKeyRef:\s*\n\s*name: travel-config\s*\n\s*key: APP_ORIGIN/);
});

test('APP_ORIGIN is the real https site address (WebAuthn and the CSRF check depend on it)', () => {
  const value = kustomization.match(/-\s*APP_ORIGIN=(\S+)/)?.[1];
  assert.ok(value, 'configMapGenerator literal APP_ORIGIN=… missing');
  const url = new URL(value);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.origin, value, 'no path or trailing slash');
  assert.ok(!/example\.|change-?me|localhost/i.test(url.hostname), `placeholder hostname: ${url.hostname}`);
});

test('the image ships the lockout recovery script', () => {
  assert.match(read('Dockerfile'), /COPY .*scripts\/admin-reset\.mjs/);
});

// --- Deploy workflow: tests and image build run in parallel, but nothing
// tagged `latest` (which the cluster pulls on every restart) exists until
// both have passed.
const ci = read('.github', 'workflows', 'ci.yml');

/** Text of one top-level job in ci.yml (lines indented under `  <name>:`). */
function job(name) {
  const lines = ci.split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  assert.ok(start >= 0, `job ${name} missing`);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line) || /^\S/.test(line)) break;
    body.push(line);
  }
  return body.join('\n');
}

const needs = (name) => {
  const m = job(name).match(/^ {4}needs:\s*(.+)$/m);
  return m ? m[1].replace(/[[\]\s]/g, '').split(',').filter(Boolean).sort() : [];
};

test('image build runs alongside the tests, not after them', () => {
  assert.deepEqual(needs('build-image'), []);
  assert.match(job('test'), /uses: \.\/\.github\/workflows\/test\.yml/);
});

test('the build pushes only an immutable per-commit tag, never latest', () => {
  const build = job('build-image');
  assert.match(build, /travel-site:sha-\$\{\{ github\.sha \}\}/);
  assert.ok(!/travel-site:latest/.test(build), 'build-image must not push :latest');
});

test('latest is promoted only after both tests and build pass', () => {
  assert.deepEqual(needs('promote'), ['build-image', 'test']);
  const promote = job('promote');
  assert.match(promote, /imagetools create/);
  assert.match(promote, /travel-site:latest/);
  assert.match(promote, /travel-site:sha-\$\{\{ github\.sha \}\}/);
});

test('promoting retries, since GHCR can briefly miss a just-pushed manifest', () => {
  const promote = job('promote');
  assert.match(promote, /for attempt in 1 2 3/);
  assert.match(promote, /sleep \$\(\(attempt \* 15\)\)/);
  assert.match(promote, /exit 1/);
});

test('deploy waits for the promoted image', () => {
  assert.deepEqual(needs('deploy'), ['promote']);
  assert.match(deployment, /image: ghcr\.io\/ferrinhouse\/travel-site:latest/);
});

// --- GitHub Actions versions: Node 20 actions are deprecated on runners.
// These are the first majors that run on Node 24.
const MIN_MAJOR = {
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'docker/setup-buildx-action': 4,
  'docker/login-action': 4,
  'docker/build-push-action': 7,
};

test('every workflow uses Node 24 versions of its actions', () => {
  const dir = path.join(ROOT, '.github', 'workflows');
  const uses = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yml'))
    .flatMap((f) => [...read('.github', 'workflows', f).matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@v(\d+)/g)].map((m) => ({ f, action: m[1], major: Number(m[2]) })));
  assert.ok(uses.length > 0);
  for (const { f, action, major } of uses) {
    assert.ok(action in MIN_MAJOR, `${f}: ${action} is new; add its first Node 24 major to MIN_MAJOR`);
    assert.ok(major >= MIN_MAJOR[action], `${f}: ${action}@v${major} runs on Node 20 (need v${MIN_MAJOR[action]}+)`);
  }
});

// --- Start-up headroom. The entrypoint backs up the DB and runs `prisma db
// push` before Next starts; at a 100m CPU cap that took ~2 minutes on the Pi,
// the start-up probe killed the first attempt and the CI rollout timed out.
const cpuMillis = (v) => (v.endsWith('m') ? Number(v.slice(0, -1)) : Number(v) * 1000);

test('the CPU limit leaves room for start-up (backup + db push + Next boot)', () => {
  const limits = deployment.slice(deployment.indexOf('limits:'));
  const cpu = limits.match(/cpu:\s*"?([\d.]+m?)"?/)?.[1];
  assert.ok(cpu, 'cpu limit missing');
  assert.ok(cpuMillis(cpu) >= 500, `cpu limit ${cpu} is too low to start in time`);
});

test('every probe allows a slow health response (no 1s default timeout)', () => {
  for (const probe of ['startupProbe', 'readinessProbe', 'livenessProbe']) {
    const block = deployment.slice(deployment.indexOf(`${probe}:`)).split(/\n\s{10}\w+Probe:|\n\s{10}volumeMounts:/)[0];
    const timeout = Number(block.match(/timeoutSeconds:\s*(\d+)/)?.[1] ?? 1);
    assert.ok(timeout >= 5, `${probe} timeoutSeconds is ${timeout}`);
  }
});

// ---- scrapbook photos (PR 5) ----

const uploadsStorage = read('k8s', 'base', 'uploads-storage.yaml');

test('photos live on their own 20Gi NFS volume that is never recycled', () => {
  assert.match(uploadsStorage, /kind: PersistentVolume\n/);
  assert.match(uploadsStorage, /name: travel-uploads-pv/);
  assert.match(uploadsStorage, /storage: 20Gi/);
  assert.match(uploadsStorage, /persistentVolumeReclaimPolicy: Retain/);
  assert.match(uploadsStorage, /ReadWriteMany/);
  // The claim binds to exactly this volume, never to some other free PV.
  assert.match(uploadsStorage, /kind: PersistentVolumeClaim[\s\S]*name: travel-uploads-pvc[\s\S]*volumeName: travel-uploads-pv/);
  assert.match(kustomization, /- base\/uploads-storage\.yaml/);
});

test('the uploads volume points at its own NFS export', () => {
  const patch = read('k8s', 'patches', 'nfs-server.yaml');
  assert.match(patch, /name: travel-uploads-pv[\s\S]*path: \/export\/travel-uploads/);
  assert.match(patch, /name: travel-site-pv[\s\S]*path: \/export\/travel-db/);
});

test('the pod mounts the uploads volume where UPLOADS_DIR points, with an upload size limit', () => {
  assert.match(deployment, /mountPath: \/app\/uploads/);
  assert.match(deployment, /claimName: travel-uploads-pvc/);
  assert.match(deployment, /name: UPLOADS_DIR\s*\n\s*value: "\/app\/uploads"/);
  assert.match(deployment, /name: MAX_UPLOAD_MB\s*\n\s*value: "\d+"/);
});

test('enough memory for resizing photos with sharp', () => {
  assert.match(deployment, /limits:[\s\S]*memory: "512Mi"/);
});

test('the image has a writable uploads folder and a working sharp', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, /mkdir -p \/app\/database \/app\/uploads/);
  assert.match(dockerfile, /RUN node -e "require\('sharp'\)/);
});

test('the standalone build ships sharp’s native libvips files (the tracer can’t see them)', () => {
  const nextConfig = read('next.config.mjs');
  assert.match(nextConfig, /outputFileTracingIncludes:\s*\{[\s\S]*'\/api\/photos':\s*\[[^\]]*'\.\/node_modules\/@img\/\*\*\/\*'/);
});

// --- Offline app: the service worker must never be cached by the browser or a
// proxy (or updates stall), and every page gets the baseline security headers.
const routeHeaders = async (source) => {
  const { default: config } = await import('../../next.config.mjs');
  const rule = (await config.headers()).find((r) => r.source === source);
  assert.ok(rule, `no headers for ${source}`);
  return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
};

test('the service worker and its helper are served uncached as JavaScript', async () => {
  for (const file of ['/sw.js', '/sw-core.js']) {
    const h = await routeHeaders(file);
    assert.equal(h['Cache-Control'], 'no-cache, no-store, must-revalidate', file);
    assert.equal(h['Content-Type'], 'application/javascript; charset=utf-8', file);
    assert.match(h['Content-Security-Policy'], /script-src 'self'/, file);
  }
});

test('every route sends nosniff, no framing and a strict referrer policy', async () => {
  const h = await routeHeaders('/:path*');
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(h['Permissions-Policy'], /camera=\(\)/);
});
