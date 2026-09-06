// Tests for M12 Phase 1: NPC Memory System.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NPCMemorySystem } from "../src/npc/NPCMemorySystem.js";
import { DEFAULT_NPC_MEMORY_CONFIG, IMPORTANCE_WEIGHT } from "../src/npc/MemoryTypes.js";
import { World } from "../src/engine/World.js";

describe("NPCMemorySystem - Memory Creation", () => {
  test("addMemory creates a memory entry", () => {
    const system = new NPCMemorySystem();
    const memory = system.addMemory("npc_1", "interaction", "Talked to merchant", "medium");
    assert.ok(memory.id.startsWith("memory_"));
    assert.equal(memory.type, "interaction");
    assert.equal(memory.text, "Talked to merchant");
    assert.equal(memory.importance, "medium");
    assert.equal(memory.decay, 1.0);
    assert.equal(memory.accessCount, 0);
  });

  test("addMemory with related entities and location", () => {
    const system = new NPCMemorySystem();
    const memory = system.addMemory("npc_1", "combat" as any, "Fought bandit", "high", {
      relatedEntities: ["bandit_1", "guard_2"],
      location: { x: 10, z: 20 },
    });
    assert.equal(memory.relatedEntities.length, 2);
    assert.ok(memory.relatedEntities.includes("bandit_1"));
    assert.equal(memory.location?.x, 10);
    assert.equal(memory.location?.z, 20);
  });

  test("high importance memory is auto-promoted to long-term", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "observation", "Saw a dragon", "critical");
    const stats = system.getMemoryStats("npc_1");
    assert.ok(stats.longTermCount >= 1, "Critical memory should be in long-term");
  });

  test("medium importance memory is NOT auto-promoted", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "observation", "Saw a bird", "medium");
    const stats = system.getMemoryStats("npc_1");
    assert.equal(stats.longTermCount, 0, "Medium memory should not be auto-promoted");
    assert.equal(stats.shortTermCount, 1);
  });

  test("maxShortTermMemories enforces limit", () => {
    const system = new NPCMemorySystem({ maxShortTermMemories: 3 });
    for (let i = 0; i < 5; i++) {
      system.addMemory("npc_1", "observation", `Memory ${i}`, "low");
    }
    const stats = system.getMemoryStats("npc_1");
    assert.equal(stats.shortTermCount, 3, "Should cap at 3 short-term memories");
  });
});

describe("NPCMemorySystem - Memory Retrieval", () => {
  test("getMemories returns all memories for entity", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "interaction", "Talked to Alice", "medium");
    system.addMemory("npc_1", "observation", "Saw a castle", "low");
    const result = system.getMemories("npc_1");
    assert.equal(result.totalCount, 2);
    assert.equal(result.memories.length, 2);
  });

  test("getMemories filters by type", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "interaction", "Talked", "medium");
    system.addMemory("npc_1", "observation", "Saw", "low");
    system.addMemory("npc_1", "interaction", "Traded", "high");
    const result = system.getMemories("npc_1", { type: "interaction" });
    assert.equal(result.totalCount, 2);
  });

  test("getMemories filters by importance", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "observation", "Trivial", "trivial");
    system.addMemory("npc_1", "observation", "Important", "high");
    const result = system.getMemories("npc_1", { importance: "high" });
    assert.equal(result.totalCount, 1);
    assert.equal(result.memories[0].text, "Important");
  });

  test("getMemories filters by related entity", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "interaction", "Talked to Alice", "medium", { relatedEntities: ["alice"] });
    system.addMemory("npc_1", "interaction", "Talked to Bob", "medium", { relatedEntities: ["bob"] });
    const result = system.getMemories("npc_1", { relatedEntity: "alice" });
    assert.equal(result.totalCount, 1);
    assert.ok(result.memories[0].text.includes("Alice"));
  });

  test("getMemories with limit", () => {
    const system = new NPCMemorySystem();
    for (let i = 0; i < 10; i++) {
      system.addMemory("npc_1", "observation", `Memory ${i}`, "low");
    }
    const result = system.getMemories("npc_1", { limit: 3 });
    assert.equal(result.memories.length, 3);
    assert.equal(result.totalCount, 10);
  });

  test("getMemories access refreshes decay", () => {
    const system = new NPCMemorySystem({ accessRefreshesDecay: true });
    const memory = system.addMemory("npc_1", "observation", "Test", "low");
    // Simulate decay by ticking.
    const world = new World({ name: "test", tickRate: 60 });
    world.addSystem(system);
    for (let i = 0; i < 100; i++) world.step(1 / 60);
    const before = system.getMemoryById("npc_1", memory.id)?.decay ?? 0;
    system.getMemories("npc_1");
    const after = system.getMemoryById("npc_1", memory.id)?.decay ?? 0;
    assert.ok(after >= before, "Access should refresh decay");
  });

  test("getMemoryById returns specific memory", () => {
    const system = new NPCMemorySystem();
    const memory = system.addMemory("npc_1", "observation", "Specific", "medium");
    const found = system.getMemoryById("npc_1", memory.id);
    assert.ok(found);
    assert.equal(found?.text, "Specific");
  });
});

