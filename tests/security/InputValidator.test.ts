import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../../src/security/InputValidator.js';
test('built-in schemas', () => {
  const v = new InputValidator();
  for (const n of ['ActionRequest','PerceptionFrameConfig','EntityConfig','CommunicationMessage','WorldEventTrigger']) assert.ok(v.getRegisteredSchemas().includes(n));
});
test('valid action', () => {
  assert.equal(new InputValidator().validate('ActionRequest',{action:'move',soulId:'soul_1'}).valid,true);
});
test('collect errors', () => {
  const r = new InputValidator().validate('ActionRequest',{action:'fly',soulId:'bad!'});
  assert.equal(r.valid,false); assert.ok(r.errors.length>=1);
});
test('validateInline', () => {
  const r = new InputValidator().validateInline({type:'object',required:['age'],properties:{age:{type:'number',min:0,max:120}}},{age:200});
  assert.equal(r.valid,false);
});
test('unknown schema', () => {
  assert.equal(new InputValidator().validate('n',{}).valid,false);
});
test('sanitize injection', () => {
  assert.equal((new InputValidator().sanitize('DROP TABLE users;',50) as {injected:boolean}).injected,true);
});
