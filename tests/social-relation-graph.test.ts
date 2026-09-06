// M13 SocialRelationGraph tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { SocialRelationGraph } from "../src/social/SocialRelationGraph.js";
import {
  DEFAULT_RELATION_STRENGTH,
  DEFAULT_SOCIAL_RELATION_CONFIG,
} from "../src/social/SocialRelationTypes.js";
import type {
  RelationCategory,
  RelationSubtype,
  RelationStrength,
} from "../src/social/SocialRelationTypes.js";

describe("SocialRelationGraph - Relation Management", () => {
  let graph: SocialRelationGraph;

  beforeEach(() => {
    graph = new SocialRelationGraph();
  });

  test("addRelation creates a new relation", () => {
    const result = graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    assert.equal(result.success, true);
    assert.ok(result.relation);
    assert.equal(result.relation!.entityA, "npc_1");
    assert.equal(result.relation!.entityB, "npc_2");
    assert.equal(result.relation!.category, "friendship");
    assert.equal(result.relation!.subtype, "friend");
    assert.equal(result.relation!.active, true);
  });

  test("addRelation emits established event", () => {
    const result = graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "relation.established");
    assert.equal(result.events[0].entityA, "npc_1");
    assert.equal(result.events[0].entityB, "npc_2");
  });

  test("addRelation with same pair updates existing relation", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    const result = graph.addRelation("npc_1", "npc_2", "romance", "lover", { intimacy: 80 });
    assert.equal(result.success, true);
    assert.equal(result.relation!.category, "romance");
    assert.equal(result.relation!.subtype, "lover");
    assert.equal(result.relation!.strength.intimacy, 80);
  });

  test("addRelation rejects self-relation", () => {
    const result = graph.addRelation("npc_1", "npc_1", "friendship", "friend");
    assert.equal(result.success, false);
    assert.equal(result.failureReason, "Cannot create relation with self");
  });

  test("getRelation returns relation if exists", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    const rel = graph.getRelation("npc_1", "npc_2");
    assert.ok(rel);
    assert.equal(rel!.category, "friendship");
  });

  test("getRelation returns undefined if not exists", () => {
    const rel = graph.getRelation("npc_1", "npc_99");
    assert.equal(rel, undefined);
  });

  test("getRelation is symmetric (order-independent)", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    const rel1 = graph.getRelation("npc_1", "npc_2");
    const rel2 = graph.getRelation("npc_2", "npc_1");
    assert.ok(rel1);
    assert.ok(rel2);
    assert.equal(rel1!.id, rel2!.id);
  });

  test("hasRelation returns correct boolean", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    assert.equal(graph.hasRelation("npc_1", "npc_2"), true);
    assert.equal(graph.hasRelation("npc_1", "npc_3"), false);
  });

  test("removeRelation removes relation", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    assert.equal(graph.removeRelation("npc_1", "npc_2"), true);
    assert.equal(graph.hasRelation("npc_1", "npc_2"), false);
  });

  test("removeRelation returns false if not exists", () => {
    assert.equal(graph.removeRelation("npc_1", "npc_99"), false);
  });

  test("getRelations returns all relations for entity", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.addRelation("npc_1", "npc_3", "enmity", "enemy");
    graph.addRelation("npc_1", "npc_4", "family", "sibling");
    const rels = graph.getRelations("npc_1");
    assert.equal(rels.length, 3);
  });

  test("getRelationsByCategory filters correctly", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.addRelation("npc_1", "npc_3", "friendship", "close_friend");
    graph.addRelation("npc_1", "npc_4", "enmity", "enemy");
    const friends = graph.getRelationsByCategory("npc_1", "friendship");
    assert.equal(friends.length, 2);
  });

  test("getConnectedEntities returns connected entity IDs", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.addRelation("npc_1", "npc_3", "enmity", "enemy");
    const connected = graph.getConnectedEntities("npc_1");
    assert.equal(connected.length, 2);
    assert.ok(connected.includes("npc_2"));
    assert.ok(connected.includes("npc_3"));
  });

  test("maxRelationsPerEntity enforces limit", () => {
    const limited = new SocialRelationGraph({ maxRelationsPerEntity: 2 });
    limited.addRelation("npc_1", "npc_2", "friendship", "friend");
    limited.addRelation("npc_1", "npc_3", "friendship", "friend");
    const result = limited.addRelation("npc_1", "npc_4", "friendship", "friend");
    assert.equal(result.success, false);
    assert.equal(result.failureReason, "Max relations per entity exceeded");
  });
});

