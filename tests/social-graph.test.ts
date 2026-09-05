// Tests for SocialGraph (M7 phase 1).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { SocialGraph } from "../src/social/SocialGraph.js";
import type { SocialRelationType } from "../src/social/SocialTypes.js";

function makeWorld(): World {
  return new World({ name: "social-test", tickRate: 60 });
}

describe("SocialGraph - Basic Relations", () => {
  test("set and get relation", () => {
    const graph = new SocialGraph();
    const rel = graph.setRelation("npc_1", "npc_2", "friend");
    assert.equal(rel.type, "friend");
    assert.equal(graph.getRelation("npc_1", "npc_2")?.type, "friend");
  });

  test("relation is undirected (key sorted)", () => {
    const graph = new SocialGraph();
    graph.setRelation("npc_1", "npc_2", "friend");
    assert.ok(graph.hasRelation("npc_2", "npc_1"));
    assert.equal(graph.getRelation("npc_2", "npc_1")?.type, "friend");
  });

  test("getRelation returns undefined for unknown pair", () => {
    const graph = new SocialGraph();
    assert.equal(graph.getRelation("a", "b"), undefined);
  });

  test("remove relation", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend");
    assert.ok(graph.removeRelation("a", "b"));
    assert.ok(!graph.hasRelation("a", "b"));
  });

  test("remove non-existent returns false", () => {
    const graph = new SocialGraph();
    assert.ok(!graph.removeRelation("x", "y"));
  });

  test("relationCount tracks total relations", () => {
    const graph = new SocialGraph();
    assert.equal(graph.relationCount, 0);
    graph.setRelation("a", "b", "friend");
    graph.setRelation("a", "c", "enemy");
    assert.equal(graph.relationCount, 2);
  });
});

describe("SocialGraph - Trust and Familiarity", () => {
  test("default trust is 50", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "neutral");
    assert.equal(graph.getTrust("a", "b"), 50);
  });

  test("modifyTrust changes trust value", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "neutral");
    const newTrust = graph.modifyTrust("a", "b", 20);
    assert.equal(newTrust, 70);
  });

  test("trust is clamped to 0-100", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "neutral");
    graph.modifyTrust("a", "b", 100);
    assert.equal(graph.getTrust("a", "b"), 100);
    graph.modifyTrust("a", "b", -200);
    assert.equal(graph.getTrust("a", "b"), 0);
  });

  test("modifyTrust auto-creates neutral relation", () => {
    const graph = new SocialGraph();
    graph.modifyTrust("x", "y", 10);
    assert.ok(graph.hasRelation("x", "y"));
    assert.equal(graph.getRelationType("x", "y"), "neutral");
  });

  test("modifyFamiliarity changes familiarity", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend");
    const newFam = graph.modifyFamiliarity("a", "b", 30);
    assert.equal(newFam, 30);
  });

  test("getTrust returns 50 for unknown pair", () => {
    const graph = new SocialGraph();
    assert.equal(graph.getTrust("unknown", "pair"), 50);
  });

  test("getRelationType returns neutral for unknown pair", () => {
    const graph = new SocialGraph();
    assert.equal(graph.getRelationType("unknown", "pair"), "neutral");
  });
});

describe("SocialGraph - Query by Type", () => {
  test("getFriends returns friend entities", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend");
    graph.setRelation("a", "c", "friend");
    graph.setRelation("a", "d", "enemy");
    const friends = graph.getFriends("a");
    assert.deepEqual(friends.sort(), ["b", "c"]);
  });

  test("getEnemies returns enemy entities", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "enemy");
    graph.setRelation("a", "c", "friend");
    const enemies = graph.getEnemies("a");
    assert.deepEqual(enemies, ["b"]);
  });

  test("getAllies returns ally entities", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "ally");
    graph.setRelation("a", "c", "ally");
    const allies = graph.getAllies("a");
    assert.deepEqual(allies.sort(), ["b", "c"]);
  });

  test("getRelationsByType filters correctly", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend");
    graph.setRelation("a", "c", "enemy");
    graph.setRelation("a", "d", "friend");
    const friends = graph.getRelationsByType("a", "friend");
    assert.equal(friends.length, 2);
  });

  test("getRelations returns all relations for entity", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend");
    graph.setRelation("a", "c", "enemy");
    graph.setRelation("b", "c", "neutral");
    const rels = graph.getRelations("a");
    assert.equal(rels.length, 2);
  });
});

