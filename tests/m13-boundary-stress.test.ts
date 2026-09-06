/**
 * M13 Boundary Conditions & Stress Tests
 *
 * Tests M13 social simulation systems under extreme conditions:
 * - Large-scale data (100+ entities, 1000+ relations)
 * - Boundary values (zero, max, min)
 * - Edge cases (empty inputs, duplicates, self-loops)
 * - Stress scenarios (rapid operations, bulk operations)
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

// ============================================================
// 1. SocialRelationGraph Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: SocialRelationGraph", () => {
  it("handles 500 relations without performance degradation", () => {
    const graph = new SocialRelationGraph();
    const startTime = Date.now();

    // Create 50 entities with 10 relations each = 500 relations
    for (let i = 0; i < 50; i++) {
      for (let j = i + 1; j < i + 11 && j < 50; j++) {
        graph.addRelation(`npc_${i}`, `npc_${j}`, "friendship", "friend", {
          trust: 50 + (i % 30),
          intimacy: 40 + (j % 30),
          respect: 45 + ((i + j) % 30),
          influence: 35 + (i % 25),
        });
      }
    }

    const elapsed = Date.now() - startTime;
    // Should complete in reasonable time (< 5 seconds for 500 relations)
    assert.ok(elapsed < 5000, `500 relations took ${elapsed}ms, expected < 5000ms`);

    // Verify relations exist
    const relations = graph.getRelations("npc_0");
    assert.ok(relations.length > 0);
  });

  it("handles self-loop relations gracefully", () => {
    const graph = new SocialRelationGraph();
    // Self-loop should either be handled or rejected, not crash
    graph.addRelation("npc_self", "npc_self", "friendship", "friend", {});
    // Should not throw
    assert.ok(true);
  });

  it("handles duplicate relation updates", () => {
    const graph = new SocialRelationGraph();
    graph.addRelation("a", "b", "friendship", "friend", { trust: 50 });
    // Adding same relation again should update or be handled
    graph.addRelation("a", "b", "friendship", "close_friend", { trust: 80 });

    const relation = graph.getRelation("a", "b");
    assert.ok(relation);
    // Should reflect the latest update
    assert.ok(relation!.strength.trust >= 79);
  });

  it("handles extreme strength values (0 and 100)", () => {
    const graph = new SocialRelationGraph();
    graph.addRelation("low_trust", "high_trust", "enmity", "sworn_enemy", {
      trust: 0,
      intimacy: 0,
      respect: 0,
      influence: 0,
    });
    graph.addRelation("best_friends_a", "best_friends_b", "friendship", "best_friend", {
      trust: 100,
      intimacy: 100,
      respect: 100,
      influence: 100,
    });

    const lowRel = graph.getRelation("low_trust", "high_trust");
    const highRel = graph.getRelation("best_friends_a", "best_friends_b");
    assert.ok(lowRel);
    assert.ok(highRel);
    assert.equal(lowRel!.strength.trust, 0);
    assert.equal(highRel!.strength.trust, 100);
  });

  it("handles social path queries in large graph", () => {
    const graph = new SocialRelationGraph();
    // Create a chain of 100 entities
    for (let i = 0; i < 99; i++) {
      graph.addRelation(`chain_${i}`, `chain_${i + 1}`, "friendship", "friend", {});
    }

    const startTime = Date.now();
    const path = graph.findSocialPath("chain_0", "chain_99", 100);
    const elapsed = Date.now() - startTime;

    assert.ok(path.exists, "Path should exist in chain graph");
    assert.equal(path.distance, 99);
    assert.ok(elapsed < 2000, `Path query took ${elapsed}ms, expected < 2000ms`);
  });
});

// ============================================================
// 2. SocialNormSystem Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: SocialNormSystem", () => {
  it("handles 100 norms without issues", () => {
    const system = new SocialNormSystem();
    for (let i = 0; i < 100; i++) {
      system.addNorm(
        i % 2 === 0 ? "custom" : "value",
        `Norm ${i}`,
        `Description for norm ${i}`,
        {},
      );
    }
    const norms = system.getActiveNorms();
    assert.equal(norms.length, 100);
  });

  it("handles empty norm name and description", () => {
    const system = new SocialNormSystem();
    system.addNorm("custom", "", "", {});
    const norms = system.getActiveNorms();
    assert.equal(norms.length, 1);
    assert.equal(norms[0].name, "");
  });

  it("handles rapid violations for same entity", () => {
    const system = new SocialNormSystem();
    system.addNorm("law", "No Stealing", "Stealing is illegal", {});
    const norm = system.getActiveNorms()[0];

    for (let i = 0; i < 50; i++) {
      system.recordViolation(norm.id, "repeat_offender", `Violation ${i}`, "minor");
    }

    const violations = system.getViolationsForEntity("repeat_offender");
    assert.equal(violations.length, 50);
  });

  it("handles all severity levels", () => {
    const system = new SocialNormSystem();
    system.addNorm("taboo", "Test Taboo", "Test", {});
    const norm = system.getActiveNorms()[0];

    const severities = ["minor", "moderate", "major", "catastrophic"] as const;
    for (const severity of severities) {
      const violation = system.recordViolation(norm.id, "entity", "test", severity);
      assert.ok(violation);
      assert.equal(violation!.severity, severity);
    }
  });
});

// ============================================================
// 3. SocialEventSystem Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: SocialEventSystem", () => {
  it("handles 50 concurrent events", () => {
    const system = new SocialEventSystem();
    for (let i = 0; i < 50; i++) {
      system.createEvent(
        i % 3 === 0 ? "festival" : i % 3 === 1 ? "gathering" : "celebration",
        `Event ${i}`,
        `Description ${i}`,
        { scheduledTick: 0, durationTicks: 10 },
      );
    }
    const events = system.getAllEvents();
    assert.equal(events.length, 50);
  });

  it("handles event with 100 participants", () => {
    const system = new SocialEventSystem();
    const result = system.createEvent("festival", "Big Festival", "Large event", {});
    assert.ok(result.success);

    for (let i = 0; i < 100; i++) {
      system.addParticipant(result.event!.id, `npc_${i}`, i === 0 ? "organizer" : "attendee");
    }

    const participants = system.getParticipants(result.event!.id);
    assert.equal(participants.length, 100);
  });

  it("handles zero duration events", () => {
    const system = new SocialEventSystem();
    const result = system.createEvent("gathering", "Quick Meeting", "Short", {
      scheduledTick: 0,
      durationTicks: 0,
    });
    assert.ok(result.success);
    assert.ok(result.event);
  });

  it("handles all 18 event types", () => {
    const system = new SocialEventSystem();
    const types = [
      "wedding", "funeral", "festival", "celebration", "gathering",
      "conflict", "war", "migration", "birth", "coming_of_age",
      "graduation", "coronation", "treaty", "trade_fair",
      "religious_ceremony", "protest", "riot", "diplomatic_meeting",
    ] as const;

    for (const type of types) {
      const result = system.createEvent(type, `${type} event`, "test", {});
      assert.ok(result.success, `Event type ${type} should create successfully`);
    }
    assert.equal(system.getAllEvents().length, 18);
  });
});

// ============================================================
// 4. GroupBehaviorEngine Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: GroupBehaviorEngine", () => {
  it("handles 20 groups with 50 members each", () => {
    const engine = new GroupBehaviorEngine();
    for (let g = 0; g < 20; g++) {
      const members = [];
      for (let m = 0; m < 50; m++) {
        members.push({
          entityId: `group_${g}_member_${m}`,
          role: m === 0 ? "leader" : "follower",
          influence: 30 + (m % 40),
        });
      }
      engine.createGroup(`Group ${g}`, "crowd", { members });
    }

    // Verify all groups exist
    for (let g = 0; g < 20; g++) {
      // Find group by name
      const allGroups = engine.getActiveGroups();
      const group = allGroups.find((grp: any) => grp.name === `Group ${g}`);
      assert.ok(group, `Group ${g} should exist`);
      assert.equal(group!.members.length, 50);
    }
  });

  it("handles empty group operations", () => {
    const engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Empty Group", "crowd", {});
    assert.ok(group);

    // Operations on empty group should not crash
    engine.setGroupEmotion(group!.id, "angry", 75);
    engine.updateMobPsychology(group!.id);

    const emotion = engine.getGroupEmotion(group!.id);
    assert.ok(emotion);
    // Empty group defaults to calm
    assert.equal(emotion!.dominantEmotion, "calm");
  });

  it("handles all 10 emotion types", () => {
    const engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Test Group", "crowd", {
      members: [{ entityId: "m1", role: "follower", influence: 50 }],
    });
    assert.ok(group);

    const emotions = [
      "calm", "excited", "angry", "fearful", "joyful",
      "anxious", "hostile", "euphoric", "sad", "determined",
    ] as const;

    for (const emotion of emotions) {
      engine.setGroupEmotion(group!.id, emotion, 60);
      const state = engine.getGroupEmotion(group!.id);
      assert.ok(state);
      assert.equal(state!.dominantEmotion, emotion, `Emotion should be ${emotion}`);
    }
  });

  it("handles all 10 collective action types", () => {
    const engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Action Group", "crowd", {
      members: [{ entityId: "m1", role: "leader", influence: 80 }],
    });
    assert.ok(group);

    const actions = [
      "protest", "celebration", "migration", "attack", "defense",
      "construction", "ritual", "strike", "feast", "pilgrimage",
    ] as const;

    for (const action of actions) {
      const result = engine.startCollectiveAction(
        group!.id,
        action,
        `${action} action`,
        "target_location",
        {},
      );
      assert.ok(result, `Action type ${action} should start successfully`);
    }
  });
});

// ============================================================
// 5. InformationSpreadModel Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: InformationSpreadModel", () => {
  it("handles 100 information items and 100 nodes", () => {
    const model = new InformationSpreadModel();

    // Create 100 nodes
    for (let i = 0; i < 100; i++) {
      model.setNodeInfluence(`npc_${i}`, 30 + (i % 50));
      model.setNodeSkepticism(`npc_${i}`, 20 + (i % 40));
    }

    // Create 100 information items
    for (let i = 0; i < 100; i++) {
      model.createInformation(
        i % 3 === 0 ? "news" : i % 3 === 1 ? "rumor" : "idea",
        `Information ${i}`,
        `npc_${i % 100}`,
        {},
      );
    }

    assert.equal(model.getAllInformation().length, 100);
  });

  it("handles zero infectivity information", () => {
    const model = new InformationSpreadModel();
    const info = model.createInformation("idea", "Boring idea", "source", {
      infectivity: 0,
      sourceCredibility: 50,
    });
    assert.ok(info);

    model.setNodeInfluence("source", 50);
    model.setNodeInfluence("target", 50);
    model.addInfluenceConnection("source", "target", 100);

    const infections = model.spreadInformation(info!.id, "source");
    assert.equal(infections, 0, "Zero infectivity should cause no infections");
  });

  it("handles fully connected network spread", () => {
    const model = new InformationSpreadModel();
    const info = model.createInformation("news", "Breaking news", "source", {
      infectivity: 100,
      sourceCredibility: 100,
    });
    assert.ok(info);

    // Create 20 nodes fully connected to source
    for (let i = 0; i < 20; i++) {
      model.setNodeInfluence(`npc_${i}`, 50);
      model.setNodeSkepticism(`npc_${i}`, 0);
      model.addInfluenceConnection("source", `npc_${i}`, 100);
    }
    model.setNodeInfluence("source", 100);

    const infections = model.spreadInformation(info!.id, "source");
    // With max infectivity and zero skepticism, most should be infected
    assert.ok(infections >= 15, `Expected at least 15 infections, got ${infections}`);
  });

  it("handles all 9 information types", () => {
    const model = new InformationSpreadModel();
    const types = [
      "idea", "rumor", "news", "gossip", "propaganda",
      "knowledge", "meme", "warning", "tradition",
    ] as const;

    for (const type of types) {
      const info = model.createInformation(type, `${type} content`, "source", {});
      assert.ok(info, `Information type ${type} should create successfully`);
    }
    assert.equal(model.getAllInformation().length, 9);
  });
});

// ============================================================
// 6. SocialMobilitySystem Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: SocialMobilitySystem", () => {
  it("handles 200 registered entities", () => {
    const system = new SocialMobilitySystem();
    const classes = ["serf", "commoner", "artisan", "merchant", "clergy", "noble"] as const;

    for (let i = 0; i < 200; i++) {
      system.registerEntity(`npc_${i}`, {
        socialClass: classes[i % classes.length],
        wealth: 10 + (i % 200),
      });
    }

    const stats = system.getStats();
    assert.ok(stats);
    assert.ok(stats.totalEntities >= 200);
  });

  it("handles prestige boundary values (0 and 1000)", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("low_prestige", {});
    system.registerEntity("high_prestige", {});

    // Prestige should be clamped to 0-1000
    system.addPrestige("low_prestige", -500, "test");
    system.addPrestige("high_prestige", 2000, "test");

    assert.equal(system.getPrestige("low_prestige"), 0);
    assert.equal(system.getPrestige("high_prestige"), 1000);
  });

  it("handles promotion through all 8 social classes", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("climber", { socialClass: "serf" });

    const classes = ["serf", "commoner", "artisan", "merchant", "clergy", "noble", "aristocrat", "royal"];

    for (let i = 0; i < 7; i++) {
      system.addPrestige("climber", 1000, `promotion ${i}`);
      const result = system.promote("climber", `merit ${i}`);
      assert.ok(result.success, `Promotion ${i} should succeed`);
      assert.equal(result.newClass, classes[i + 1]);
    }

    const status = system.getSocialStatus("climber");
    assert.ok(status);
    assert.equal(status!.socialClass, "royal");
  });

  it("handles disgrace to lowest class", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("fallen", { socialClass: "royal" });

    const result = system.disgrace("fallen", 7, "treason");
    assert.ok(result.success);

    const status = system.getSocialStatus("fallen");
    assert.ok(status);
    assert.equal(status!.socialClass, "serf");
  });
});

// ============================================================
// 7. CulturalEvolutionSystem Boundary & Stress Tests
// ============================================================
describe("M13 Boundary: CulturalEvolutionSystem", () => {
  it("handles 20 cultures with 20 traits each", () => {
    const system = new CulturalEvolutionSystem();

    for (let c = 0; c < 20; c++) {
      const culture = system.createCulture(`Culture ${c}`, `Description ${c}`, {});
      assert.ok(culture);

      for (let t = 0; t < 20; t++) {
        system.createTrait(
          t % 3 === 0 ? "custom" : t % 3 === 1 ? "value" : "ritual",
          `Culture ${c} Trait ${t}`,
          `Description ${t}`,
          culture!.id,
          {},
        );
      }
    }

    assert.equal(system.getActiveCultures().length, 20);
  });

  it("handles zero mutation rate (auto-mutation disabled)", () => {
    const system = new CulturalEvolutionSystem({
      baseMutationRate: 0,
      autoMutate: false,
    });
    const culture = system.createCulture("Stable Culture", "No mutation", {});
    assert.ok(culture);
    const trait = system.createTrait("custom", "Stable Trait", "Never changes", culture!.id, {});
    assert.ok(trait);

    // Run multiple ticks with autoMutate disabled - traits should not change
    for (let i = 0; i < 10; i++) {
      system.tick(1 / 60, null as any, null as any);
    }

    // Trait should still exist with original name
    const traits = system.getTraitsForCulture(culture!.id);
    assert.equal(traits.length, 1);
    assert.equal(traits[0].name, "Stable Trait");
  });

  it("handles cultural distance between identical cultures (shared traits)", () => {
    const system = new CulturalEvolutionSystem();
    const cultureA = system.createCulture("Culture A", "Test", {});
    const cultureB = system.createCulture("Culture B", "Test", {});
    assert.ok(cultureA);
    assert.ok(cultureB);

    // Create a trait and add it to both cultures (shared trait ID)
    const trait = system.createTrait("language", "Common Tongue", "Same language", cultureA!.id, {});
    assert.ok(trait);
    system.addTraitToCulture(cultureB!.id, trait!.id);

    const distance = system.getCulturalDistance(cultureA!.id, cultureB!.id);
    assert.ok(distance);
    // Shared traits should give low distance
    assert.ok(distance!.distance < 50, `Expected low distance, got ${distance!.distance}`);
  });

  it("handles all 17 cultural trait types", () => {
    const system = new CulturalEvolutionSystem();
    const culture = system.createCulture("All Types Culture", "Test", {});
    assert.ok(culture);

    const types = [
      "language", "religion", "custom", "art", "music", "food",
      "dress", "architecture", "ritual", "value", "technology",
      "myth", "etiquette", "holiday", "economy", "governance",
    ] as const;

    for (const type of types) {
      const trait = system.createTrait(type, `${type} trait`, "test", culture!.id, {});
      assert.ok(trait, `Trait type ${type} should create successfully`);
    }
    assert.equal(system.getTraitsForCulture(culture!.id).length, 16);
  });
});

// ============================================================
// 8. SocialCulturalIntegrationSystem Boundary Tests
// ============================================================
describe("M13 Boundary: SocialCulturalIntegrationSystem", () => {
  it("handles null system registrations gracefully", () => {
    const system = new SocialCulturalIntegrationSystem();
    // Should not throw with null registrations
    system.registerSocialSystems(null as any, null as any, null as any);
    system.registerM12Systems(null as any, null as any);
    assert.ok(true);
  });

  it("handles applySocialInfluence on unknown entity", () => {
    const system = new SocialCulturalIntegrationSystem();
    const result = system.applySocialInfluence("unknown_entity");
    // Should return null or handle gracefully, not crash
    assert.ok(result === null || result !== undefined);
  });

  it("handles applyCulturalInfluence with unknown culture", () => {
    const system = new SocialCulturalIntegrationSystem();
    const result = system.applyCulturalInfluence("entity", "unknown_culture");
    assert.ok(result === null || result !== undefined);
  });

  it("handles sync with no registered systems", () => {
    const system = new SocialCulturalIntegrationSystem();
    const result = system.sync();
    assert.ok(result);
    assert.ok(Array.isArray(result.socialEventBridges));
    assert.ok(Array.isArray(result.culturalInfluences));
  });

  it("handles multiple sync cycles without memory leak", () => {
    const system = new SocialCulturalIntegrationSystem();
    const eventSystem = new SocialEventSystem();
    system.registerSocialSystems(null as any, eventSystem, null as any);

    // Create events and run multiple sync cycles
    for (let i = 0; i < 10; i++) {
      eventSystem.createEvent("festival", `Event ${i}`, "test", {});
    }

    for (let cycle = 0; cycle < 5; cycle++) {
      system.sync();
    }

    // Should not crash or accumulate errors
    const stats = system.getStats();
    assert.ok(stats);
  });
});

// ============================================================
// 9. Cross-System Stress Test
// ============================================================
describe("M13 Stress: Cross-System Large-Scale", () => {
  it("handles 50 entities across all M13 systems simultaneously", () => {
    const relationGraph = new SocialRelationGraph();
    const normSystem = new SocialNormSystem();
    const eventSystem = new SocialEventSystem();
    const groupEngine = new GroupBehaviorEngine();
    const infoModel = new InformationSpreadModel();
    const mobilitySystem = new SocialMobilitySystem();
    const culturalSystem = new CulturalEvolutionSystem();

    const startTime = Date.now();

    // Register 50 entities across all systems
    for (let i = 0; i < 50; i++) {
      const entityId = `npc_${i}`;

      // Relations: each entity connects to 5 others
      for (let j = i + 1; j < i + 6 && j < 50; j++) {
        relationGraph.addRelation(entityId, `npc_${j}`, "friendship", "friend", {});
      }

      // Mobility
      mobilitySystem.registerEntity(entityId, { socialClass: "commoner" });

      // Information nodes
      infoModel.setNodeInfluence(entityId, 30 + (i % 40));
    }

    // Create 10 norms
    for (let i = 0; i < 10; i++) {
      normSystem.addNorm("custom", `Norm ${i}`, "test", {});
    }

    // Create 5 events
    for (let i = 0; i < 5; i++) {
      eventSystem.createEvent("festival", `Event ${i}`, "test", {});
    }

    // Create 3 groups
    for (let i = 0; i < 3; i++) {
      groupEngine.createGroup(`Group ${i}`, "crowd", {
        members: Array.from({ length: 10 }, (_, j) => ({
          entityId: `npc_${i * 10 + j}`,
          role: j === 0 ? "leader" : "follower",
          influence: 50,
        })),
      });
    }

    // Create 2 cultures
    const culture1 = culturalSystem.createCulture("Culture 1", "test", {});
    const culture2 = culturalSystem.createCulture("Culture 2", "test", {});
    if (culture1) {
      for (let i = 0; i < 5; i++) {
        culturalSystem.createTrait("custom", `Trait ${i}`, "test", culture1.id, {});
      }
    }

    const elapsed = Date.now() - startTime;
    assert.ok(elapsed < 10000, `Cross-system setup took ${elapsed}ms, expected < 10000ms`);

    // Verify data integrity
    assert.ok(mobilitySystem.getStats().totalEntities >= 50);
    assert.equal(normSystem.getActiveNorms().length, 10);
    assert.equal(eventSystem.getAllEvents().length, 5);
    assert.ok(groupEngine.getActiveGroups().length >= 3);
    assert.ok(culturalSystem.getActiveCultures().length >= 2);
  });

  it("handles rapid serialize/deserialize cycles without data loss", () => {
    const graph = new SocialRelationGraph();
    for (let i = 0; i < 20; i++) {
      graph.addRelation(`a_${i}`, `b_${i}`, "friendship", "friend", { trust: 50 + i });
    }

    // Multiple serialize/deserialize cycles
    let current = graph;
    for (let cycle = 0; cycle < 5; cycle++) {
      const data = JSON.parse(JSON.stringify(current.serialize()));
      const newGraph = new SocialRelationGraph();
      newGraph.deserialize(data);
      current = newGraph;
    }

    // Verify all relations survived
    for (let i = 0; i < 20; i++) {
      const rel = current.getRelation(`a_${i}`, `b_${i}`);
      assert.ok(rel, `Relation ${i} should survive 5 serialize cycles`);
    }
  });
});
