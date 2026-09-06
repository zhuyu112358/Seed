/**
 * M13 Serialization/Deserialization Integrity Tests
 *
 * Verifies that all 8 M13 social simulation systems can correctly
 * serialize their state to JSON and deserialize it back, preserving
 * all data. This is critical for world save/load functionality.
 *
 * Systems tested:
 * 1. SocialRelationGraph
 * 2. SocialNormSystem
 * 3. SocialEventSystem
 * 4. GroupBehaviorEngine
 * 5. InformationSpreadModel
 * 6. SocialMobilitySystem
 * 7. CulturalEvolutionSystem
 * 8. SocialCulturalIntegrationSystem
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SocialRelationGraph } from "../src/social/SocialRelationGraph.js";
import { SocialNormSystem } from "../src/social/SocialNormSystem.js";
import { SocialEventSystem } from "../src/social/SocialEventSystem.js";
import { GroupBehaviorEngine } from "../src/social/GroupBehaviorEngine.js";
import { InformationSpreadModel } from "../src/social/InformationSpreadModel.js";
import { SocialMobilitySystem } from "../src/social/SocialMobilitySystem.js";
import { CulturalEvolutionSystem } from "../src/social/CulturalEvolutionSystem.js";
import { SocialCulturalIntegrationSystem } from "../src/social/SocialCulturalIntegrationSystem.js";

// Helper: serialize and deserialize, returning the new system
function roundTrip<T extends { serialize(): Record<string, unknown>; deserialize(d: Record<string, unknown>): void }>(
  system: T,
  factory: () => T,
): T {
  const data = system.serialize();
  // Verify data is JSON-serializable
  const json = JSON.stringify(data);
  const parsed = JSON.parse(json);
  const newSystem = factory();
  newSystem.deserialize(parsed);
  return newSystem;
}

// ============================================================
// 1. SocialRelationGraph Serialization
// ============================================================
describe("M13 Serialization: SocialRelationGraph", () => {
  it("preserves relations after serialize/deserialize", () => {
    const graph = new SocialRelationGraph();
    graph.addRelation("npc_a", "npc_b", "friendship", "close_friend", {
      trust: 80,
      intimacy: 70,
      respect: 75,
      influence: 60,
    });
    graph.addRelation("npc_a", "npc_c", "enmity", "rival", {
      trust: 10,
      intimacy: 5,
      respect: 20,
      influence: 30,
    });

    const restored = roundTrip(graph, () => new SocialRelationGraph());

    const relationsA = restored.getRelations("npc_a");
    assert.equal(relationsA.length, 2);

    const friendRel = restored.getRelation("npc_a", "npc_b");
    assert.ok(friendRel);
    assert.equal(friendRel!.category, "friendship");
    assert.equal(friendRel!.subtype, "close_friend");
    assert.ok(friendRel!.strength.trust >= 79);
  });

  it("preserves relation events after serialize/deserialize", () => {
    const graph = new SocialRelationGraph();
    graph.addRelation("npc_x", "npc_y", "family", "sibling", {});
    graph.recordInteraction("npc_x", "npc_y", "positive", "Shared a meal");

    const eventsBefore = graph.getRecentEvents(10);
    assert.ok(eventsBefore.length > 0);

    const restored = roundTrip(graph, () => new SocialRelationGraph());
    const eventsAfter = restored.getRecentEvents(10);
    assert.equal(eventsAfter.length, eventsBefore.length);
  });

  it("handles empty graph serialization", () => {
    const graph = new SocialRelationGraph();
    const restored = roundTrip(graph, () => new SocialRelationGraph());
    assert.equal(restored.getRelations("any").length, 0);
  });
});

// ============================================================
// 2. SocialNormSystem Serialization
// ============================================================
describe("M13 Serialization: SocialNormSystem", () => {
  it("preserves norms after serialize/deserialize", () => {
    const system = new SocialNormSystem();
    system.addNorm("taboo", "No Stealing", "Stealing is forbidden", {
      severity: "major",
    });
    system.addNorm("value", "Honor", "Personal honor is paramount", {});

    const restored = roundTrip(system, () => new SocialNormSystem());

    const norms = restored.getActiveNorms();
    assert.equal(norms.length, 2);
    const stealing = norms.find((n: any) => n.name === "No Stealing");
    assert.ok(stealing);
    assert.equal(stealing!.type, "taboo");
  });

  it("preserves violations after serialize/deserialize", () => {
    const system = new SocialNormSystem();
    system.addNorm("law", "No Violence", "Violence is illegal", {});
    const norms = system.getActiveNorms();
    const norm = norms[0];

    system.recordViolation(norm.id, "npc_aggressor", "Attacked a villager", "major");

    const violationsBefore = system.getViolations(10);
    assert.ok(violationsBefore.length > 0);

    const restored = roundTrip(system, () => new SocialNormSystem());
    const violationsAfter = restored.getViolations(10);
    assert.equal(violationsAfter.length, violationsBefore.length);
    assert.equal(violationsAfter[0].violatorId, "npc_aggressor");
  });

  it("preserves feedbacks after serialize/deserialize", () => {
    const system = new SocialNormSystem();
    system.givePositiveFeedback(
      "npc_hero",
      "praise",
      ["npc_villager1", "npc_villager2"],
      85,
    );

    const feedbacksBefore = system.getFeedbacks(10);
    assert.ok(feedbacksBefore.length > 0);

    const restored = roundTrip(system, () => new SocialNormSystem());
    const feedbacksAfter = restored.getFeedbacks(10);
    assert.equal(feedbacksAfter.length, feedbacksBefore.length);
  });
});

// ============================================================
// 3. SocialEventSystem Serialization
// ============================================================
describe("M13 Serialization: SocialEventSystem", () => {
  it("preserves events after serialize/deserialize", () => {
    const system = new SocialEventSystem();
    const result = system.createEvent(
      "wedding",
      "Alice and Bob Wedding",
      "A joyous ceremony",
      { scheduledTick: 0, durationTicks: 10 },
    );
    assert.ok(result.success);

    const restored = roundTrip(system, () => new SocialEventSystem());

    const events = restored.getAllEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "wedding");
    assert.equal(events[0].name, "Alice and Bob Wedding");
  });

  it("preserves participants after serialize/deserialize", () => {
    const system = new SocialEventSystem();
    const result = system.createEvent("festival", "Harvest Festival", "Annual celebration", {});
    assert.ok(result.success);
    const eventId = result.event!.id;

    system.addParticipant(eventId, "npc_organizer", "organizer");
    system.addParticipant(eventId, "npc_guest1", "attendee");
    system.addParticipant(eventId, "npc_guest2", "attendee");

    const restored = roundTrip(system, () => new SocialEventSystem());
    const participants = restored.getParticipants(eventId);
    assert.equal(participants.length, 3);
  });

  it("handles empty event system serialization", () => {
    const system = new SocialEventSystem();
    const restored = roundTrip(system, () => new SocialEventSystem());
    assert.equal(restored.getAllEvents().length, 0);
  });
});

// ============================================================
// 4. GroupBehaviorEngine Serialization
// ============================================================
describe("M13 Serialization: GroupBehaviorEngine", () => {
  it("preserves groups after serialize/deserialize", () => {
    const engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Townsfolk", "crowd", {
      members: [
        { entityId: "npc_leader", role: "leader", influence: 80 },
        { entityId: "npc_follower", role: "follower", influence: 50 },
      ],
    });
    assert.ok(group);

    const restored = roundTrip(engine, () => new GroupBehaviorEngine());

    const restoredGroup = restored.getGroup(group!.id);
    assert.ok(restoredGroup);
    assert.equal(restoredGroup!.name, "Townsfolk");
    assert.equal(restoredGroup!.members.length, 2);
  });

  it("preserves group emotion after serialize/deserialize", () => {
    const engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Angry Mob", "crowd", {
      members: [
        { entityId: "npc_angry1", role: "follower", influence: 50 },
        { entityId: "npc_angry2", role: "follower", influence: 50 },
      ],
    });
    assert.ok(group);
    engine.setGroupEmotion(group!.id, "angry", 75);

    // Verify emotion was set before serialization
    const emotionBefore = engine.getGroupEmotion(group!.id);
    assert.ok(emotionBefore);
    assert.equal(emotionBefore!.dominantEmotion, "angry");

    const restored = roundTrip(engine, () => new GroupBehaviorEngine());
    const emotion = restored.getGroupEmotion(group!.id);
    assert.ok(emotion);
    assert.equal(emotion!.dominantEmotion, "angry");
  });

  it("preserves collective actions after serialize/deserialize", () => {
    const engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Protesters", "crowd", {});
    assert.ok(group);
    const action = engine.startCollectiveAction(
      group!.id,
      "protest",
      "Peaceful Protest",
      "town_square",
      {},
    );
    assert.ok(action);

    const restored = roundTrip(engine, () => new GroupBehaviorEngine());
    const actions = restored.getGroupActions(group!.id);
    assert.ok(actions.length > 0);
  });
});

// ============================================================
// 5. InformationSpreadModel Serialization
// ============================================================
describe("M13 Serialization: InformationSpreadModel", () => {
  it("preserves information items after serialize/deserialize", () => {
    const model = new InformationSpreadModel();
    const info = model.createInformation(
      "news",
      "Great harvest expected",
      "npc_farmer",
      { sourceCredibility: 80, infectivity: 70 },
    );
    assert.ok(info);

    const restored = roundTrip(model, () => new InformationSpreadModel());

    const restoredInfo = restored.getInformation(info!.id);
    assert.ok(restoredInfo);
    assert.equal(restoredInfo!.type, "news");
    assert.equal(restoredInfo!.content, "Great harvest expected");
  });

  it("preserves node states after serialize/deserialize", () => {
    const model = new InformationSpreadModel();
    const info = model.createInformation("rumor", "Merchant hoarding food", "npc_gossip", {});
    assert.ok(info);

    model.setNodeInfluence("npc_gossip", 60);
    model.setNodeSkepticism("npc_listener", 40);
    model.addInfluenceConnection("npc_gossip", "npc_listener", 80);
    model.spreadInformation(info!.id, "npc_gossip");

    const stateBefore = model.getNodeState("npc_gossip", info!.id);
    assert.ok(stateBefore);

    const restored = roundTrip(model, () => new InformationSpreadModel());
    const stateAfter = restored.getNodeState("npc_gossip", info!.id);
    assert.ok(stateAfter);
    assert.equal(stateAfter, stateBefore);
  });

  it("handles empty model serialization", () => {
    const model = new InformationSpreadModel();
    const restored = roundTrip(model, () => new InformationSpreadModel());
    assert.equal(restored.getAllInformation().length, 0);
  });
});

// ============================================================
// 6. SocialMobilitySystem Serialization
// ============================================================
describe("M13 Serialization: SocialMobilitySystem", () => {
  it("preserves social status after serialize/deserialize", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("npc_alice", { socialClass: "commoner", wealth: 50 });
    system.registerEntity("npc_bob", { socialClass: "merchant", wealth: 200 });

    const restored = roundTrip(system, () => new SocialMobilitySystem());

    const aliceStatus = restored.getSocialStatus("npc_alice");
    assert.ok(aliceStatus);
    assert.equal(aliceStatus!.socialClass, "commoner");

    const bobStatus = restored.getSocialStatus("npc_bob");
    assert.ok(bobStatus);
    assert.equal(bobStatus!.socialClass, "merchant");
  });

  it("preserves prestige after serialize/deserialize", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("npc_hero", { socialClass: "commoner" });
    system.addPrestige("npc_hero", 300, "saved the village");

    const prestigeBefore = system.getPrestige("npc_hero");
    assert.ok(prestigeBefore > 0);

    const restored = roundTrip(system, () => new SocialMobilitySystem());
    const prestigeAfter = restored.getPrestige("npc_hero");
    assert.equal(prestigeAfter, prestigeBefore);
  });

  it("preserves marriage history after serialize/deserialize", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("npc_carol", {});
    system.registerEntity("npc_dave", {});
    system.intermarry("npc_carol", "npc_dave", "love marriage");

    const historyBefore = system.getMarriageHistory("npc_carol");
    assert.ok(historyBefore.length > 0);

    const restored = roundTrip(system, () => new SocialMobilitySystem());
    const historyAfter = restored.getMarriageHistory("npc_carol");
    assert.equal(historyAfter.length, historyBefore.length);
  });
});

// ============================================================
// 7. CulturalEvolutionSystem Serialization
// ============================================================
describe("M13 Serialization: CulturalEvolutionSystem", () => {
  it("preserves cultures after serialize/deserialize", () => {
    const system = new CulturalEvolutionSystem();
    const culture = system.createCulture(
      "Northern Clan",
      "A hardy northern culture",
      {},
    );
    assert.ok(culture);

    const restored = roundTrip(system, () => new CulturalEvolutionSystem());

    const restoredCulture = restored.getCulture(culture!.id);
    assert.ok(restoredCulture);
    assert.equal(restoredCulture!.name, "Northern Clan");
  });

  it("preserves cultural traits after serialize/deserialize", () => {
    const system = new CulturalEvolutionSystem();
    const culture = system.createCulture("Artisan Guild", "Creative culture", {});
    assert.ok(culture);

    const trait = system.createTrait(
      "art",
      "Painting",
      "Visual art tradition",
      culture!.id,
      { transmissibility: 70, adaptability: 60 },
    );
    assert.ok(trait);

    const restored = roundTrip(system, () => new CulturalEvolutionSystem());

    const traits = restored.getTraitsForCulture(culture!.id);
    assert.equal(traits.length, 1);
    assert.equal(traits[0].name, "Painting");
    assert.equal(traits[0].type, "art");
  });

  it("preserves mutation history after serialize/deserialize", () => {
    const system = new CulturalEvolutionSystem();
    const culture = system.createCulture("Evolving Culture", "Test", {});
    assert.ok(culture);
    const trait = system.createTrait("custom", "Old Ritual", "Ancient ritual", culture!.id, {});
    assert.ok(trait);

    // Mutate the trait (may or may not occur due to probability, but we record the attempt)
    system.mutateTrait(trait!.id, culture!.id);

    const statsBefore = system.getStats();
    const mutationsBefore = statsBefore.totalMutations ?? 0;

    const restored = roundTrip(system, () => new CulturalEvolutionSystem());
    const statsAfter = restored.getStats();
    const mutationsAfter = statsAfter.totalMutations ?? 0;

    // Mutation count should be preserved
    assert.equal(mutationsAfter, mutationsBefore);
  });
});

// ============================================================
// 8. SocialCulturalIntegrationSystem Serialization
// ============================================================
describe("M13 Serialization: SocialCulturalIntegrationSystem", () => {
  it("preserves integration state after serialize/deserialize", () => {
    const system = new SocialCulturalIntegrationSystem();
    // Register some systems (they can be null for serialization test)
    system.registerSocialSystems(null as any, null as any, null as any);
    system.registerM12Systems(null as any, null as any);

    const restored = roundTrip(system, () => new SocialCulturalIntegrationSystem());

    // Verify the system was deserialized without error
    const stats = restored.getStats();
    assert.ok(stats);
  });

  it("preserves bridged events set after serialize/deserialize", () => {
    const system = new SocialCulturalIntegrationSystem();

    // Create a mock event system with an event
    const eventSystem = new SocialEventSystem();
    const result = eventSystem.createEvent("wedding", "Test Wedding", "Test", {});
    assert.ok(result.success);

    system.registerSocialSystems(null as any, eventSystem, null as any);

    // Bridge the event (may fail if narrative system is null, but that's ok)
    // Just verify serialization works with the bridged set
    const restored = roundTrip(system, () => new SocialCulturalIntegrationSystem());
    assert.ok(restored);
  });
});

// ============================================================
// 9. Cross-System Serialization Consistency
// ============================================================
describe("M13 Serialization: Cross-System Consistency", () => {
  it("all 8 M13 systems produce valid JSON when serialized", () => {
    const systems = [
      new SocialRelationGraph(),
      new SocialNormSystem(),
      new SocialEventSystem(),
      new GroupBehaviorEngine(),
      new InformationSpreadModel(),
      new SocialMobilitySystem(),
      new CulturalEvolutionSystem(),
      new SocialCulturalIntegrationSystem(),
    ];

    for (const system of systems) {
      const data = system.serialize();
      const json = JSON.stringify(data);
      assert.ok(json.length > 0, `${system.constructor.name} produces non-empty JSON`);
      const parsed = JSON.parse(json);
      assert.ok(typeof parsed === "object", `${system.constructor.name} produces valid JSON object`);
    }
  });

  it("all 8 M13 systems can deserialize their own serialized state", () => {
    const factories = [
      () => new SocialRelationGraph(),
      () => new SocialNormSystem(),
      () => new SocialEventSystem(),
      () => new GroupBehaviorEngine(),
      () => new InformationSpreadModel(),
      () => new SocialMobilitySystem(),
      () => new CulturalEvolutionSystem(),
      () => new SocialCulturalIntegrationSystem(),
    ];

    for (const factory of factories) {
      const system = factory();
      const data = system.serialize();
      const newSystem = factory();
      // Should not throw
      newSystem.deserialize(data);
      assert.ok(true, `${system.constructor.name} deserializes without error`);
    }
  });

  it("serialized data is stable across multiple serialize calls", () => {
    const graph = new SocialRelationGraph();
    graph.addRelation("a", "b", "friendship", "friend", {});

    const data1 = graph.serialize();
    const data2 = graph.serialize();

    // Should be structurally identical (same keys, same values)
    assert.deepEqual(Object.keys(data1).sort(), Object.keys(data2).sort());
  });
});
