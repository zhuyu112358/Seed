/**
 * Seed Bridge - SoulBridge
 *
 * Bidirectional bridge between a Seed world and the SoulArena soul system.
 */
import type {
  ActionRequest, ActionResult, ILogger, IVector3, PerceptionFrame,
  SoulFeedback, SoulInfo, ValidationSchema, WorldEffect,
} from '../types/index.js';
import { Logger } from '../reliability/Logger.js';

export interface BridgeValidator {
  validateInline(schema: ValidationSchema, data: unknown): { valid: boolean; errors: unknown[] };
}
export interface SoulWorldAdapter {
  createSoulEntity(soulId: string, position: IVector3): string;
  removeSoulEntity(entityId: string): boolean;
  getEntityPosition(entityId: string): IVector3 | undefined;
  executeAction(request: ActionRequest): ActionResult;
  buildPerceptionFrame(soulId: string): PerceptionFrame;
}
export type SoulBridgeEvent =
  | 'soulJoined' | 'soulLeft' | 'actionReceived' | 'effectApplied'
  | 'connectionLost' | 'connectionRestored';
export type SoulBridgeListener = (payload?: unknown) => void;
export interface SoulBridgeConfig {
  soulSystemUrl: string; worldId: string; logger?: ILogger;
  validator?: BridgeValidator; pollIntervalSec?: number;
}
const DEFAULT_POLL_SEC = 0.5;
const MAX_BACKOFF_MS = 30000;

