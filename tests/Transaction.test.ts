import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldTransaction } from '../src/reliability/Transaction.js';
import { GameObject } from '../src/entity/Entity.js';
import { Vector3 } from '../src/entity/Vector3.js';

function makeEntity(): GameObject {
  return new GameObject({ id: 'body', name: 'body', position: { x: 0, y: 0, z: 0 } });
}

test('record/finalize track mutation count', () => {
  const tx = new WorldTransaction();
  const e = makeEntity();
  const map = new Map([[e.id, e]]);
  tx.record(e, { x: 0, y: 0, z: 0 });
  e.position = new Vector3(5, 0, 0);
  tx.finalize(map);
  assert.equal(tx.size(), 1);
});

test('commit marks the transaction committed', () => {
  const tx = new WorldTransaction();
  const e = makeEntity();
  tx.record(e, { x: 0, y: 0, z: 0 });
  assert.equal(tx.isCommitted(), false);
  tx.commit();
  assert.equal(tx.isCommitted(), true);
});

test('rollback restores the recorded before-positions', () => {
  const tx = new WorldTransaction();
  const e = makeEntity();
  const map = new Map([[e.id, e]]);

  tx.record(e, { x: 0, y: 0, z: 0 });
  e.position = new Vector3(9, 9, 9);
  tx.finalize(map);

  const reverted = tx.rollback(map);
  assert.equal(reverted, 1);
  assert.equal(e.position.x, 0);
  assert.equal(e.position.y, 0);
  assert.equal(tx.isCommitted(), false);
});
