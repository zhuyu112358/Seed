import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';
test('valid', () => { const v = new InputValidator(); const r = v.validate({name:{type:'string',required:true}},{name:'hi'}); assert.equal(r.ok,true); });
test('missing required', () => { const v = new InputValidator(); const r = v.validate({name:{type:'string',required:true}},{}); assert.equal(r.ok,false); });
