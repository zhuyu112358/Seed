// Tests for VisionConeSystem (M10 phase 1).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { VisionConeSystem } from "../src/vision/VisionConeSystem.js";

function makeSystem(): VisionConeSystem {
  return new VisionConeSystem();
}

describe("VisionConeSystem - Observer Management", () => {
  test("add an observer", () => {
    const system = makeSystem();
    const result = system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    assert.ok(result.success);
    const observer = system.getObserver(result.observerId!)!;
    assert.equal(observer.position.x, 0);
    assert.equal(observer.position.z, 0);
    assert.equal(observer.direction, 0);
    assert.equal(observer.config.fovAngle, 90);
    assert.equal(observer.config.viewDistance, 10);
    assert.equal(observer.active, true);
  });

  test("add observer with specific ID", () => {
    const system = makeSystem();
    const result = system.addObserver({ x: 5, z: 5 }, Math.PI / 2, undefined, "observer_1");
    assert.ok(result.success);
    assert.equal(result.observerId, "observer_1");
    assert.equal(system.getObserver("observer_1")!.direction, Math.PI / 2);
  });

  test("reject duplicate observer ID", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, undefined, "obs_1");
    const result = system.addObserver({ x: 1, z: 1 }, 0, undefined, "obs_1");
    assert.ok(!result.success);
  });

  test("remove observer", () => {
    const system = makeSystem();
    const added = system.addObserver({ x: 0, z: 0 }, 0);
    const result = system.removeObserver(added.observerId!);
    assert.ok(result.success);
    assert.equal(system.getObserver(added.observerId!), undefined);
  });

  test("set observer position", () => {
    const system = makeSystem();
    const added = system.addObserver({ x: 0, z: 0 }, 0);
    system.setObserverPosition(added.observerId!, { x: 10, z: 20 });
    assert.equal(system.getObserver(added.observerId!)!.position.x, 10);
    assert.equal(system.getObserver(added.observerId!)!.position.z, 20);
  });

  test("set observer direction", () => {
    const system = makeSystem();
    const added = system.addObserver({ x: 0, z: 0 }, 0);
    system.setObserverDirection(added.observerId!, Math.PI); // Facing -x.
    assert.equal(system.getObserver(added.observerId!)!.direction, Math.PI);
  });

  test("set observer config", () => {
    const system = makeSystem();
    const added = system.addObserver({ x: 0, z: 0 }, 0);
    system.setObserverConfig(added.observerId!, { fovAngle: 120, viewDistance: 15 });
    assert.equal(system.getObserver(added.observerId!)!.config.fovAngle, 120);
    assert.equal(system.getObserver(added.observerId!)!.config.viewDistance, 15);
  });

  test("set observer active state", () => {
    const system = makeSystem();
    const added = system.addObserver({ x: 0, z: 0 }, 0);
    system.setObserverActive(added.observerId!, false);
    assert.equal(system.getObserver(added.observerId!)!.active, false);
    assert.equal(system.getActiveObservers().length, 0);
  });

  test("observer count", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0);
    system.addObserver({ x: 1, z: 1 }, 0);
    system.addObserver({ x: 2, z: 2 }, 0);
    assert.equal(system.observerCount, 3);
  });
});

describe("VisionConeSystem - Visibility Calculations", () => {
  test("target directly in front is visible", () => {
    const system = makeSystem();
    // Observer at origin facing +x (direction 0), 90-degree FOV.
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    // Target at (5, 0) - directly in front, within FOV (angle 0).
    assert.equal(system.isTargetVisible(obsId, { x: 5, z: 0 }), true);
  });

  test("target behind observer is not visible", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    // Target at (-5, 0) - directly behind, angle 180 > 45 (half FOV).
    assert.equal(system.isTargetVisible(obsId, { x: -5, z: 0 }), false);
  });

  test("target at FOV edge is visible", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    // Target at 45 degrees (half of 90 FOV) - at the edge, should be visible.
    // tan(45°) = 1, so z = x for 45 degrees.
    assert.equal(system.isTargetVisible(obsId, { x: 5, z: 5 }), true);
  });

  test("target just outside FOV is not visible", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    // Target at 60 degrees - outside 45-degree half FOV.
    // tan(60°) ≈ 1.732, so z = 1.732 * x.
    assert.equal(system.isTargetVisible(obsId, { x: 5, z: 8.66 }), false);
  });

  test("target beyond view distance is not visible", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 5 });
    const obsId = system.getObservers()[0].id;
    // Target at (10, 0) - directly in front but beyond view distance 5.
    assert.equal(system.isTargetVisible(obsId, { x: 10, z: 0 }), false);
  });

  test("target at observer position is visible", () => {
    const system = makeSystem();
    system.addObserver({ x: 5, z: 5 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    assert.equal(system.isTargetVisible(obsId, { x: 5, z: 5 }), true);
  });

  test("inactive observer cannot see", () => {
    const system = makeSystem();
    const added = system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    system.setObserverActive(added.observerId!, false);
    assert.equal(system.isTargetVisible(added.observerId!, { x: 5, z: 0 }), false);
  });

  test("compute angle to target", () => {
    const system = makeSystem();
    // Observer facing +x (direction 0).
    const angle = system.computeAngleToTarget({ x: 0, z: 0 }, 0, { x: 0, z: 5 });
    // Target at (0, 5) is 90 degrees counterclockwise from +x.
    assert.ok(Math.abs(angle - 90) < 0.01, `Angle should be ~90, got ${angle}`);
  });

  test("compute distance", () => {
    const system = makeSystem();
    const dist = system.computeDistance({ x: 0, z: 0 }, { x: 3, z: 4 });
    assert.equal(dist, 5); // 3-4-5 triangle.
  });

  test("narrow FOV sees less", () => {
    const system = makeSystem();
    // 30-degree FOV (15-degree half).
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 30, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    // Target at 20 degrees - outside 15-degree half FOV.
    assert.equal(system.isTargetVisible(obsId, { x: 5, z: 1.82 }), false);
    // Target at 10 degrees - inside.
    assert.equal(system.isTargetVisible(obsId, { x: 5, z: 0.88 }), true);
  });

  test("wide FOV sees more", () => {
    const system = makeSystem();
    // 180-degree FOV (90-degree half).
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 180, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;
    // Target at 90 degrees - at edge of 180 FOV.
    assert.equal(system.isTargetVisible(obsId, { x: 0, z: 5 }), true);
    // Target at 100 degrees - just outside.
    assert.equal(system.isTargetVisible(obsId, { x: -1, z: 5.67 }), false);
  });
});

