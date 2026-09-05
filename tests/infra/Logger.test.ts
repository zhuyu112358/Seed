import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Logger, createLogger, parseMaxFileSize } from '../../src/infra/Logger.js';
test('parseMaxFileSize', () => {
  assert.equal(parseMaxFileSize('10m'), 10*1024*1024);
  assert.equal(parseMaxFileSize('512k'), 512*1024);
  assert.equal(parseMaxFileSize('1g'), 1024*1024*1024);
});
test('silent and level', () => {
  const log = Logger.create({ level:'warn', consoleEnabled:false, fileEnabled:false, logDirectory:fs.mkdtempSync(path.join(os.tmpdir(),'l-')), maxFileSize:'10m', maxFiles:5, jsonFormat:true });
  assert.equal(log.getLevel(),'warn'); log.setLevel('debug'); assert.equal(log.getLevel(),'debug');
  log.setSilent(true); assert.equal(log.isSilent(),true);
});
test('child nests module', () => {
  const log = Logger.create({ level:'info', consoleEnabled:false, fileEnabled:false, logDirectory:fs.mkdtempSync(path.join(os.tmpdir(),'l-')), maxFileSize:'10m', maxFiles:5, jsonFormat:true });
  assert.equal((log.child('engine') as Logger).module,'engine');
  assert.equal(((log.child('engine') as Logger).child('physics') as Logger).module,'engine:physics');
});
test('createLogger', () => {
  assert.equal(typeof createLogger({ level:'info', consoleEnabled:false, fileEnabled:false, logDirectory:fs.mkdtempSync(path.join(os.tmpdir(),'l-')), maxFileSize:'10m', maxFiles:5, jsonFormat:true }).info,'function');
});
test('file transport writes seed.log', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'f-'));
  const log = Logger.create({ level:'info', consoleEnabled:false, fileEnabled:true, logDirectory:dir, maxFileSize:'10m', maxFiles:3, jsonFormat:true });
  log.info('msg'); await log.flush();
  const t = path.join(dir,'seed.log');
  for (let i=0;i<20&&!fs.existsSync(t);i++) await new Promise((r)=>setTimeout(r,50));
  assert.ok(fs.existsSync(t));
});