describe("SocialRelationGraph - Multi-dimensional Strength", () => {
  let graph: SocialRelationGraph;

  beforeEach(() => {
    graph = new SocialRelationGraph();
  });

  test("new relation uses default strength", () => {
    const result = graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    assert.deepEqual(result.relation!.strength, DEFAULT_RELATION_STRENGTH);
  });

  test("addRelation accepts partial strength override", () => {
    const result = graph.addRelation("npc_1", "npc_2", "romance", "lover", {
      trust: 90,
      intimacy: 95,
    });
    assert.equal(result.relation!.strength.trust, 90);
    assert.equal(result.relation!.strength.intimacy, 95);
    assert.equal(result.relation!.strength.respect, DEFAULT_RELATION_STRENGTH.respect);
  });

  test("modifyStrength changes a dimension", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend", { trust: 50 });
    const result = graph.modifyStrength("npc_1", "npc_2", "trust", 20);
    assert.equal(result, true);
    assert.equal(graph.getRelation("npc_1", "npc_2")!.strength.trust, 70);
  });

  test("modifyStrength clamps to 0-100", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend", { trust: 90 });
    graph.modifyStrength("npc_1", "npc_2", "trust", 30);
    assert.equal(graph.getRelation("npc_1", "npc_2")!.strength.trust, 100);

    graph.modifyStrength("npc_1", "npc_2", "trust", -200);
    assert.equal(graph.getRelation("npc_1", "npc_2")!.strength.trust, 0);
  });

  test("modifyStrength returns false if relation not exists", () => {
    const result = graph.modifyStrength("npc_1", "npc_99", "trust", 10);
    assert.equal(result, false);
  });

  test("overallScore is calculated from weighted dimensions", () => {
    const result = graph.addRelation("npc_1", "npc_2", "friendship", "friend", {
      trust: 100,
      intimacy: 100,
      respect: 100,
      fear: 0,
      influence: 100,
    });
    // trust*0.3 + intimacy*0.25 + respect*0.2 + influence*0.15 + fear*0.1
    // = 30 + 25 + 20 + 15 + 0 = 90
    assert.equal(result.relation!.overallScore, 90);
  });

  test("recordInteraction updates interaction count", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.recordInteraction("npc_1", "npc_2", "conversation", { trust: 5 });
    const rel = graph.getRelation("npc_1", "npc_2")!;
    assert.equal(rel.interactionCount, 1);
    assert.equal(rel.strength.trust, 55); // default 50 + 5
  });
});

describe("SocialRelationGraph - Relation Events", () => {
  let graph: SocialRelationGraph;

  beforeEach(() => {
    graph = new SocialRelationGraph();
  });

  test("emitRelationEvent creates and records event", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    const event = graph.emitRelationEvent("relation.betrayed", "npc_1", "npc_2", "npc_1 betrayed npc_2");
    assert.ok(event);
    assert.equal(event!.type, "relation.betrayed");
    assert.equal(event!.description, "npc_1 betrayed npc_2");
  });

  test("getRecentEvents returns recent events", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.emitRelationEvent("relation.strengthened", "npc_1", "npc_2");
    graph.emitRelationEvent("relation.marriage", "npc_1", "npc_2");
    const events = graph.getRecentEvents();
    assert.ok(events.length >= 3);
  });

  test("getEventsForEntity filters by entity", () => {
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.addRelation("npc_3", "npc_4", "friendship", "friend");
    const events = graph.getEventsForEntity("npc_1");
    assert.ok(events.length >= 1);
    assert.ok(events.every((e) => e.entityA === "npc_1" || e.entityB === "npc_1"));
  });

  test("maxEventHistory limits stored events", () => {
    const limited = new SocialRelationGraph({ maxEventHistory: 5 });
    for (let i = 0; i < 10; i++) {
      limited.addRelation(`npc_${i}`, `npc_${i + 1}`, "friendship", "friend");
    }
    const events = limited.getRecentEvents(100);
    assert.ok(events.length <= 5);
  });
});

describe("SocialRelationGraph - Path Queries", () => {
  let graph: SocialRelationGraph;

  beforeEach(() => {
    graph = new SocialRelationGraph();
    // Create a chain: npc_1 - npc_2 - npc_3 - npc_4
    graph.addRelation("npc_1", "npc_2", "friendship", "friend", { trust: 80 });
    graph.addRelation("npc_2", "npc_3", "friendship", "friend", { trust: 60 });
    graph.addRelation("npc_3", "npc_4", "friendship", "friend", { trust: 40 });
    // Direct: npc_1 - npc_5
    graph.addRelation("npc_1", "npc_5", "enmity", "enemy", { trust: 10 });
  });

  test("findSocialPath returns direct path for connected entities", () => {
    const result = graph.findSocialPath("npc_1", "npc_5");
    assert.equal(result.exists, true);
    assert.equal(result.distance, 1);
    assert.deepEqual(result.path, ["npc_1", "npc_5"]);
  });

  test("findSocialPath finds shortest path through chain", () => {
    const result = graph.findSocialPath("npc_1", "npc_4");
    assert.equal(result.exists, true);
    assert.equal(result.distance, 3);
    assert.deepEqual(result.path, ["npc_1", "npc_2", "npc_3", "npc_4"]);
  });

  test("findSocialPath returns self path for same entity", () => {
    const result = graph.findSocialPath("npc_1", "npc_1");
    assert.equal(result.exists, true);
    assert.equal(result.distance, 0);
    assert.deepEqual(result.path, ["npc_1"]);
  });

  test("findSocialPath returns not exists for disconnected entity", () => {
    const result = graph.findSocialPath("npc_1", "npc_99");
    assert.equal(result.exists, false);
    assert.equal(result.distance, -1);
  });

  test("findSocialPath respects maxDepth", () => {
    const result = graph.findSocialPath("npc_1", "npc_4", 2);
    assert.equal(result.exists, false); // distance 3 > maxDepth 2
  });

  test("findCommonConnections returns shared entities", () => {
    graph.addRelation("npc_2", "npc_5", "friendship", "friend");
    // npc_1 connected to: npc_2, npc_5
    // npc_3 connected to: npc_2, npc_4
    // Common: npc_2
    const common = graph.findCommonConnections("npc_1", "npc_3");
    assert.equal(common.length, 1);
    assert.equal(common[0], "npc_2");
  });

  test("getSocialDegree returns relation count", () => {
    assert.equal(graph.getSocialDegree("npc_1"), 2); // npc_2 and npc_5
    assert.equal(graph.getSocialDegree("npc_2"), 2); // npc_1 and npc_3
    assert.equal(graph.getSocialDegree("npc_4"), 1); // npc_3 only
  });
});

