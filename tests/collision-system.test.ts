import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CollisionSystem } from "../src/physics/CollisionSystem.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";

function makeSoul(id: string, x = 0, z = 0): GameObject {
  return new GameObject({
    id, name: id, type: "soul",
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    mass: 1,
  });
}

function makeWorld(): World {
  return new World({ name: "test", tickRate: 60 });
}

describe("CollisionSystem", () => {
  it("initializes with default config", () => {
    const cs = new CollisionSystem();
    assert.equal(cs.name, "collision-system");
    assert.equal(cs.enabled, true);
    assert.equal(cs.config.restitution, 0.2);
    assert.equal(cs.config.positionalCorrection, 0.8);
    assert.deepEqual(cs.config.collidableTypes, ["soul", "dynamic"]);
  });

  it("accepts custom config", () => {
    const cs = new CollisionSystem({ restitution: 0.5, checkYAxis: true });
    assert.equal(cs.config.restitution, 0.5);
    assert.equal(cs.config.checkYAxis, true);
  });

  it("detects and separates overlapping souls on x axis", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.5, 0); // 0.5m apart, AABBs overlap (each 0.5 half-extent)
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    // After collision resolution, bodies should be separated (no overlap).
    // Use strict inequality: touching (aMax == bMin) is not overlapping.
    const aMin = a.aabbMin(), aMax = a.aabbMax();
    const bMin = b.aabbMin(), bMax = b.aabbMax();
    const stillOverlap = aMin.x < bMax.x && aMax.x > bMin.x &&
                          aMin.z < bMax.z && aMax.z > bMin.z;
    assert.ok(!stillOverlap, "souls should be separated after collision resolution");
  });

  it("detects and separates overlapping souls on z axis", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0, 0.5); // overlap on z axis
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    const aMin = a.aabbMin(), aMax = a.aabbMax();
    const bMin = b.aabbMin(), bMax = b.aabbMax();
    const stillOverlap = aMin.x < bMax.x && aMax.x > bMin.x &&
                          aMin.z < bMax.z && aMax.z > bMin.z;
    assert.ok(!stillOverlap, "souls should be separated on z axis");
  });

  it("does not separate non-overlapping souls", () => {
    const world = makeWorld();
    const cs = new CollisionSystem();
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 5, 0); // 5m apart, no overlap
    const origAX = a.position.x;
    const origBX = b.position.x;
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    assert.equal(a.position.x, origAX, "non-overlapping soul A should not move");
    assert.equal(b.position.x, origBX, "non-overlapping soul B should not move");
  });

  it("applies velocity response with restitution", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0.8, positionalCorrection: 0 });
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.5, 0);
    a.velocity = new Vector3(2, 0, 0); // moving toward b
    b.velocity = new Vector3(0, 0, 0);
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    // After collision, a should bounce back (negative x velocity) or at least slow down.
    assert.ok(a.velocity.x < 2, `soul A should slow down or bounce, got vx=${a.velocity.x.toFixed(2)}`);
  });

  it("respects collides=false state flag", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ respectCollidesFlag: true });
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.5, 0);
    b.state.set("collides", false); // b should not collide
    const origAX = a.position.x;
    const origBX = b.position.x;
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    // Since b has collides=false, no collision should be resolved.
    assert.equal(a.position.x, origAX, "soul A should not move when b has collides=false");
    assert.equal(b.position.x, origBX, "soul B should not move with collides=false");
  });

  it("only collides configured entity types", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ collidableTypes: ["soul"] });
    world.addSystem(cs);

    const soul = makeSoul("soul", 0, 0);
    const dynamic = new GameObject({
      id: "dyn", name: "dyn", type: "dynamic",
      position: { x: 0.5, y: 0, z: 0 },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      mass: 1,
    });
    const origSoulX = soul.position.x;
    const origDynX = dynamic.position.x;
    world.addEntity(soul);
    world.addEntity(dynamic);

    world.step(1 / 60);

    // dynamic is not in collidableTypes, so no collision.
    assert.equal(soul.position.x, origSoulX, "soul should not collide with non-collidable type");
    assert.equal(dynamic.position.x, origDynX, "dynamic should not be affected");
  });

  it("static body does not move during collision", () => {
    const world = makeWorld();
    // Create collision system that includes static type from the start.
    const cs = new CollisionSystem({
      collidableTypes: ["soul", "static"],
      restitution: 0,
      positionalCorrection: 1.0,
      slop: 0,
    });
    world.addSystem(cs);

    const soul = makeSoul("soul", 0, 0);
    const wall = new GameObject({
      id: "wall", name: "wall", type: "static",
      position: { x: 0.5, y: 0, z: 0 },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      mass: 0,
    });

    const origWallX = wall.position.x;
    world.addEntity(soul);
    world.addEntity(wall);

    world.step(1 / 60);

    assert.equal(wall.position.x, origWallX, "static wall should not move");
    // Soul should be pushed away from wall (left, since wall is to the right).
    assert.ok(soul.position.x < 0, `soul should be pushed left, got x=${soul.position.x.toFixed(3)}`);
  });

  it("records collision state on entities", () => {
    const world = makeWorld();
    const cs = new CollisionSystem();
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.5, 0);
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    assert.ok(a.state.get("lastCollisionAt") !== undefined, "soul A should have lastCollisionAt");
    assert.equal(a.state.get("lastCollidedWith"), "b", "soul A should record lastCollidedWith=b");
    assert.equal(b.state.get("lastCollidedWith"), "a", "soul B should record lastCollidedWith=a");
  });

  it("multiple overlapping souls all get separated", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    // 3 souls all overlapping at origin.
    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.2, 0);
    const c = makeSoul("c", 0, 0.2);
    world.addEntity(a);
    world.addEntity(b);
    world.addEntity(c);

    // Step multiple times to resolve all overlaps.
    for (let i = 0; i < 20; i++) world.step(1 / 60);

    // Check no pair overlaps (with small tolerance for floating point / asymptotic convergence).
    const souls = [a, b, c];
    const TOLERANCE = 0.02; // 2cm — anything less is "touching", not "overlapping"
    for (let i = 0; i < souls.length; i++) {
      for (let j = i + 1; j < souls.length; j++) {
        const s1 = souls[i], s2 = souls[j];
        const overlapX = Math.min(s1.aabbMax().x, s2.aabbMax().x) - Math.max(s1.aabbMin().x, s2.aabbMin().x);
        const overlapZ = Math.min(s1.aabbMax().z, s2.aabbMax().z) - Math.max(s1.aabbMin().z, s2.aabbMin().z);
        const overlapping = overlapX > TOLERANCE && overlapZ > TOLERANCE;
        assert.ok(!overlapping, `souls ${s1.id} and ${s2.id} should not overlap (overlapX=${overlapX.toFixed(3)}, overlapZ=${overlapZ.toFixed(3)})`);
      }
    }
  });

  it("disabled system does nothing", () => {
    const world = makeWorld();
    const cs = new CollisionSystem();
    cs.enabled = false;
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.5, 0);
    const origAX = a.position.x;
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    assert.equal(a.position.x, origAX, "disabled collision system should not move entities");
  });

  it("tracks statistics", () => {
    const world = makeWorld();
    const cs = new CollisionSystem();
    world.addSystem(cs);

    const a = makeSoul("a", 0, 0);
    const b = makeSoul("b", 0.5, 0);
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    const stats = cs.getStats();
    assert.ok(stats.pairsChecked >= 1, "should check at least 1 pair");
    assert.ok(stats.collisionsDetected >= 1, "should detect at least 1 collision");
    assert.ok(stats.collisionsResolved >= 1, "should resolve at least 1 collision");

    cs.resetStats();
    const reset = cs.getStats();
    assert.equal(reset.pairsChecked, 0);
    assert.equal(reset.collisionsDetected, 0);
  });

  // --- Spatial Hash Broad Phase Integration Tests ---

  it("spatial hash broad phase detects same collisions as brute force", () => {
    // Two overlapping souls — both broad phases should detect and resolve.
    const worldBF = makeWorld();
    const csBF = new CollisionSystem({ broadPhase: 'brute-force' });
    worldBF.addSystem(csBF);
    const aBF = makeSoul("a", 0, 0);
    const bBF = makeSoul("b", 0.5, 0);
    worldBF.addEntity(aBF);
    worldBF.addEntity(bBF);
    worldBF.step(1 / 60);

    const worldSH = makeWorld();
    const csSH = new CollisionSystem({ broadPhase: 'spatial-hash', spatialHashCellSize: 5 });
    worldSH.addSystem(csSH);
    const aSH = makeSoul("a", 0, 0);
    const bSH = makeSoul("b", 0.5, 0);
    worldSH.addEntity(aSH);
    worldSH.addEntity(bSH);
    worldSH.step(1 / 60);

    // Both should detect the collision.
    assert.ok(csBF.getStats().collisionsDetected >= 1, "brute force should detect collision");
    assert.ok(csSH.getStats().collisionsDetected >= 1, "spatial hash should detect collision");

    // Both should produce the same separation result (within floating point tolerance).
    assert.ok(Math.abs(aBF.position.x - aSH.position.x) < 0.001,
      `soul A x should match: BF=${aBF.position.x.toFixed(4)}, SH=${aSH.position.x.toFixed(4)}`);
    assert.ok(Math.abs(bBF.position.x - bSH.position.x) < 0.001,
      `soul B x should match: BF=${bBF.position.x.toFixed(4)}, SH=${bSH.position.x.toFixed(4)}`);
  });

  it("spatial hash broad phase reduces pair checks for distributed entities", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ broadPhase: 'spatial-hash', spatialHashCellSize: 5 });
    world.addSystem(cs);

    // 20 souls spread across a 50x50 world — most won't be in the same cell.
    for (let i = 0; i < 20; i++) {
      const x = (i % 5) * 10 + 2;
      const z = Math.floor(i / 5) * 10 + 2;
      world.addEntity(makeSoul(`soul_${i}`, x, z));
    }

    cs.resetStats();
    world.step(1 / 60);

    const stats = cs.getStats();
    // Brute force would check C(20,2) = 190 pairs.
    // Spatial hash with 1 soul per 5m cell should check far fewer.
    assert.ok(stats.pairsChecked < 190,
      `spatial hash should check fewer than 190 pairs, got ${stats.pairsChecked}`);
    // No collisions since souls are 10m apart (well outside 1m AABB).
    assert.equal(stats.collisionsDetected, 0, "no collisions expected for distributed souls");
  });

  it("spatial hash broad phase handles clustered entities", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ broadPhase: 'spatial-hash', spatialHashCellSize: 5, maxPairsPerTick: 1000 });
    world.addSystem(cs);

    // 5 souls all clustered at origin — all in the same cell.
    for (let i = 0; i < 5; i++) {
      world.addEntity(makeSoul(`soul_${i}`, i * 0.3, 0));
    }

    cs.resetStats();
    world.step(1 / 60);

    const stats = cs.getStats();
    // 5 souls in same cell = C(5,2) = 10 pairs.
    assert.equal(stats.pairsChecked, 10, `should check 10 pairs for 5 clustered souls, got ${stats.pairsChecked}`);
    assert.ok(stats.collisionsDetected > 0, "should detect collisions among clustered souls");
  });

  it("spatial hash broad phase respects maxPairsPerTick", () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ broadPhase: 'spatial-hash', spatialHashCellSize: 5, maxPairsPerTick: 3 });
    world.addSystem(cs);

    // 5 souls clustered — would be 10 pairs, but capped at 3.
    for (let i = 0; i < 5; i++) {
      world.addEntity(makeSoul(`soul_${i}`, i * 0.3, 0));
    }

    cs.resetStats();
    world.step(1 / 60);

    assert.equal(cs.getStats().pairsChecked, 3, "should respect maxPairsPerTick=3");
  });

  it("spatial hash cell size config is respected", () => {
    const cs = new CollisionSystem({ broadPhase: 'spatial-hash', spatialHashCellSize: 10 });
    assert.equal(cs.config.spatialHashCellSize, 10);
    assert.equal(cs.config.broadPhase, 'spatial-hash');
  });

  it("default broad phase is brute-force for backward compatibility", () => {
    const cs = new CollisionSystem();
    assert.equal(cs.config.broadPhase, 'brute-force');
  });
});
