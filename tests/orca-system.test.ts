// Tests for OrcaSystem (M9 phase 2): Optimal Reciprocal Collision Avoidance.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { OrcaSystem } from "../src/orca/OrcaSystem.js";

function makeWorld(): World {
  return new World({ name: "orca-test", tickRate: 60 });
}

describe("OrcaSystem - Agent Management", () => {
  test("add an agent", () => {
    const system = new OrcaSystem();
    const result = system.addAgent({ x: 0, z: 0 });
    assert.ok(result.success);
    const agent = system.getAgent(result.agentId!)!;
    assert.equal(agent.position.x, 0);
    assert.equal(agent.active, true);
    assert.equal(agent.radius, 0.5); // default
  });

  test("add agent with velocity and radius", () => {
    const system = new OrcaSystem();
    const result = system.addAgent({ x: 0, z: 0 }, { x: 1, z: 0 }, 1.0);
    assert.ok(result.success);
    assert.equal(system.getAgent(result.agentId!)!.velocity.x, 1);
    assert.equal(system.getAgent(result.agentId!)!.radius, 1.0);
  });

  test("remove an agent", () => {
    const system = new OrcaSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    const result = system.removeAgent(added.agentId!);
    assert.ok(result.success);
    assert.equal(system.getAgent(added.agentId!), undefined);
  });

  test("remove nonexistent agent fails", () => {
    const system = new OrcaSystem();
    const result = system.removeAgent("nonexistent");
    assert.ok(!result.success);
  });

  test("set preferred velocity", () => {
    const system = new OrcaSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    system.setPreferredVelocity(added.agentId!, { x: 2, z: 0 });
    assert.deepEqual(system.getAgent(added.agentId!)!.preferredVelocity, { x: 2, z: 0 });
  });

  test("set agent active state", () => {
    const system = new OrcaSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    system.setAgentActive(added.agentId!, false);
    assert.equal(system.getAgent(added.agentId!)!.active, false);
    assert.equal(system.getActiveAgents().length, 0);
  });

  test("agent count", () => {
    const system = new OrcaSystem();
    system.addAgent({ x: 0, z: 0 });
    system.addAgent({ x: 5, z: 5 });
    assert.equal(system.agentCount, 2);
  });
});

describe("OrcaSystem - Collision Avoidance", () => {
  test("agents moving toward each other avoid collision", () => {
    const system = new OrcaSystem({ timeHorizon: 2, maxSpeed: 3, maxForce: 5, neighborDist: 15 });
    // Two agents moving directly toward each other.
    const a1 = system.addAgent({ x: -5, z: 0 }, { x: 2, z: 0 }, 0.5);
    const a2 = system.addAgent({ x: 5, z: 0 }, { x: -2, z: 0 }, 0.5);
    system.setPreferredVelocity(a1.agentId!, { x: 2, z: 0 });
    system.setPreferredVelocity(a2.agentId!, { x: -2, z: 0 });

    let minDist = Infinity;
    for (let i = 0; i < 120; i++) {
      system.updateAgent(system.getAgent(a1.agentId!)!, 1 / 60);
      system.updateAgent(system.getAgent(a2.agentId!)!, 1 / 60);
      const dist = Math.sqrt(
        Math.pow(system.getAgent(a1.agentId!)!.position.x - system.getAgent(a2.agentId!)!.position.x, 2) +
        Math.pow(system.getAgent(a1.agentId!)!.position.z - system.getAgent(a2.agentId!)!.position.z, 2),
      );
      minDist = Math.min(minDist, dist);
    }

    // Agents should maintain at least combined radius (1.0) with some margin.
    assert.ok(minDist > 0.8, `Agents should avoid collision, min distance: ${minDist}`);
  });

  test("agent deviates to avoid static obstacle", () => {
    const system = new OrcaSystem({ timeHorizon: 5, maxSpeed: 3, maxForce: 5, neighborDist: 15 });
    // Moving agent + stationary agent (obstacle), close enough for significant deviation.
    const mover = system.addAgent({ x: -5, z: 0 }, { x: 2, z: 0 }, 0.5);
    const obstacle = system.addAgent({ x: 0, z: 0 }, { x: 0, z: 0 }, 1.0);
    system.setPreferredVelocity(mover.agentId!, { x: 2, z: 0 });
    system.setPreferredVelocity(obstacle.agentId!, { x: 0, z: 0 });

    for (let i = 0; i < 180; i++) {
      system.updateAgent(system.getAgent(mover.agentId!)!, 1 / 60);
      system.updateAgent(system.getAgent(obstacle.agentId!)!, 1 / 60);
    }

    const moverPos = system.getAgent(mover.agentId!)!.position;
    // Mover should have deviated in z to avoid the obstacle.
    assert.ok(Math.abs(moverPos.z) > 0.2, `Mover should deviate in z, z: ${moverPos.z}`);
    // Mover should have passed the obstacle (x > 0).
    assert.ok(moverPos.x > 0, `Mover should pass obstacle, x: ${moverPos.x}`);
  });

  test("no avoidance needed when paths don't intersect", () => {
    const system = new OrcaSystem({ timeHorizon: 2, maxSpeed: 3, maxForce: 2, neighborDist: 10 });
    // Two agents moving parallel, far apart.
    const a1 = system.addAgent({ x: 0, z: -5 }, { x: 2, z: 0 }, 0.5);
    const a2 = system.addAgent({ x: 0, z: 5 }, { x: 2, z: 0 }, 0.5);
    system.setPreferredVelocity(a1.agentId!, { x: 2, z: 0 });
    system.setPreferredVelocity(a2.agentId!, { x: 2, z: 0 });

    const initialVel1 = { ...system.getAgent(a1.agentId!)!.velocity };
    for (let i = 0; i < 60; i++) {
      system.updateAgent(system.getAgent(a1.agentId!)!, 1 / 60);
      system.updateAgent(system.getAgent(a2.agentId!)!, 1 / 60);
    }

    // Velocity should remain close to preferred (no significant deviation).
    const vel1 = system.getAgent(a1.agentId!)!.velocity;
    assert.ok(Math.abs(vel1.x - 2) < 0.5, `Velocity should stay close to preferred, x: ${vel1.x}`);
  });
});

