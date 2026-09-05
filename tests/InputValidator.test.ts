// Unit tests for src/security/InputValidator.ts (AJV-backed)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';

describe('InputValidator built-in schemas', () => {
  it('accepts a well-formed ActionRequest', () => {
    const v = new InputValidator();
    const r = v.validate('ActionRequest', { soulId: 'soul_1', action: 'move' });
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });

  it('rejects an ActionRequest missing required fields / bad action', () => {
    const v = new InputValidator();
    assert.equal(v.validate('ActionRequest', { action: 'move' }).valid, false);
    assert.equal(v.validate('ActionRequest', { soulId: 'soul_1', action: 'explode' }).valid, false);
  });
});

describe('registerSchema / validate / validateInline', () => {
  it('registerSchema adds a custom schema usable by validate', () => {
    const v = new InputValidator();
    v.registerSchema('PlayerMove', {
      type: 'object',
      required: ['dx', 'dy'],
      properties: {
        dx: { type: 'number', min: -10, max: 10 },
        dy: { type: 'number', min: -10, max: 10 },
      },
    });
    assert.equal(v.validate('PlayerMove', { dx: 3, dy: -2 }).valid, true);
    assert.equal(v.validate('PlayerMove', { dx: 99 }).valid, false);
  });

  it('validateInline validates an ad-hoc schema', () => {
    const v = new InputValidator();
    assert.equal(v.validateInline({ type: 'string', min: 1, max: 5 }, 'abc').valid, true);
    assert.equal(v.validateInline({ type: 'number', min: 0, max: 10 }, 99).valid, false);
  });

  it('validate on an unknown schema returns an error', () => {
    const v = new InputValidator();
    const r = v.validate('DoesNotExist', {});
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].message.includes('Unknown schema'));
  });

  it('getRegisteredSchemas lists built-ins and custom ones', () => {
    const v = new InputValidator();
    v.registerSchema('CustomOne', { type: 'object' });
    const schemas = v.getRegisteredSchemas();
    assert.ok(schemas.includes('ActionRequest'));
    assert.ok(schemas.includes('CustomOne'));
  });
});

describe('sanitize', () => {
  it('sanitize escapes HTML and flags injection', () => {
    const v = new InputValidator();
    const clean = v.sanitize('<script>alert(1)</script>');
    assert.equal(clean.injected, true);
    assert.ok(!(clean.clean as string).includes('<script>'));
  });

  it('sanitize leaves plain strings untouched and non-strings alone', () => {
    const v = new InputValidator();
    assert.equal(v.sanitize('hello world').injected, false);
    assert.equal(v.sanitize(42).clean, 42);
  });
});
