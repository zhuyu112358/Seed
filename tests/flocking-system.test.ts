// Tests for FlockingSystem (M9 phase 1): Reynolds flocking behavior.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { FlockingSystem } from "../src/flocking/FlockingSystem.js";

function makeWorld(): World {
  return new World({ name: "flocking-test", tickRate: 60 });
}

describe("FlockingSystem - Agent Management", () => {
  test("add an agent", () => {
    const system = new FlockingSystem();
    const result = system.addAgent({ x: 0, z: 0 });
    assert.ok(result.success);
    const agent = system.getAgent(result.agentId!)!;
    assert.equal(agent.position.x, 0);
    assert.equal(agent.position.z, 0);
    assert.equal(agent.active, true);
  });

  test("add agent with initial velocity", () => {
    const system = new FlockingSystem();
    const result = system.addAgent({ x: 0, z: 0 }, { x: 1, z: 0 });
    assert.ok(result.success);
    assert.equal(system.getAgent(result.agentId!)!.velocity.x, 1);
  });

  test("remove an agent", () => {
    const system = new FlockingSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    const result = system.removeAgent(added.agentId!);
    assert.ok(result.success);
    assert.equal(system.getAgent(added.agentId!), undefined);
  });

  test("remove nonexistent agent fails", () => {
    const system = new FlockingSystem();
    const result = system.removeAgent("nonexistent");
    assert.ok(!result.success);
  });

  test("set agent target", () => {
    const system = new FlockingSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    system.setAgentTarget(added.agentId!, { x: 10, z: 10 });
    assert.deepEqual(system.getAgent(added.agentId!)!.target, { x: 10, z: 10 });
  });

  test("set agent active state", () => {
    const system = new FlockingSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    system.setAgentActive(added.agentId!, false);
    assert.equal(system.getAgent(added.agentId!)!.active, false);
    assert.equal(system.getActiveAgents().length, 0);
  });

  test("agent count", () => {
    const system = new FlockingSystem();
    system.addAgent({ x: 0, z: 0 });
    system.addAgent({ x: 5, z: 5 });
    system.addAgent({ x: 10, z: 10 });
    assert.equal(system.agentCount, 3);
  });
});

describe("FlockingSystem - Separation", () => {
  test("agents move apart when too close", () => {
    const system = new FlockingSystem({ perceptionRadius: 10, separationRadius: 5, maxSpeed: 5, maxForce: 3 });
    const a1 = system.addAgent({ x: 0, z: 0 }, { x: 0, z: 0 });
    const a2 = system.addAgent({ x: 1, z: 0 }, { x: 0, z: 0 });

    // Step several ticks.
    for (let i = 0; i < 60; i++) {
      system.updateAgent(system.getAgent(a1.agentId!)!, 1 / 60);
      system.updateAgent(system.getAgent(a2.agentId!)!, 1 / 60);
    }

    const dist = Math.sqrt(
      Math.pow(system.getAgent(a1.agentId!)!.position.x - system.getAgent(a2.agentId!)!.position.x, 2) +
      Math.pow(system.getAgent(a1.agentId!)!.position.z - system.getAgent(a2.agentId!)!.position.z, 2),
    );
    // Agents should have moved apart (distance > initial 1.0).
    assert.ok(dist > 1.0, `Agents should move apart, distance: ${dist}`);
  });

  test("separation weight affects behavior", () => {
    // High separation should cause more aggressive avoidance.
    const systemHigh = new FlockingSystem({ separationWeight: 5.0, perceptionRadius: 10, separationRadius: 5, maxSpeed: 3, maxForce: 2 });
    systemHigh.addAgent({ x: 0, z: 0 });
    systemHigh.addAgent({ x: 1, z: 0 });
    for (let i = 0; i < 20; i++) {
      for (const agent of systemHigh.getAgents()) systemHigh.updateAgent(agent, 1 / 60);
    }
    const distHigh = Math.sqrt(
      Math.pow(systemHigh.getAgents()[0].position.x - systemHigh.getAgents()[1].position.x, 2),
    );

    // Low separation.
    const systemLow = new FlockingSystem({ separationWeight: 0.1, perceptionRadius: 10, separationRadius: 5, maxSpeed: 3, maxForce: 2 });
    systemLow.addAgent({ x: 0, z: 0 });
    systemLow.addAgent({ x: 1, z: 0 });
    for (let i = 0; i < 20; i++) {
      for (const agent of systemLow.getAgents()) systemLow.updateAgent(agent, 1 / 60);
    }
    const distLow = Math.sqrt(
      Math.pow(systemLow.getAgents()[0].position.x - systemLow.getAgents()[1].position.x, 2),
    );

    assert.ok(distHigh > distLow, `High separation (${distHigh}) should cause more distance than low (${distLow})`);
  });
});

