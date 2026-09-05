import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
test('save list rollback', () => { const sm = new SnapshotManager(); sm.save({worldName:'t',worldTime:1,tick:5,entities:[]}); assert.ok(sm.list().length>=1); const s = sm.rollback(); assert.ok(s); assert.equal(s.tick,5); });
