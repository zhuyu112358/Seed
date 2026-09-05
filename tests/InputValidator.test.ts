import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';

test('built-in schemas are registered on construction', () => {
  const v = new InputValidator();
  const names = v.getRegisteredSchemas();
  assert.ok(names.includes('ActionRequest'));
  assert.ok(names.includes('EntityConfig'));
});

test('registerSchema + validate accepts valid data and rejects invalid', () => {
  const v = new InputValidator();
  v.registerSchema('User', {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string', min: 1, max: 10 } },
  });
  const good = v.validate('User', { name: 'neo' });
  assert.equal(good.valid, true);
  assert.deepEqual(good.errors, []);

  const bad = v.validate('User', { name: '' });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length > 0);
});

test('validateInline validates an ad-hoc schema without registration', () => {
  const v = new InputValidator();
  const ok = v.validateInline({ type: 'number', min: 0, max: 100 }, 42);
  assert.equal(ok.valid, true);
  const bad = v.validateInline({ type: 'number', min: 0, max: 100 }, 999);
  assert.equal(bad.valid, false);
});

test('validate of an unknown schema reports an error', () => {
  const v = new InputValidator();
  const res = v.validate('DoesNotExist', {});
  assert.equal(res.valid, false);
  assert.ok(res.errors[0].message.includes('Unknown schema'));
});

test('sanitize strips injected content and flags injection', () => {
  const v = new InputValidator();
  const plain = v.sanitize('hello world');
  assert.equal(plain.injected, false);
  const malicious = v.sanitize('<script>alert(1)</script>');
  assert.equal(malicious.injected, true);
  assert.ok(typeof malicious.clean === 'string');
  const nonString = v.sanitize(123);
  assert.equal(nonString.clean, 123);
});
