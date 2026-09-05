import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InputValidator } from '../src/security/InputValidator.js';
import { PermissionSystem } from '../src/security/PermissionSystem.js';
import { RateLimiter } from '../src/security/RateLimiter.js';

describe('InputValidator', () => {
  it('should validate valid input', () => {
    const v = new InputValidator();
    const result = v.validate(
      { name: { type: 'string', required: true }, age: { type: 'number', required: true } },
      { name: 'Test', age: 25 }
    );
    assert.ok(result.ok);
  });

  it('should reject missing required field', () => {
    const v = new InputValidator();
    const result = v.validate(
      { name: { type: 'string', required: true } },
      {}
    );
    assert.ok(!result.ok);
    assert.ok(result.errors.length > 0);
  });

  it('should reject wrong type', () => {
    const v = new InputValidator();
    const result = v.validate(
      { age: { type: 'number', required: true } },
      { age: 'not a number' }
    );
    assert.ok(!result.ok);
  });

  it('should validate enum', () => {
    const v = new InputValidator();
    const result = v.validate(
      { action: { type: 'string', required: true, enum: ['move', 'speak'] } },
      { action: 'fly' }
    );
    assert.ok(!result.ok);
    const valid = v.validate(
      { action: { type: 'string', required: true, enum: ['move', 'speak'] } },
      { action: 'move' }
    );
    assert.ok(valid.ok);
  });

  it('should validate max length', () => {
    const v = new InputValidator();
    const result = v.validate(
      { name: { type: 'string', required: true, max: 5 } },
      { name: 'TooLongName' }
    );
    assert.ok(!result.ok);
  });

  it('should handle optional fields', () => {
    const v = new InputValidator();
    const result = v.validate(
      { name: { type: 'string', required: true }, optional: { type: 'string', required: false } },
      { name: 'Test' }
    );
    assert.ok(result.ok);
  });
});

describe('PermissionSystem', () => {
  it('should create permission system', () => {
    const ps = new PermissionSystem();
    assert.ok(ps);
  });

  it('should allow admin all permissions', () => {
    const ps = new PermissionSystem();
    assert.doesNotThrow(() => ps.ensure('admin', 'entity', 'create'));
    assert.doesNotThrow(() => ps.ensure('admin', 'world', 'start'));
  });

  it('should check permission for soul role', () => {
    const ps = new PermissionSystem();
    // soul should be able to interact with entities
    assert.doesNotThrow(() => ps.ensure('soul', 'entity', 'interact'));
  });

  it('should check permission for observer role', () => {
    const ps = new PermissionSystem();
    // observer should be able to read world status
    assert.doesNotThrow(() => ps.ensure('observer', 'world', 'status'));
  });

  it('should register custom permissions', () => {
    const ps = new PermissionSystem();
    ps.registerPermission('custom', 'action', ['admin']);
    assert.doesNotThrow(() => ps.ensure('admin', 'custom', 'action'));
  });
});

describe('RateLimiter', () => {
  it('should create with max requests', () => {
    const rl = new RateLimiter(10);
    assert.ok(rl);
  });

  it('should allow requests under limit', () => {
    const rl = new RateLimiter(100);
    for (let i = 0; i < 5; i++) {
      const result = rl.check('client_1');
      assert.ok(result.allowed);
    }
  });

  it('should reject requests over limit', () => {
    const rl = new RateLimiter(3);
    for (let i = 0; i < 3; i++) {
      const result = rl.check('client_limit');
      assert.ok(result.allowed);
    }
    const blocked = rl.check('client_limit');
    assert.ok(!blocked.allowed);
    assert.ok(blocked.retryAfterMs > 0);
  });

  it('should track separate clients', () => {
    const rl = new RateLimiter(2);
    rl.check('client_a');
    rl.check('client_a');
    // client_a is now limited
    const aBlocked = rl.check('client_a');
    assert.ok(!aBlocked.allowed);
    // client_b should still be allowed
    const bAllowed = rl.check('client_b');
    assert.ok(bAllowed.allowed);
  });
});
