import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';
test('valid input', () => { const v = new InputValidator(); const r = v.validate({name:{type:'string',required:true}},{name:'hello'}); assert.equal(r.ok,true); assert.equal(r.value.name,'hello'); });
test('missing required', () => { const v = new InputValidator(); const r = v.validate({name:{type:'string',required:true}},{}); assert.equal(r.ok,false); assert.ok(r.errors.length>0); });
test('type mismatch', () => { const v = new InputValidator(); const r = v.validate({age:{type:'number'}},{age:'abc'}); assert.equal(r.ok,false); });
test('enum check', () => { const v = new InputValidator(); const r = v.validate({action:{type:'string',enum:['a','b']}},{action:'c'}); assert.equal(r.ok,false); });
