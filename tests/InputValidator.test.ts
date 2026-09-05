// Unit tests for src/security/InputValidator.ts and sanitize.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator, type Schema } from '../src/security/InputValidator.js';
import { sanitizeString, looksInjective } from '../src/security/sanitize.js';

const ActionRequest: Schema = {
  soulId: { type: 'string', required: true, min: 1, max: 64 },
  action: { type: 'string', required: true, enum: ['move', 'interact', 'wait'] },
  timestamp: { type: 'number', required: true, min: 0 },
  parameters: { type: 'object' },
};

describe('InputValidator.validate', () => {
  it('accepts a well-formed ActionRequest', () => {
    const v = new InputValidator();
    const r = v.validate(ActionRequest, {
      soulId: 'soul_1',
      action: 'move',
      timestamp: 123,
      parameters: { x: 1 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
    assert.equal(r.value.soulId, 'soul_1');
  });

  it('rejects missing required fields and wrong types', () => {
    const v = new InputValidator();
    const r = v.validate(ActionRequest, { action: 'move', timestamp: 'not-a-number' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('soulId')));
    assert.ok(r.errors.some((e) => e.includes('timestamp')));
  });

  it('enforces string length, number range and enum', () => {
    const v = new InputValidator();
    const short = v.validate(ActionRequest, { soulId: '', action: 'move', timestamp: 1 });
    assert.equal(short.ok, false);

    const badEnum = v.validate(ActionRequest, { soulId: 's1', action: 'explode', timestamp: 1 });
    assert.equal(badEnum.ok, false);

    const negTime = v.validate(ActionRequest, { soulId: 's1', action: 'move', timestamp: -5 });
    assert.equal(negTime.ok, false);
  });

  it('rejects non-object / array input', () => {
    const v = new InputValidator();
    assert.equal(v.validate(ActionRequest, null).ok, false);
    assert.equal(v.validate(ActionRequest, [1, 2, 3]).ok, false);
    assert.equal(v.validate(ActionRequest, 'string').ok, false);
  });
});

describe('custom inline schema', () => {
  it('validates an inline shape on the fly', () => {
    const v = new InputValidator();
    const schema: Schema = {
      name: { type: 'string', required: true, pattern: /^[a-z]+$/ },
      count: { type: 'number', min: 1, max: 10 },
      flag: { type: 'boolean' },
    };
    const good = v.validate(schema, { name: 'abc', count: 5, flag: true });
    assert.equal(good.ok, true);

    const badPattern = v.validate(schema, { name: 'ABC!', count: 5 });
    assert.equal(badPattern.ok, false);

    const overMax = v.validate(schema, { name: 'abc', count: 99 });
    assert.equal(overMax.ok, false);
  });
});

describe('sanitize', () => {
  it('sanitizeString escapes HTML and strips control chars', () => {
    const out = sanitizeString('<script>alert(1)</script>');
    assert.ok(!out.includes('<script>'));
    assert.ok(out.includes('\\u003c'));
  });

  it('sanitizeString truncates to maxLen', () => {
    const out = sanitizeString('a'.repeat(1000), 10);
    assert.equal(out.length, 10);
  });

  it('looksInjective flags script and SQL injection attempts', () => {
    assert.equal(looksInjective('<script>x</script>'), true);
    assert.equal(looksInjective('DROP TABLE users;'), true);
    assert.equal(looksInjective('normal chat message'), false);
  });
});
