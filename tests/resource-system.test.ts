import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ResourceType, ResourceTypeRegistry } from "../src/resource/ResourceType.js";
import { ResourceNode } from "../src/resource/ResourceNode.js";
import { ResourceInventory } from "../src/resource/ResourceInventory.js";
import { HarvestSystem } from "../src/resource/HarvestSystem.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";
import {
  HarvestStartEvent,
  HarvestCompleteEvent,
  ResourceDepletedEvent,
  ResourceRegeneratedEvent,
} from "../src/event/Event.js";

// --- ResourceType & Registry ---

describe("ResourceType", () => {
  test("creates resource type with default values", () => {
    const type = new ResourceType({ id: "wood", name: "Wood" });
    assert.equal(type.id, "wood");
    assert.equal(type.name, "Wood");
    assert.equal(type.maxStackSize, 99);
    assert.equal(type.renewable, true);
    assert.equal(type.icon, "wood");
  });

  test("creates resource type with custom values", () => {
    const type = new ResourceType({
      id: "iron_ore",
      name: "Iron Ore",
      description: "Raw iron ore",
      maxStackSize: 50,
      icon: "iron",
      renewable: false,
    });
    assert.equal(type.id, "iron_ore");
    assert.equal(type.description, "Raw iron ore");
    assert.equal(type.maxStackSize, 50);
    assert.equal(type.renewable, false);
  });
});

describe("ResourceTypeRegistry", () => {
  test("registers and retrieves resource types", () => {
    const reg = new ResourceTypeRegistry();
    const wood = reg.register({ id: "wood", name: "Wood" });
    assert.equal(reg.size, 1);
    assert.equal(reg.get("wood"), wood);
    assert.equal(reg.has("wood"), true);
    assert.equal(reg.has("stone"), false);
  });

  test("getAll returns all registered types", () => {
    const reg = new ResourceTypeRegistry();
    reg.register({ id: "wood", name: "Wood" });
    reg.register({ id: "stone", name: "Stone" });
    reg.register({ id: "iron", name: "Iron" });
    assert.equal(reg.getAll().length, 3);
  });

  test("remove and clear work", () => {
    const reg = new ResourceTypeRegistry();
    reg.register({ id: "wood", name: "Wood" });
    assert.equal(reg.remove("wood"), true);
    assert.equal(reg.remove("wood"), false);
    reg.register({ id: "stone", name: "Stone" });
    reg.clear();
    assert.equal(reg.size, 0);
  });
});

// --- ResourceNode ---

