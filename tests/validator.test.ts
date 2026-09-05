import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';

test('InputValidator enforces required/type/range', () => {
  const v = new InputValidator();
  const schema = {
    name: { type: 'string' as const, required: true, max: 10 },
    power: { type: 'number' as const, min: 0, max: 100 },
  };
  const ok = v.validate(schema, { name: 'vex', power: 50 });
  assert.equal(ok.ok, true);
  const bad = v.validate(schema, { name: 'this-name-is-way-too-long', power: 999 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes('too long')));
  assert.ok(bad.errors.some((e) => e.includes('above max')));
});

test('InputValidator rejects wrong type', () => {
  const v = new InputValidator();
  const r = v.validate({ age: { type: 'number', required: true } }, { age: 'old' });
  assert.equal(r.ok, false);
  assert.ok(r.errors[0].includes('must be a number'));
});
