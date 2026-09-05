import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../src/reliability/Logger.js';
import { SnapshotManager } from '../src/reliability/SnapshotManager.js';
import { Transaction } from '../src/reliability/Transaction.js';

describe('Logger', () => {
  it('should create logger for module', () => {
    const log = Logger.for('test-module');
    assert.ok(log);
  });

  it('should log at all levels without error', () => {
    const log = Logger.for('test');
    assert.doesNotThrow(() => log.debug('debug message'));
    assert.doesNotThrow(() => log.info('info message'));
    assert.doesNotThrow(() => log.warn('warn message'));
    assert.doesNotThrow(() => log.error('error message'));
    assert.doesNotThrow(() => log.fatal('fatal message'));
  });

  it('should log with metadata', () => {
    const log = Logger.for('test');
    assert.doesNotThrow(() => log.info({ entityId: 'ent_1', tick: 100 }, 'entity updated'));
  });

  it('should create child logger', () => {
    const log = Logger.for('parent');
    const child = log.child('child');
    assert.ok(child);
  });
});

describe('SnapshotManager', () => {
  it('should create snapshot manager', () => {
    const sm = new SnapshotManager({ directory: 'test-snapshots', maxSnapshots: 5 });
    assert.ok(sm);
  });

  it('should create and retrieve snapshot', () => {
    const sm = new SnapshotManager({ directory: 'test-snapshots', maxSnapshots: 5 });
    const worldState = { tick: 100, entities: [{ id: 'e1' }] };
    const snapshot = sm.createSnapshot(worldState);
    assert.ok(snapshot.id);
    assert.equal(snapshot.tick, 100);
    assert.equal(snapshot.entities.length, 1);
  });

  it('should list snapshots', () => {
    const sm = new SnapshotManager({ directory: 'test-snapshots', maxSnapshots: 5 });
    sm.createSnapshot({ tick: 1, entities: [] });
    sm.createSnapshot({ tick: 2, entities: [] });
    const list = sm.listSnapshots();
    assert.ok(list.length >= 2);
  });

  it('should restore from snapshot', () => {
    const sm = new SnapshotManager({ directory: 'test-snapshots', maxSnapshots: 5 });
    const state = { tick: 42, entities: [{ id: 'restore_test' }] };
    const snap = sm.createSnapshot(state);
    const restored = sm.restore(snap.id);
    assert.equal(restored.tick, 42);
    assert.equal(restored.entities[0].id, 'restore_test');
  });

  it('should respect max snapshots', () => {
    const sm = new SnapshotManager({ directory: 'test-snapshots', maxSnapshots: 3 });
    for (let i = 0; i < 5; i++) {
      sm.createSnapshot({ tick: i, entities: [] });
    }
    const list = sm.listSnapshots();
    assert.ok(list.length <= 3);
  });
});

describe('Transaction', () => {
  it('should create transaction', () => {
    const tx = new Transaction();
    assert.ok(tx);
  });

  it('should begin and commit transaction', () => {
    const tx = new Transaction();
    tx.begin();
    tx.addOperation({ type: 'update', entityId: 'e1', before: { x: 0 }, after: { x: 1 } });
    tx.commit();
    assert.equal(tx.status, 'committed');
  });

  it('should rollback transaction', () => {
    const tx = new Transaction();
    tx.begin();
    tx.addOperation({ type: 'update', entityId: 'e1', before: { x: 0 }, after: { x: 1 } });
    tx.rollback();
    assert.equal(tx.status, 'rolled_back');
  });

  it('should track operations', () => {
    const tx = new Transaction();
    tx.begin();
    tx.addOperation({ type: 'create', entityId: 'e1' });
    tx.addOperation({ type: 'update', entityId: 'e2' });
    assert.equal(tx.operations.length, 2);
  });

  it('should not allow commit without begin', () => {
    const tx = new Transaction();
    assert.throws(() => tx.commit());
  });
});
