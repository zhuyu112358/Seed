import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { SnapshotManager, type SnapshotInput } from '../../src/infra/SnapshotManager.js';
function sample(tick: number): SnapshotInput {
  return { version:'1', worldId:'w', tickCount:tick, entities:[{id:'e1',type:'b',name:'b',position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},mass:1,material:'wood',state:{},properties:{},active:true}], events:[], weather:'sunny', clock:{timeOfDay:12,day:1}, stats:{} };
}
test('takeSnapshot checksum', () => {
  const sm = new SnapshotManager({ directory: fs.mkdtempSync(path.join(os.tmpdir(),'s-')), intervalMs:1000, maxSnapshots:5 });
  const s = sm.takeSnapshot(sample(1));
  assert.ok(/^[0-9a-f]{64}$/.test(s.checksum));
});
test('load round-trip', () => {
  const sm = new SnapshotManager({ directory: fs.mkdtempSync(path.join(os.tmpdir(),'s-')), intervalMs:1000, maxSnapshots:5 });
  const s = sm.takeSnapshot(sample(5));
  assert.equal(sm.loadLatest()?.id,s.id);
  assert.equal(sm.loadById(s.id)?.tickCount,5);
  assert.equal(sm.loadById('n'),null);
});
test('list and delete', () => {
  const sm = new SnapshotManager({ directory: fs.mkdtempSync(path.join(os.tmpdir(),'s-')), intervalMs:1000, maxSnapshots:5 });
  sm.takeSnapshot(sample(1)); sm.takeSnapshot(sample(2));
  const l = sm.listSnapshots(); assert.equal(l.length,2);
  assert.equal(sm.deleteSnapshot(l[0].id),true);
});
test('maxSnapshots prune', () => {
  const sm = new SnapshotManager({ directory: fs.mkdtempSync(path.join(os.tmpdir(),'s-')), intervalMs:1000, maxSnapshots:3 });
  for (let i=0;i<5;i++) sm.takeSnapshot(sample(i));
  assert.equal(sm.listSnapshots().length,3);
});
test('recoverOnStartup', () => {
  const sm = new SnapshotManager({ directory: fs.mkdtempSync(path.join(os.tmpdir(),'s-')), intervalMs:1000, maxSnapshots:5 });
  sm.takeSnapshot(sample(1)); sm.takeSnapshot(sample(42));
  assert.equal(sm.recoverOnStartup()?.tickCount,42);
});
