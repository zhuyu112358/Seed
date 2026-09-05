import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExceptionHandler } from '../../src/infra/ExceptionHandler.js';
test('TypeError recoverable', () => {
  const eh = new ExceptionHandler();
  assert.equal(eh.handle(new TypeError('x'),'p').some(a=>a.type==='alert'),true);
});
test('entity isolation', () => {
  const eh = new ExceptionHandler(); eh.handle(new RangeError('x'),'e',{},'ent-1');
  assert.deepEqual(eh.getIsolatedEntities(),['ent-1']);
  assert.equal(eh.clearIsolatedEntity('ent-1'),true);
});
test('fatal restart', () => {
  let f=false; const eh = new ExceptionHandler({onFatal:()=>{f=true;}});
  assert.equal(eh.handle(new Error('heap out of memory'),'w').some(a=>a.type==='restart_world'),true);
  assert.equal(f,true);
});
test('degraded flag', () => {
  const eh = new ExceptionHandler(); const e = new Error('s') as Error & {recoverable:boolean}; e.recoverable=true;
  assert.equal(eh.handle(e,'m').some(a=>a.type==='degrade'),true);
});
test('history stats', () => {
  const eh = new ExceptionHandler(); eh.handle(new TypeError('a'),'A'); eh.handle(new Error('b'),'B');
  assert.equal(eh.getErrorHistory().length,2); assert.equal(eh.getStats().totalErrors,2);
});
test('custom strategy', () => {
  const eh = new ExceptionHandler(); eh.registerRecoveryStrategy('c',()=>[{type:'rollback',reason:'r'}]);
  assert.equal(eh.handle(new Error('y'),'c')[0].type,'rollback');
});
