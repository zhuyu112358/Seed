import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionSystem } from '../src/security/PermissionSystem.js';
test('admin soul', () => { const ps=new PermissionSystem(); assert.equal(ps.isAllowed('admin','x','y'),true); assert.equal(ps.isAllowed('soul','entity','interact'),true); assert.equal(ps.isAllowed('soul','entity','delete'),false); });
