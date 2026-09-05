// WorldTransaction: a minimal undo-log skeleton. A transaction records a list of
// reversible mutations; commit() applies them, rollback() reverses them. The
// v0.1 implementation only supports position/velocity snapshots so the test world
// can demonstrate it; richer action logs land later.

import type { GameObject } from '../entity/Entity.js';
import { Vector3 } from '../entity/Vector3.js';

interface Mutation {
  entityId: string;
  before: { x: number; y: number; z: number };
  after: { x: number; y: number; z: number };
}

export class WorldTransaction {
  private readonly mutations: Mutation[] = [];
  private committed = false;

  /** Snapshot an entity's position before it is changed. */
  record(entity: GameObject, before: { x: number; y: number; z: number }): void {
    this.mutations.push({
      entityId: entity.id,
      before,
      after: entity.position.toObject(),
    });
  }

  /** Mark the end of a mutation block; update the `after` values. */
  finalize(entities: Map<string, GameObject>): void {
    for (const m of this.mutations) {
      const e = entities.get(m.entityId);
      if (e) m.after = e.position.toObject();
    }
  }

  commit(): void {
    this.committed = true;
  }

  /** Replay the `before` positions back onto the given entities. */
  rollback(entities: Map<string, GameObject>): number {
    let reverted = 0;
    for (const m of this.mutations) {
      const e = entities.get(m.entityId);
      if (!e) continue;
      e.position = new Vector3(m.before.x, m.before.y, m.before.z);
      reverted++;
    }
    this.committed = false;
    return reverted;
  }

  isCommitted(): boolean {
    return this.committed;
  }

  size(): number {
    return this.mutations.length;
  }
}
