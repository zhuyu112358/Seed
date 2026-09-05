import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
test('save and list', () => { const sm = new SnapshotManager(); const f = sm.save({worldName:'t',worldTime:0,tick:0,entities:[]}); assert.ok(f); assert.ok(sm.list().length>=1); });
test('rollback loads latest', () => { const sm = new SnapshotManager(); sm.save({worldName:'t',worldTime:1,tick:1,entities:[]}); const s = sm.rollback(); assert.ok(s); assert.equal(s.tick,1); });
