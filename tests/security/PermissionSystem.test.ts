import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionSystem } from '../../src/security/PermissionSystem.js';
test('admin all', () => {
  const ps = new PermissionSystem(); ps.assignRole('a','admin');
  assert.equal(ps.hasPermission('a','system.x','write'),true);
});
test('observer read-only', () => {
  const ps = new PermissionSystem(); ps.assignRole('o','observer');
  assert.equal(ps.hasPermission('o','e.x','read'),true);
  assert.equal(ps.hasPermission('o','e.x','delete'),false);
});
test('anonymous public', () => {
  const ps = new PermissionSystem();
  assert.equal(ps.hasPermission('an','world.public','read'),true);
  assert.equal(ps.hasPermission('an','e.x','read'),false);
});
test('wildcard', () => {
  const ps = new PermissionSystem(); ps.assignRole('m','moderator');
  assert.equal(ps.hasPermission('m','entity.player','update'),true);
  assert.equal(ps.hasPermission('m','system.x','write'),false);
});
test('role round-trip', () => {
  const ps = new PermissionSystem(); ps.assignRole('s','soul');
  assert.equal(ps.getRole('s'),'soul'); ps.removeRole('s'); assert.equal(ps.getRole('s'),null);
});
test('add/remove permission', () => {
  const ps = new PermissionSystem();
  ps.defineRole('observer',[{resource:'world.*',action:'read'}]);
  ps.addPermissionToRole('observer',{resource:'sys.diag',action:'read'});
  ps.assignRole('o1','observer');
  assert.equal(ps.hasPermission('o1','sys.diag','read'),true);
  ps.removePermissionFromRole('observer','sys.diag','read');
  assert.equal(ps.hasPermission('o1','sys.diag','read'),false);
});
