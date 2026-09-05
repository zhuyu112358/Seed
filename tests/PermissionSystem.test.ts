import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionSystem } from '../src/security/PermissionSystem.js';
test('admin', () => { assert.equal(new PermissionSystem().isAllowed('admin','x','y'),true); });
test('soul', () => { const ps=new PermissionSystem(); assert.equal(ps.isAllowed('soul','entity','interact'),true); assert.equal(ps.isAllowed('soul','entity','delete'),false); });
test('ensure throws', () => { assert.throws(()=>new PermissionSystem().ensure('soul','entity','delete'),/permission denied/); });
