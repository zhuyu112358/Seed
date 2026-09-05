import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionSystem } from '../src/security/PermissionSystem.js';

test('admin has wildcard access to any resource/action', () => {
  const ps = new PermissionSystem();
  assert.equal(ps.isAllowed('admin', 'any-resource', 'delete'), true);
  assert.equal(ps.isAllowed('admin', 'entity', 'interact'), true);
});

test('observer can read but not mutate', () => {
  const ps = new PermissionSystem();
  assert.equal(ps.isAllowed('observer', 'entity', 'read'), true);
  assert.equal(ps.isAllowed('observer', 'entity', 'interact'), false);
});

test('soul can read and interact entities and act on itself', () => {
  const ps = new PermissionSystem();
  assert.equal(ps.isAllowed('soul', 'entity', 'read'), true);
  assert.equal(ps.isAllowed('soul', 'entity', 'interact'), true);
  assert.equal(ps.isAllowed('soul', 'soul', 'self-action'), true);
  assert.equal(ps.isAllowed('soul', 'entity', 'delete'), false);
});

test('grant adds new rules and ensure throws on denial', () => {
  const ps = new PermissionSystem();
  ps.grant({ role: 'observer', resource: 'entity', action: 'interact' });
  assert.equal(ps.isAllowed('observer', 'entity', 'interact'), true);

  assert.doesNotThrow(() => ps.ensure('admin', 'entity', 'read'));
  assert.throws(() => ps.ensure('observer', 'entity', 'delete'), /permission denied/);
});
