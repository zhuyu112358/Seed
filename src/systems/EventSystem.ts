import type { IEntity, ILogger, IVector3 } from '../types/index.js';
import type { EventCondition, EventDefinition, WorldEvent, WorldEventEffect } from './event-types.js';
import { consoleFallbackLogger } from './logger.js';
import { ConditionEngine, type ConditionContext } from './ConditionEngine.js';
export interface WorldEnvironment { temperature: number; pressure: number; windSpeed: number; humidity?: number; lightLevel?: number; [key: string]: unknown; }
export interface WorldEventContext {
  getEntitiesInArea(center: IVector3, radius: number): IEntity[];
  getEnvironment(): WorldEnvironment;
  getTime(): number;
}
export type EventEffectApplier = (event: WorldEvent, effect: WorldEventEffect, entities: IEntity[]) => void;
type EventListener = (event: WorldEvent) => void;
const MAX_HISTORY = 100;
export class EventSystem {
  private readonly logger: ILogger;
  private readonly conditions: ConditionEngine;
  private readonly definitions = new Map<string, EventDefinition>();
  private readonly activeEvents = new Map<string, WorldEvent>();
  private readonly historyList: WorldEvent[] = [];
  private readonly listeners = new Map<string, Set<EventListener>>();
  private eventCounter = 0;
  private effectApplier: EventEffectApplier | null = null;
  private customConditionEvaluator: ((c: EventCondition) => boolean) | null = null;
  constructor(logger?: ILogger) { this.logger = logger ?? consoleFallbackLogger; this.conditions = new ConditionEngine(this.logger); }
  registerEventDefinition(d: EventDefinition): void { this.definitions.set(d.type, d); }
  unregisterEventDefinition(type: string): void { this.definitions.delete(type); }
  triggerEvent(type: string, position: IVector3, overrides?: Partial<WorldEvent>): WorldEvent | null {
    const definition = this.definitions.get(type);
    const radius = overrides?.radius ?? definition?.defaultRadius ?? 0;
    const duration = overrides?.duration ?? definition?.defaultDuration ?? 0;
    if (radius <= 0 || duration <= 0) return null;
    const now = Date.now();
    const event: WorldEvent = {
      id: `event_${++this.eventCounter}`, type,
      name: overrides?.name ?? definition?.name ?? type,
      severity: overrides?.severity ?? definition?.severity ?? 'info',
      position, radius, duration, elapsed: 0, status: 'active',
      effects: overrides?.effects ?? definition?.effects ?? [],
      conditions: overrides?.conditions ?? definition?.conditions,
      propagation: overrides?.propagation ?? definition?.propagation,
      createdAt: now, triggeredAt: now, data: overrides?.data ?? {},
    };
    this.activeEvents.set(event.id, event);
    this.notifyListeners(event);
    return event;
  }
  cancelEvent(eventId: string): boolean {
    const event = this.activeEvents.get(eventId);
    if (!event) return false;
    event.status = 'cancelled';
    this.activeEvents.delete(eventId);
    this.pushHistory(event);
    return true;
  }
  getActiveEvents(): WorldEvent[] { return Array.from(this.activeEvents.values()); }
  getEvent(eventId: string): WorldEvent | undefined { return this.activeEvents.get(eventId) ?? this.historyList.find((e) => e.id === eventId); }
  getEventHistory(): WorldEvent[] { return [...this.historyList]; }
  on(eventType: string, handler: EventListener): void {
    const set = this.listeners.get(eventType) ?? new Set<EventListener>();
    set.add(handler); this.listeners.set(eventType, set);
  }
  setEffectApplier(applier: EventEffectApplier): void { this.effectApplier = applier; }
  setCustomConditionEvaluator(fn: (c: EventCondition) => boolean): void { this.customConditionEvaluator = fn; }
  update(deltaTime: number, worldContext: WorldEventContext): void {
    for (const event of Array.from(this.activeEvents.values())) {
      event.elapsed += deltaTime;
      if (event.elapsed >= event.duration) {
        event.status = 'expired'; this.activeEvents.delete(event.id);
        this.pushHistory(event); this.notifyListeners(event); continue;
      }
      this.applyEffects(event, worldContext);
    }
    this.autoTrigger(worldContext);
  }
  private applyEffects(event: WorldEvent, worldContext: WorldEventContext): void {
    if (!this.effectApplier || event.effects.length === 0) return;
    const entities = worldContext.getEntitiesInArea(event.position, event.radius);
    for (const effect of event.effects) this.effectApplier(event, effect, entities);
  }
  private autoTrigger(worldContext: WorldEventContext): void {
    const context = this.buildContext(worldContext);
    for (const definition of this.definitions.values()) {
      if (this.isActive(definition.type)) continue;
      if (!this.conditions.evaluate(definition.conditions, definition.conditionLogic, context)) continue;
      const area = definition.conditions.find((c) => c.area !== undefined)?.area;
      this.triggerEvent(definition.type, area ? area.position : { x: 0, y: 0, z: 0 });
    }
  }
  private isActive(type: string): boolean {
    for (const e of this.activeEvents.values()) if (e.type === type) return true;
    return false;
  }
  private buildContext(worldContext: WorldEventContext): ConditionContext {
    const env = worldContext.getEnvironment();
    return {
      getTemperatureAt: () => env.temperature, getPressureAt: () => env.pressure,
      getWindSpeed: () => env.windSpeed,
      getEntityDensity: (a) => worldContext.getEntitiesInArea(a.position, a.radius).length,
      getTimeOfDay: () => worldContext.getTime(),
      getEntityState: () => undefined,
      evaluateCustom: (c) => (this.customConditionEvaluator ? this.customConditionEvaluator(c) : false),
    };
  }
  private notifyListeners(event: WorldEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const handler of set) { try { handler(event); } catch { /* host logs */ } }
  }
  private pushHistory(event: WorldEvent): void {
    this.historyList.push(event);
    if (this.historyList.length > MAX_HISTORY) this.historyList.shift();
  }
}