export class SoulBridge {
  private readonly soulSystemUrl: string;
  private readonly worldId: string;
  private readonly logger: ILogger;
  private readonly validator?: BridgeValidator;
  private readonly pollIntervalSec: number;
  private readonly connectedSouls = new Set<string>();
  private readonly listeners = new Map<SoulBridgeEvent, Set<SoulBridgeListener>>();
  private world: SoulWorldAdapter | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private pollAccumulator = 0;
  private aborted = false;
  constructor(config: SoulBridgeConfig) {
    this.soulSystemUrl = config.soulSystemUrl.replace(/\/$/, '');
    this.worldId = config.worldId;
    this.logger = config.logger ?? Logger.for('bridge');
    this.validator = config.validator;
    this.pollIntervalSec = config.pollIntervalSec ?? DEFAULT_POLL_SEC;
  }
  attachWorld(world: SoulWorldAdapter): this { this.world = world; return this; }
  on(event: SoulBridgeEvent, listener: SoulBridgeListener): this {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener); this.listeners.set(event, set); return this;
  }
  off(event: SoulBridgeEvent, listener: SoulBridgeListener): this {
    this.listeners.get(event)?.delete(listener); return this;
  }
  private emit(event: SoulBridgeEvent, payload?: unknown): void {
    const set = this.listeners.get(event); if (!set) return;
    for (const cb of set) { try { cb(payload); } catch { /* isolated */ } }
  }
  async connect(): Promise<boolean> {
    try {
      const res = await fetch(`${this.soulSystemUrl}/api/souls`, { signal: AbortSignal.timeout(2000) });
      this.connected = res.ok;
      if (this.connected) { this.reconnectAttempts = 0; this.emit('connectionRestored'); }
      else this.handleConnectionLoss();
      return this.connected;
    } catch (err) {
      this.logger.warn('soul system unreachable', { error: String(err) });
      this.handleConnectionLoss(); return false;
    }
  }
  disconnect(): void {
    this.aborted = true; this.connected = false;
    for (const soulId of [...this.connectedSouls]) this.leaveWorld(soulId).catch(() => undefined);
    this.connectedSouls.clear();
  }
  private handleConnectionLoss(): void {
    if (this.connected) { this.connected = false; this.emit('connectionLost'); }
    this.reconnectAttempts += 1;
  }
  private backoffMs(): number { return Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.reconnectAttempts); }
  private async getJson<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.soulSystemUrl}${path}`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch { return null; }
  }
  private async postJson(path: string, body: unknown): Promise<boolean> {
    try {
      const res = await fetch(`${this.soulSystemUrl}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch { return false; }
  }
  async getSoulList(): Promise<SoulInfo[]> {
    const raw = await this.getJson<{ souls?: SoulInfo[] } | SoulInfo[]>('/api/souls');
    if (raw === null) return [];
    return Array.isArray(raw) ? raw : raw.souls ?? [];
  }
  async getSoulDetail(soulId: string): Promise<SoulInfo | null> {
    return this.getJson<SoulInfo>(`/api/souls/${encodeURIComponent(soulId)}`);
  }
  async joinWorld(soulId: string, spawnPosition: IVector3): Promise<{ success: boolean; entityId: string }> {
    if (!soulId) return { success: false, entityId: '' };
    const entityId = this.world ? this.world.createSoulEntity(soulId, spawnPosition) : `soul_${soulId}`;
    await this.postJson(`/api/souls/${encodeURIComponent(soulId)}/join`, { worldId: this.worldId, position: spawnPosition });
    this.connectedSouls.add(soulId);
    this.emit('soulJoined', { soulId, entityId });
    return { success: true, entityId };
  }
  async leaveWorld(soulId: string): Promise<boolean> {
    const removed = this.world ? this.world.removeSoulEntity(`soul_${soulId}`) : true;
    await this.postJson(`/api/souls/${encodeURIComponent(soulId)}/leave`, { worldId: this.worldId });
    this.connectedSouls.delete(soulId);
    this.emit('soulLeft', { soulId, removed });
    return removed;
  }
  async sendPerceptionFrame(soulId: string, frame: PerceptionFrame): Promise<boolean> {
    return this.postJson(`/api/souls/${encodeURIComponent(soulId)}/perception`, frame);
  }
  async requestAction(soulId: string): Promise<ActionRequest | null> {
    const req = await this.getJson<ActionRequest | { action: null }>(`/api/souls/${encodeURIComponent(soulId)}/action`);
    if (!req || (req as { action: null }).action === null) return null;
    const action = req as ActionRequest; this.emit('actionReceived', action); return action;
  }
  async executeAction(request: ActionRequest): Promise<ActionResult> {
    const schema: ValidationSchema = {
      type: 'object', required: ['soulId', 'action'],
      properties: { soulId: { type: 'string' }, action: { type: 'string' } },
    };
    if (this.validator && !this.validator.validateInline(schema, request).valid) {
      const result: ActionResult = { soulId: request.soulId, action: request.action, success: false, message: 'invalid action payload', timestamp: Date.now() };
      await this.postJson(`/api/souls/${encodeURIComponent(request.soulId)}/action/result`, result);
      return result;
    }
    const result = this.world
      ? this.world.executeAction(request)
      : { soulId: request.soulId, action: request.action, success: true, message: 'no world attached', timestamp: Date.now() };
    await this.postJson(`/api/souls/${encodeURIComponent(request.soulId)}/action/result`, result);
    return result;
  }
  async applyWorldEffect(effect: WorldEffect): Promise<boolean> {
    const ok = await this.postJson('/api/effects', effect);
    if (ok) this.emit('effectApplied', effect); return ok;
  }
  async receiveSoulFeedback(soulId: string): Promise<SoulFeedback | null> {
    return this.getJson<SoulFeedback>(`/api/souls/${encodeURIComponent(soulId)}/feedback`);
  }
  getConnectedSouls(): string[] { return [...this.connectedSouls]; }
  update(deltaTime: number): void {
    if (this.aborted || !this.connected) return;
    this.pollAccumulator += deltaTime;
    if (this.pollAccumulator < this.pollIntervalSec) return;
    this.pollAccumulator = 0;
    for (const soulId of this.connectedSouls) void this.tickSoul(soulId);
  }
  private async tickSoul(soulId: string): Promise<void> {
    try {
      if (this.world) await this.sendPerceptionFrame(soulId, this.world.buildPerceptionFrame(soulId));
      const action = await this.requestAction(soulId);
      if (action) await this.executeAction(action);
    } catch (err) { this.logger.debug('soul tick failed', { soulId, error: String(err) }); }
  }
  get nextBackoffMs(): number { return this.backoffMs(); }
  get isConnected(): boolean { return this.connected; }
}
