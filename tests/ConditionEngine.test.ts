import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConditionEngine } from '../src/event/ConditionEngine.js';
test('worldTime', () => { const ce=new ConditionEngine(); const ctx={worldTime:10,entities:new Map()}; assert.equal(ce.evaluate({kind:'worldTime',op:'gt',value:5},ctx),true); assert.equal(ce.evaluate({kind:'worldTime',op:'lt',value:5},ctx),false); });
