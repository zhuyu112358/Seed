import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
test('save returns file path', () => {
  const sm = new SnapshotManager();
  const f = sm.save({ worldName: 't', worldTime: 0, tick: 0, entities: [] });
  assert.ok(f);
  assert.ok(typeof f === 'string');
});
test('list returns snapshots', () => {
  const sm = new SnapshotManager();
  sm.save({ worldName: 't', worldTime: 0, tick: 0, entities: [] });
  const list = sm.list();
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
});
test('rollback returns snapshot', () => {
  const sm = new SnapshotManager();
  sm.save({ worldName: 't', worldTime: 1, tick: 5, entities: [] });
  const s = sm.rollback();
  assert.ok(s);
  assert.equal(s.tick, 5);
});
