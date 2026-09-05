import type { IVector3 } from '../types/index.js';
export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type EventStatus = 'triggered' | 'active' | 'expired' | 'cancelled';
export type ConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between' | 'exists';
export type ConditionType = 'temperature' | 'pressure' | 'wind_speed' | 'entity_density' | 'time' | 'proximity' | 'state' | 'custom';
export interface EventCondition {
  type: ConditionType; operator: ConditionOperator; value: number; value2?: number;
  area?: { position: IVector3; radius: number }; combine?: 'AND' | 'OR' | 'NOT'; metadata?: Record<string, unknown>;
}
export interface WorldEventEffect { type: string; magnitude: number; radius?: number; metadata?: Record<string, unknown>; }
export interface EventPropagationConfig { spreadSpeed: number; maxRadius: number; decayPerSecond?: number; }
export interface EventDefinition {
  type: string; name: string; severity: EventSeverity; conditions: EventCondition[];
  conditionLogic: 'AND' | 'OR'; effects: WorldEventEffect[]; defaultRadius: number;
  defaultDuration: number; propagation?: EventPropagationConfig; data?: Record<string, unknown>;
}
export interface WorldEvent {
  id: string; type: string; name: string; severity: EventSeverity; position: IVector3;
  radius: number; duration: number; elapsed: number; status: EventStatus; effects: WorldEventEffect[];
  conditions?: EventCondition[]; propagation?: EventPropagationConfig; createdAt: number;
  triggeredAt: number; data: Record<string, unknown>;
}
