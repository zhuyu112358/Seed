// SoulActionSystem: executes soul actions on the world.
//
// This is the counterpart to SoulPerceptionSystem: perception lets souls
// READ the world, action lets souls WRITE to it. Together they form the
// perceive -> decide -> act loop that connects SoulArena souls to the Seed
// virtual world.
//
// Supported actions (per types/index.ts ActionRequest):
//   move         - relocate soul proxy (target position or direction+distance)
//   interact     - interact with a target interactive entity
//   communicate  - send a message via a communication medium
//   use          - use a target entity (consume/activate)
//   attack       - apply force/damage to a target
//   wait         - no-op (soul chooses to wait)
//   stop         - zero velocity (stops physics-based movement)
//   custom       - extension point for world-specific actions
//
// Corresponds to SOUL_INTERFACE.md section 6.2 (ActionRequest / ActionResult).

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Vector3 } from "../entity/Vector3.js";
import type { GameObject } from "../entity/Entity.js";
import type { ActionRequest, ActionResult } from "../types/index.js";
import type { SoulPerceptionSystem } from "./SoulPerceptionSystem.js";
import { AcousticPropagation } from "../communication/AcousticPropagation.js";
import { Message } from "../communication/Message.js";
import type { AcousticConfig } from "../communication/AcousticPropagation.js";
import type { PathfinderSystem } from "../pathfinding/PathfinderSystem.js";
import type { HarvestSystem } from "../resource/HarvestSystem.js";
import type { CraftingSystem } from "../resource/CraftingSystem.js";

export interface SoulActionConfig {
  /** Maximum move distance per action. Default 5. */
  maxMoveDistance?: number;
  /** Maximum interaction distance. Default 3. */
  maxInteractDistance?: number;
  /** Maximum actions queued per soul. Default 10. */
  maxQueuePerSoul?: number;
  /** Default move distance when only direction is given. Default 1. */
  defaultMoveDistance?: number;
  /** Acoustic propagation config for communicate (speak) actions. */
  acoustic?: AcousticConfig;
  /** Movement mode: "instant" teleports immediately, "physics" applies velocity
   *  and lets PhysicsSystem integrate smooth movement over ticks. Default "instant". */
  movementMode?: "instant" | "physics";
  /** Speed (m/s) applied to soul velocity in physics movement mode. Default 5. */
  physicsMoveSpeed?: number;
  /** If true, move actions use A* pathfinding to navigate around obstacles.
   *  Requires a PathfinderSystem registered in the world. Default false. */
  pathfindingEnabled?: boolean;
  /** If true, paths found via pathfinding are automatically smoothed using
   *  string-pulling (PathSmoother) to reduce waypoint count. Only applies
   *  when pathfindingEnabled is true. Default false. */
  smoothPaths?: boolean;
}

const DEFAULT_CONFIG: Required<Omit<SoulActionConfig, 'acoustic'>> & { acoustic?: AcousticConfig } = {
  maxMoveDistance: 5,
  maxInteractDistance: 3,
  maxQueuePerSoul: 10,
  defaultMoveDistance: 1,
  acoustic: undefined,
  movementMode: "instant",
  physicsMoveSpeed: 5,
  pathfindingEnabled: false,
  smoothPaths: false,
};

export interface ActionHistoryEntry {
  request: ActionRequest;
  result: ActionResult;
  tick: number;
}

export class SoulActionSystem implements WorldSystem {
  readonly name = "soul-action";
  enabled = true;

  private readonly config: Required<Omit<SoulActionConfig, 'acoustic'>> & { acoustic?: AcousticConfig };
  private readonly queue: ActionRequest[] = [];
  private readonly history: ActionHistoryEntry[] = [];
  private perception: SoulPerceptionSystem | null = null;
  private interaction: unknown = null;
  private acoustic: AcousticPropagation | null = null;
  private pathfinder: PathfinderSystem | null = null;
  private harvest: HarvestSystem | null = null;
  private crafting: CraftingSystem | null = null;
  private actionsExecuted = 0;
  private actionsFailed = 0;

