// FlockingSystem: Implements Reynolds' flocking behavior (separation, alignment, cohesion).
// All behavior parameters are configurable via FlockConfig.
// Seed only provides the flocking calculation framework; target selection and
// high-level decision making are handled by the application layer/SoulArena.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  FlockConfig,
  DEFAULT_FLOCK_CONFIG,
  FlockVector2,
  FlockAgent,
  FlockResult,
} from "./FlockingTypes.js";

export class FlockingSystem {
  readonly name = "flocking";
  enabled = true;
  private agents = new Map<string, FlockAgent>();
  private agentCounter = 0;
  /** Flocking behavior configuration. */
  config: FlockConfig;

  constructor(config?: Partial<FlockConfig>) {
    this.config = { ...DEFAULT_FLOCK_CONFIG, ...config };
  }

  /** Generate a unique agent ID. */
  private generateId(): string {
    this.agentCounter++;
    return `flock_${Date.now()}_${this.agentCounter}`;
  }

  /** Vector operations. */
  private add(a: FlockVector2, b: FlockVector2): FlockVector2 {
    return { x: a.x + b.x, z: a.z + b.z };
  }

  private sub(a: FlockVector2, b: FlockVector2): FlockVector2 {
    return { x: a.x - b.x, z: a.z - b.z };
  }

  private mul(a: FlockVector2, scalar: number): FlockVector2 {
    return { x: a.x * scalar, z: a.z * scalar };
  }

  private div(a: FlockVector2, scalar: number): FlockVector2 {
    if (scalar === 0) return { x: 0, z: 0 };
    return { x: a.x / scalar, z: a.z / scalar };
  }

  private magnitude(a: FlockVector2): number {
    return Math.sqrt(a.x * a.x + a.z * a.z);
  }

  private normalize(a: FlockVector2): FlockVector2 {
    const mag = this.magnitude(a);
    if (mag === 0) return { x: 0, z: 0 };
    return { x: a.x / mag, z: a.z / mag };
  }

  private limit(a: FlockVector2, max: number): FlockVector2 {
    const mag = this.magnitude(a);
    if (mag > max && mag > 0) {
      return this.mul(this.normalize(a), max);
    }
    return a;
  }

  private distance(a: FlockVector2, b: FlockVector2): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** Add a new agent to the flocking system. */
  addAgent(position: FlockVector2, velocity?: FlockVector2): FlockResult {
    const id = this.generateId();
    const agent: FlockAgent = {
      id,
      position: { ...position },
      velocity: velocity ? { ...velocity } : { x: 0, z: 0 },
      acceleration: { x: 0, z: 0 },
      target: null,
      active: true,
    };
    this.agents.set(id, agent);
    return { success: true, agentId: id };
  }

  /** Remove an agent. */
  removeAgent(agentId: string): FlockResult {
    if (!this.agents.has(agentId)) return { success: false, error: "Agent not found" };
    this.agents.delete(agentId);
    return { success: true, agentId };
  }

  /** Get an agent by ID. */
  getAgent(agentId: string): FlockAgent | undefined {
    return this.agents.get(agentId);
  }

  /** Get all agents. */
  getAgents(): FlockAgent[] {
    return Array.from(this.agents.values());
  }

  /** Get active agents only. */
  getActiveAgents(): FlockAgent[] {
    return Array.from(this.agents.values()).filter((a) => a.active);
  }

