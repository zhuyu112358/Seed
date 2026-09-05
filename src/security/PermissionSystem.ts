// PermissionSystem: role-based access control.

import type { Role } from '../types/index.js';

export interface PermissionRule { role: Role; resource: string; action: string; }

export class PermissionSystem {
  private readonly rules: PermissionRule[] = [];
  constructor() {
    this.grant({ role: 'admin', resource: '*', action: '*' });
    this.grant({ role: 'observer', resource: '*', action: 'read' });
    this.grant({ role: 'soul', resource: 'entity', action: 'read' });
    this.grant({ role: 'soul', resource: 'entity', action: 'interact' });
    this.grant({ role: 'soul', resource: 'soul', action: 'self-action' });
  }
  grant(rule: PermissionRule): void { this.rules.push(rule); }
  isAllowed(role: Role, resource: string, action: string): boolean {
    return this.rules.some((r) => r.role === role && (r.resource === '*' || r.resource === resource) && (r.action === '*' || r.action === action));
  }
  ensure(role: Role, resource: string, action: string): void {
    if (!this.isAllowed(role, resource, action)) throw new Error(`permission denied: ${role} cannot ${action} on ${resource}`);
  }
}
