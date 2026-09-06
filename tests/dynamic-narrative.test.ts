// Tests for M12 Phase 6: Dynamic Narrative Generation.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DynamicNarrativeSystem } from "../src/narrative/DynamicNarrativeSystem.js";
import { DEFAULT_DYNAMIC_NARRATIVE_CONFIG } from "../src/narrative/DynamicNarrativeTypes.js";
import type { DynamicNarrativeArc, DynamicNarrativeChoice } from "../src/narrative/DynamicNarrativeTypes.js";
import { World } from "../src/engine/World.js";

// Helper: create a simple narrative arc.
function createSimpleArc(): DynamicNarrativeArc {
  return {
    id: "arc_1",
    name: "The Journey",
    description: "A hero's journey",
    status: "available",
    phases: [
      { id: "phase_1", name: "Call to Adventure", description: "The hero receives the call" },
      { id: "phase_2", name: "The Road of Trials", description: "The hero faces challenges" },
      { id: "phase_3", name: "The Return", description: "The hero returns home", isFinal: true },
    ],
    currentPhaseIndex: 0,
    priority: 10,
    participants: ["hero_1"],
  };
}

describe("DynamicNarrativeSystem - Arc Management", () => {
  test("addArc and getArc", () => {
    const system = new DynamicNarrativeSystem();
    const arc = createSimpleArc();
    system.addArc(arc);
    const retrieved = system.getArc("arc_1");
    assert.equal(retrieved?.name, "The Journey");
    assert.equal(retrieved?.phases.length, 3);
  });

  test("getAllArcs returns all arcs", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc());
    system.addArc({ ...createSimpleArc(), id: "arc_2", name: "Second Arc" });
    assert.equal(system.getAllArcs().length, 2);
  });

  test("getArcsByStatus filters correctly", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc()); // available
    system.addArc({ ...createSimpleArc(), id: "arc_2", status: "active" });
    assert.equal(system.getArcsByStatus("available").length, 1);
    assert.equal(system.getArcsByStatus("active").length, 1);
  });

  test("getCurrentPhase returns current phase", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc());
    const phase = system.getCurrentPhase("arc_1");
    assert.equal(phase?.id, "phase_1");
  });

  test("startArc sets status to active", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc());
    assert.equal(system.startArc("arc_1"), true);
    assert.equal(system.getArc("arc_1")?.status, "active");
    assert.equal(system.getArc("arc_1")?.currentPhaseIndex, 0);
  });

  test("startArc returns false if already active", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc({ ...createSimpleArc(), status: "active" });
    assert.equal(system.startArc("arc_1"), false);
  });

  test("advanceArc moves to next phase", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc());
    system.startArc("arc_1");
    const result = system.advanceArc("arc_1");
    assert.equal(result.advanced, true);
    assert.equal(result.newPhaseId, "phase_2");
    assert.equal(system.getArc("arc_1")?.currentPhaseIndex, 1);
  });

  test("advanceArc completes arc at final phase", () => {
    const system = new DynamicNarrativeSystem();
    const arc = createSimpleArc();
    arc.currentPhaseIndex = 2; // Last phase.
    arc.status = "active";
    system.addArc(arc);
    const result = system.advanceArc("arc_1");
    assert.equal(result.advanced, true);
    assert.equal(result.reason, "arc_completed");
    assert.equal(system.getArc("arc_1")?.status, "completed");
  });

  test("advanceArc returns failure if arc not active", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc()); // available, not active
    const result = system.advanceArc("arc_1");
    assert.equal(result.advanced, false);
    assert.equal(result.reason, "arc_not_active");
  });

  test("failArc sets status to failed", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc({ ...createSimpleArc(), status: "active" });
    assert.equal(system.failArc("arc_1", "hero died"), true);
    assert.equal(system.getArc("arc_1")?.status, "failed");
  });

  test("updateArc modifies arc properties", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc());
    system.updateArc("arc_1", { priority: 20, name: "Updated Journey" });
    assert.equal(system.getArc("arc_1")?.priority, 20);
    assert.equal(system.getArc("arc_1")?.name, "Updated Journey");
  });
});

