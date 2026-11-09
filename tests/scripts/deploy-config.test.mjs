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
