import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { WorldSaveManager } from "../src/persistence/WorldSaveManager.js";
import type { SerializedEntity } from "../src/persistence/WorldSerializer.js";

let tempDir: string;

function makeWorld(): World {
  return new World({ name: "test-world", tickRate: 60 });
}

function makeEntity(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, type: "dynamic", name: id,
    position: { x, y: 0, z },
    velocity: { x: 1, y: 0, z: 0 },
    mass: 2,
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
  });
}

describe("WorldSaveManager", () => {
  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seed-save-test-"));
  });

  after(() => {
    // Clean up temp directory.
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("save creates a save file", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    world.addEntity(makeEntity("ent_1", 1, 2));
    world.step(1 / 60);

    manager.save(world, "test-save");

    const filePath = manager.savePath("test-save");
    assert.ok(fs.existsSync(filePath));
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.equal(content.name, "test-world");
    assert.equal(content.tick, 1);
    assert.equal(content.entities.length, 1);
  });

  test("save includes savedAt timestamp in metadata", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    manager.save(world, "timestamp-save");

    const filePath = manager.savePath("timestamp-save");
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.ok(typeof content.metadata.savedAt === "number");
    assert.ok(content.metadata.savedAt > 0);
  });

  test("save with custom metadata", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    manager.save(world, "meta-save", { playerName: "Alice", playTime: 3600 });

    const filePath = manager.savePath("meta-save");
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.equal(content.metadata.playerName, "Alice");
    assert.equal(content.metadata.playTime, 3600);
  });

  test("load restores world state from save", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world1 = makeWorld();
    world1.addEntity(makeEntity("ent_1", 5, 7));
    world1.addEntity(makeEntity("ent_2", 3, 4));
    world1.step(1 / 60);
    world1.step(1 / 60);
    manager.save(world1, "load-test");

    const world2 = makeWorld();
    manager.load("load-test", world2, entityFactory);

    assert.equal(world2.tick, 2);
    assert.equal(world2.entities.size, 2);
    assert.equal(world2.getEntity("ent_1")!.position.x, 5);
    assert.equal(world2.getEntity("ent_2")!.position.z, 4);
  });

  test("load throws on missing save", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    assert.throws(
      () => manager.load("nonexistent", world, entityFactory),
      /Save not found/,
    );
  });

  test("exists returns true for saved slot, false for missing", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    manager.save(world, "exists-test");

    assert.equal(manager.exists("exists-test"), true);
    assert.equal(manager.exists("never-saved"), false);
  });

  test("delete removes save file", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    manager.save(world, "delete-test");
    assert.equal(manager.exists("delete-test"), true);

    const result = manager.delete("delete-test");
    assert.equal(result, true);
    assert.equal(manager.exists("delete-test"), false);
  });

  test("delete returns false for missing save", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const result = manager.delete("never-existed");
    assert.equal(result, false);
  });

  test("list returns all saves sorted by newest first", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();

    manager.save(world, "save-a");
    // Small delay to ensure different modification times.
    const later = new Date(Date.now() + 1000);
    manager.save(world, "save-b");
    // Touch save-b to make it newer.
    fs.utimesSync(manager.savePath("save-b"), later, later);

    const saves = manager.list();
    const names = saves.map((s) => s.name);
    assert.ok(names.includes("save-a"));
    assert.ok(names.includes("save-b"));
    // Newest first.
    assert.equal(names[0], "save-b");
  });

  test("list returns metadata with world name and tick", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    world.step(1 / 60);
    world.step(1 / 60);
    manager.save(world, "meta-list-test");

    const saves = manager.list();
    const save = saves.find((s) => s.name === "meta-list-test")!;
    assert.equal(save.worldName, "test-world");
    assert.equal(save.tick, 2);
    assert.equal(save.version, 1);
    assert.ok(save.size > 0);
    assert.ok(save.modifiedAt > 0);
  });

  test("list returns empty for nonexistent directory", () => {
    const manager = new WorldSaveManager({ saveDirectory: path.join(tempDir, "does-not-exist") });
    const saves = manager.list();
    assert.equal(saves.length, 0);
  });

  test("getMetadata returns save info", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world = makeWorld();
    manager.save(world, "get-meta-test");

    const meta = manager.getMetadata("get-meta-test");
    assert.ok(meta);
    assert.equal(meta!.name, "get-meta-test");
    assert.equal(meta!.worldName, "test-world");
  });

  test("getMetadata returns undefined for missing save", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const meta = manager.getMetadata("no-such-save");
    assert.equal(meta, undefined);
  });

  test("round-trip save and load preserves entity state", () => {
    const manager = new WorldSaveManager({ saveDirectory: tempDir });
    const world1 = makeWorld();
    const entity = makeEntity("rt-1", 10, 20);
    entity.state.set("health", 100);
    entity.state.set("score", 42);
    world1.addEntity(entity);
    manager.save(world1, "roundtrip");

    const world2 = makeWorld();
    manager.load("roundtrip", world2, entityFactory);

    const restored = world2.getEntity("rt-1")!;
    assert.equal(restored.state.get("health"), 100);
    assert.equal(restored.state.get("score"), 42);
    assert.equal(restored.position.x, 10);
    assert.equal(restored.position.z, 20);
  });

  test("custom file extension", () => {
    const manager = new WorldSaveManager({
      saveDirectory: tempDir,
      fileExtension: ".world",
    });
    const world = makeWorld();
    manager.save(world, "custom-ext");

    const filePath = manager.savePath("custom-ext");
    assert.ok(filePath.endsWith(".world"));
    assert.ok(fs.existsSync(filePath));
  });
});
