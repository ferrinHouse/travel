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
