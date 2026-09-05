import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldTransaction } from '../src/reliability/Transaction.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
test('commit rollback', () => { const tx=new WorldTransaction(); const a=EntityFactory.dynamicBox({name:'a',position:{x:1,y:2,z:3}}); tx.record(a,{x:1,y:2,z:3}); a.position=a.position.add({x:100,y:0,z:0}); const m=new Map([[a.id,a]]); tx.finalize(m); tx.rollback(m); assert.deepEqual(a.position.toObject(),{x:1,y:2,z:3}); });