describe("NPCMemorySystem - Memory Management", () => {
  test("promoteToLongTerm moves memory to long-term", () => {
    const system = new NPCMemorySystem();
    const memory = system.addMemory("npc_1", "observation", "Important discovery", "medium");
    const before = system.getMemoryStats("npc_1");
    assert.equal(before.longTermCount, 0);
    const promoted = system.promoteToLongTerm("npc_1", memory.id);
    assert.equal(promoted, true);
    const after = system.getMemoryStats("npc_1");
    assert.ok(after.longTermCount >= 1);
  });

  test("forgetMemory removes a memory", () => {
    const system = new NPCMemorySystem();
    const memory = system.addMemory("npc_1", "observation", "Forget me", "low");
    const before = system.getMemoryStats("npc_1");
    assert.equal(before.shortTermCount, 1);
    const forgotten = system.forgetMemory("npc_1", memory.id);
    assert.equal(forgotten, true);
    const after = system.getMemoryStats("npc_1");
    assert.equal(after.shortTermCount, 0);
  });

  test("clearMemories removes all memories for entity", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "observation", "One", "low");
    system.addMemory("npc_1", "observation", "Two", "high");
    system.clearMemories("npc_1");
    const stats = system.getMemoryStats("npc_1");
    assert.equal(stats.totalCount, 0);
  });

  test("getMemoryStats returns correct statistics", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "interaction", "Talked", "medium");
    system.addMemory("npc_1", "observation", "Saw", "low");
    system.addMemory("npc_1", "interaction", "Traded", "high");
    const stats = system.getMemoryStats("npc_1");
    assert.equal(stats.totalCount, 3);
    assert.equal(stats.byType["interaction"], 2);
    assert.equal(stats.byType["observation"], 1);
    assert.ok(stats.avgDecay > 0);
  });
});

describe("NPCMemorySystem - Decay and Forgetting", () => {
  test("memories decay over time", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCMemorySystem({ shortTermDecayRate: 0.01, autoForget: false });
    world.addSystem(system);
    const memory = system.addMemory("npc_1", "observation", "Test", "low");
    assert.equal(memory.decay, 1.0);
    for (let i = 0; i < 50; i++) world.step(1 / 60);
    const updated = system.getMemoryById("npc_1", memory.id);
    assert.ok(updated && updated.decay < 1.0, `Decay should decrease (was ${updated?.decay})`);
  });

  test("high importance memories decay slower", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCMemorySystem({ shortTermDecayRate: 0.01, autoForget: false });
    world.addSystem(system);
    const lowMem = system.addMemory("npc_1", "observation", "Low", "low");
    const highMem = system.addMemory("npc_1", "observation", "High", "high");
    for (let i = 0; i < 50; i++) world.step(1 / 60);
    const lowUpdated = system.getMemoryById("npc_1", lowMem.id);
    const highUpdated = system.getMemoryById("npc_1", highMem.id);
    assert.ok(highUpdated!.decay > lowUpdated!.decay,
      `High importance (${highUpdated?.decay}) should decay slower than low (${lowUpdated?.decay})`);
  });

  test("autoForget removes memories below threshold", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCMemorySystem({
      shortTermDecayRate: 0.1,
      autoForget: true,
      forgetThreshold: 0.5,
    });
    world.addSystem(system);
    system.addMemory("npc_1", "observation", "Forgettable", "trivial");
    for (let i = 0; i < 10; i++) world.step(1 / 60);
    const stats = system.getMemoryStats("npc_1");
    assert.equal(stats.shortTermCount, 0, "Trivial memory should be auto-forgotten");
  });
});

describe("NPCMemorySystem - Events", () => {
  test("memory.created event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCMemorySystem();
    world.addSystem(system);
    world.step(1 / 60); // Initialize events reference.

    let eventReceived = false;
    world.events.on("memory.created", () => { eventReceived = true; });
    system.addMemory("npc_1", "observation", "Test", "medium");
    assert.equal(eventReceived, true);
  });

  test("memory.promoted event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCMemorySystem();
    world.addSystem(system);
    world.step(1 / 60);

    let promoted = false;
    world.events.on("memory.promoted", () => { promoted = true; });
    const memory = system.addMemory("npc_1", "observation", "Test", "medium");
    system.promoteToLongTerm("npc_1", memory.id);
    assert.equal(promoted, true);
  });
});

describe("NPCMemorySystem - Serialization", () => {
  test("serialize and deserialize preserves memories", () => {
    const system = new NPCMemorySystem();
    system.addMemory("npc_1", "interaction", "Talked", "medium");
    system.addMemory("npc_1", "observation", "Saw", "high");

    const data = system.serialize();
    const system2 = new NPCMemorySystem();
    system2.deserialize(data as Record<string, unknown>);

    const stats = system2.getMemoryStats("npc_1");
    assert.equal(stats.totalCount, 2);
  });
});

describe("NPCMemorySystem - Configuration", () => {
  test("DEFAULT_NPC_MEMORY_CONFIG has expected values", () => {
    assert.equal(DEFAULT_NPC_MEMORY_CONFIG.maxShortTermMemories, 50);
    assert.equal(DEFAULT_NPC_MEMORY_CONFIG.maxLongTermMemories, 200);
    assert.equal(DEFAULT_NPC_MEMORY_CONFIG.longTermThreshold, "high");
    assert.equal(DEFAULT_NPC_MEMORY_CONFIG.autoForget, true);
  });

  test("IMPORTANCE_WEIGHT has correct values", () => {
    assert.equal(IMPORTANCE_WEIGHT["trivial"], 0.5);
    assert.equal(IMPORTANCE_WEIGHT["low"], 0.75);
    assert.equal(IMPORTANCE_WEIGHT["medium"], 1.0);
    assert.equal(IMPORTANCE_WEIGHT["high"], 1.5);
    assert.equal(IMPORTANCE_WEIGHT["critical"], 2.0);
  });
});
