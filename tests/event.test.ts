import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import { WorldTickEvent } from '../src/event/Event.js';
test('on emit', () => { const es = new EventSystem(); let c=0; es.on('t',()=>c++); es.emit({type:'t',timestamp:0,payload:{}}); assert.equal(c,1); });
test('once', () => { const es = new EventSystem(); let c=0; es.once('t',()=>c++); es.emit({type:'t',timestamp:0,payload:{}}); es.emit({type:'t',timestamp:0,payload:{}}); assert.equal(c,1); });
test('off', () => { const es = new EventSystem(); let c=0; const fn=()=>c++; es.on('t',fn); es.off('t',fn); es.emit({type:'t',timestamp:0,payload:{}}); assert.equal(c,0); });