  /** Set an agent's target position. */
  setAgentTarget(agentId: string, target: FlockVector2 | null): FlockResult {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: "Agent not found" };
    agent.target = target ? { ...target } : null;
    return { success: true, agentId };
  }

  /** Set an agent's active state. */
  setAgentActive(agentId: string, active: boolean): FlockResult {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: "Agent not found" };
    agent.active = active;
    return { success: true, agentId };
  }

  /** Number of agents. */
  get agentCount(): number {
    return this.agents.size;
  }

  /** Find neighbors within perception radius. */
  private findNeighbors(agent: FlockAgent): FlockAgent[] {
    const neighbors: FlockAgent[] = [];
    for (const other of this.agents.values()) {
      if (other.id === agent.id || !other.active) continue;
      const dist = this.distance(agent.position, other.position);
      if (dist < this.config.perceptionRadius) {
        neighbors.push(other);
      }
    }
    return neighbors;
  }

  /** Compute separation force: steer away from nearby agents. */
  private computeSeparation(agent: FlockAgent, neighbors: FlockAgent[]): FlockVector2 {
    let steer: FlockVector2 = { x: 0, z: 0 };
    let count = 0;
    for (const other of neighbors) {
      const dist = this.distance(agent.position, other.position);
      if (dist > 0 && dist < this.config.separationRadius) {
        // Vector pointing away from neighbor, weighted by distance.
        const diff = this.sub(agent.position, other.position);
        const normalized = this.normalize(diff);
        const weighted = this.div(normalized, dist);
        steer = this.add(steer, weighted);
        count++;
      }
    }
    if (count > 0) {
      steer = this.div(steer, count);
      if (this.magnitude(steer) > 0) {
        steer = this.normalize(steer);
        steer = this.mul(steer, this.config.maxSpeed);
        steer = this.sub(steer, agent.velocity);
        steer = this.limit(steer, this.config.maxForce);
      }
    }
    return steer;
  }

  /** Compute alignment force: match velocity of nearby agents. */
  private computeAlignment(agent: FlockAgent, neighbors: FlockAgent[]): FlockVector2 {
    let sum: FlockVector2 = { x: 0, z: 0 };
    let count = 0;
    for (const other of neighbors) {
      sum = this.add(sum, other.velocity);
      count++;
    }
    if (count > 0) {
      sum = this.div(sum, count);
      sum = this.normalize(sum);
      sum = this.mul(sum, this.config.maxSpeed);
      let steer = this.sub(sum, agent.velocity);
      steer = this.limit(steer, this.config.maxForce);
      return steer;
    }
    return { x: 0, z: 0 };
  }

  /** Compute cohesion force: move toward center of nearby agents. */
  private computeCohesion(agent: FlockAgent, neighbors: FlockAgent[]): FlockVector2 {
    let center: FlockVector2 = { x: 0, z: 0 };
    let count = 0;
    for (const other of neighbors) {
      center = this.add(center, other.position);
      count++;
    }
    if (count > 0) {
      center = this.div(center, count);
      // Desired velocity toward center.
      const desired = this.sub(center, agent.position);
      const dist = this.magnitude(desired);
      if (dist > 0) {
        const normalized = this.normalize(desired);
        const desiredVel = this.mul(normalized, this.config.maxSpeed);
        let steer = this.sub(desiredVel, agent.velocity);
        steer = this.limit(steer, this.config.maxForce);
        return steer;
      }
    }
    return { x: 0, z: 0 };
  }

  /** Compute seek force toward a target. */
  private computeSeek(agent: FlockAgent, target: FlockVector2): FlockVector2 {
    const desired = this.sub(target, agent.position);
    const dist = this.magnitude(desired);
    if (dist === 0) return { x: 0, z: 0 };
    const normalized = this.normalize(desired);
    // Slow down when close to target.
    const speed = dist < 2 ? this.config.maxSpeed * (dist / 2) : this.config.maxSpeed;
    const desiredVel = this.mul(normalized, speed);
    let steer = this.sub(desiredVel, agent.velocity);
    steer = this.limit(steer, this.config.maxForce);
    return steer;
  }

  /** Compute total flocking acceleration for an agent. */
  computeFlocking(agent: FlockAgent): FlockVector2 {
    const neighbors = this.findNeighbors(agent);
    let total: FlockVector2 = { x: 0, z: 0 };

    if (neighbors.length > 0) {
      const separation = this.mul(this.computeSeparation(agent, neighbors), this.config.separationWeight);
      const alignment = this.mul(this.computeAlignment(agent, neighbors), this.config.alignmentWeight);
      const cohesion = this.mul(this.computeCohesion(agent, neighbors), this.config.cohesionWeight);
      total = this.add(total, separation);
      total = this.add(total, alignment);
      total = this.add(total, cohesion);
    }

    // Seek target if set.
    if (agent.target) {
      const seek = this.computeSeek(agent, agent.target);
      total = this.add(total, seek);
      // Stop if very close to target.
      const dist = this.distance(agent.position, agent.target);
      if (dist < 0.5) {
        agent.velocity = { x: 0, z: 0 };
        return { x: 0, z: 0 };
      }
    }

    return total;
  }

  /** Update a single agent's physics. */
  updateAgent(agent: FlockAgent, dt: number): void {
    if (!agent.active) return;
    agent.acceleration = this.computeFlocking(agent);
    agent.velocity = this.add(agent.velocity, this.mul(agent.acceleration, dt));
    agent.velocity = this.limit(agent.velocity, this.config.maxSpeed);
    agent.position = this.add(agent.position, this.mul(agent.velocity, dt));
  }

  /** WorldSystem interface: update all agents each tick. */
  tick(dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    for (const agent of this.agents.values()) {
      this.updateAgent(agent, dt);
    }
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.agents.clear();
    this.agentCounter = 0;
  }

  /** Serialize all agents. */
  serialize(): Record<string, unknown> {
    const agents: Record<string, FlockAgent> = {};
    for (const [id, agent] of this.agents) {
      agents[id] = agent;
    }
    return { agents, agentCounter: this.agentCounter, config: this.config };
  }

  /** Deserialize agents. */
  deserialize(data: Record<string, unknown>): void {
    if (data.agents && typeof data.agents === "object") {
      for (const [id, agent] of Object.entries(data.agents as Record<string, FlockAgent>)) {
        this.agents.set(id, agent);
      }
    }
    if (typeof data.agentCounter === "number") {
      this.agentCounter = data.agentCounter;
    }
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_FLOCK_CONFIG, ...(data.config as Partial<FlockConfig>) };
    }
  }
}
