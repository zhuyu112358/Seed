// Tests for PerceptionFilter + AttentionSystem (M10 phase 3).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PerceptionFilter } from "../src/perception/PerceptionFilter.js";
import { AttentionSystem } from "../src/perception/AttentionSystem.js";
import type { PerceptionEvent, PerceptibleEntity } from "../src/perception/PerceptionFilterTypes.js";

function makeEvent(overrides: Partial<PerceptionEvent> = {}): PerceptionEvent {
  return {
    id: "evt_1",
    type: "collision.enter",
    name: "Collision detected",
    severity: "medium",
    position: { x: 5, z: 5 },
    tick: 100,
    ...overrides,
  };
}

function makeEntity(overrides: Partial<PerceptibleEntity> = {}): PerceptibleEntity {
  return {
    id: "ent_1",
    type: "soul",
    position: { x: 3, z: 4 },
    name: "TestSoul",
    ...overrides,
  };
}

describe("PerceptionFilter - Configuration", () => {
  test("default config", () => {
    const filter = new PerceptionFilter();
    assert.equal(filter.config.maxDistance, 0);
    assert.equal(filter.config.minSeverity, "low");
    assert.equal(filter.config.allowedTypes.length, 0);
    assert.equal(filter.config.excludedTypes.length, 0);
    assert.equal(filter.config.enableFovFilter, false);
  });

  test("custom config", () => {
    const filter = new PerceptionFilter({ maxDistance: 20, minSeverity: "high" });
    assert.equal(filter.config.maxDistance, 20);
    assert.equal(filter.config.minSeverity, "high");
  });

  test("setConfig updates", () => {
    const filter = new PerceptionFilter();
    filter.setConfig({ maxDistance: 30 });
    assert.equal(filter.config.maxDistance, 30);
  });

  test("add/remove allowed type", () => {
    const filter = new PerceptionFilter();
    filter.addAllowedType("collision.enter");
    assert.ok(filter.config.allowedTypes.includes("collision.enter"));
    filter.removeAllowedType("collision.enter");
    assert.ok(!filter.config.allowedTypes.includes("collision.enter"));
  });

  test("add excluded type", () => {
    const filter = new PerceptionFilter();
    filter.addExcludedType("debug.info");
    assert.ok(filter.config.excludedTypes.includes("debug.info"));
  });

  test("set min severity", () => {
    const filter = new PerceptionFilter();
    filter.setMinSeverity("critical");
    assert.equal(filter.config.minSeverity, "critical");
  });

  test("set max distance", () => {
    const filter = new PerceptionFilter();
    filter.setMaxDistance(50);
    assert.equal(filter.config.maxDistance, 50);
  });
});