describe("DynamicNarrativeSystem - Event Chain", () => {
  test("recordEvent creates and stores event", () => {
    const system = new DynamicNarrativeSystem();
    const event = system.recordEvent("plot", "Hero Arrives", "The hero arrives at the village");
    assert.ok(event.id.startsWith("narrative_event_"));
    assert.equal(event.type, "plot");
    assert.equal(event.title, "Hero Arrives");
    assert.equal(system.getEvents().length, 1);
  });

  test("recordEvent links to previous event", () => {
    const system = new DynamicNarrativeSystem();
    const first = system.recordEvent("plot", "First", "First event");
    const second = system.recordEvent("plot", "Second", "Second event");
    assert.equal(second.previousEventId, first.id);
  });

  test("recordEvent applies consequences to narrative state", () => {
    const system = new DynamicNarrativeSystem();
    system.recordEvent("world", "Village Destroyed", "The village is destroyed", {
      consequences: { village_status: "destroyed", morale: -50 },
    });
    assert.equal(system.getState("village_status"), "destroyed");
    assert.equal(system.getState("morale"), -50);
  });

  test("getEventsByArc filters by arc", () => {
    const system = new DynamicNarrativeSystem();
    system.recordEvent("plot", "Arc Event", "In arc 1", { arcId: "arc_1" });
    system.recordEvent("plot", "Other Event", "Not in arc", { arcId: "arc_2" });
    assert.equal(system.getEventsByArc("arc_1").length, 1);
  });

  test("getEventsByType filters by type", () => {
    const system = new DynamicNarrativeSystem();
    system.recordEvent("plot", "Plot", "Plot event");
    system.recordEvent("character", "Char", "Character event");
    system.recordEvent("world", "World", "World event");
    assert.equal(system.getEventsByType("plot").length, 1);
    assert.equal(system.getEventsByType("character").length, 1);
  });

  test("getRecentEvents returns most recent N", () => {
    const system = new DynamicNarrativeSystem();
    for (let i = 0; i < 10; i++) {
      system.recordEvent("plot", `Event ${i}`, `Description ${i}`);
    }
    const recent = system.getRecentEvents(3);
    assert.equal(recent.length, 3);
    assert.equal(recent[0].title, "Event 7");
    assert.equal(recent[2].title, "Event 9");
  });

  test("getEvent returns specific event", () => {
    const system = new DynamicNarrativeSystem();
    const event = system.recordEvent("climax", "Final Battle", "The final battle");
    const retrieved = system.getEvent(event.id);
    assert.equal(retrieved?.title, "Final Battle");
  });

  test("maxEventHistory limits stored events", () => {
    const system = new DynamicNarrativeSystem({ maxEventHistory: 5 });
    for (let i = 0; i < 10; i++) {
      system.recordEvent("plot", `Event ${i}`, `Desc ${i}`);
    }
    assert.equal(system.getEvents().length, 5);
    assert.equal(system.getEvents()[0].title, "Event 5"); // Oldest kept.
  });
});

describe("DynamicNarrativeSystem - Branching Narrative", () => {
  test("createBranch creates a branch with choices", () => {
    const system = new DynamicNarrativeSystem();
    const choices: DynamicNarrativeChoice[] = [
      { id: "choice_a", text: "Accept the quest", weight: 1, consequences: { quest_accepted: true } },
      { id: "choice_b", text: "Refuse the quest", weight: 1, consequences: { quest_accepted: false } },
    ];
    const branch = system.createBranch("Will you accept the quest?", choices);
    assert.equal(branch.choices.length, 2);
    assert.equal(branch.resolved, false);
    assert.equal(system.getUnresolvedBranches().length, 1);
  });

  test("selectChoice resolves branch and applies consequences", () => {
    const system = new DynamicNarrativeSystem();
    const choices: DynamicNarrativeChoice[] = [
      { id: "choice_a", text: "Accept", weight: 1, consequences: { accepted: true } },
      { id: "choice_b", text: "Refuse", weight: 1, consequences: { accepted: false } },
    ];
    const branch = system.createBranch("Accept?", choices);
    assert.equal(system.selectChoice(branch.id, "choice_a"), true);
    assert.equal(system.getBranch(branch.id)?.resolved, true);
    assert.equal(system.getBranch(branch.id)?.selectedChoiceId, "choice_a");
    assert.equal(system.getState("accepted"), true);
  });

  test("selectChoice returns false for unknown choice", () => {
    const system = new DynamicNarrativeSystem();
    const branch = system.createBranch("Test", [{ id: "a", text: "A", weight: 1, consequences: {} }]);
    assert.equal(system.selectChoice(branch.id, "nonexistent"), false);
  });

  test("selectChoice returns false for already resolved branch", () => {
    const system = new DynamicNarrativeSystem();
    const branch = system.createBranch("Test", [
      { id: "a", text: "A", weight: 1, consequences: {} },
      { id: "b", text: "B", weight: 1, consequences: {} },
    ]);
    system.selectChoice(branch.id, "a");
    assert.equal(system.selectChoice(branch.id, "b"), false);
  });

  test("autoSelectChoice picks a choice based on weights", () => {
    const system = new DynamicNarrativeSystem();
    const branch = system.createBranch("Test", [
      { id: "a", text: "A", weight: 100, consequences: {} }, // Very likely.
      { id: "b", text: "B", weight: 1, consequences: {} },
    ]);
    const selected = system.autoSelectChoice(branch.id);
    assert.ok(selected === "a" || selected === "b");
    assert.equal(system.getBranch(branch.id)?.resolved, true);
  });

  test("autoSelectChoice returns null for resolved branch", () => {
    const system = new DynamicNarrativeSystem();
    const branch = system.createBranch("Test", [{ id: "a", text: "A", weight: 1, consequences: {} }]);
    system.selectChoice(branch.id, "a");
    assert.equal(system.autoSelectChoice(branch.id), null);
  });

  test("getUnresolvedBranches returns only unresolved", () => {
    const system = new DynamicNarrativeSystem();
    const b1 = system.createBranch("B1", [{ id: "a", text: "A", weight: 1, consequences: {} }]);
    const b2 = system.createBranch("B2", [{ id: "a", text: "A", weight: 1, consequences: {} }]);
    system.selectChoice(b1.id, "a");
    assert.equal(system.getUnresolvedBranches().length, 1);
    assert.equal(system.getUnresolvedBranches()[0].id, b2.id);
  });
});

