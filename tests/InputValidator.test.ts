import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';

test('a well-formed input passes validation', () => {
  const v = new InputValidator();
  const schema = { name: { type: 'string', required: true }, age: { type: 'number' } };
  const res = v.validate(schema, { name: 'neo', age: 30 });
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
  assert.equal(res.value.name, 'neo');
});

test('missing required fields and wrong types are rejected', () => {
  const v = new InputValidator();
  const schema = { name: { type: 'string', required: true }, age: { type: 'number', required: true } };
  const res = v.validate(schema, { name: 5 });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('required')));
  assert.ok(res.errors.some((e) => e.includes('must be a string')));
});

test('min/max/pattern/enum constraints are enforced', () => {
  const v = new InputValidator();
  const schema = {
    code: { type: 'string', min: 2, max: 4, pattern: /^[a-z]+$/ },
    role: { type: 'string', enum: ['admin', 'observer'] },
    score: { type: 'number', min: 0, max: 100 },
  };
  const bad = v.validate(schema, { code: 'X', role: 'ghost', score: 999 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 3);

  const good = v.validate(schema, { code: 'ab', role: 'admin', score: 50 });
  assert.equal(good.ok, true);
});

test('non-object input is rejected outright', () => {
  const v = new InputValidator();
  const res = v.validate({ a: { type: 'string' } }, [1, 2, 3]);
  assert.equal(res.ok, false);
  assert.ok(res.errors[0].includes('object'));
});
