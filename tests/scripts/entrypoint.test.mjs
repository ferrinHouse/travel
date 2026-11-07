// Runs docker-entrypoint.sh with stubbed `npx` and `node` so we can check the
// backup rotation and the fail-loudly schema push without Docker.
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../support/test-db.mjs';

const SCRIPT = path.join(ROOT, 'docker-entrypoint.sh');
const hasSh = spawnSync('sh', ['-c', 'exit 0']).status === 0;

let work;
let dbDir;
let callLog;

function writeStub(name, exitVar) {
  const file = path.join(work, 'bin', name);
  fs.writeFileSync(
    file,
    `#!/bin/sh\necho "${name} $*" >> "$CALL_LOG"\nexit "\${${exitVar}:-0}"\n`,
    { mode: 0o755 }
  );
}

function run(env = {}) {
  const binDir = path.join(work, 'bin');
  // Script must be LF-only for sh; normalise in case git checked it out with CRLF.
  const script = path.join(work, 'entrypoint.sh');
  fs.writeFileSync(script, fs.readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n'));
  return spawnSync('sh', [script], {
    cwd: work,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      DATABASE_URL: `file:${path.join(dbDir, 'travel.db').replace(/\\/g, '/')}`,
      CALL_LOG: callLog,
      ...env,
    },
  });
}

const calls = () => (fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8').trim().split('\n') : []);
const backups = () => {
  const dir = path.join(dbDir, 'backups');
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
};

describe('docker-entrypoint.sh', { skip: !hasSh && 'needs a POSIX sh' }, () => {
  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-entry-'));
    dbDir = path.join(work, 'database');
    callLog = path.join(work, 'calls.log');
    fs.mkdirSync(path.join(work, 'bin'));
    writeStub('npx', 'NPX_EXIT');
    writeStub('node', 'NODE_EXIT');
  });
  afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

  test('fresh install: creates the db dir, pushes schema without data loss, starts the server', () => {
    const res = run();
    assert.equal(res.status, 0, res.stderr);
    assert.ok(fs.existsSync(dbDir), 'database directory created');
    assert.deepEqual(calls(), ['npx prisma db push', 'node server.js']);
    assert.ok(!calls().join(' ').includes('accept-data-loss'));
    assert.deepEqual(backups(), [], 'nothing to back up yet');
  });

  test('existing database is copied to backups/ before the push', () => {
    fs.mkdirSync(dbDir);
    fs.writeFileSync(path.join(dbDir, 'travel.db'), 'precious data');
    const res = run();
    assert.equal(res.status, 0, res.stderr);
    const [backup] = backups();
    assert.match(backup, /^travel\.db\.bak-\d{14}$/);
    assert.equal(fs.readFileSync(path.join(dbDir, 'backups', backup), 'utf8'), 'precious data');
  });

  test('keeps only the 5 newest backups', () => {
    const backupDir = path.join(dbDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, 'travel.db'), 'current');
    const old = [];
    for (let i = 0; i < 7; i += 1) {
      const name = `travel.db.bak-2020010100000${i}`;
      const file = path.join(backupDir, name);
      fs.writeFileSync(file, `old ${i}`);
      const t = new Date(Date.UTC(2020, 0, 1, 0, 0, i));
      fs.utimesSync(file, t, t);
      old.push(name);
    }
    const res = run();
    assert.equal(res.status, 0, res.stderr);
    const kept = backups();
    assert.equal(kept.length, 5);
    // The new backup plus the four most recent old ones survive.
    assert.deepEqual(kept.filter((n) => old.includes(n)), old.slice(3));
  });

  test('a failed schema push stops startup and never launches the server', () => {
    const res = run({ NPX_EXIT: '1' });
    assert.notEqual(res.status, 0);
    assert.deepEqual(calls(), ['npx prisma db push']);
  });
});