describe("PerceptionFilter - Event Filtering", () => {
  test("passes all events with default config", () => {
    const filter = new PerceptionFilter();
    const events = [makeEvent(), makeEvent({ id: "evt_2", severity: "low" })];
    const result = filter.filterEvents(events);
    assert.equal(result.events.length, 2);
    assert.equal(result.result.filteredCount, 0);
  });

  test("filters by excluded type", () => {
    const filter = new PerceptionFilter();
    filter.addExcludedType("debug.info");
    const events = [
      makeEvent({ type: "collision.enter" }),
      makeEvent({ id: "evt_2", type: "debug.info" }),
    ];
    const result = filter.filterEvents(events);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "collision.enter");
  });

  test("filters by allowed type", () => {
    const filter = new PerceptionFilter();
    filter.addAllowedType("collision.enter");
    const events = [
      makeEvent({ type: "collision.enter" }),
      makeEvent({ id: "evt_2", type: "weather.rain" }),
    ];
    const result = filter.filterEvents(events);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "collision.enter");
  });

  test("filters by min severity", () => {
    const filter = new PerceptionFilter({ minSeverity: "high" });
    const events = [
      makeEvent({ severity: "critical" }),
      makeEvent({ id: "evt_2", severity: "medium" }),
      makeEvent({ id: "evt_3", severity: "low" }),
    ];
    const result = filter.filterEvents(events);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].severity, "critical");
  });

  test("filters by distance", () => {
    const filter = new PerceptionFilter({ maxDistance: 10 });
    const observer = { x: 0, z: 0 };
    const events = [
      makeEvent({ position: { x: 5, z: 0 } }), // distance 5, passes
      makeEvent({ id: "evt_2", position: { x: 20, z: 0 } }), // distance 20, filtered
    ];
    const result = filter.filterEvents(events, observer);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].id, "evt_1");
  });

  test("events without position pass distance filter", () => {
    const filter = new PerceptionFilter({ maxDistance: 10 });
    const observer = { x: 0, z: 0 };
    const event = makeEvent({ position: undefined });
    const result = filter.filterEvents([event], observer);
    assert.equal(result.events.length, 1);
  });

  test("combined filters (type + severity + distance)", () => {
    const filter = new PerceptionFilter({ maxDistance: 10, minSeverity: "medium" });
    filter.addAllowedType("collision.enter");
    const observer = { x: 0, z: 0 };
    const events = [
      makeEvent({ type: "collision.enter", severity: "high", position: { x: 5, z: 0 } }), // passes all
      makeEvent({ id: "evt_2", type: "collision.enter", severity: "low", position: { x: 5, z: 0 } }), // fails severity
      makeEvent({ id: "evt_3", type: "weather.rain", severity: "high", position: { x: 5, z: 0 } }), // fails type
      makeEvent({ id: "evt_4", type: "collision.enter", severity: "high", position: { x: 20, z: 0 } }), // fails distance
    ];
    const result = filter.filterEvents(events, observer);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].id, "evt_1");
  });

  test("filter result stats", () => {
    const filter = new PerceptionFilter({ minSeverity: "high" });
    const events = [makeEvent({ severity: "critical" }), makeEvent({ id: "evt_2", severity: "low" })];
    const result = filter.filterEvents(events);
    assert.equal(result.result.inputCount, 2);
    assert.equal(result.result.outputCount, 1);
    assert.equal(result.result.filteredCount, 1);
  });
});

describe("PerceptionFilter - Entity Filtering", () => {
  test("passes all entities with default config", () => {
    const filter = new PerceptionFilter();
    const entities = [makeEntity(), makeEntity({ id: "ent_2" })];
    const result = filter.filterEntities(entities);
    assert.equal(result.entities.length, 2);
  });

  test("filters by entity type", () => {
    const filter = new PerceptionFilter();
    filter.config.allowedEntityTypes = ["soul"];
    const entities = [
      makeEntity({ type: "soul" }),
      makeEntity({ id: "ent_2", type: "item" }),
    ];
    const result = filter.filterEntities(entities);
    assert.equal(result.entities.length, 1);
    assert.equal(result.entities[0].type, "soul");
  });

  test("filters by distance", () => {
    const filter = new PerceptionFilter({ maxDistance: 10 });
    const observer = { x: 0, z: 0 };
    const entities = [
      makeEntity({ position: { x: 5, z: 0 } }), // distance 5
      makeEntity({ id: "ent_2", position: { x: 15, z: 0 } }), // distance 15
    ];
    const result = filter.filterEntities(entities, observer);
    assert.equal(result.entities.length, 1);
  });

  test("FOV filter with visibility map", () => {
    const filter = new PerceptionFilter({ enableFovFilter: true });
    const fovMap = new Map<string, boolean>();
    fovMap.set("ent_1", true);
    fovMap.set("ent_2", false);
    const entities = [makeEntity(), makeEntity({ id: "ent_2" })];
    const result = filter.filterEntities(entities, undefined, fovMap);
    assert.equal(result.entities.length, 1);
    assert.equal(result.entities[0].id, "ent_1");
  });

  test("FOV filter disabled ignores visibility map", () => {
    const filter = new PerceptionFilter({ enableFovFilter: false });
    const fovMap = new Map<string, boolean>();
    fovMap.set("ent_1", false);
    const entities = [makeEntity()];
    const result = filter.filterEntities(entities, undefined, fovMap);
    assert.equal(result.entities.length, 1);
  });
});

