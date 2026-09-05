import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';

test('SnapshotManager saves and restores', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-snap-'));
  const sm = new SnapshotManager({ dir, keep: 5 });
  const e = EntityFactory.dynamicBox({ name: 'b', position: { x: 1, y: 2, z: 3 } });
  const file = sm.save({ worldName: 't', worldTime: 1.5, tick: 10, entities: [e] });
  assert.ok(fs.existsSync(file));
  const snap = sm.load(path.basename(file));
  assert.equal(snap.worldTime, 1.5);
  assert.equal(snap.tick, 10);
  assert.equal((snap.entities[0] as { name: string }).name, 'b');
});

test('SnapshotManager prunes old snapshots', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-snap-'));
  const sm = new SnapshotManager({ dir, keep: 2 });
  for (let i = 0; i < 5; i++) sm.save({ worldName: 't', worldTime: i, tick: i, entities: [] });
  assert.equal(sm.list().length, 2);
});