describe("ResourceNode", () => {
  test("creates node with default values", () => {
    const node = new ResourceNode({ resourceTypeId: "wood" });
    assert.equal(node.resourceTypeId, "wood");
    assert.equal(node.maxAmount, 100);
    assert.equal(node.currentAmount, 100);
    assert.equal(node.regenRate, 0.1);
    assert.equal(node.harvestTime, 30);
    assert.equal(node.harvestAmount, 1);
    assert.equal(node.renewable, true);
    assert.equal(node.isAvailable, true);
    assert.equal(node.isBeingHarvested, false);
  });

  test("startHarvest and tickHarvest work", () => {
    const node = new ResourceNode({ resourceTypeId: "wood", harvestTime: 3, harvestAmount: 2, maxAmount: 10 });
    assert.equal(node.startHarvest("soul_1"), true);
    assert.equal(node.isBeingHarvested, true);
    assert.equal(node.harvestProgress, 0);

    // Tick 1: still in progress
    assert.equal(node.tickHarvest(), 0);
    assert.ok(Math.abs(node.harvestProgress - 1 / 3) < 0.001, `progress should be ~1/3, got ${node.harvestProgress}`);

    // Tick 2: still in progress
    assert.equal(node.tickHarvest(), 0);

    // Tick 3: complete
    const harvested = node.tickHarvest();
    assert.equal(harvested, 2);
    assert.equal(node.currentAmount, 8);
    assert.equal(node.isBeingHarvested, false);
  });

  test("startHarvest fails when depleted or already harvesting", () => {
    const node = new ResourceNode({ resourceTypeId: "wood", currentAmount: 0, maxAmount: 10 });
    assert.equal(node.isAvailable, false);
    assert.equal(node.startHarvest("soul_1"), false);

    const node2 = new ResourceNode({ resourceTypeId: "wood", harvestTime: 5 });
    assert.equal(node2.startHarvest("soul_1"), true);
    assert.equal(node2.startHarvest("soul_2"), false); // already harvesting
  });

  test("cancelHarvest stops harvest operation", () => {
    const node = new ResourceNode({ resourceTypeId: "wood", harvestTime: 5 });
    node.startHarvest("soul_1");
    assert.equal(node.isBeingHarvested, true);
    node.cancelHarvest();
    assert.equal(node.isBeingHarvested, false);
    assert.equal(node.currentAmount, 100); // no resource lost
  });

  test("regenerate restores resource", () => {
    const node = new ResourceNode({ resourceTypeId: "wood", currentAmount: 5, maxAmount: 10, regenRate: 2 });
    const regen = node.regenerate();
    assert.equal(regen, 2);
    assert.equal(node.currentAmount, 7);
  });

  test("regenerate does nothing if not renewable or at max", () => {
    const node = new ResourceNode({ resourceTypeId: "wood", renewable: false, currentAmount: 5 });
    assert.equal(node.regenerate(), 0);
    assert.equal(node.currentAmount, 5);

    const node2 = new ResourceNode({ resourceTypeId: "wood", currentAmount: 100, maxAmount: 100 });
    assert.equal(node2.regenerate(), 0);
  });

  test("getSnapshot returns current state", () => {
    const node = new ResourceNode({ resourceTypeId: "wood", currentAmount: 50, maxAmount: 100 });
    const snap = node.getSnapshot();
    assert.equal(snap.resourceTypeId, "wood");
    assert.equal(snap.currentAmount, 50);
    assert.equal(snap.maxAmount, 100);
    assert.equal(snap.isAvailable, true);
    assert.equal(snap.isBeingHarvested, false);
    assert.equal(snap.harvestProgress, 0);
  });
});

// --- ResourceInventory ---

describe("ResourceInventory", () => {
  test("add and remove resources", () => {
    const inv = new ResourceInventory();
    assert.equal(inv.add("wood", 10), 10);
    assert.equal(inv.getAmount("wood"), 10);
    assert.equal(inv.has("wood", 5), true);
    assert.equal(inv.has("wood", 15), false);

    assert.equal(inv.remove("wood", 3), 3);
    assert.equal(inv.getAmount("wood"), 7);
  });

  test("remove more than available returns actual removed", () => {
    const inv = new ResourceInventory({ initial: { wood: 5 } });
    assert.equal(inv.remove("wood", 10), 5);
    assert.equal(inv.getAmount("wood"), 0);
    assert.equal(inv.typeCount, 0); // removed when zero
  });

  test("capacity limit works", () => {
    const inv = new ResourceInventory({ maxCapacity: 20 });
    assert.equal(inv.add("wood", 15), 15);
    assert.equal(inv.add("stone", 10), 5); // only 5 capacity left
    assert.equal(inv.getTotal(), 20);
    assert.equal(inv.canAdd(1), false);
  });

  test("unlimited capacity (maxCapacity=0)", () => {
    const inv = new ResourceInventory();
    assert.equal(inv.add("wood", 1000), 1000);
    assert.equal(inv.getRemainingCapacity(), Infinity);
  });

  test("getAll returns all resources", () => {
    const inv = new ResourceInventory({ initial: { wood: 10, stone: 5, iron: 3 } });
    const all = inv.getAll();
    assert.equal(all.wood, 10);
    assert.equal(all.stone, 5);
    assert.equal(all.iron, 3);
  });

  test("clear removes all resources", () => {
    const inv = new ResourceInventory({ initial: { wood: 10 } });
    inv.clear();
    assert.equal(inv.getTotal(), 0);
    assert.equal(inv.typeCount, 0);
  });
});

// --- HarvestSystem ---

