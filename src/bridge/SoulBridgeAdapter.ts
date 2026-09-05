// SoulBridgeAdapter: bridges Seed world engine with SoulArena cognitive system.
// This is the ONLY module allowed to do format conversion and API orchestration
// between Seed and SoulArena. It completes the perceive -> decide -> act loop:
//   1. Pull PerceptionFrame from SoulPerceptionSystem
//   2. Convert to SoulArena perception format (situation text mode recommended)
//   3. POST to SoulArena /api/soul/:id/perceive
//   4. Receive actions (from API response or webhook ingestAction)
//   5. Convert SoulArena actions to Seed ActionRequest
//   6. Execute via SoulActionSystem

import type { World } from '../engine/World.js';
import type { WorldSystem } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import type { PerceptionFrame, ActionRequest, ActionResult } from '../types/index.js';
import { Logger } from '../reliability/Logger.js';

const log = Logger.for('soul-bridge');

/** Configuration for SoulBridgeAdapter. */
export interface BridgeConfig {
  /** SoulArena base URL. Default: process.env.SOUL_URL or http://localhost:3000 */
  soulArenaUrl?: string;
  /** Send perception every N ticks. Default: 10 */
  perceiveIntervalTicks?: number;
  /** Use simplified situation text mode (recommended). Default: true */
  enableSituationMode?: boolean;
  /** Timeout for perceive API calls in ms. Default: 2000 */
  perceiveTimeoutMs?: number;
  /** Maximum actions queued per soul before dropping oldest. Default: 20 */
  maxQueuedActionsPerSoul?: number;
}

/** Action format as output by SoulArena. */
export interface SoulArenaAction {
  id?: string;
  type: string; // speak | expression | move | attack | interact | use | wait | custom
  content?: string;
  targetId?: string;
  modality?: string;
  volume?: number;
  expression?: string;
  intensity?: number;
  parameters?: Record<string, unknown>;
}

/** Statistics for bridge operations. */
export interface BridgeStats {
  perceptionsSent: number;
  perceptionsFailed: number;
  actionsReceived: number;
  actionsExecuted: number;
  actionsFailed: number;
  actionsDropped: number;
  connectedSouls: number;
}

const DEFAULT_CONFIG: Required<BridgeConfig> = {
  soulArenaUrl: process.env.SOUL_URL ?? 'http://localhost:3000',
  perceiveIntervalTicks: 10,
  enableSituationMode: true,
  perceiveTimeoutMs: 2000,
  maxQueuedActionsPerSoul: 20,
};

/**
 * SoulBridgeAdapter completes the perceive -> decide -> act loop between
 * Seed world engine and SoulArena cognitive system.
 *
 * Usage:
 *   const bridge = new SoulBridgeAdapter();
 *   world.addSystem(bridge);  // auto-binds to perception/action systems by name
 *   // or manually: bridge.bindSystems(perception, actionSystem)
 */
export class SoulBridgeAdapter implements WorldSystem {
  readonly name = 'soul-bridge';
  enabled = true;

  private config: Required<BridgeConfig>;
  private perception: unknown = null;
  private actionSystem: unknown = null;
  private tickCount = 0;
  private actionQueue = new Map<string, SoulArenaAction[]>();
  private stats: BridgeStats = {
    perceptionsSent: 0,
    perceptionsFailed: 0,
    actionsReceived: 0,
    actionsExecuted: 0,
    actionsFailed: 0,
    actionsDropped: 0,
    connectedSouls: 0,
  };

