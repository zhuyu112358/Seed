/**
 * Seed Engine - PermissionSystem
 *
 * Role-based access control (RBAC). Roles bundle permissions over a resource
 * hierarchy (world.*, entity.*, event.*, system.*, communication.*) and an
 * action (create/read/update/delete/execute/*). Wildcards are supported both at
 * the resource level ("entity.*" covers "entity.player") and the action level
 * ("*"). Per-entity permission lookups are cached for performance and the cache
 * is invalidated whenever roles or role permissions change.
 */

import type { ILogger, Permission, Role } from '../types/index.js';

class NullLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  fatal(): void {}
  child(): ILogger {
    return this;
  }
}

/** Key used to cache a single permission lookup. */
type CacheKey = string; // `${entityId}|${resource}|${action}`

export class PermissionSystem {
  private readonly logger: ILogger;
  private readonly rolePermissions = new Map<Role, Permission[]>();
  private readonly entityRoles = new Map<string, Role>();
  private readonly cache = new Map<CacheKey, boolean>();

  constructor(logger?: ILogger) {
    this.logger = logger ?? new NullLogger();
    this.defineDefaultRoles();
  }

  /** Define (or replace) the permission set for a role. */
  defineRole(role: Role, permissions: Permission[]): void {
    this.rolePermissions.set(role, [...permissions]);
    this.invalidateCache();
    this.logger.debug('Role defined', { role, permissionCount: permissions.length });
  }

  /** Assign a role to an entity. Replaces any previous role. */
  assignRole(entityId: string, role: Role): void {
    this.entityRoles.set(entityId, role);
    this.invalidateCache();
    this.logger.debug('Role assigned', { entityId, role });
  }

  /** Remove the role assignment for an entity. */
  removeRole(entityId: string): void {
    this.entityRoles.delete(entityId);
    this.invalidateCache();
  }

  /** Look up the role currently assigned to an entity. */
  getRole(entityId: string): Role | null {
    return this.entityRoles.get(entityId) ?? null;
  }

  /** Add a permission to an existing role. */
  addPermissionToRole(role: Role, permission: Permission): void {
    const existing = this.rolePermissions.get(role) ?? [];
    existing.push(permission);
    this.rolePermissions.set(role, existing);
    this.invalidateCache();
  }

  /** Remove matching permissions from a role by resource and action. */
  removePermissionFromRole(role: Role, resource: string, action: string): void {
    const existing = this.rolePermissions.get(role);
    if (!existing) return;
    const filtered = existing.filter(
      (p) => !(p.resource === resource && p.action === action),
    );
    this.rolePermissions.set(role, filtered);
    this.invalidateCache();
  }

  /** Whether the entity may perform `action` on `resource`. */
  hasPermission(entityId: string, resource: string, action: string): boolean {
    const cacheKey: CacheKey = `${entityId}|${resource}|${action}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const role = this.entityRoles.get(entityId);
    let allowed = false;
    if (role) {
      const permissions = this.rolePermissions.get(role) ?? [];
      allowed = permissions.some((p) => this.permissionMatches(p, resource, action));
    }

    this.cache.set(cacheKey, allowed);
    return allowed;
  }

  /** Check with a human-readable reason for denial. */
  checkPermission(entityId: string, resource: string, action: string): { allowed: boolean; reason?: string } {
    const allowed = this.hasPermission(entityId, resource, action);
    if (allowed) return { allowed: true };
    const role = this.entityRoles.get(entityId);
    if (!role) return { allowed: false, reason: `No role assigned to "${entityId}"` };
    return {
      allowed: false,
      reason: `Role "${role}" lacks permission ${action} on ${resource}`,
    };
  }

  /**
   * Match a permission against a requested resource/action. Supports:
   *  - wildcard action "*"
   *  - wildcard resource "*"
   *  - prefix wildcards "entity.*" matching "entity" and "entity.*"
   */
  private permissionMatches(permission: Permission, resource: string, action: string): boolean {
    if (permission.action !== '*' && permission.action !== action) return false;
    return this.resourceMatches(permission.resource, resource);
  }

  private resourceMatches(allowed: string, requested: string): boolean {
    if (allowed === '*') return true;
    if (allowed === requested) return true;
    if (allowed.endsWith('.*')) {
      const prefix = allowed.slice(0, -2); // strip trailing ".*"
      return requested === prefix || requested.startsWith(`${prefix}.`);
    }
    return false;
  }

  /** Clear the permission lookup cache (called on any change). */
  private invalidateCache(): void {
    this.cache.clear();
  }

  /** Register the engine's built-in default roles. */
  private defineDefaultRoles(): void {
    // admin: full access to every resource and action.
    this.rolePermissions.set('admin', [{ resource: '*', action: '*' }]);

    // moderator: read/update/delete on entities, execute on events, no system config.
    this.rolePermissions.set('moderator', [
      { resource: 'entity.*', action: 'read' },
      { resource: 'entity.*', action: 'update' },
      { resource: 'entity.*', action: 'delete' },
      { resource: 'event.*', action: 'execute' },
      { resource: 'communication.*', action: 'read' },
      { resource: 'world.*', action: 'read' },
    ]);

    // soul: read the world, update its own entity, and execute actions.
    this.rolePermissions.set('soul', [
      { resource: 'world.*', action: 'read' },
      { resource: 'entity.*', action: 'update', condition: 'owner' },
      { resource: 'communication.*', action: 'execute' },
      { resource: 'event.*', action: 'read' },
    ]);

    // observer: read-only across all resources.
    this.rolePermissions.set('observer', [
      { resource: '*', action: 'read' },
    ]);

    // anonymous: read public world info only.
    this.rolePermissions.set('anonymous', [
      { resource: 'world.public', action: 'read' },
      { resource: 'world.*', action: 'read' },
    ]);
  }
}
