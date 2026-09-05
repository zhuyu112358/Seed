import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import { ConditionEngine } from '../src/event/ConditionEngine.js';

describe('EventSystem', () => {
  it('should create event system', () => {
    const es = new EventSystem();
    assert.ok(es);
  });

  it('should add and retrieve events', () => {
    const es = new EventSystem();
    const event = es.createEvent({
      type: 'test_event',
      name: 'Test Event',
      severity: 'info',
      position: { x: 0, y: 0, z: 0 },
      radius: 10,
    });
    assert.ok(event.id);
    assert.equal(event.type, 'test_event');
    assert.equal(event.name, 'Test Event');
    assert.equal(event.status, 'active');
  });

  it('should list active events', () => {
    const es = new EventSystem();
    es.createEvent({ type: 'e1', name: 'E1', severity: 'info', position: { x: 0, y: 0, z: 0 }, radius: 5 });
    es.createEvent({ type: 'e2', name: 'E2', severity: 'warning', position: { x: 1, y: 0, z: 0 }, radius: 5 });
    const active = es.getActiveEvents();
    assert.equal(active.length, 2);
  });

  it('should expire events after duration', () => {
    const es = new EventSystem();
    const event = es.createEvent({
      type: 'short',
      name: 'Short',
      severity: 'info',
      position: { x: 0, y: 0, z: 0 },
      radius: 5,
      duration: 0.001, // very short
    });
    assert.equal(event.status, 'active');
    // Wait a tiny bit and update
    setTimeout(() => {
      es.update(0.1);
      const active = es.getActiveEvents();
      assert.equal(active.length, 0);
    }, 10);
  });

  it('should register and fire listeners', () => {
    const es = new EventSystem();
    let fired = false;
    es.on('test_event', () => { fired = true; });
    es.createEvent({ type: 'test_event', name: 'Test', severity: 'info', position: { x: 0, y: 0, z: 0 }, radius: 5 });
    assert.ok(fired);
  });
});

describe('ConditionEngine', () => {
  it('should create condition engine', () => {
    const ce = new ConditionEngine();
    assert.ok(ce);
  });

  it('should evaluate threshold conditions', () => {
    const ce = new ConditionEngine();
    const condition = ce.createThresholdCondition('temperature', '>', 30);
    assert.ok(ce.evaluate(condition, { temperature: 35 }));
    assert.ok(!ce.evaluate(condition, { temperature: 25 }));
  });

  it('should evaluate AND composite conditions', () => {
    const ce = new ConditionEngine();
    const c1 = ce.createThresholdCondition('windSpeed', '>', 10);
    const c2 = ce.createThresholdCondition('pressure', '<', 1000);
    const and = ce.createAndCondition([c1, c2]);
    assert.ok(ce.evaluate(and, { windSpeed: 15, pressure: 990 }));
    assert.ok(!ce.evaluate(and, { windSpeed: 15, pressure: 1010 }));
    assert.ok(!ce.evaluate(and, { windSpeed: 5, pressure: 990 }));
  });

  it('should evaluate OR composite conditions', () => {
    const ce = new ConditionEngine();
    const c1 = ce.createThresholdCondition('temperature', '>', 40);
    const c2 = ce.createThresholdCondition('humidity', '>', 90);
    const or = ce.createOrCondition([c1, c2]);
    assert.ok(ce.evaluate(or, { temperature: 45, humidity: 50 }));
    assert.ok(ce.evaluate(or, { temperature: 30, humidity: 95 }));
    assert.ok(!ce.evaluate(or, { temperature: 30, humidity: 50 }));
  });

  it('should evaluate NOT conditions', () => {
    const ce = new ConditionEngine();
    const c = ce.createThresholdCondition('raining', '==', 1);
    const not = ce.createNotCondition(c);
    assert.ok(ce.evaluate(not, { raining: 0 }));
    assert.ok(!ce.evaluate(not, { raining: 1 }));
  });

  it('should evaluate typhoon-like complex condition', () => {
    const ce = new ConditionEngine();
    const wind = ce.createThresholdCondition('windSpeed', '>', 20);
    const pressure = ce.createThresholdCondition('pressureDrop', '>', 5);
    const tempGradient = ce.createThresholdCondition('temperatureGradient', '>', 10);
    const typhoon = ce.createAndCondition([wind, pressure, tempGradient]);
    // Typhoon conditions met
    assert.ok(ce.evaluate(typhoon, { windSpeed: 25, pressureDrop: 8, temperatureGradient: 15 }));
    // Not met
    assert.ok(!ce.evaluate(typhoon, { windSpeed: 10, pressureDrop: 2, temperatureGradient: 5 }));
  });
});