  constructor(config?: BridgeConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Manually bind perception and action systems. */
  bindSystems(perception: unknown, actionSystem: unknown): void {
    this.perception = perception;
    this.actionSystem = actionSystem;
  }

  /** Lazy-locate perception and action systems from world by name. */
  private ensureSystems(world: World): void {
    if (!this.perception) {
      for (const s of world.systems) {
        if (s.name === 'soul-perception') { this.perception = s; break; }
      }
    }
    if (!this.actionSystem) {
      for (const s of world.systems) {
        if (s.name === 'soul-action') { this.actionSystem = s; break; }
      }
    }
  }

  /** WorldSystem tick: send perceptions on interval and process queued actions. */
  tick(_dt: number, world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    this.ensureSystems(world);
    this.tickCount++;

    // Send perceptions at configured interval (fire-and-forget).
    if (this.tickCount % this.config.perceiveIntervalTicks === 0) {
      this.sendAllPerceptions().catch((err) => {
        log.warn({ err: String(err) }, 'sendAllPerceptions failed');
      });
    }

    // Process queued actions.
    this.processActionQueue(world);
  }

  /** Send perceptions for all souls currently in the perception system. */
  async sendAllPerceptions(): Promise<void> {
    if (!this.perception) return;
    const getAll = (this.perception as { getAllPerceptions?: () => Map<string, PerceptionFrame> }).getAllPerceptions;
    if (!getAll) return;
    const all = getAll.call(this.perception);
    this.stats.connectedSouls = all.size;
    for (const [soulId, frame] of all) {
      await this.sendPerception(soulId, frame);
    }
  }

  /** Send a single soul's perception to SoulArena. */
  async sendPerception(soulId: string, frame: PerceptionFrame): Promise<void> {
    try {
      const payload = this.config.enableSituationMode
        ? this.buildSituationPayload(frame)
        : this.buildStructuredPayload(frame);

      const res = await fetch(`${this.config.soulArenaUrl}/api/soul/${soulId}/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.perceiveTimeoutMs),
      });

      if (!res.ok) {
        this.stats.perceptionsFailed++;
        log.warn({ soulId, status: res.status }, 'perceive API returned error');
        return;
      }

      this.stats.perceptionsSent++;

      // Try to parse actions from response (SoulArena may return actions directly).
      try {
        const body = await res.json() as { actions?: SoulArenaAction[] };
        if (body.actions && Array.isArray(body.actions)) {
          for (const action of body.actions) {
            this.ingestAction(soulId, action);
          }
        }
      } catch {
        // Response body is not JSON or has no actions — that's fine.
      }
    } catch (err) {
      this.stats.perceptionsFailed++;
      log.warn({ err: String(err), soulId }, 'sendPerception failed');
    }
  }

  /**
   * Ingest an action from SoulArena (via webhook callback or API response).
   * The action is queued and processed on the next tick.
   */
  ingestAction(soulId: string, action: SoulArenaAction): void {
    let queue = this.actionQueue.get(soulId);
    if (!queue) {
      queue = [];
      this.actionQueue.set(soulId, queue);
    }
    if (queue.length >= this.config.maxQueuedActionsPerSoul) {
      queue.shift(); // drop oldest
      this.stats.actionsDropped++;
    }
    queue.push(action);
    this.stats.actionsReceived++;
  }

  /** Process all queued actions by converting and executing them. */
  private processActionQueue(world: World): void {
    if (!this.actionSystem || this.actionQueue.size === 0) return;
    const executeAction = (this.actionSystem as { executeAction?: (req: ActionRequest, w: World) => ActionResult }).executeAction;
    if (!executeAction) return;

    for (const [soulId, actions] of this.actionQueue) {
      for (const action of actions) {
        const request = this.convertAction(soulId, action);
        if (!request) continue;
        try {
          const result = executeAction.call(this.actionSystem, request, world);
          if (result.success) this.stats.actionsExecuted++;
          else this.stats.actionsFailed++;
        } catch (err) {
          this.stats.actionsFailed++;
          log.warn({ err: String(err), soulId, actionType: action.type }, 'action execution threw');
        }
      }
    }
    this.actionQueue.clear();
  }

  /**
   * Convert a SoulArena action to a Seed ActionRequest.
   * Mapping:
   *   speak      -> communicate (content, medium=acoustic)
   *   expression -> custom (expression, intensity)
   *   move       -> move (parameters passthrough)
   *   attack     -> attack (targetId, parameters)
   *   interact   -> interact (targetId, parameters)
   *   use        -> use (targetId, parameters)
   *   wait       -> wait
   *   other      -> custom (originalType preserved)
   */
  private convertAction(soulId: string, action: SoulArenaAction): ActionRequest | null {
    const timestamp = Date.now();
    switch (action.type) {
      case 'speak':
        return {
          soulId,
          action: 'communicate',
          parameters: { content: action.content ?? '', medium: action.modality ?? 'acoustic' },
          timestamp,
        };
      case 'expression':
        return {
          soulId,
          action: 'custom',
          parameters: { expression: action.expression, intensity: action.intensity ?? 0.5 },
          timestamp,
        };
      case 'move':
        return { soulId, action: 'move', parameters: action.parameters ?? {}, timestamp };
      case 'attack':
        return { soulId, action: 'attack', targetId: action.targetId, parameters: action.parameters ?? {}, timestamp };
      case 'interact':
        return { soulId, action: 'interact', targetId: action.targetId, parameters: action.parameters ?? {}, timestamp };
      case 'use':
        return { soulId, action: 'use', targetId: action.targetId, parameters: action.parameters ?? {}, timestamp };
      case 'wait':
        return { soulId, action: 'wait', parameters: {}, timestamp };
      default:
        return {
          soulId,
          action: 'custom',
          parameters: { originalType: action.type, ...action.parameters },
          timestamp,
        };
    }
  }

  /** Build simplified situation-text payload (recommended mode). */
  private buildSituationPayload(frame: PerceptionFrame): Record<string, unknown> {
    return {
      tick: frame.worldTime,
      situation: this.generateSituationText(frame),
      worldState: {
        position: frame.position,
        environment: frame.environment,
      },
    };
  }

  /** Generate a human-readable situation description from PerceptionFrame. */
  private generateSituationText(frame: PerceptionFrame): string {
    const parts: string[] = [];
    const env = frame.environment;

    // Position.
    parts.push(
      `You are at (${frame.position.x.toFixed(1)}, ${frame.position.y.toFixed(1)}, ${frame.position.z.toFixed(1)}).`,
    );

    // Environment.
    parts.push(
      `Weather: ${env.weather}, ${env.temperature.toFixed(1)}C, humidity ${env.humidity.toFixed(0)}%, wind ${env.windSpeed.toFixed(1)} m/s, light ${(env.lightLevel * 100).toFixed(0)}%.`,
    );

    // Visible entities.
    if (frame.visibleEntities.length > 0) {
      const nearest = frame.visibleEntities.slice(0, 5);
      parts.push(
        `Objects: ${nearest.map((e) => `${e.name}(${e.type}, ${e.distance.toFixed(1)}m)`).join(', ')}.`,
      );
    }

    // Nearby souls.
    if (frame.nearbySouls.length > 0) {
      parts.push(
        `Souls nearby: ${frame.nearbySouls.map((s) => `${s.name}(${s.element}, ${s.distance.toFixed(1)}m)`).join(', ')}.`,
      );
    }

    // Recent communications (most recent first).
    if (frame.communications.length > 0) {
      const latest = frame.communications[frame.communications.length - 1];
      const source = latest.senderId ?? 'unknown';
      parts.push(`You hear from ${source}: "${latest.content}".`);
    }

    // Recent events.
    if (frame.events.length > 0) {
      const latest = frame.events[frame.events.length - 1];
      parts.push(`World event: ${latest.name} (severity: ${latest.severity}).`);
    }

    return parts.join(' ');
  }

  /** Build full structured payload (SoulArena native format). */
  private buildStructuredPayload(frame: PerceptionFrame): Record<string, unknown> {
    const visualObjects = [
      ...frame.nearbySouls.map((s) => ({
        type: 'person' as const,
        name: s.name,
        action: 'idle',
        distance: s.distance,
        expression: '',
      })),
      ...frame.visibleEntities.slice(0, 20).map((e) => ({
        type: 'item' as const,
        name: e.name,
        action: e.type,
        distance: e.distance,
      })),
    ];

    const sounds = frame.communications.map((c) => ({
      type: 'speech' as const,
      source: c.senderId ?? 'unknown',
      content: c.content,
    }));

    return {
      tick: frame.worldTime,
      perception: {
        visual: {
          environment: {
            location: `(${frame.position.x.toFixed(1)},${frame.position.y.toFixed(1)},${frame.position.z.toFixed(1)})`,
            lighting: frame.environment.lightLevel > 0.5 ? 'bright' : 'dim',
            weather: String(frame.environment.weather),
            temperature: frame.environment.temperature,
          },
          objects: visualObjects,
        },
        auditory: { sounds },
        proprioception: { posture: 'standing', health: 100, energy: 100 },
      },
      events: frame.events.map((e) => ({
        description: e.name,
        severity: e.severity === 'extreme' ? 4 : e.severity === 'high' ? 3 : e.severity === 'medium' ? 2 : 1,
        psychologicalEffects: {},
      })),
      worldState: { position: frame.position, environment: frame.environment },
      threatLevel: 0,
      complexity: 0.4,
      timePressure: 0.3,
      activity: 'exploring',
    };
  }

  /** Get bridge statistics. */
  getStats(): BridgeStats {
    return { ...this.stats };
  }

  /** Clear all queued actions. */
  clearQueue(): void {
    this.actionQueue.clear();
  }

  start(): void { /* no-op */ }
  stop(): void { this.actionQueue.clear(); }
}
