// OrcaSystem: Optimal Reciprocal Collision Avoidance.
// Implements the ORCA algorithm for local collision avoidance among
// multiple agents. Each agent computes velocity obstacles for neighbors,
// converts them to ORCA half-planes, and solves a linear program to
// find the optimal velocity that avoids collisions.
//
// Seed only provides the avoidance calculation; preferred velocities
// (where agents want to go) are set by the application layer/SoulArena.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  OrcaConfig,
  DEFAULT_ORCA_CONFIG,
  OrcaVector2,
  OrcaAgent,
  OrcaHalfPlane,
  OrcaResult,
} from "./OrcaTypes.js";

export class OrcaSystem {
  readonly name = "orca";
  enabled = true;
  private agents = new Map<string, OrcaAgent>();
  private agentCounter = 0;
  /** ORCA configuration. */
  config: OrcaConfig;

  constructor(config?: Partial<OrcaConfig>) {
    this.config = { ...DEFAULT_ORCA_CONFIG, ...config };
  }

  // --- Vector operations ---

  private add(a: OrcaVector2, b: OrcaVector2): OrcaVector2 {
    return { x: a.x + b.x, z: a.z + b.z };
  }

  private sub(a: OrcaVector2, b: OrcaVector2): OrcaVector2 {
    return { x: a.x - b.x, z: a.z - b.z };
  }

  private mul(a: OrcaVector2, scalar: number): OrcaVector2 {
    return { x: a.x * scalar, z: a.z * scalar };
  }

  private dot(a: OrcaVector2, b: OrcaVector2): number {
    return a.x * b.x + a.z * b.z;
  }

  private magnitude(a: OrcaVector2): number {
    return Math.sqrt(a.x * a.x + a.z * a.z);
  }

  private normalize(a: OrcaVector2): OrcaVector2 {
    const mag = this.magnitude(a);
    if (mag === 0) return { x: 0, z: 0 };
    return { x: a.x / mag, z: a.z / mag };
  }

  private limit(a: OrcaVector2, max: number): OrcaVector2 {
    const mag = this.magnitude(a);
    if (mag > max && mag > 0) {
      return this.mul(this.normalize(a), max);
    }
    return a;
  }

  private distance(a: OrcaVector2, b: OrcaVector2): number {
    return this.magnitude(this.sub(a, b));
  }

  /** Perpendicular (rotate 90 degrees CCW). */
  private perp(a: OrcaVector2): OrcaVector2 {
    return { x: -a.z, z: a.x };
  }

  // --- Agent management ---

  private generateId(): string {
    this.agentCounter++;
    return `orca_${Date.now()}_${this.agentCounter}`;
  }

  addAgent(position: OrcaVector2, velocity?: OrcaVector2, radius?: number): OrcaResult {
    const id = this.generateId();
    const agent: OrcaAgent = {
      id,
      position: { ...position },
      velocity: velocity ? { ...velocity } : { x: 0, z: 0 },
      preferredVelocity: velocity ? { ...velocity } : { x: 0, z: 0 },
      radius: radius ?? this.config.defaultRadius,
      active: true,
    };
    this.agents.set(id, agent);
    return { success: true, agentId: id };
  }

  removeAgent(agentId: string): OrcaResult {
    if (!this.agents.has(agentId)) return { success: false, error: "Agent not found" };
    this.agents.delete(agentId);
    return { success: true, agentId };
  }

  getAgent(agentId: string): OrcaAgent | undefined {
    return this.agents.get(agentId);
  }

  getAgents(): OrcaAgent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgents(): OrcaAgent[] {
    return Array.from(this.agents.values()).filter((a) => a.active);
  }

