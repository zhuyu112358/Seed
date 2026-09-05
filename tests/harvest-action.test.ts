import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { HarvestSystem } from "../src/resource/HarvestSystem.js";
import { ResourceNode } from "../src/resource/ResourceNode.js";
import type { ActionRequest } from "../src/types/index.js";

function makeWorld(): { world: World; action: SoulActionSystem; perception: SoulPerceptionSystem; harvest: HarvestSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const action = new SoulActionSystem();
  const perception = new SoulPerceptionSystem();
  const harvest = new HarvestSystem({ harvestRange: 3 });
  world.addSystem(action);
  world.addSystem(perception);
  world.addSystem(harvest);
  return { world, action, perception, harvest };
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, type: "soul", name: id,
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  });
}

function makeTree(id: string, x: number, z: number): { entity: GameObject; node: ResourceNode } {
  const entity = new GameObject({
    id, type: "resource", name: id,
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  });
  const node = new ResourceNode({ resourceTypeId: "wood", harvestTime: 2, maxAmount: 10, regenRate: 0 });
  return { entity, node };
}

function harvestRequest(soulId: string, targetId: string): ActionRequest {
  return {
    soulId,
    action: "harvest",
    targetId,
    parameters: {},
    timestamp: Date.now(),
  };
}

describe("SoulActionSystem harvest action", () => {
  test("harvest action starts harvesting a resource node", () => {
    const { world, action, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    const result = action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    assert.equal(result.success, true);
    assert.equal(node.isBeingHarvested, true);
  });

  test("harvest action fails when target not found", () => {
    const { world, action } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);

    const result = action.executeAction(harvestRequest("soul_1", "nonexistent"), world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("not found"));
  });

  test("harvest action fails when target is not a resource node", () => {
    const { world, action } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const rock = new GameObject({ id: "rock_1", type: "static", name: "rock", position: { x: 1, y: 0, z: 0 } });
    world.addEntity(soul);
    world.addEntity(rock);

    const result = action.executeAction(harvestRequest("soul_1", "rock_1"), world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("not a harvestable"));
  });

  test("harvest action fails when soul too far", () => {
    const { world, action, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 10, 0); // 10 units away, range=3
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    const result = action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("too far"));
  });

  test("harvest action fails when node depleted", () => {
    const { world, action, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    node.currentAmount = 0;
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    const result = action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("depleted"));
  });

  test("harvest action fails when node already being harvested", () => {
    const { world, action, harvest } = makeWorld();
    const soul1 = makeSoul("soul_1", 0, 0);
    const soul2 = makeSoul("soul_2", 0.5, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul1);
    world.addEntity(soul2);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // First soul starts harvesting
    const r1 = action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    assert.equal(r1.success, true);

    // Second soul tries to harvest same node
    const r2 = action.executeAction(harvestRequest("soul_2", "tree_1"), world);
    assert.equal(r2.success, false);
    assert.ok(r2.message.includes("already being harvested"));
  });

  test("harvest completes and adds to inventory over multiple ticks", () => {
    const { world, action, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Start harvest via action system
    const result = action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    assert.equal(result.success, true);

    // Tick to complete harvest (harvestTime=2)
    world.step(1 / 60);
    world.step(1 / 60);

    // Check inventory
    const inv = harvest.getInventory("soul_1");
    assert.ok(inv, "inventory should exist");
    assert.equal(inv!.getAmount("wood"), 1);
    assert.equal(node.currentAmount, 9);
  });

  test("harvest action requires targetId", () => {
    const { world, action } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);

    const req: ActionRequest = { soulId: "soul_1", action: "harvest", parameters: {}, timestamp: Date.now() };
    const result = action.executeAction(req, world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("targetId"));
  });
});

describe("SoulPerceptionSystem harvest events", () => {
  test("perceives harvest complete events", () => {
    const { world, action, perception, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Step once to set up perception event subscriptions
    world.step(1 / 60);

    // Start and complete harvest
    action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    world.step(1 / 60); // harvest tick 1
    world.step(1 / 60); // harvest tick 2 — completes, event emitted
    world.step(1 / 60); // extra tick for perception to pick up event (system order: perception before harvest)

    // Check perception frame for harvest event
    const frame = perception.getPerception("soul_1");
    assert.ok(frame, "perception frame should exist");
    const events = frame!.events ?? [];
    const harvestEvents = events.filter((e: { type?: string }) => e.type === "resource.harvest.complete");
    assert.ok(harvestEvents.length > 0, "should perceive harvest complete event");
  });

  test("perceives resource depleted events", () => {
    const { world, action, perception, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    node.currentAmount = 1;
    node.harvestAmount = 1;
    node.harvestTime = 1;
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Step once to set up subscriptions
    world.step(1 / 60);

    // Harvest the last resource (depletes node)
    action.executeAction(harvestRequest("soul_1", "tree_1"), world);
    world.step(1 / 60); // harvest completes, depleted event emitted
    world.step(1 / 60); // extra tick for perception to pick up event

    // Check perception frame for depleted event
    const frame = perception.getPerception("soul_1");
    assert.ok(frame, "perception frame should exist");
    const events = frame!.events ?? [];
    const depletedEvents = events.filter((e: { type?: string }) => e.type === "resource.node.depleted");
    assert.ok(depletedEvents.length > 0, "should perceive resource depleted event");
  });
});

describe("SoulPerceptionSystem nearby resources", () => {
  test("perception frame includes nearby resource nodes", () => {
    const { world, perception, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 2, 0);
    const { entity: rock, node: rockNode } = makeTree("rock_1", 5, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    world.addEntity(rock);
    harvest.registerNode(tree, node);
    harvest.registerNode(rock, rockNode);

    // Step to build perception frame
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame, "perception frame should exist");
    assert.ok(frame!.nearbyResources, "nearbyResources should be defined");
    assert.equal(frame!.nearbyResources!.length, 2);
    assert.equal(frame!.nearbyResources![0].id, "tree_1"); // closer first
    assert.equal(frame!.nearbyResources![0].resourceType, "wood");
    assert.equal(frame!.nearbyResources![0].currentAmount, 10);
    assert.equal(frame!.nearbyResources![0].isAvailable, true);
  });

  test("resource nodes beyond view distance are excluded", () => {
    const { world, perception, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 2, 0);
    const { entity: farTree, node: farNode } = makeTree("far_tree", 100, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    world.addEntity(farTree);
    harvest.registerNode(tree, node);
    harvest.registerNode(farTree, farNode);

    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame!.nearbyResources);
    assert.equal(frame!.nearbyResources!.length, 1);
    assert.equal(frame!.nearbyResources![0].id, "tree_1");
  });

  test("nearbyResources is undefined when HarvestSystem not available", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);

    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    assert.equal(frame!.nearbyResources, undefined);
  });

  test("depleted resource node shows isAvailable=false in perception", () => {
    const { world, perception, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    node.currentAmount = 0;
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame!.nearbyResources);
    assert.equal(frame!.nearbyResources!.length, 1);
    assert.equal(frame!.nearbyResources![0].isAvailable, false);
    assert.equal(frame!.nearbyResources![0].currentAmount, 0);
  });
});
