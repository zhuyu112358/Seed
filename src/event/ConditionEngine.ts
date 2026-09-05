// ConditionEngine: small predicate language over entity properties / world state / time.
// Used by gameplay rules ("if entity X enters zone Y while worldTime > T").

import type { Entity } from '../entity/Entity.js';

export type Predicate =
  | { kind: 'entityProperty'; entityId: string; property: string; op: 'eq' | 'gt' | 'lt' | 'gte' | 'lte'; value: number }
  | { kind: 'worldTime'; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number }
  | { kind: 'and'; left: Predicate; right: Predicate }
  | { kind: 'or'; left: Predicate; right: Predicate }
  | { kind: 'not'; inner: Predicate };

export interface ConditionContext {
  worldTime: number;
  entities: Map<string, Entity>;
}

type ComparisonOp = 'eq' | 'gt' | 'lt' | 'gte' | 'lte';

function compare(a: number, b: number, op: ComparisonOp): boolean {
  switch (op) {
    case 'eq': return a === b;
    case 'gt': return a > b;
    case 'lt': return a < b;
    case 'gte': return a >= b;
    case 'lte': return a <= b;
  }
}

export class ConditionEngine {
  evaluate(pred: Predicate, ctx: ConditionContext): boolean {
    switch (pred.kind) {
      case 'entityProperty': {
        const e = ctx.entities.get(pred.entityId);
        if (!e) return false;
        const raw = e.properties.get(pred.property) ?? e.state.get(pred.property);
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isNaN(num)) return false;
        return compare(num, pred.value, pred.op);
      }
      case 'worldTime':
        return compare(ctx.worldTime, pred.value, pred.op);
      case 'and':
        return this.evaluate(pred.left, ctx) && this.evaluate(pred.right, ctx);
      case 'or':
        return this.evaluate(pred.left, ctx) || this.evaluate(pred.right, ctx);
      case 'not':
        return !this.evaluate(pred.inner, ctx);
    }
  }
}