describe("SocialRelationGraph - Group Detection", () => {
  let graph: SocialRelationGraph;

  beforeEach(() => {
    graph = new SocialRelationGraph();
  });

  test("detectGroups finds a tightly connected cluster", () => {
    // Create a triangle of close friends.
    graph.addRelation("npc_1", "npc_2", "friendship", "close_friend", {
      trust: 90, intimacy: 80, respect: 85, influence: 70, fear: 5,
    });
    graph.addRelation("npc_2", "npc_3", "friendship", "close_friend", {
      trust: 85, intimacy: 75, respect: 80, influence: 65, fear: 5,
    });
    graph.addRelation("npc_1", "npc_3", "friendship", "close_friend", {
      trust: 80, intimacy: 70, respect: 75, influence: 60, fear: 5,
    });

    const groups = graph.detectGroups(3, 60);
    assert.ok(groups.length >= 1);
    assert.equal(groups[0].members.length, 3);
    assert.ok(groups[0].cohesion > 60);
  });

  test("detectGroups ignores weakly connected entities", () => {
    graph.addRelation("npc_1", "npc_2", "neutral", "stranger", {
      trust: 10, intimacy: 5, respect: 10, influence: 5, fear: 5,
    });
    graph.addRelation("npc_2", "npc_3", "neutral", "stranger", {
      trust: 10, intimacy: 5, respect: 10, influence: 5, fear: 5,
    });

    const groups = graph.detectGroups(2, 60);
    assert.equal(groups.length, 0); // Low cohesion, no group
  });
});

describe("SocialRelationGraph - Serialization", () => {
  test("serialize and deserialize preserves relations", () => {
    const graph1 = new SocialRelationGraph();
    graph1.addRelation("npc_1", "npc_2", "friendship", "friend", { trust: 75 });
    graph1.addRelation("npc_1", "npc_3", "enmity", "enemy", { trust: 15 });
    graph1.emitRelationEvent("relation.betrayed", "npc_1", "npc_3");

    const data = graph1.serialize();
    const graph2 = new SocialRelationGraph();
    graph2.deserialize(data);

    assert.equal(graph2.hasRelation("npc_1", "npc_2"), true);
    assert.equal(graph2.hasRelation("npc_1", "npc_3"), true);
    assert.equal(graph2.getRelation("npc_1", "npc_2")!.strength.trust, 75);
    assert.equal(graph2.getRelations("npc_1").length, 2);
  });
});

describe("SocialRelationGraph - Statistics", () => {
  test("getStats returns correct counts", () => {
    const graph = new SocialRelationGraph();
    graph.addRelation("npc_1", "npc_2", "friendship", "friend");
    graph.addRelation("npc_1", "npc_3", "enmity", "enemy");
    graph.addRelation("npc_2", "npc_3", "family", "sibling");

    const stats = graph.getStats();
    assert.equal(stats.totalRelations, 3);
    assert.equal(stats.activeRelations, 3);
    assert.equal(stats.totalEntities, 3);
    assert.ok(stats.totalEvents >= 3);
    assert.equal(stats.categoryBreakdown["friendship"], 1);
    assert.equal(stats.categoryBreakdown["enmity"], 1);
    assert.equal(stats.categoryBreakdown["family"], 1);
  });
});

describe("SocialRelationGraph - Configuration", () => {
  test("uses default config when none provided", () => {
    const graph = new SocialRelationGraph();
    const data = graph.serialize();
    assert.deepEqual(data.config, DEFAULT_SOCIAL_RELATION_CONFIG);
  });

  test("accepts partial config override", () => {
    const graph = new SocialRelationGraph({ maxRelationsPerEntity: 50, decayRate: 0.01 });
    const data = graph.serialize();
    assert.equal(data.config.maxRelationsPerEntity, 50);
    assert.equal(data.config.decayRate, 0.01);
    assert.equal(data.config.autoDecay, true); // default preserved
  });
});