  constructor(config?: SoulActionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.acoustic) {
      this.acoustic = new AcousticPropagation(this.config.acoustic);
    }
  }

  /** Execute an action immediately (synchronous). */
  executeAction(request: ActionRequest, world: World): ActionResult {
    this.ensurePerception(world);
    this.ensureInteraction(world);
    this.ensurePathfinder(world);
    this.ensureHarvest(world);
    this.ensureCrafting(world);
    const result = this.dispatch(request, world);
    this.history.push({ request, result, tick: world.tick });
    if (this.history.length > 200) this.history.shift();
    if (result.success) this.actionsExecuted++;
    else this.actionsFailed++;
    return result;
  }

  /** Queue an action for execution on the next tick. */
  queueAction(request: ActionRequest): boolean {
    const soulQueue = this.queue.filter(a => a.soulId === request.soulId);
    if (soulQueue.length >= this.config.maxQueuePerSoul) return false;
    this.queue.push(request);
    return true;
  }

  /** Get action history for a soul. */
  getHistory(soulId?: string): ActionHistoryEntry[] {
    if (!soulId) return [...this.history];
    return this.history.filter(h => h.request.soulId === soulId);
  }

  /** Total successful actions. */
  get executedCount(): number { return this.actionsExecuted; }
  /** Total failed actions. */
  get failedCount(): number { return this.actionsFailed; }
  /** Current queue length. */
  get queueLength(): number { return this.queue.length; }

  /** Lazy-locate SoulPerceptionSystem by name. */
  private ensurePerception(world: World): void {
    if (this.perception && world.systems.includes(this.perception as unknown as WorldSystem)) return;
    this.perception = null;
    for (const s of world.systems) {
      if (s.name === 'soul-perception') { this.perception = s as unknown as SoulPerceptionSystem; break; }
    }
  }

  /** Lazy-locate PathfinderSystem by name. */
  private ensurePathfinder(world: World): void {
    if (this.pathfinder && world.systems.includes(this.pathfinder as unknown as WorldSystem)) return;
    this.pathfinder = null;
    for (const s of world.systems) {
      if (s.name === 'pathfinder') { this.pathfinder = s as unknown as PathfinderSystem; break; }
    }
  }

  /** Lazy-locate InteractionSystem by name. */
  private ensureInteraction(world: World): void {
    if (this.interaction && world.systems.includes(this.interaction as unknown as WorldSystem)) return;
    this.interaction = null;
    for (const s of world.systems) {
      if (s.name === 'interaction') { this.interaction = s; break; }
    }
  }

  /** Lazy-locate HarvestSystem by name. */
  private ensureHarvest(world: World): void {
    if (this.harvest && world.systems.includes(this.harvest as unknown as WorldSystem)) return;
    this.harvest = null;
    for (const s of world.systems) {
      if (s.name === 'harvest') { this.harvest = s as unknown as HarvestSystem; break; }
    }
  }

  /** Lazy-locate CraftingSystem by name. */
  private ensureCrafting(world: World): void {
    if (this.crafting && world.systems.includes(this.crafting as unknown as WorldSystem)) return;
    this.crafting = null;
    for (const s of world.systems) {
      if (s.name === 'crafting') { this.crafting = s as unknown as CraftingSystem; break; }
    }
  }

  tick(_dt: number, world: World, _events: EventSystem): void {
    this.ensurePerception(world);
    this.ensureInteraction(world);
    this.ensurePathfinder(world);
    this.ensureHarvest(world);
    this.ensureCrafting(world);

    // Process queued actions.
    const pending = [...this.queue];
    this.queue.length = 0;
    for (const request of pending) {
      this.executeAction(request, world);
    }
  }

  private dispatch(request: ActionRequest, world: World): ActionResult {
    const soul = this.findSoulProxy(request.soulId, world);
    if (!soul) {
      return this.fail(request, `soul proxy not found for soulId=${request.soulId}`);
    }

    switch (request.action) {
      case "move": return this.doMove(request, soul, world);
      case "interact": return this.doInteract(request, soul, world);
      case "communicate": return this.doCommunicate(request, soul, world);
      case "use": return this.doUse(request, soul, world);
      case "attack": return this.doAttack(request, soul, world);
      case "harvest": return this.doHarvest(request, soul, world);
      case "craft": return this.doCraft(request, soul, world);
      case "wait": return this.success(request, "soul waits", {});
      case "stop": return this.doStop(request, soul);
      case "custom": return this.doCustom(request, soul, world);
      default: return this.fail(request, `unknown action: ${request.action}`);
    }
  }

  /** Convert a string direction (e.g. "north", "south", "east") to a normalized vector. */
  private directionStringToVector(dir: string): { x: number; y: number; z: number } | null {
    const d = dir.toLowerCase().trim();
    const SQRT2 = Math.SQRT1_2; // 0.7071 for diagonal directions
    switch (d) {
      case "north": case "n": case "forward": case "f":
        return { x: 0, y: 0, z: -1 };
      case "south": case "s": case "backward": case "back": case "b":
        return { x: 0, y: 0, z: 1 };
      case "east": case "e": case "right": case "r":
        return { x: 1, y: 0, z: 0 };
      case "west": case "w": case "left": case "l":
        return { x: -1, y: 0, z: 0 };
      case "up": case "u":
        return { x: 0, y: 1, z: 0 };
      case "down": case "d":
        return { x: 0, y: -1, z: 0 };
      case "northeast": case "ne":
        return { x: SQRT2, y: 0, z: -SQRT2 };
      case "northwest": case "nw":
        return { x: -SQRT2, y: 0, z: -SQRT2 };
      case "southeast": case "se":
        return { x: SQRT2, y: 0, z: SQRT2 };
      case "southwest": case "sw":
        return { x: -SQRT2, y: 0, z: SQRT2 };
      default:
        return null;
    }
  }

  /** Resolve direction parameter: accepts vector object {x,y,z} or string "north"/"south"/etc. */
  private resolveDirection(dir: unknown): { x: number; y: number; z: number } | null {
    if (typeof dir === "string") {
      return this.directionStringToVector(dir);
    }
    if (dir && typeof dir === "object") {
      const v = dir as { x?: number; y?: number; z?: number };
      if (v.x !== undefined || v.y !== undefined || v.z !== undefined) {
        return { x: Number(v.x) || 0, y: Number(v.y) || 0, z: Number(v.z) || 0 };
      }
    }
    return null;
  }

  private doMove(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    const p = request.parameters;
    let targetX = soul.position.x;
    let targetY = soul.position.y;
    let targetZ = soul.position.z;
    let mode = "unknown";

    // Format 1: absolute {x, y, z}
    if (p.x !== undefined && p.y !== undefined) {
      targetX = Number(p.x);
      targetY = Number(p.y);
      if (p.z !== undefined) targetZ = Number(p.z);
      mode = "absolute";
    }
    // Format 2: targetPosition: {x, y, z}
    else if (p.targetPosition && typeof p.targetPosition === "object") {
      const tp = p.targetPosition as { x?: number; y?: number; z?: number };
      if (tp.x !== undefined) targetX = Number(tp.x);
      if (tp.y !== undefined) targetY = Number(tp.y);
      if (tp.z !== undefined) targetZ = Number(tp.z);
      mode = "targetPosition";
    }
    // Format 3: delta {dx, dy, dz}
    else if (p.dx !== undefined || p.dy !== undefined || p.dz !== undefined) {
      targetX += Number(p.dx ?? 0);
      targetY += Number(p.dy ?? 0);
      targetZ += Number(p.dz ?? 0);
      mode = "delta";
    }
    // Format 4: direction + distance
    else if (p.direction && p.distance !== undefined) {
      const dir = this.resolveDirection(p.direction);
      if (!dir) return this.fail(request, `invalid direction: ${String(p.direction)}`);
      const dist = Number(p.distance);
      targetX += dir.x * dist;
      targetY += dir.y * dist;
      targetZ += dir.z * dist;
      mode = "direction+distance";
    }
    // Format 5: direction + speed (distance = speed * defaultMoveDistance)
    else if (p.direction && p.speed !== undefined) {
      const dir = this.resolveDirection(p.direction);
      if (!dir) return this.fail(request, `invalid direction: ${String(p.direction)}`);
      const speed = Number(p.speed);
      const dist = speed * this.config.defaultMoveDistance;
      targetX += dir.x * dist;
      targetY += dir.y * dist;
      targetZ += dir.z * dist;
      mode = "direction+speed";
    }
    // Format 6: direction only (use defaultMoveDistance)
    else if (p.direction) {
      const dir = this.resolveDirection(p.direction);
      if (!dir) return this.fail(request, `invalid direction: ${String(p.direction)}`);
      const dist = this.config.defaultMoveDistance;
      targetX += dir.x * dist;
      targetY += dir.y * dist;
      targetZ += dir.z * dist;
      mode = "direction-only";
    } else {
      return this.fail(request, "move requires {x,y,z}, {targetPosition}, {dx,dy,dz}, or {direction[,distance|speed]}");
    }

    const dist = soul.position.distance({ x: targetX, y: targetY, z: targetZ });
    if (dist === 0) {
      return this.success(request, "no movement (target equals current position)", {
        position: { x: targetX, y: targetY, z: targetZ },
        distance: 0,
        mode,
      });
    }

    soul.state.set("lastMoveAt", Date.now());
    soul.state.set("lastMoveMode", mode);

    // Pathfinding mode: use A* to find a route around obstacles, then follow
    // it point-by-point via physics movement + MovementController + PathFollowerSystem.
    // Pathfinding bypasses maxMoveDistance because the route is broken into waypoints.
    if (this.config.pathfindingEnabled && this.pathfinder) {
      const path = this.pathfinder.findPath(
        soul.position.x, soul.position.z,
        targetX, targetZ, world,
      );
      if (!path || path.waypoints.length === 0) {
        return this.fail(request, `no path found to (${targetX.toFixed(1)}, ${targetZ.toFixed(1)}) [pathfinding, ${mode}]`);
      }

      // Smooth path if enabled (string-pulling reduces waypoint count).
      let waypoints = path.waypoints;
      let pathLength = path.length;
      let smoothed = false;
      if (this.config.smoothPaths && waypoints.length > 2) {
        const result = this.pathfinder.smoothPath(waypoints);
        waypoints = result.waypoints;
        pathLength = result.length;
        smoothed = true;
      }

      // Store full path for PathFollowerSystem to advance along.
      soul.state.set("movePath", waypoints);
      soul.state.set("movePathIndex", 0);
      // Set first waypoint as immediate moveTarget.
      const firstWp = waypoints[0];
      const dx = firstWp.x - soul.position.x;
      const dz = firstWp.z - soul.position.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const speed = this.config.physicsMoveSpeed;
      soul.velocity = new Vector3((dx / len) * speed, 0, (dz / len) * speed);
      soul.state.set("movementMode", "physics");
      soul.state.set("moveTarget", { x: firstWp.x, y: soul.position.y, z: firstWp.z });
      const smoothTag = smoothed ? "smoothed " : "";
      return this.success(request, `path found: ${smoothTag}${waypoints.length} waypoints, length ${pathLength.toFixed(1)}m [pathfinding, ${mode}]`, {
        position: { x: soul.position.x, y: soul.position.y, z: soul.position.z },
        target: { x: targetX, y: targetY, z: targetZ },
        pathLength: Math.round(pathLength * 100) / 100,
        waypoints: waypoints.length,
        smoothed,
        mode: `pathfinding-${mode}`,
      });
    }

    // Non-pathfinding moves are limited by maxMoveDistance.
    if (dist > this.config.maxMoveDistance) {
      return this.fail(request, `move distance ${dist.toFixed(2)} exceeds max ${this.config.maxMoveDistance} (mode=${mode})`);
    }

    // Physics movement mode: apply velocity toward target instead of teleporting.
    // PhysicsSystem integrates velocity over subsequent ticks with friction/damping.
    if (this.config.movementMode === "physics") {
      const dx = targetX - soul.position.x;
      const dy = targetY - soul.position.y;
      const dz = targetZ - soul.position.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const speed = this.config.physicsMoveSpeed;
      soul.velocity = new Vector3((dx / len) * speed, (dy / len) * speed, (dz / len) * speed);
      soul.state.set("movementMode", "physics");
      soul.state.set("moveTarget", { x: targetX, y: targetY, z: targetZ });
      return this.success(request, `velocity applied toward (${targetX.toFixed(1)}, ${targetY.toFixed(1)}, ${targetZ.toFixed(1)}) at ${speed}m/s [physics, ${mode}]`, {
        position: { x: soul.position.x, y: soul.position.y, z: soul.position.z },
        target: { x: targetX, y: targetY, z: targetZ },
        velocity: { x: soul.velocity.x, y: soul.velocity.y, z: soul.velocity.z },
        speed,
        distance: Math.round(dist * 100) / 100,
        mode: `physics:${mode}`,
      });
    }

    // Instant movement mode (default): teleport directly to target.
    soul.position = new Vector3(targetX, targetY, targetZ);
    return this.success(request, `moved to (${targetX.toFixed(1)}, ${targetY.toFixed(1)}, ${targetZ.toFixed(1)}) [${mode}]`, {
      position: { x: targetX, y: targetY, z: targetZ },
      distance: Math.round(dist * 100) / 100,
      mode,
    });
  }

  /** Stop all movement by zeroing velocity. Useful in physics movement mode. */
  private doStop(request: ActionRequest, soul: GameObject): ActionResult {
    const prevSpeed = soul.velocity.length();
    soul.velocity = new Vector3(0, 0, 0);
    soul.state.set("movementMode", "stopped");
    soul.state.delete("moveTarget");
    return this.success(request, `stopped (previous speed ${prevSpeed.toFixed(2)}m/s)`, {
      position: { x: soul.position.x, y: soul.position.y, z: soul.position.z },
      previousSpeed: Math.round(prevSpeed * 100) / 100,
    });
  }

  /**
   * Harvest a resource node. The soul must be within harvestRange of the target.
   * Harvesting is asynchronous (takes harvestTime ticks); this action starts the
   * harvest and returns immediately. Completion is communicated via HarvestCompleteEvent
   * and soul perception.
   */
  private doHarvest(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    if (!request.targetId) return this.fail(request, "harvest requires targetId");

    if (!this.harvest) {
      return this.fail(request, "HarvestSystem not available in this world");
    }

    const target = world.getEntity(request.targetId) as GameObject | undefined;
    if (!target) return this.fail(request, `target not found: ${request.targetId}`);

    const node = this.harvest.getNode(target.id);
    if (!node) {
      return this.fail(request, `target ${target.name} is not a harvestable resource node`);
    }

    if (!node.isAvailable) {
      return this.fail(request, `resource node ${target.name} is depleted`);
    }

    if (node.isBeingHarvested) {
      return this.fail(request, `resource node ${target.name} is already being harvested`);
    }

    // startHarvest performs distance check internally.
    const started = this.harvest.startHarvest(soul, target);
    if (!started) {
      // Determine failure reason for better error message.
      const dx = soul.position.x - target.position.x;
      const dz = soul.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const range = this.harvest.harvestRange;
      if (dist > range) {
        return this.fail(request, `target too far: ${dist.toFixed(2)}m > ${range}m harvest range`);
      }
      return this.fail(request, `harvest failed for unknown reason (dist=${dist.toFixed(2)}m)`);
    }

    return this.success(request, `harvesting ${node.resourceTypeId} from ${target.name}`, {
      targetId: target.id,
      resourceType: node.resourceTypeId,
      harvestTime: node.harvestTime,
      remaining: node.currentAmount,
    });
  }

  /**
   * Craft a recipe. The soul must have a registered inventory (from HarvestSystem)
   * with sufficient resources. Crafting is asynchronous (takes craftTime ticks);
   * this action starts the craft and returns immediately.
   *
   * Recipe ID can be specified via request.targetId or request.parameters.recipeId.
   */
  private doCraft(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    if (!this.crafting) {
      return this.fail(request, "CraftingSystem not available in this world");
    }

    const recipeId = (request.parameters?.recipeId as string) ?? request.targetId;
    if (!recipeId) {
      return this.fail(request, "craft requires recipeId (in parameters or targetId)");
    }

    const recipe = this.crafting.recipes.get(recipeId);
    if (!recipe) {
      return this.fail(request, `recipe not found: ${recipeId}`);
    }

    // Share inventory from HarvestSystem if available (so harvested resources can be crafted).
    if (this.harvest) {
      const inv = this.harvest.getInventory(soul.id);
      if (inv) {
        this.crafting.registerInventory(soul.id, inv);
      }
    }

    // Check if craft can start (resources + concurrency).
    const check = this.crafting.canCraft(soul.id, recipeId);
    if (!check.canCraft) {
      return this.fail(request, `cannot craft ${recipe.name}: ${check.reason ?? "unknown"}`);
    }

    // Start the craft (consumes inputs immediately).
    const started = this.crafting.startCraft(soul.id, recipeId, world.events);
    if (!started) {
      return this.fail(request, `failed to start crafting ${recipe.name}`);
    }

    return this.success(request, `crafting ${recipe.name}`, {
      recipeId,
      recipeName: recipe.name,
      craftTime: recipe.craftTime,
      outputResourceType: recipe.outputResourceTypeId,
      outputAmount: recipe.outputAmount,
    });
  }

  private doInteract(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    if (!request.targetId) return this.fail(request, "interact requires targetId");
    const target = world.getEntity(request.targetId) as GameObject | undefined;
    if (!target) return this.fail(request, `target not found: ${request.targetId}`);
    if (target.type !== "interactive") return this.fail(request, `target ${target.name} is not interactive (type=${target.type})`);

    const dist = soul.position.distance(target.position);
    if (dist > this.config.maxInteractDistance) {
      return this.fail(request, `target too far: ${dist.toFixed(2)}m > ${this.config.maxInteractDistance}m`);
    }

    // If InteractionSystem is available and target is registered, trigger state machine.
    if (this.interaction) {
      const isRegistered = (this.interaction as { isRegistered?: (id: string) => boolean }).isRegistered;
      if (isRegistered && isRegistered.call(this.interaction, target.id)) {
        const interact = (this.interaction as { interact: (id: string, actorId?: string, events?: unknown) => { success: boolean; message: string; previousState: string; newState: string; transitioned: boolean } }).interact;
        const result = interact.call(this.interaction, target.id, request.soulId, world.events);
        // Also update legacy counters for backward compatibility.
        target.state.set("lastInteractedBy", request.soulId);
        target.state.set("lastInteractedAt", Date.now());
        const interactionCount = (target.state.get("interactionCount") as number ?? 0) + 1;
        target.state.set("interactionCount", interactionCount);
        return this.success(request, result.message, {
          targetId: target.id,
          targetName: target.name,
          interactionCount,
          previousState: result.previousState,
          newState: result.newState,
          transitioned: result.transitioned,
        });
      }
    }

    // Fallback: counter-only behavior when InteractionSystem is not available.
    target.state.set("lastInteractedBy", request.soulId);
    target.state.set("lastInteractedAt", Date.now());
    const interactionCount = (target.state.get("interactionCount") as number ?? 0) + 1;
    target.state.set("interactionCount", interactionCount);

    return this.success(request, `interacted with ${target.name}`, {
      targetId: target.id,
      targetName: target.name,
      interactionCount,
    });
  }

  private doCommunicate(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    const content = String(request.parameters.content ?? "");
    if (!content) return this.fail(request, "communicate requires content");
    const medium = String(request.parameters.medium ?? "acoustic");
    const intensity = Number(request.parameters.volume ?? request.parameters.intensity ?? 1);

    const heardBy: Array<{ id: string; name: string; distance: number; intensity: number }> = [];

    // If acoustic propagation is configured and medium is acoustic, compute which
    // entities actually hear the message with distance attenuation.
    if (this.acoustic && medium === "acoustic") {
      const message = new Message({
        content,
        sourceId: request.soulId,
        position: { x: soul.position.x, y: soul.position.y, z: soul.position.z },
        medium: "acoustic",
        intensity,
      });
      for (const e of world.entities.values()) {
        if (e.id === soul.id || !e.active) continue;
        const d = soul.position.distance(e.position);
        const receivedIntensity = this.acoustic.intensityAt(intensity, d);
        if (receivedIntensity <= 0) continue;
        heardBy.push({
          id: e.id,
          name: e.name,
          distance: Math.round(d * 100) / 100,
          intensity: Math.round(receivedIntensity * 1000) / 1000,
        });
        // Record in perception system so nearby souls can perceive it.
        if (this.perception) {
          this.perception.recordCommunication({
            id: message.id,
            senderId: request.soulId,
            senderType: "soul",
            medium: "acoustic" as never,
            content,
            metadata: { soulName: soul.name, receivedIntensity },
            position: { x: e.position.x, y: e.position.y, z: e.position.z },
            timestamp: Date.now(),
            priority: 0,
            ttl: 30000,
          });
        }
      }
    } else {
      // Fallback: record without acoustic propagation (legacy behavior).
      if (this.perception) {
        this.perception.recordCommunication({
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          senderId: request.soulId,
          senderType: "soul",
          medium: medium as never,
          content,
          metadata: { soulName: soul.name },
          position: { x: soul.position.x, y: soul.position.y, z: soul.position.z },
          timestamp: Date.now(),
          priority: 0,
          ttl: 30000,
        });
      }
    }

    soul.state.set("lastSpokeAt", Date.now());
    soul.state.set("lastSpokeContent", content);
    return this.success(request, `${soul.name} says: ${content}`, {
      content,
      medium,
      intensity,
      position: { x: soul.position.x, y: soul.position.y, z: soul.position.z },
      heardBy,
      heardCount: heardBy.length,
    });
  }

  private doUse(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    if (!request.targetId) return this.fail(request, "use requires targetId");
    const target = world.getEntity(request.targetId) as GameObject | undefined;
    if (!target) return this.fail(request, `target not found: ${request.targetId}`);

    const dist = soul.position.distance(target.position);
    if (dist > this.config.maxInteractDistance) {
      return this.fail(request, `target too far: ${dist.toFixed(2)}m > ${this.config.maxInteractDistance}m`);
    }

    // If InteractionSystem is available and target is registered, trigger use.
    if (this.interaction) {
      const isRegistered = (this.interaction as { isRegistered?: (id: string) => boolean }).isRegistered;
      if (isRegistered && isRegistered.call(this.interaction, target.id)) {
        const use = (this.interaction as { use: (id: string, actorId?: string, events?: unknown) => { success: boolean; message: string } }).use;
        const result = use.call(this.interaction, target.id, request.soulId, world.events);
        if (!result.success) {
          return this.fail(request, result.message);
        }
        // Also update legacy counters.
        target.state.set("lastUsedBy", request.soulId);
        target.state.set("lastUsedAt", Date.now());
        const useCount = (target.state.get("useCount") as number ?? 0) + 1;
        target.state.set("useCount", useCount);
        return this.success(request, result.message, {
          targetId: target.id,
          targetName: target.name,
          useCount,
        });
      }
    }

    // Fallback: counter-only behavior.
    target.state.set("lastUsedBy", request.soulId);
    target.state.set("lastUsedAt", Date.now());
    const useCount = (target.state.get("useCount") as number ?? 0) + 1;
    target.state.set("useCount", useCount);

    return this.success(request, `used ${target.name}`, {
      targetId: target.id,
      targetName: target.name,
      useCount,
    });
  }

  private doAttack(request: ActionRequest, soul: GameObject, world: World): ActionResult {
    if (!request.targetId) return this.fail(request, "attack requires targetId");
    const target = world.getEntity(request.targetId) as GameObject | undefined;
    if (!target) return this.fail(request, `target not found: ${request.targetId}`);
    if (String(target.type) === "static") return this.fail(request, "cannot attack static entity");

    const dist = soul.position.distance(target.position);
    if (dist > this.config.maxInteractDistance * 2) {
      return this.fail(request, `target too far: ${dist.toFixed(2)}m`);
    }

    // Apply impulse away from attacker.
    const dx = target.position.x - soul.position.x;
    const dy = target.position.y - soul.position.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = Number(request.parameters.force ?? 5);
    if (String(target.type) !== "static" && target.mass > 0) {
      target.velocity = new Vector3(
        target.velocity.x + (dx / len) * force / target.mass,
        target.velocity.y + (dy / len) * force / target.mass,
        target.velocity.z,
      );
    }
    target.state.set("lastAttackedBy", request.soulId);
    target.state.set("lastAttackedAt", Date.now());

    return this.success(request, `attacked ${target.name} with force ${force}`, {
      targetId: target.id,
      targetName: target.name,
      force,
      knockback: { x: (dx / len) * force, y: (dy / len) * force },
    });
  }

  private doCustom(request: ActionRequest, soul: GameObject, _world: World): ActionResult {
    // Extension point: worlds can override or listen for custom actions.
    soul.state.set("lastCustomAction", JSON.stringify(request.parameters));
    soul.state.set("lastCustomActionAt", Date.now());
    return this.success(request, `custom action executed: ${JSON.stringify(request.parameters).slice(0, 100)}`, {
      parameters: request.parameters,
    });
  }

  private findSoulProxy(soulId: string, world: World): GameObject | null {
    // Try with soul_ prefix first, then without.
    const withPrefix = world.getEntity(`soul_${soulId}`) as GameObject | undefined;
    if (withPrefix && withPrefix.type === "soul") return withPrefix;
    const direct = world.getEntity(soulId) as GameObject | undefined;
    if (direct && direct.type === "soul") return direct;
    return null;
  }

  private success(request: ActionRequest, message: string, data: Record<string, unknown>): ActionResult {
    return { soulId: request.soulId, action: request.action, success: true, message, data, timestamp: Date.now() };
  }

  private fail(request: ActionRequest, message: string): ActionResult {
    return { soulId: request.soulId, action: request.action, success: false, message, timestamp: Date.now() };
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}