describe("DynamicNarrativeSystem - Player Influence", () => {
  test("recordPlayerAction creates player-triggered event", () => {
    const system = new DynamicNarrativeSystem();
    const event = system.recordPlayerAction("steal_item", "Player steals the artifact", {
      reputation: -10,
      artifact_taken: true,
    }, { participants: ["player_1"] });
    assert.equal(event.playerTriggered, true);
    assert.equal(event.type, "player");
    assert.equal(system.getState("artifact_taken"), true);
  });

  test("getPlayerInfluence counts player events", () => {
    const system = new DynamicNarrativeSystem();
    system.recordPlayerAction("action1", "First", {}, { participants: ["player_1"] });
    system.recordPlayerAction("action2", "Second", {}, { participants: ["player_1"] });
    system.recordEvent("plot", "NPC event", "Not player");
    assert.equal(system.getPlayerInfluence("player_1"), 2);
  });
});

describe("DynamicNarrativeSystem - Narrative State", () => {
  test("setState and getState", () => {
    const system = new DynamicNarrativeSystem();
    system.setState("key1", "value1");
    assert.equal(system.getState("key1"), "value1");
  });

  test("getState returns undefined for missing key", () => {
    const system = new DynamicNarrativeSystem();
    assert.equal(system.getState("missing"), undefined);
  });

  test("getAllState returns all state", () => {
    const system = new DynamicNarrativeSystem();
    system.setState("a", 1);
    system.setState("b", 2);
    const all = system.getAllState();
    assert.equal(all.a, 1);
    assert.equal(all.b, 2);
  });
});

describe("DynamicNarrativeSystem - Events", () => {
  test("narrative.arc_started event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new DynamicNarrativeSystem();
    world.addSystem(system);
    system.addArc(createSimpleArc());
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("narrative.arc_started", () => { eventReceived = true; });
    system.startArc("arc_1");
    assert.equal(eventReceived, true);
  });

  test("narrative.event_recorded event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new DynamicNarrativeSystem();
    world.addSystem(system);
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("narrative.event_recorded", () => { eventReceived = true; });
    system.recordEvent("plot", "Test", "Test event");
    assert.equal(eventReceived, true);
  });

  test("narrative.branch_created and choice_selected events", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new DynamicNarrativeSystem();
    world.addSystem(system);
    world.step(1 / 60);

    let branchCreated = false;
    let choiceSelected = false;
    world.events.on("narrative.branch_created", () => { branchCreated = true; });
    world.events.on("narrative.choice_selected", () => { choiceSelected = true; });

    const branch = system.createBranch("Test", [{ id: "a", text: "A", weight: 1, consequences: {} }]);
    assert.equal(branchCreated, true);
    system.selectChoice(branch.id, "a");
    assert.equal(choiceSelected, true);
  });
});

describe("DynamicNarrativeSystem - Configuration", () => {
  test("DEFAULT_DYNAMIC_NARRATIVE_CONFIG has expected values", () => {
    assert.equal(DEFAULT_DYNAMIC_NARRATIVE_CONFIG.maxEventHistory, 500);
    assert.equal(DEFAULT_DYNAMIC_NARRATIVE_CONFIG.autoAdvanceArcs, true);
    assert.equal(DEFAULT_DYNAMIC_NARRATIVE_CONFIG.emitEvents, true);
    assert.equal(DEFAULT_DYNAMIC_NARRATIVE_CONFIG.playerInfluenceEnabled, true);
  });
});

describe("DynamicNarrativeSystem - Serialization", () => {
  test("serialize and deserialize preserves arcs, events, and state", () => {
    const system = new DynamicNarrativeSystem();
    system.addArc(createSimpleArc());
    system.recordEvent("plot", "Test Event", "Description", { consequences: { test: true } });
    system.setState("custom_key", "custom_value");

    const data = system.serialize();
    const system2 = new DynamicNarrativeSystem();
    system2.deserialize(data as Record<string, unknown>);

    assert.equal(system2.getArc("arc_1")?.name, "The Journey");
    assert.equal(system2.getEvents().length, 1);
    assert.equal(system2.getState("test"), true);
    assert.equal(system2.getState("custom_key"), "custom_value");
  });
});

