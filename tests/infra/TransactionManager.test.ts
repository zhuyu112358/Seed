import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionManager } from '../../src/infra/TransactionManager.js';
test('commit/rollback', () => {
  const tm = new TransactionManager();
  const t1 = tm.beginTransaction(); assert.equal(t1.status,'pending');
  assert.equal(tm.commitTransaction(t1.id),true);
  assert.equal(tm.getTransaction(t1.id)?.status,'committed');
  const t2 = tm.beginTransaction(); assert.equal(tm.rollbackTransaction(t2.id),true);
  assert.equal(tm.getTransaction(t2.id)?.status,'rolled_back'); tm.destroy();
});
test('undo log', () => {
  const tm = new TransactionManager(); const tx = tm.beginTransaction();
  tm.addOperation(tx.id,{type:'update',entityId:'e',data:{}},{x:0});
  assert.equal(tm.getTransaction(tx.id)?.undoLog.length,1); tm.destroy();
});
test('checkpoint rollback', () => {
  const tm = new TransactionManager(); const a = tm.beginTransaction(); const cp = tm.createCheckpoint(); const b = tm.beginTransaction();
  tm.rollbackToCheckpoint(cp);
  assert.equal(tm.getTransaction(b.id)?.status,'rolled_back');
  assert.equal(tm.getTransaction(a.id)?.status,'pending'); tm.destroy();
});
test('timeout auto-rollback', async () => {
  const tm = new TransactionManager({ transactionTimeoutMs:80 }); const tx = tm.beginTransaction();
  await new Promise((r)=>setTimeout(r,1300));
  assert.equal(tm.getTransaction(tx.id)?.status,'rolled_back'); tm.destroy();
});