describe("PerceptionFilter - Serialization", () => {
  test("serialize and deserialize preserves config", () => {
    const filter = new PerceptionFilter({ maxDistance: 25, minSeverity: "high" });
    filter.addAllowedType("collision.enter");
    const data = filter.serialize();

    const filter2 = new PerceptionFilter();
    filter2.deserialize(data as Record<string, unknown>);
    assert.equal(filter2.config.maxDistance, 25);
    assert.equal(filter2.config.minSeverity, "high");
    assert.ok(filter2.config.allowedTypes.includes("collision.enter"));
  });
});

describe("AttentionSystem - Configuration", () => {
  test("default config", () => {
    const attention = new AttentionSystem();
    assert.equal(attention.config.severityWeight, 0.5);
    assert.equal(attention.config.distanceWeight, 0.2);
    assert.equal(attention.config.recencyWeight, 0.2);
    assert.equal(attention.config.maxEventsPerTick, 10);
  });

  test("custom config", () => {
    const attention = new AttentionSystem({ maxEventsPerTick: 5, severityWeight: 0.8 });
    assert.equal(attention.config.maxEventsPerTick, 5);
    assert.equal(attention.config.severityWeight, 0.8);
  });

  test("setConfig updates", () => {
    const attention = new AttentionSystem();
    attention.setConfig({ maxEventsPerTick: 20 });
    assert.equal(attention.config.maxEventsPerTick, 20);
  });

  test("set/get type importance", () => {
    const attention = new AttentionSystem();
    attention.setTypeImportance("collision.enter", 0.8);
    assert.equal(attention.getTypeImportance("collision.enter"), 0.8);
    assert.equal(attention.getTypeImportance("unknown.type"), 0);
  });

  test("remove type importance", () => {
    const attention = new AttentionSystem();
    attention.setTypeImportance("collision.enter", 0.8);
    attention.removeTypeImportance("collision.enter");
    assert.equal(attention.getTypeImportance("collision.enter"), 0);
  });
});

describe("AttentionSystem - Priority Calculation", () => {
  test("higher severity gets higher priority", () => {
    const attention = new AttentionSystem();
    const critical = attention.calculatePriority(makeEvent({ severity: "critical" }));
    const low = attention.calculatePriority(makeEvent({ severity: "low" }));
    assert.ok(critical.priority > low.priority, `Critical (${critical.priority}) should be > low (${low.priority})`);
  });

  test("closer event gets higher priority", () => {
    const attention = new AttentionSystem();
    const observer = { x: 0, z: 0 };
    const close = attention.calculatePriority(makeEvent({ position: { x: 1, z: 0 } }), observer);
    const far = attention.calculatePriority(makeEvent({ position: { x: 40, z: 0 } }), observer);
    assert.ok(close.priority > far.priority, `Close (${close.priority}) should be > far (${far.priority})`);
  });

  test("newer event gets higher priority", () => {
    const attention = new AttentionSystem();
    const newEvent = attention.calculatePriority(makeEvent({ tick: 99 }), undefined, 100);
    const oldEvent = attention.calculatePriority(makeEvent({ tick: 1 }), undefined, 100);
    assert.ok(newEvent.priority > oldEvent.priority, `New (${newEvent.priority}) should be > old (${oldEvent.priority})`);
  });

  test("type importance bonus increases priority", () => {
    const attention = new AttentionSystem();
    attention.setTypeImportance("collision.enter", 1.0);
    const withBonus = attention.calculatePriority(makeEvent({ type: "collision.enter" }));
    const withoutBonus = attention.calculatePriority(makeEvent({ type: "other.type" }));
    assert.ok(withBonus.priority > withoutBonus.priority);
  });

  test("priority components are within 0-1", () => {
    const attention = new AttentionSystem();
    const result = attention.calculatePriority(makeEvent());
    assert.ok(result.priority >= 0 && result.priority <= 1);
    assert.ok(result.severityScore >= 0 && result.severityScore <= 1);
    assert.ok(result.distanceScore >= 0 && result.distanceScore <= 1);
    assert.ok(result.recencyScore >= 0 && result.recencyScore <= 1);
  });
});

