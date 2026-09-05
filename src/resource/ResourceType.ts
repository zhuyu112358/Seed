// ResourceType: defines a type of resource that can be harvested, stored,
// crafted, or consumed. Resource types are registered at runtime, not
// hardcoded — specific worlds define their own resource types via config.

/** Configuration for creating a resource type. */
export interface ResourceTypeConfig {
  /** Unique identifier for this resource type (e.g., "wood", "iron_ore"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Maximum amount that can stack in one inventory slot. Default 99. */
  maxStackSize?: number;
  /** Optional icon identifier for UI rendering. */
  icon?: string;
  /** Whether this resource is renewable (can regrow/respawn). Default true. */
  renewable?: boolean;
}

/** A registered resource type definition. */
export class ResourceType {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly maxStackSize: number;
  readonly icon: string;
  readonly renewable: boolean;

  constructor(config: ResourceTypeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description ?? "";
    this.maxStackSize = config.maxStackSize ?? 99;
    this.icon = config.icon ?? config.id;
    this.renewable = config.renewable ?? true;
  }
}

/** Registry for resource types. Worlds register their resource types at startup. */
export class ResourceTypeRegistry {
  private types = new Map<string, ResourceType>();

  /** Register a resource type. Returns the registered ResourceType. */
  register(config: ResourceTypeConfig): ResourceType {
    const type = new ResourceType(config);
    this.types.set(type.id, type);
    return type;
  }

  /** Get a resource type by ID. Returns undefined if not found. */
  get(id: string): ResourceType | undefined {
    return this.types.get(id);
  }

  /** Check if a resource type is registered. */
  has(id: string): boolean {
    return this.types.has(id);
  }

  /** Get all registered resource types. */
  getAll(): ResourceType[] {
    return Array.from(this.types.values());
  }

  /** Get the number of registered resource types. */
  get size(): number {
    return this.types.size;
  }

  /** Remove a resource type. Returns true if it existed. */
  remove(id: string): boolean {
    return this.types.delete(id);
  }

  /** Clear all registered resource types. */
  clear(): void {
    this.types.clear();
  }
}
