import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { WorldGenerator } from "../src/generation/WorldGenerator.js";
import type { GenerationPlugin, GenerationContext } from "../src/generation/WorldGenerator.js";

function makeEntity(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, type: "dynamic", name: id,
    position: { x, y: 0, z },
  });
}

describe("WorldGenerator", () => {
  test("creates a world with default config", () => {
    const gen = new WorldGenerator({ seed: 42 });
    const world = gen.generate();
    assert.equal(world.config.name, "generated-world");
    assert.equal(world.config.tickRate, 60);
  });

  test("creates a world with custom name and tickRate", () => {
    const gen = new WorldGenerator({ seed: "abc", worldName: "my-world", tickRate: 30 });
    const world = gen.generate();
    assert.equal(world.config.name, "my-world");
    assert.equal(world.config.tickRate, 30);
  });

  test("runs plugins in registration order", () => {
    const order: string[] = [];
    const pluginA: GenerationPlugin = {
      name: "A",
      generate: () => { order.push("A"); },
    };
    const pluginB: GenerationPlugin = {
      name: "B",
      generate: () => { order.push("B"); },
    };
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin(pluginA).addPlugin(pluginB);
    gen.generate();
    assert.deepEqual(order, ["A", "B"]);
  });

  test("plugins can add entities to the world", () => {
    const entityPlugin: GenerationPlugin = {
      name: "entities",
      generate: (ctx: GenerationContext) => {
        for (let i = 0; i < 5; i++) {
          ctx.world.addEntity(makeEntity(`ent_${i}`, i, i * 2));
        }
      },
    };
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin(entityPlugin);
    const world = gen.generate();
    assert.equal(world.entities.size, 5);
    assert.equal(world.getEntity("ent_0")!.position.x, 0);
    assert.equal(world.getEntity("ent_4")!.position.z, 8);
  });

  test("plugins share data via context.data", () => {
    const producer: GenerationPlugin = {
      name: "producer",
      generate: (ctx) => {
        ctx.data.set("heightMap", [1, 2, 3, 4, 5]);
      },
    };
    const consumer: GenerationPlugin = {
      name: "consumer",
      generate: (ctx) => {
        const map = ctx.data.get("heightMap") as number[];
        ctx.data.set("sum", map.reduce((a, b) => a + b, 0));
      },
    };
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin(producer).addPlugin(consumer);
    const { data } = gen.generateWithData();
    assert.deepEqual(data.get("heightMap"), [1, 2, 3, 4, 5]);
    assert.equal(data.get("sum"), 15);
  });

  test("same seed produces same world (deterministic)", () => {
    const randomEntities: GenerationPlugin = {
      name: "random-entities",
      generate: (ctx) => {
        const count = ctx.rng.nextInt(3, 7);
        for (let i = 0; i < count; i++) {
          const x = ctx.rng.nextFloat(0, 100);
          const z = ctx.rng.nextFloat(0, 100);
          ctx.world.addEntity(makeEntity(`r_${i}`, x, z));
        }
      },
    };

    const gen1 = new WorldGenerator({ seed: "deterministic" });
    gen1.addPlugin(randomEntities);
    const world1 = gen1.generate();

    const gen2 = new WorldGenerator({ seed: "deterministic" });
    gen2.addPlugin(randomEntities);
    const world2 = gen2.generate();

    assert.equal(world1.entities.size, world2.entities.size);
    for (const [id, e1] of world1.entities) {
      const e2 = world2.getEntity(id)!;
      assert.ok(e2);
      assert.equal(e1.position.x, e2.position.x);
      assert.equal(e1.position.z, e2.position.z);
    }
  });

  test("different seeds produce different worlds", () => {
    const randomEntities: GenerationPlugin = {
      name: "random-entities",
      generate: (ctx) => {
        for (let i = 0; i < 10; i++) {
          const x = ctx.rng.nextFloat(0, 100);
          ctx.world.addEntity(makeEntity(`r_${i}`, x, 0));
        }
      },
    };

    const gen1 = new WorldGenerator({ seed: 1 });
    gen1.addPlugin(randomEntities);
    const world1 = gen1.generate();

    const gen2 = new WorldGenerator({ seed: 2 });
    gen2.addPlugin(randomEntities);
    const world2 = gen2.generate();

    // At least one entity should have a different x position.
    let anyDifferent = false;
    for (const [id, e1] of world1.entities) {
      const e2 = world2.getEntity(id)!;
      if (Math.abs(e1.position.x - e2.position.x) > 0.001) {
        anyDifferent = true;
        break;
      }
    }
    assert.equal(anyDifferent, true);
  });

  test("duplicate plugin name throws", () => {
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin({ name: "dup", generate: () => {} });
    assert.throws(
      () => gen.addPlugin({ name: "dup", generate: () => {} }),
      /Duplicate generation plugin/,
    );
  });

  test("removePlugin removes plugin", () => {
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin({ name: "a", generate: () => {} });
    gen.addPlugin({ name: "b", generate: () => {} });
    assert.equal(gen.removePlugin("a"), true);
    assert.deepEqual(gen.getPluginNames(), ["b"]);
  });

  test("removePlugin returns false for missing plugin", () => {
    const gen = new WorldGenerator({ seed: 1 });
    assert.equal(gen.removePlugin("nonexistent"), false);
  });

  test("getPluginNames returns names in order", () => {
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin({ name: "first", generate: () => {} });
    gen.addPlugin({ name: "second", generate: () => {} });
    assert.deepEqual(gen.getPluginNames(), ["first", "second"]);
  });

  test("generate populates an existing world", () => {
    const existing = new World({ name: "existing", tickRate: 60 });
    existing.addEntity(makeEntity("pre-existing", 0, 0));

    const plugin: GenerationPlugin = {
      name: "add-one",
      generate: (ctx) => {
        ctx.world.addEntity(makeEntity("new", 1, 1));
      },
    };

    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin(plugin);
    const result = gen.generate(existing);

    assert.equal(result, existing);
    assert.equal(result.entities.size, 2);
    assert.ok(result.getEntity("pre-existing"));
    assert.ok(result.getEntity("new"));
  });

  test("generateWithData returns world and data", () => {
    const plugin: GenerationPlugin = {
      name: "data-setter",
      generate: (ctx) => {
        ctx.data.set("generated", true);
        ctx.world.addEntity(makeEntity("e", 0, 0));
      },
    };
    const gen = new WorldGenerator({ seed: 1 });
    gen.addPlugin(plugin);
    const { world, data } = gen.generateWithData();
    assert.equal(world.entities.size, 1);
    assert.equal(data.get("generated"), true);
  });

  test("plugins receive the seed in context", () => {
    let receivedSeed: number | string | undefined;
    const plugin: GenerationPlugin = {
      name: "seed-check",
      generate: (ctx) => {
        receivedSeed = ctx.seed;
      },
    };
    const gen = new WorldGenerator({ seed: "my-seed" });
    gen.addPlugin(plugin);
    gen.generate();
    assert.equal(receivedSeed, "my-seed");
  });
});
