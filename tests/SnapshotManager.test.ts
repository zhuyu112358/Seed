import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
import { Entity } from '../src/entity/Entity.js';

let dir: string;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-snap-'));
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('save writes a snapshot file and load reads it back', () => {
  const mgr = new SnapshotManager({ dir });
  const e = new Entity({ id: 'e1', name: 'box', type: 'static' });
  const file = mgr.save({ worldName: 'w', worldTime: 1.5, tick: 3, entities: [e] });
  assert.ok(fs.existsSync(file));
  const snap = mgr.load(file);
  assert.equal(snap.tick, 3);
  assert.equal(snap.worldTime, 1.5);
  assert.equal(snap.entities.length, 1);
});

test('list returns saved snapshots and rollback returns the latest', () => {
  const mgr = new SnapshotManager({ dir });
  mgr.save({ worldName: 'w', worldTime: 1, tick: 1, entities: [] });
  const files = mgr.list();
  assert.ok(files.length >= 1);
  const rb = mgr.rollback();
  assert.ok(rb);
  assert.equal(rb!.schema, 'seed/world-snapshot@1');
});

test('prune keeps at most `keep` snapshots', () => {
  const keepDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-snap-prune-'));
  try {
    const mgr = new SnapshotManager({ dir: keepDir, keep: 2 });
    for (let i = 0; i < 5; i++) {
      mgr.save({ worldName: 'prune', worldTime: i, tick: i, entities: [] });
    }
    assert.ok(mgr.list().length <= 2);
  } finally {
    fs.rmSync(keepDir, { recursive: true, force: true });
  }
});

test('rollback on an empty directory returns null', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-snap-empty-'));
  try {
    const mgr = new SnapshotManager({ dir: empty });
    assert.equal(mgr.rollback(), null);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
