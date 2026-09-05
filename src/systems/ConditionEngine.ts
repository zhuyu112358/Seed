import type { EntityState, ILogger, IVector3 } from '../types/index.js';
import type { EventCondition } from './event-types.js';
import { consoleFallbackLogger } from './logger.js';
export interface ConditionArea { position: IVector3; radius: number; }
export interface ConditionContext {
  getTemperatureAt(pos?: IVector3): number; getPressureAt(pos?: IVector3): number;
  getWindSpeed(): number; getEntityDensity(area: ConditionArea): number;
  getTimeOfDay(): number; getEntityState(entityId: string): EntityState | undefined;
  evaluateCustom(condition: EventCondition): boolean;
}
function cmp(actual: number, c: EventCondition): boolean {
  const v = Number(c.value); const v2 = c.value2;
  switch (c.operator) {
    case 'gt': return actual > v; case 'lt': return actual < v; case 'eq': return actual === v;
    case 'gte': return actual >= v; case 'lte': return actual <= v;
    case 'between': { const lo = Math.min(v, v2 ?? v); const hi = Math.max(v, v2 ?? v); return actual >= lo && actual <= hi; }
    case 'exists': return !Number.isNaN(actual); default: return false;
  }
}
export class ConditionEngine {
  private readonly logger: ILogger;
  constructor(logger?: ILogger) { this.logger = logger ?? consoleFallbackLogger; }
  evaluate(conditions: EventCondition[], logic: 'AND' | 'OR', context: ConditionContext): boolean {
    if (conditions.length === 0) return true;
    if (logic === 'AND') return conditions.every((c) => this.evaluateSingle(c, context));
    return conditions.some((c) => this.evaluateSingle(c, context));
  }
  evaluateSingle(condition: EventCondition, context: ConditionContext): boolean {
    let result: boolean;
    try { result = this.leaf(condition, context); } catch { result = false; }
    return condition.combine === 'NOT' ? !result : result;
  }
  private leaf(condition: EventCondition, context: ConditionContext): boolean {
    switch (condition.type) {
      case 'temperature': return cmp(context.getTemperatureAt(condition.area?.position), condition);
      case 'pressure': return cmp(context.getPressureAt(condition.area?.position), condition);
      case 'wind_speed': return cmp(context.getWindSpeed(), condition);
      case 'entity_density': return condition.area ? cmp(context.getEntityDensity(condition.area), condition) : false;
      case 'proximity': {
        if (!condition.area) return false;
        const d = context.getEntityDensity(condition.area);
        return condition.operator === 'exists' ? d > 0 : cmp(d, condition);
      }
      case 'time': return cmp(context.getTimeOfDay(), condition);
      case 'state': {
        const st = context.getEntityState(String(condition.value));
        return condition.operator === 'exists' ? st !== undefined : cmp(st !== undefined ? 1 : 0, condition);
      }
      case 'custom': return context.evaluateCustom(condition);
      default: return false;
    }
  }
}