describe("VisionConeSystem - Entity Filtering", () => {
  test("filter visible entities", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;

    const entities = [
      { id: "e1", position: { x: 5, z: 0 } },   // Visible (directly in front).
      { id: "e2", position: { x: 5, z: 3 } },   // Visible (~31 degrees).
      { id: "e3", position: { x: -5, z: 0 } },  // Not visible (behind).
      { id: "e4", position: { x: 15, z: 0 } },  // Not visible (beyond distance).
      { id: "e5", position: { x: 3, z: 4 } },   // Visible (~53 degrees, > 45 half FOV → not visible).
    ];

    const visible = system.getVisibleEntities(obsId, entities);
    // e1 (0°), e2 (31°) should be visible. e5 (53°) is outside 45° half FOV.
    assert.equal(visible.length, 2);
    assert.equal(visible[0].entityId, "e1"); // Closest first (distance 5).
    assert.equal(visible[1].entityId, "e2"); // Distance ~5.83.
  });

  test("visible entities sorted by distance", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 360, viewDistance: 20 });
    const obsId = system.getObservers()[0].id;

    const entities = [
      { id: "far", position: { x: 15, z: 0 } },
      { id: "near", position: { x: 3, z: 0 } },
      { id: "mid", position: { x: 8, z: 0 } },
    ];

    const visible = system.getVisibleEntities(obsId, entities);
    assert.equal(visible.length, 3);
    assert.equal(visible[0].entityId, "near");
    assert.equal(visible[1].entityId, "mid");
    assert.equal(visible[2].entityId, "far");
  });

  test("get target visibility returns details", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 });
    const obsId = system.getObservers()[0].id;

    const visibility = system.getTargetVisibility(obsId, "target_1", { x: 3, z: 4 });
    // (3,4) is at 53.13 degrees - outside 45 half FOV, so null.
    assert.equal(visibility, null);

    const visibility2 = system.getTargetVisibility(obsId, "target_2", { x: 4, z: 3 });
    // (4,3) is at 36.87 degrees - inside 45 half FOV.
    assert.ok(visibility2);
    assert.equal(visibility2!.entityId, "target_2");
    assert.equal(visibility2!.distance, 5);
    assert.ok(Math.abs(visibility2!.angleToEntity - 36.87) < 0.1);
  });

  test("find observers seeing target", () => {
    const system = makeSystem();
    // Observer 1 facing +x, can see (5, 0).
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 10 }, "obs_1");
    // Observer 2 facing -x, cannot see (5, 0).
    system.addObserver({ x: 0, z: 0 }, Math.PI, { fovAngle: 90, viewDistance: 10 }, "obs_2");
    // Observer 3 facing +x but view distance 3, cannot see (5, 0).
    system.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 3 }, "obs_3");

    const observers = system.findObserversSeeingTarget({ x: 5, z: 0 });
    assert.equal(observers.length, 1);
    assert.equal(observers[0], "obs_1");
  });
});

describe("VisionConeSystem - Serialization", () => {
  test("serialize and deserialize preserves observers", () => {
    const system = makeSystem();
    system.addObserver({ x: 1, z: 2 }, Math.PI / 4, { fovAngle: 120, viewDistance: 15 }, "obs_1");
    system.addObserver({ x: 3, z: 4 }, 0, { fovAngle: 60, viewDistance: 8 }, "obs_2");
    const data = system.serialize();

    const system2 = makeSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.observerCount, 2);

    const obs1 = system2.getObserver("obs_1")!;
    assert.equal(obs1.position.x, 1);
    assert.equal(obs1.position.z, 2);
    assert.equal(obs1.direction, Math.PI / 4);
    assert.equal(obs1.config.fovAngle, 120);
    assert.equal(obs1.config.viewDistance, 15);
  });

  test("stop clears all observers", () => {
    const system = makeSystem();
    system.addObserver({ x: 0, z: 0 }, 0);
    system.addObserver({ x: 1, z: 1 }, 0);
    system.stop();
    assert.equal(system.observerCount, 0);
  });
});
