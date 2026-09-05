import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { WorldSerializer } from "../src/persistence/WorldSerializer.js";
import type { SerializedEntity } from "../src/persistence/WorldSerializer.js";

function makeWorld(): World {
  return new World({ name: "test-world", tickRate: 60 });
}

function makeEntity(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, type: "dynamic", name: id,
    position: { x, y: 0, z },
    velocity: { x: 1, y: 0, z: 0 },
    mass: 2,
    material: "wood",
  });
}

function entityFactory(serialized: SerializedEntity): GameObject {
  return new GameObject({
    id: serialized.id,
    name: serialized.name,
    type: serialized.type as any,
    position: serialized.position,
    velocity: serialized.velocity,
    mass: serialized.mass,
    material: serialized.material,
  });
}

describe("WorldSerializer", () => {
  test("serializes basic world metadata", () => {
    const world = makeWorld();
    world.step(1 / 60);
    world.step(1 / 60);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world);

    assert.equal(data.version, 1);
    assert.equal(data.name, "test-world");
    assert.equal(data.tickRate, 60);
    assert.equal(data.tick, 2);
    assert.ok(data.worldTime > 0);
  });

  test("serializes entities with position and velocity", () => {
    const world = makeWorld();
    const entity = makeEntity("ent_1", 3, 4);
    world.addEntity(entity);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world);

    assert.equal(data.entities.length, 1);
    assert.equal(data.entities[0].id, "ent_1");
    assert.equal(data.entities[0].position.x, 3);
    assert.equal(data.entities[0].position.z, 4);
    assert.equal(data.entities[0].velocity.x, 1);
    assert.equal(data.entities[0].mass, 2);
    assert.equal(data.entities[0].material, "wood");
  });

  test("serializes entity state and properties maps", () => {
    const world = makeWorld();
    const entity = makeEntity("ent_1", 0, 0);
    entity.state.set("health", 100);
    entity.state.set("alive", true);
    entity.properties.set("color", "red");
    world.addEntity(entity);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world);

    assert.equal(data.entities[0].state.health, 100);
    assert.equal(data.entities[0].state.alive, true);
    assert.equal(data.entities[0].properties.color, "red");
  });

  test("serializes entity children hierarchy", () => {
    const world = makeWorld();
    const parent = makeEntity("parent", 0, 0);
    const child = makeEntity("child", 1, 1);
    parent.attach(child);
    world.addEntity(parent);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world);

    assert.equal(data.entities.length, 1); // only top-level
    assert.equal(data.entities[0].children.length, 1);
    assert.equal(data.entities[0].children[0].id, "child");
  });

  test("deserializes entities into a new world", () => {
    const world1 = makeWorld();
    const entity = makeEntity("ent_1", 5, 7);
    entity.state.set("score", 42);
    world1.addEntity(entity);
    world1.step(1 / 60);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world1);

    const world2 = makeWorld();
    serializer.deserialize(data, world2, entityFactory);

    assert.equal(world2.tick, 1);
    assert.equal(world2.entities.size, 1);
    const restored = world2.getEntity("ent_1")!;
    assert.equal(restored.position.x, 5);
    assert.equal(restored.position.z, 7);
    assert.equal(restored.state.get("score"), 42);
  });

  test("round-trip preserves entity state", () => {
    const world1 = makeWorld();
    const e1 = makeEntity("a", 1, 2);
    const e2 = makeEntity("b", 3, 4);
    e1.state.set("hp", 80);
    e2.properties.set("tag", "enemy");
    world1.addEntity(e1);
    world1.addEntity(e2);

    const serializer = new WorldSerializer();
    const json = serializer.toJSON(world1);
    const world2 = makeWorld();
    serializer.fromJSON(json, world2, entityFactory);

    assert.equal(world2.entities.size, 2);
    assert.equal(world2.getEntity("a")!.state.get("hp"), 80);
    assert.equal(world2.getEntity("b")!.properties.get("tag"), "enemy");
  });

  test("toJSON produces valid JSON string", () => {
    const world = makeWorld();
    world.addEntity(makeEntity("ent_1", 0, 0));

    const serializer = new WorldSerializer();
    const json = serializer.toJSON(world);
    const parsed = JSON.parse(json);

    assert.equal(parsed.version, 1);
    assert.equal(parsed.entities.length, 1);
  });

  test("toJSON with pretty formatting", () => {
    const world = makeWorld();
    const serializer = new WorldSerializer();
    const json = serializer.toJSON(world, true);
    assert.ok(json.includes("\n")); // pretty-printed has newlines
  });

  test("fromJSON throws on unsupported version", () => {
    const world = makeWorld();
    const serializer = new WorldSerializer();
    const badJson = JSON.stringify({ version: 999, entities: [], systems: {} });
    assert.throws(() => serializer.fromJSON(badJson, world, entityFactory), /Unsupported serialization version/);
  });

  test("serializes systems implementing ISerializable", () => {
    const world = makeWorld();
    const testSystem = {
      name: "test-system",
      enabled: true,
      value: 42,
      tick() {},
      serialize() { return { value: this.value }; },
      deserialize(data: any) { this.value = data.value; },
    };
    world.addSystem(testSystem as any);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world);

    assert.ok(data.systems["test-system"]);
    assert.equal((data.systems["test-system"] as any).value, 42);
  });

  test("registerSystemSerializer handles non-ISerializable systems", () => {
    const world = makeWorld();
    const simpleSystem = {
      name: "simple-system",
      enabled: true,
      data: { count: 5 },
      tick() {},
    };
    world.addSystem(simpleSystem as any);

    const serializer = new WorldSerializer();
    serializer.registerSystemSerializer(
      "simple-system",
      (w) => (w.systems.find(s => s.name === "simple-system") as any).data,
      (w, data) => { (w.systems.find(s => s.name === "simple-system") as any).data = data; },
    );

    const data = serializer.serialize(world);
    assert.equal((data.systems["simple-system"] as any).count, 5);
  });

  test("deserialize clears existing entities before restoring", () => {
    const world1 = makeWorld();
    world1.addEntity(makeEntity("original", 0, 0));

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world1);

    const world2 = makeWorld();
    world2.addEntity(makeEntity("stale", 9, 9));
    serializer.deserialize(data, world2, entityFactory);

    assert.equal(world2.entities.size, 1);
    assert.ok(world2.getEntity("original"));
    assert.equal(world2.getEntity("stale"), undefined);
  });
});
