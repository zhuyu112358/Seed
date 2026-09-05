// PathfinderSystem: WorldSystem that maintains a navigation grid and
// provides A* pathfinding services to other systems (e.g. SoulActionSystem).
//
// The system scans world entities each tick (or on demand) and marks cells
// blocked by static obstacles (entities with state.blocksPath === true or
// type === "static"). Dynamic entities are not marked as obstacles by default
// (they move), but can be configured to block paths.
//
// Usage:
//   const pathfinder = new PathfinderSystem({ cellSize: 1, width: 50, height: 50 });
//   world.addSystem(pathfinder);
//   const path = pathfinder.findPath(0, 0, 10, 10);

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { GridMap, type GridMapConfig } from "./GridMap.js";
import { AStarPathfinder, type PathResult } from "./AStarPathfinder.js";
import { GameObject } from "../entity/Entity.js";

export interface PathfinderSystemConfig extends GridMapConfig {
  /** If true, scan entities for obstacles every tick. Default true. */
  autoUpdate?: boolean;
  /** Entity types that block paths by default. Default ["static"]. */
  blockingTypes?: string[];
  /** If true, entities with state.blocksPath=true block paths. Default true. */
  respectBlocksPathFlag?: boolean;
}

export class PathfinderSystem implements WorldSystem {
  readonly name = "pathfinder";
  enabled = true;

  readonly grid: GridMap;
  private readonly pathfinder: AStarPathfinder;
  private readonly config: Required<PathfinderSystemConfig>;
  private dirty = true;

  constructor(config?: PathfinderSystemConfig) {
    this.config = {
      cellSize: config?.cellSize ?? 1.0,
      width: config?.width ?? 100,
      height: config?.height ?? 100,
      originX: config?.originX ?? 0,
      originZ: config?.originZ ?? 0,
      allowDiagonal: config?.allowDiagonal ?? true,
      autoUpdate: config?.autoUpdate ?? true,
      blockingTypes: config?.blockingTypes ?? ["static"],
      respectBlocksPathFlag: config?.respectBlocksPathFlag ?? true,
    };
    this.grid = new GridMap({
      cellSize: this.config.cellSize,
      width: this.config.width,
      height: this.config.height,
      originX: this.config.originX,
      originZ: this.config.originZ,
      allowDiagonal: this.config.allowDiagonal,
    });
    this.pathfinder = new AStarPathfinder();
  }

  /** Mark the grid as dirty so it will be rebuilt on next tick or findPath call. */
  markDirty(): void {
    this.dirty = true;
  }

  /** Rebuild the navigation grid from world entities. */
  rebuildGrid(world: World): void {
    this.grid.clear();
    for (const entity of world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;
      if (this.isBlocking(entity)) {
        const pos = entity.position;
        const he = entity.halfExtents;
        this.grid.blockRegion(
          pos.x - he.x, pos.z - he.z,
          pos.x + he.x, pos.z + he.z,
        );
      }
    }
    this.dirty = false;
  }

  /** Check if an entity should block the navigation grid. */
  private isBlocking(entity: GameObject): boolean {
    if (this.config.respectBlocksPathFlag && entity.state.get("blocksPath") === true) {
      return true;
    }
    return this.config.blockingTypes.includes(entity.type);
  }

  /**
   * Find a path from (startX, startZ) to (goalX, goalZ) in world space.
   * Returns waypoints or null if unreachable. Rebuilds grid if dirty.
   */
  findPath(startX: number, startZ: number, goalX: number, goalZ: number, world?: World): PathResult | null {
    if (this.dirty && world) {
      this.rebuildGrid(world);
    }
    return this.pathfinder.findPath(startX, startZ, goalX, goalZ, this.grid);
  }

  /** WorldSystem tick: rebuild grid if dirty and autoUpdate is on. */
  tick(_dt: number, world: World, _events: EventSystem): void {
    if (this.config.autoUpdate && this.dirty) {
      this.rebuildGrid(world);
    }
  }

  start(): void { this.dirty = true; }
  stop(): void { /* no-op */ }

  /** Number of blocked cells in the current grid. */
  get blockedCellCount(): number {
    return this.grid.blockedCount;
  }
}