describe("FlockingSystem - Alignment", () => {
  test("agents align velocity with neighbors", () => {
    const system = new FlockingSystem({ alignmentWeight: 3.0, separationWeight: 0.1, cohesionWeight: 0.1, perceptionRadius: 10, maxSpeed: 3, maxForce: 1 });
    // Agent 1 moving right, agent 2 stationary.
    system.addAgent({ x: 0, z: 0 }, { x: 2, z: 0 });
    system.addAgent({ x: 2, z: 0 }, { x: 0, z: 0 });

    for (let i = 0; i < 60; i++) {
      for (const agent of system.getAgents()) system.updateAgent(agent, 1 / 60);
    }

    // Agent 2 should start moving right (positive x velocity).
    const agent2Vel = system.getAgents()[1].velocity;
    assert.ok(agent2Vel.x > 0.5, `Agent 2 should align to right, velocity x: ${agent2Vel.x}`);
  });
});

describe("FlockingSystem - Cohesion", () => {
  test("agents move toward group center", () => {
    const system = new FlockingSystem({ cohesionWeight: 3.0, separationWeight: 0.1, alignmentWeight: 0.1, perceptionRadius: 20, maxSpeed: 2, maxForce: 1 });
    // Three agents spread out.
    system.addAgent({ x: -10, z: 0 });
    system.addAgent({ x: 10, z: 0 });
    system.addAgent({ x: 0, z: 10 });

    for (let i = 0; i < 120; i++) {
      for (const agent of system.getAgents()) system.updateAgent(agent, 1 / 60);
    }

    // Agents should have moved closer to center (0, ~3.3).
    const positions = system.getAgents().map((a) => a.position);
    const centerX = positions.reduce((s, p) => s + p.x, 0) / 3;
    const centerZ = positions.reduce((s, p) => s + p.z, 0) / 3;
    // Center should be closer to origin than initial (0, 3.33).
    const centerDist = Math.sqrt(centerX * centerX + centerZ * centerZ);
    assert.ok(centerDist < 3.0, `Group center should move toward origin, dist: ${centerDist}`);
  });
});

describe("FlockingSystem - Seek Target", () => {
  test("agent moves toward target", () => {
    const system = new FlockingSystem({ maxSpeed: 5, maxForce: 3 });
    const added = system.addAgent({ x: 0, z: 0 });
    system.setAgentTarget(added.agentId!, { x: 10, z: 0 });

    for (let i = 0; i < 120; i++) system.updateAgent(system.getAgent(added.agentId!)!, 1 / 60);

    const pos = system.getAgent(added.agentId!)!.position;
    assert.ok(pos.x > 3, `Agent should move toward target x=10, current x: ${pos.x}`);
  });

  test("agent stops near target", () => {
    const system = new FlockingSystem({ maxSpeed: 2, maxForce: 1 });
    const added = system.addAgent({ x: 0, z: 0 });
    system.setAgentTarget(added.agentId!, { x: 5, z: 0 });

    for (let i = 0; i < 200; i++) system.updateAgent(system.getAgent(added.agentId!)!, 1 / 60);

    const agent = system.getAgent(added.agentId!)!;
    const dist = Math.sqrt(Math.pow(agent.position.x - 5, 2) + Math.pow(agent.position.z, 2));
    assert.ok(dist < 1.0, `Agent should stop near target, distance: ${dist}`);
  });
});

describe("FlockingSystem - World Integration", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const system = new FlockingSystem({ maxSpeed: 5, maxForce: 3 });
    world.addSystem(system);
    system.addAgent({ x: 0, z: 0 });
    system.setAgentTarget(system.getAgents()[0].id, { x: 5, z: 0 });

    for (let i = 0; i < 120; i++) world.step(1 / 60);

    assert.ok(system.getAgents()[0].position.x > 1, "Agent should move via world tick");
  });

  test("inactive agents do not move", () => {
    const system = new FlockingSystem();
    const added = system.addAgent({ x: 0, z: 0 });
    system.setAgentTarget(added.agentId!, { x: 10, z: 0 });
    system.setAgentActive(added.agentId!, false);

    for (let i = 0; i < 60; i++) system.updateAgent(system.getAgent(added.agentId!)!, 1 / 60);

    assert.deepEqual(system.getAgent(added.agentId!)!.position, { x: 0, z: 0 });
  });

  test("stop clears all agents", () => {
    const system = new FlockingSystem();
    system.addAgent({ x: 0, z: 0 });
    system.addAgent({ x: 5, z: 5 });
    system.stop();
    assert.equal(system.agentCount, 0);
  });
});

describe("FlockingSystem - Serialization", () => {
  test("serialize and deserialize preserves agents and config", () => {
    const system = new FlockingSystem({ maxSpeed: 10, separationWeight: 2.0 });
    system.addAgent({ x: 1, z: 2 }, { x: 0.5, z: 0 });
    system.addAgent({ x: 3, z: 4 });
    const data = system.serialize();

    const system2 = new FlockingSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.agentCount, 2);
    assert.equal(system2.config.maxSpeed, 10);
    assert.equal(system2.config.separationWeight, 2.0);
    assert.deepEqual(system2.getAgents()[0].position, { x: 1, z: 2 });
  });
});
