// Unit tests for src/reliability/SnapshotManager.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
import { Entity } from '../src/entity/Entity.js';

let dir: string;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function makeEntity(id: string): Entity {
  return new Entity({ id, name: id, type: 'dynamic' });
}

describe('SnapshotManager', () => {
  before(() => {
    dir = path.join(os.tmpdir(), `seed-snap-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
  });
  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('constructor creates the snapshot directory', () => {
    const sub = path.join(dir, 'fresh');
    new SnapshotManager({ dir: sub });
    assert.equal(fs.existsSync(sub), true);
  });

  it('save writes a JSON file and load reads it back', () => {
    const mgr = new SnapshotManager({ dir });
    const file = mgr.save({ worldName: 'world', worldTime: 1.5, tick: 3, entities: [makeEntity('e1')] });
    assert.equal(fs.existsSync(file), true);
    const snap = mgr.load(file);
    assert.equal(snap.worldTime, 1.5);
    assert.equal(snap.tick, 3);
    assert.equal(snap.entities.length, 1);
  });

  it('list returns snapshots newest first', async () => {
    const mgr = new SnapshotManager({ dir });
    mgr.save({ worldName: 'seq', worldTime: 1, tick: 1, entities: [] });
    await sleep(5);
    mgr.save({ worldName: 'seq', worldTime: 2, tick: 2, entities: [] });
    await sleep(5);
    mgr.save({ worldName: 'seq', worldTime: 3, tick: 3, entities: [] });
    const files = mgr.list().filter((f) => f.startsWith('seq-'));
    assert.ok(files.length >= 3);
    assert.equal(mgr.load(files[0]).tick, 3);
  });

  it('rollback loads the most recent snapshot', async () => {
    const mgr = new SnapshotManager({ dir });
    mgr.save({ worldName: 'rb', worldTime: 10, tick: 10, entities: [] });
    await sleep(5);
    mgr.save({ worldName: 'rb', worldTime: 20, tick: 20, entities: [] });
    assert.equal(mgr.rollback()!.tick, 20);
  });

  it('rollback returns null when no snapshots exist', () => {
    const empty = path.join(dir, 'empty-rb');
    fs.mkdirSync(empty, { recursive: true });
    assert.equal(new SnapshotManager({ dir: empty }).rollback(), null);
  });

  it('keep limits retained snapshots', async () => {
    const keepDir = path.join(dir, 'keep');
    const mgr = new SnapshotManager({ dir: keepDir, keep: 2 });
    for (let i = 0; i < 4; i++) {
      mgr.save({ worldName: 'k', worldTime: i, tick: i, entities: [] });
      await sleep(5);
    }
    assert.equal(mgr.list().filter((f) => f.startsWith('k-')).length, 2);
  });
});