describe("SocialGraph - Interactions", () => {
  test("recordInteraction updates trust and familiarity", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    graph.setRelation("a", "b", "neutral");
    graph.recordInteraction("a", "b", "gift", 15, 10, world.events, world.tick);
    assert.equal(graph.getTrust("a", "b"), 65);
    const rel = graph.getRelation("a", "b")!;
    assert.equal(rel.familiarity, 10);
    assert.equal(rel.interactionCount, 1);
  });

  test("recordInteraction auto-creates relation", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    graph.recordInteraction("x", "y", "talk", 5, 5, world.events, world.tick);
    assert.ok(graph.hasRelation("x", "y"));
  });

  test("recordInteraction increments interactionCount", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    graph.recordInteraction("a", "b", "talk", 0, 5, world.events, world.tick);
    graph.recordInteraction("a", "b", "trade", 10, 5, world.events, world.tick);
    const rel = graph.getRelation("a", "b")!;
    assert.equal(rel.interactionCount, 2);
  });

  test("recordInteraction emits social.interaction event", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    let emitted = false;
    world.events.on("social.interaction", () => { emitted = true; });
    graph.recordInteraction("a", "b", "gift", 5, 5, world.events, world.tick);
    assert.ok(emitted);
  });
});

describe("SocialGraph - Events", () => {
  test("setRelation emits relation_changed when type changes", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    graph.setRelation("a", "b", "neutral", world.events);
    let changed = false;
    world.events.on("social.relation_changed", () => { changed = true; });
    graph.setRelation("a", "b", "friend", world.events);
    assert.ok(changed);
  });

  test("modifyTrust emits trust_changed event", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    graph.setRelation("a", "b", "neutral", world.events);
    let changed = false;
    world.events.on("social.trust_changed", () => { changed = true; });
    graph.modifyTrust("a", "b", 10, world.events);
    assert.ok(changed);
  });

  test("setRelation with same type does not emit", () => {
    const graph = new SocialGraph();
    const world = makeWorld();
    graph.setRelation("a", "b", "friend", world.events);
    let changed = false;
    world.events.on("social.relation_changed", () => { changed = true; });
    graph.setRelation("a", "b", "friend", world.events);
    assert.ok(!changed);
  });
});

describe("SocialGraph - Serialization", () => {
  test("serialize and deserialize preserves relations", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend", undefined, 80, 30);
    graph.setRelation("a", "c", "enemy", undefined, 20, 10);
    const data = graph.serialize();

    const graph2 = new SocialGraph();
    graph2.deserialize(data as Record<string, unknown>);
    assert.equal(graph2.getRelationType("a", "b"), "friend");
    assert.equal(graph2.getTrust("a", "b"), 80);
    assert.equal(graph2.getRelationType("a", "c"), "enemy");
  });
});

describe("SocialGraph - WorldSystem", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const graph = new SocialGraph();
    world.addSystem(graph);
    graph.setRelation("a", "b", "friend");
    world.step(1 / 60);
    assert.ok(graph.hasRelation("a", "b"));
  });

  test("stop clears all relations", () => {
    const graph = new SocialGraph();
    graph.setRelation("a", "b", "friend");
    graph.stop();
    assert.equal(graph.relationCount, 0);
  });
});

describe("SocialGraph - All Relation Types", () => {
  test("supports all relation types", () => {
    const graph = new SocialGraph();
    const types: SocialRelationType[] = ["friend", "neutral", "enemy", "rival", "ally", "family"];
    for (let i = 0; i < types.length; i++) {
      graph.setRelation(`e${i}`, `e${i + 1}`, types[i]);
    }
    assert.equal(graph.relationCount, types.length);
  });
});
