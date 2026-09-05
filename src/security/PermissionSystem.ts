import type { ILogger, Permission, Role } from '../types/index.js';

class NullLogger implements ILogger {
  debug(): void {} info(): void {} warn(): void {} error(): void {} fatal(): void {}
  child(): ILogger { return this; }
}

export class PermissionSystem {
  private readonly logger: ILogger;
  private readonly rolePerms = new Map<Role, Permission[]>();
  private readonly roles = new Map<string, Role>();
  private readonly cache = new Map<string, boolean>();

  constructor(logger?: ILogger) {
    this.logger = logger ?? new NullLogger();
    this.defineDefaults();
  }

  private defineDefaults(): void {
    this.defineRole('admin', [{ resource: '*', action: '*' }]);
    this.defineRole('moderator', [
      { resource: 'entity.*', action: 'read' }, { resource: 'entity.*', action: 'update' }, { resource: 'entity.*', action: 'delete' },
      { resource: 'event.*', action: 'execute' },
    ]);
    this.defineRole('soul', [
      { resource: 'world.*', action: 'read' },
      { resource: 'entity.*', action: 'read' }, { resource: 'entity.own', action: 'update' },
      { resource: 'action.*', action: 'execute' }, { resource: 'communication.*', action: 'execute' },
    ]);
    this.defineRole('observer', [{ resource: '*', action: 'read' }]);
    this.defineRole('anonymous', [{ resource: 'world.public', action: 'read' }]);
  }

  defineRole(role: Role, permissions: Permission[]): void { this.rolePerms.set(role, [...permissions]); this.cache.clear(); }
  assignRole(entityId: string, role: Role): void { this.roles.set(entityId, role); this.cache.clear(); }
  removeRole(entityId: string): void { this.roles.delete(entityId); this.cache.clear(); }
  getRole(entityId: string): Role | null { return this.roles.get(entityId) ?? null; }

  hasPermission(entityId: string, resource: string, action: string): boolean {
    const role = this.roles.get(entityId) ?? 'anonymous';
    const key = `${role}:${resource}:${action}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const allowed = this.evaluate(role, resource, action);
    this.cache.set(key, allowed);
    return allowed;
  }

  checkPermission(entityId: string, resource: string, action: string): { allowed: boolean; reason?: string } {
    if (this.hasPermission(entityId, resource, action)) return { allowed: true };
    return { allowed: false, reason: `Entity ${entityId} lacks ${action} on ${resource}` };
  }

  addPermissionToRole(role: Role, permission: Permission): void {
    const list = this.rolePerms.get(role) ?? []; list.push(permission); this.rolePerms.set(role, list); this.cache.clear();
  }
  removePermissionFromRole(role: Role, resource: string, action: string): void {
    const list = this.rolePerms.get(role) ?? [];
    this.rolePerms.set(role, list.filter((p) => !(p.resource === resource && p.action === action)));
    this.cache.clear();
  }

  private evaluate(role: Role, resource: string, action: string): boolean {
    const perms = this.rolePerms.get(role) ?? [];
    for (const p of perms) {
      if (this.matchResource(p.resource, resource) && this.matchAction(p.action, action)) return true;
    }
    return false;
  }
  private matchResource(grant: string, resource: string): boolean {
    if (grant === '*') return true;
    if (grant === resource) return true;
    if (grant.endsWith('.*')) { const prefix = grant.slice(0, -1); return resource === prefix.slice(0, -1) || resource.startsWith(prefix); }
    return false;
  }
  private matchAction(grant: string, action: string): boolean { return grant === '*' || grant === action; }
}