describe("AttentionSystem - Prioritization", () => {
  test("prioritizeEvents sorts by priority descending", () => {
    const attention = new AttentionSystem();
    const events = [
      makeEvent({ id: "low", severity: "low" }),
      makeEvent({ id: "critical", severity: "critical" }),
      makeEvent({ id: "medium", severity: "medium" }),
    ];
    const result = attention.prioritizeEvents(events);
    assert.equal(result.length, 3);
    assert.equal(result[0].event.id, "critical");
    assert.equal(result[1].event.id, "medium");
    assert.equal(result[2].event.id, "low");
  });

  test("getTopEvents returns within attention span", () => {
    const attention = new AttentionSystem({ maxEventsPerTick: 2 });
    const events = [
      makeEvent({ id: "e1", severity: "critical" }),
      makeEvent({ id: "e2", severity: "high" }),
      makeEvent({ id: "e3", severity: "medium" }),
    ];
    const result = attention.getTopEvents(events);
    assert.equal(result.events.length, 2);
    assert.equal(result.events[0].event.id, "e1");
    assert.equal(result.events[1].event.id, "e2");
    assert.equal(result.result.processedCount, 3);
    assert.equal(result.result.selectedCount, 2);
  });

  test("getTopEvents with custom maxCount", () => {
    const attention = new AttentionSystem();
    const events = [makeEvent({ severity: "critical" }), makeEvent({ id: "e2", severity: "high" })];
    const result = attention.getTopEvents(events, undefined, undefined, 1);
    assert.equal(result.events.length, 1);
  });

  test("getTopEvents average priority", () => {
    const attention = new AttentionSystem();
    const events = [makeEvent({ severity: "critical" }), makeEvent({ id: "e2", severity: "low" })];
    const result = attention.getTopEvents(events);
    assert.ok(result.result.averagePriority > 0);
  });
});

describe("AttentionSystem - Attention Decay", () => {
  test("decay reduces priority over time", () => {
    const attention = new AttentionSystem({ attentionDecay: 0.1 });
    const prioritized = attention.prioritizeEvents([makeEvent({ severity: "critical" })]);
    const original = prioritized[0].priority;
    const decayed = attention.applyAttentionDecay(prioritized, 5);
    assert.ok(decayed[0].priority < original, `Decayed (${decayed[0].priority}) should be < original (${original})`);
  });

  test("zero decay keeps priority", () => {
    const attention = new AttentionSystem({ attentionDecay: 0 });
    const prioritized = attention.prioritizeEvents([makeEvent()]);
    const decayed = attention.applyAttentionDecay(prioritized, 100);
    assert.equal(decayed[0].priority, prioritized[0].priority);
  });

  test("decay never goes below 0", () => {
    const attention = new AttentionSystem({ attentionDecay: 0.99 });
    const prioritized = attention.prioritizeEvents([makeEvent()]);
    const decayed = attention.applyAttentionDecay(prioritized, 1000);
    assert.ok(decayed[0].priority >= 0);
  });
});

describe("AttentionSystem - Serialization", () => {
  test("serialize and deserialize preserves state", () => {
    const attention = new AttentionSystem({ maxEventsPerTick: 15 });
    attention.setTypeImportance("collision.enter", 0.7);
    attention.tick(); // currentTick = 1
    const data = attention.serialize();

    const attention2 = new AttentionSystem();
    attention2.deserialize(data as Record<string, unknown>);
    assert.equal(attention2.config.maxEventsPerTick, 15);
    assert.equal(attention2.getTypeImportance("collision.enter"), 0.7);
  });

  test("stop clears state", () => {
    const attention = new AttentionSystem();
    attention.setTypeImportance("test", 0.5);
    attention.stop();
    assert.equal(attention.getTypeImportance("test"), 0);
  });
});