describe("OrcaSystem - World Integration", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const system = new OrcaSystem({ maxSpeed: 3, maxForce: 3 });
    world.addSystem(system);
    const added = system.addAgent({ x: 0, z: 0 });
    system.setPreferredVelocity(added.agentId!, { x: 2, z: 0 });

    for (let i = 0; i < 60; i++) world.step(1 / 60);

    assert.ok(system.getAgent(added.agentId!)!.position.x > 0.5, "Agent should move via world tick");
  });

  test("inactive agents do not move", () => {
    const system = new OrcaSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    system.setPreferredVelocity(added.agentId!, { x: 2, z: 0 });
    system.setAgentActive(added.agentId!, false);

    for (let i = 0; i < 60; i++) system.updateAgent(system.getAgent(added.agentId!)!, 1 / 60);

    assert.deepEqual(system.getAgent(added.agentId!)!.position, { x: 0, z: 0 });
  });

  test("stop clears all agents", () => {
    const system = new OrcaSystem();
    system.addAgent({ x: 0, z: 0 });
    system.addAgent({ x: 5, z: 5 });
    system.stop();
    assert.equal(system.agentCount, 0);
  });
});

describe("OrcaSystem - Serialization", () => {
  test("serialize and deserialize preserves agents and config", () => {
    const system = new OrcaSystem({ maxSpeed: 8, timeHorizon: 3 });
    system.addAgent({ x: 1, z: 2 }, { x: 0.5, z: 0 }, 1.0);
    system.addAgent({ x: 3, z: 4 });
    const data = system.serialize();

    const system2 = new OrcaSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.agentCount, 2);
    assert.equal(system2.config.maxSpeed, 8);
    assert.equal(system2.config.timeHorizon, 3);
    assert.deepEqual(system2.getAgents()[0].position, { x: 1, z: 2 });
    assert.equal(system2.getAgents()[0].radius, 1.0);
  });
});

describe("OrcaSystem - Multi-Agent Crowd", () => {
  test("crowd of agents maintains separation", () => {
    const system = new OrcaSystem({ timeHorizon: 2, maxSpeed: 2, maxForce: 3, neighborDist: 8, maxNeighbors: 8 });
    // Create a small crowd moving in the same direction.
    const agents: string[] = [];
    for (let i = 0; i < 5; i++) {
      const added = system.addAgent({ x: i * 1.5, z: (i % 2) * 1.5 }, { x: 1, z: 0 }, 0.4);
      system.setPreferredVelocity(added.agentId!, { x: 1, z: 0 });
      agents.push(added.agentId!);
    }

    let minDist = Infinity;
    for (let step = 0; step < 120; step++) {
      for (const id of agents) system.updateAgent(system.getAgent(id)!, 1 / 60);
      // Check all pairs.
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const dist = Math.sqrt(
            Math.pow(system.getAgent(agents[i])!.position.x - system.getAgent(agents[j])!.position.x, 2) +
            Math.pow(system.getAgent(agents[i])!.position.z - system.getAgent(agents[j])!.position.z, 2),
          );
          minDist = Math.min(minDist, dist);
        }
      }
    }

    // Crowd should maintain at least combined radius (0.8) with margin.
    assert.ok(minDist > 0.6, `Crowd should maintain separation, min distance: ${minDist}`);
  });
});
