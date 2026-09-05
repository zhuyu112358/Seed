import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConditionEngine, type Predicate } from '../src/event/ConditionEngine.js';
import { Entity } from '../src/entity/Entity.js';
test('worldTime', () => { const ce=new ConditionEngine(); const ctx={worldTime:10,entities:new Map()}; assert.equal(ce.evaluate({kind:'worldTime',op:'gt',value:5},ctx),true); assert.equal(ce.evaluate({kind:'worldTime',op:'lt',value:5},ctx),false); });
test('composite', () => { const ce=new ConditionEngine(); const ctx={worldTime:10,entities:new Map()}; const t:Predicate={kind:'worldTime',op:'gt',value:0}; const f:Predicate={kind:'worldTime',op:'lt',value:0}; assert.equal(ce.evaluate({kind:'and',left:t,right:t},ctx),true); assert.equal(ce.evaluate({kind:'not',inner:f},ctx),true); });