  setPreferredVelocity(agentId: string, vel: OrcaVector2): OrcaResult {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: "Agent not found" };
    agent.preferredVelocity = { ...vel };
    return { success: true, agentId };
  }

  setAgentActive(agentId: string, active: boolean): OrcaResult {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: "Agent not found" };
    agent.active = active;
    return { success: true, agentId };
  }

  get agentCount(): number {
    return this.agents.size;
  }

  // --- ORCA core algorithm ---

  /** Find nearest neighbors within neighborDist, up to maxNeighbors. */
  private findNeighbors(agent: OrcaAgent): OrcaAgent[] {
    const neighbors: { agent: OrcaAgent; dist: number }[] = [];
    for (const other of this.agents.values()) {
      if (other.id === agent.id || !other.active) continue;
      const dist = this.distance(agent.position, other.position);
      if (dist < this.config.neighborDist) {
        neighbors.push({ agent: other, dist });
      }
    }
    // Sort by distance and take maxNeighbors.
    neighbors.sort((a, b) => a.dist - b.dist);
    return neighbors.slice(0, this.config.maxNeighbors).map((n) => n.agent);
  }

  /**
   * Compute ORCA half-plane for a pair of agents.
   * Uses the velocity obstacle (VO) approach: find the closest point
   * on the VO boundary to the current relative velocity, and define
   * the ORCA line perpendicular to the vector from that point.
   */
  private computeOrcaHalfPlane(agent: OrcaAgent, neighbor: OrcaAgent): OrcaHalfPlane {
    const invTimeHorizon = 1.0 / this.config.timeHorizon;

    // Relative position and velocity.
    const relPos = this.sub(neighbor.position, agent.position);
    const relVel = this.sub(agent.velocity, neighbor.velocity);
    const combinedRadius = agent.radius + neighbor.radius;

    const distSq = this.dot(relPos, relPos);
    const radiusSq = combinedRadius * combinedRadius;

    // w = relative velocity - apex of VO (relPos / timeHorizon).
    const w = this.sub(relVel, this.mul(relPos, invTimeHorizon));
    const wLengthSq = this.dot(w, w);

    let u: OrcaVector2; // Vector from w to closest point on VO boundary.

    if (distSq > radiusSq) {
      // No current collision. The VO is a cone + cutoff circle.
      const wLength = Math.sqrt(wLengthSq);
      const unitW = wLength > 1e-9 ? this.mul(w, 1 / wLength) : { x: 0, z: 0 };

      // Cone half-angle: sin(theta) = combinedRadius / |relPos|.
      const coneHalfAngleSin = combinedRadius / Math.sqrt(distSq);
      const unitRelPos = this.normalize(relPos);

      // Check if w is inside the cone (angle between w and relPos < cone half-angle).
      const cosAngle = this.dot(unitW, unitRelPos);
      const coneHalfAngleCos = Math.sqrt(Math.max(0, 1 - coneHalfAngleSin * coneHalfAngleSin));

      if (cosAngle > coneHalfAngleCos && wLength > 0) {
        // w is inside the cone: project to the nearest cone boundary.
        // The cone boundary direction: rotate unitRelPos by +/- half-angle.
        // Find which side is closer.
        const perpRelPos = this.perp(unitRelPos);
        const sideSign = this.dot(unitW, perpRelPos) >= 0 ? 1 : -1;
        // Boundary direction = cos(angle)*unitRelPos + sin(angle)*side*perp.
        const boundaryDir = this.add(
          this.mul(unitRelPos, coneHalfAngleCos),
          this.mul(perpRelPos, sideSign * coneHalfAngleSin),
        );
        // Project w onto boundary direction.
        const projLen = this.dot(w, boundaryDir);
        const closestPoint = this.mul(boundaryDir, Math.max(0, projLen));
        u = this.sub(closestPoint, w);
      } else {
        // w is outside the cone: check cutoff circle.
        // Cutoff circle center = apex (0 in w-space), radius = combinedRadius / timeHorizon.
        const cutoffRadius = combinedRadius * invTimeHorizon;
        if (wLength > cutoffRadius) {
          // Outside cutoff circle: closest point is on the circle.
          const closestPoint = this.mul(unitW, cutoffRadius);
          u = this.sub(closestPoint, w);
        } else {
          // Inside cutoff circle (but outside cone): push to cutoff circle.
          const closestPoint = this.mul(unitW, cutoffRadius);
          u = this.sub(closestPoint, w);
        }
      }
    } else {
      // Already colliding: push away directly using time horizon.
      u = this.sub(this.mul(relPos, invTimeHorizon), relVel);
    }

    // ORCA normal points in direction of u (away from VO).
    const normal = this.magnitude(u) > 1e-9 ? this.normalize(u) : { x: 1, z: 0 };

    // ORCA point: current velocity + half of u (reciprocal assumption).
    const point = this.add(agent.velocity, this.mul(u, 0.5));

    return { point, normal };
  }

  /**
   * Solve linear program: find velocity closest to preferred that
   * satisfies all half-plane constraints and max speed.
   */
  private solveLinearProgram(
    halfPlanes: OrcaHalfPlane[],
    preferredVel: OrcaVector2,
    currentVel: OrcaVector2,
  ): OrcaVector2 {
    // Start with preferred velocity (clamped to max speed).
    let result = this.limit(preferredVel, this.config.maxSpeed);

    // Check each half-plane.
    for (let i = 0; i < halfPlanes.length; i++) {
      const hp = halfPlanes[i];
      // Check if result is in the feasible half-plane.
      if (this.dot(this.sub(result, hp.point), hp.normal) < 0) {
        // Not feasible: project onto the line.
        // Find closest point on line to result.
        const toPoint = this.sub(result, hp.point);
        const dist = this.dot(toPoint, hp.normal);
        result = this.sub(result, this.mul(hp.normal, dist));

        // Now check previous constraints with the new result.
        for (let j = 0; j < i; j++) {
          const prevHp = halfPlanes[j];
          if (this.dot(this.sub(result, prevHp.point), prevHp.normal) < 0) {
            // Intersect the two lines and use that point.
            const intersection = this.intersectLines(hp, prevHp);
            if (intersection) {
              result = intersection;
            } else {
              // Lines are parallel: use current velocity as fallback.
              result = { ...currentVel };
            }
          }
        }
      }
    }

    // Clamp to max speed.
    result = this.limit(result, this.config.maxSpeed);
    return result;
  }

  /** Intersect two lines defined by half-planes. Returns null if parallel. */
  private intersectLines(hp1: OrcaHalfPlane, hp2: OrcaHalfPlane): OrcaVector2 | null {
    // Line 1: point1 + t * dir1, where dir1 is perpendicular to normal1.
    const dir1 = this.perp(hp1.normal);
    const dir2 = this.perp(hp2.normal);

    // Solve: point1 + t*dir1 = point2 + s*dir2
    // Using cross product (2D determinant).
    const denom = dir1.x * dir2.z - dir1.z * dir2.x;
    if (Math.abs(denom) < 1e-9) return null; // Parallel.

    const diff = this.sub(hp2.point, hp1.point);
    const t = (diff.x * dir2.z - diff.z * dir2.x) / denom;

    return this.add(hp1.point, this.mul(dir1, t));
  }

  /** Compute the optimal velocity for an agent using ORCA. */
  computeOptimalVelocity(agent: OrcaAgent): OrcaVector2 {
    const neighbors = this.findNeighbors(agent);
    const halfPlanes: OrcaHalfPlane[] = [];

    for (const neighbor of neighbors) {
      const hp = this.computeOrcaHalfPlane(agent, neighbor);
      halfPlanes.push(hp);
    }

    return this.solveLinearProgram(halfPlanes, agent.preferredVelocity, agent.velocity);
  }

  /** Update a single agent: compute optimal velocity and move. */
  updateAgent(agent: OrcaAgent, dt: number): void {
    if (!agent.active) return;

    const optimalVel = this.computeOptimalVelocity(agent);

    // Steer toward optimal velocity (limited by maxForce).
    const steer = this.sub(optimalVel, agent.velocity);
    const limitedSteer = this.limit(steer, this.config.maxForce);
    agent.velocity = this.add(agent.velocity, this.mul(limitedSteer, dt));
    agent.velocity = this.limit(agent.velocity, this.config.maxSpeed);

    // Update position.
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
    const agents: Record<string, OrcaAgent> = {};
    for (const [id, agent] of this.agents) {
      agents[id] = agent;
    }
    return { agents, agentCounter: this.agentCounter, config: this.config };
  }

  /** Deserialize agents. */
  deserialize(data: Record<string, unknown>): void {
    if (data.agents && typeof data.agents === "object") {
      for (const [id, agent] of Object.entries(data.agents as Record<string, OrcaAgent>)) {
        this.agents.set(id, agent);
      }
    }
    if (typeof data.agentCounter === "number") {
      this.agentCounter = data.agentCounter;
    }
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_ORCA_CONFIG, ...(data.config as Partial<OrcaConfig>) };
    }
  }
}