describe("HarvestSystem", () => {
  function makeWorld(): { world: World; harvest: HarvestSystem } {
    const world = new World({ name: "test", tickRate: 60 });
    const harvest = new HarvestSystem({ harvestRange: 3 });
    world.addSystem(harvest);
    return { world, harvest };
  }

  function makeSoul(id: string, x: number, z: number): GameObject {
    return new GameObject({
      id, type: "soul", name: id,
      position: { x, y: 0, z },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    });
  }

  function makeResourceNode(id: string, x: number, z: number, typeId = "wood", config?: Partial<{ maxAmount: number; harvestTime: number; harvestAmount: number; regenRate: number; currentAmount: number }>): { entity: GameObject; node: ResourceNode } {
    const entity = new GameObject({
      id, type: "resource", name: id,
      position: { x, y: 0, z },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    });
    const node = new ResourceNode({
      resourceTypeId: typeId,
      harvestTime: config?.harvestTime ?? 2,
      maxAmount: config?.maxAmount ?? 10,
      harvestAmount: config?.harvestAmount ?? 1,
      regenRate: config?.regenRate ?? 0.1,
      currentAmount: config?.currentAmount,
    });
    return { entity, node };
  }

  test("registers and retrieves resource nodes", () => {
    const { world, harvest } = makeWorld();
    const { entity, node } = makeResourceNode("tree_1", 0, 0);
    world.addEntity(entity);
    harvest.registerNode(entity, node);

    assert.equal(harvest.getNode("tree_1"), node);
    assert.equal(harvest.getAllNodes().length, 1);
  });

  test("startHarvest requires proximity", () => {
    const { world, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeResourceNode("tree_1", 10, 0); // 10 units away
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Too far (range is 3)
    assert.equal(harvest.startHarvest(soul, tree), false);

    // Move soul close (tree at x=10, range=3, so x=8 is within range)
    soul.position = new Vector3(8, 0, 0);
    assert.equal(harvest.startHarvest(soul, tree), true);
  });

  test("harvest completes and adds to inventory", () => {
    const { world, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeResourceNode("tree_1", 1, 0, "wood", { regenRate: 0 });
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Start harvest
    assert.equal(harvest.startHarvest(soul, tree), true);

    // Tick to complete harvest (harvestTime=2)
    world.step(1 / 60); // tick 1
    world.step(1 / 60); // tick 2 — harvest complete

    // Check inventory
    const inv = harvest.getInventory("soul_1");
    assert.ok(inv, "inventory should exist");
    assert.equal(inv!.getAmount("wood"), 1);
    assert.equal(node.currentAmount, 9);
  });

  test("emits harvest events", () => {
    const { world, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeResourceNode("tree_1", 1, 0, "wood");
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    const events: string[] = [];
    world.events.on("resource.harvest.start", () => events.push("start"));
    world.events.on("resource.harvest.complete", () => events.push("complete"));

    harvest.startHarvest(soul, tree);
    world.step(1 / 60); // start event emitted on first tick
    assert.ok(events.includes("start"), "start event should be emitted");

    world.step(1 / 60); // complete event
    assert.ok(events.includes("complete"), "complete event should be emitted");
  });

  test("emits depleted and regenerated events", () => {
    const { world, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    // Node with only 1 resource, fast regen, harvestTime=1
    const { entity: tree, node } = makeResourceNode("tree_1", 1, 0, "wood", {
      currentAmount: 1,
      maxAmount: 10,
      harvestTime: 1,
      harvestAmount: 1,
      regenRate: 5,
    });
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    const events: string[] = [];
    world.events.on("resource.node.depleted", () => events.push("depleted"));
    world.events.on("resource.node.regenerated", () => events.push("regenerated"));

    harvest.startHarvest(soul, tree);
    world.step(1 / 60); // harvest completes, node depleted AND regenerated same tick (regenRate=5)

    assert.ok(events.includes("depleted"), "depleted event should be emitted");
    assert.ok(events.includes("regenerated"), "regenerated event should be emitted (same tick with high regenRate)");
    assert.ok(node.currentAmount > 0, "node should have regenerated some resource");
  });

  test("getOrCreateInventory creates inventory for entity", () => {
    const { harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const inv = harvest.getOrCreateInventory(soul, 50);
    assert.equal(inv.maxCapacity, 50);
    assert.equal(harvest.getInventory("soul_1"), inv);
  });
});
