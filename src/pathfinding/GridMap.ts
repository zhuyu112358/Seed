// Grid-based navigation map for pathfinding.
//
// The grid divides the world into uniform cells. Each cell is either
// walkable or blocked. Obstacles (static entities with blocksPath=true)
// mark cells as blocked. The grid supports arbitrary world coordinates
// via an origin offset and configurable cell size.

export interface GridMapConfig {
  /** World-space size of each grid cell. Default 1.0. */
  cellSize?: number;
  /** Grid width in cells. Default 100. */
  width?: number;
  /** Grid height in cells (z-axis). Default 100. */
  height?: number;
  /** World-space origin (minimum x,z) of the grid. Default (0,0). */
  originX?: number;
  originZ?: number;
  /** Allow diagonal movement between cells. Default true. */
  allowDiagonal?: boolean;
}

export interface GridCell {
  x: number; // cell coordinate
  z: number;
  walkable: boolean;
}

export class GridMap {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originZ: number;
  readonly allowDiagonal: boolean;

  /** Flat array: blocked[width * z + x] = true means blocked. */
  private readonly blocked: Uint8Array;

  constructor(config?: GridMapConfig) {
    this.cellSize = config?.cellSize ?? 1.0;
    this.width = config?.width ?? 100;
    this.height = config?.height ?? 100;
    this.originX = config?.originX ?? 0;
    this.originZ = config?.originZ ?? 0;
    this.allowDiagonal = config?.allowDiagonal ?? true;
    this.blocked = new Uint8Array(this.width * this.height);
  }

  /** Convert world x to cell x coordinate. */
  worldToCellX(worldX: number): number {
    return Math.floor((worldX - this.originX) / this.cellSize);
  }

  /** Convert world z to cell z coordinate. */
  worldToCellZ(worldZ: number): number {
    return Math.floor((worldZ - this.originZ) / this.cellSize);
  }

  /** Convert cell x to world x (center of cell). */
  cellToWorldX(cellX: number): number {
    return this.originX + (cellX + 0.5) * this.cellSize;
  }

  /** Convert cell z to world z (center of cell). */
  cellToWorldZ(cellZ: number): number {
    return this.originZ + (cellZ + 0.5) * this.cellSize;
  }

  /** Check if a cell coordinate is within grid bounds. */
  inBounds(cellX: number, cellZ: number): boolean {
    return cellX >= 0 && cellX < this.width && cellZ >= 0 && cellZ < this.height;
  }

  /** Check if a world position is walkable. */
  isWalkable(worldX: number, worldZ: number): boolean {
    const cx = this.worldToCellX(worldX);
    const cz = this.worldToCellZ(worldZ);
    if (!this.inBounds(cx, cz)) return false;
    return this.blocked[cz * this.width + cx] === 0;
  }

  /** Mark a cell as blocked (1) or walkable (0). */
  setCell(cellX: number, cellZ: number, blocked: boolean): void {
    if (!this.inBounds(cellX, cellZ)) return;
    this.blocked[cellZ * this.width + cellX] = blocked ? 1 : 0;
  }

  /** Mark a world-space AABB region as blocked. */
  blockRegion(minX: number, minZ: number, maxX: number, maxZ: number): void {
    const cxMin = Math.max(0, this.worldToCellX(minX));
    const czMin = Math.max(0, this.worldToCellZ(minZ));
    const cxMax = Math.min(this.width - 1, this.worldToCellX(maxX));
    const czMax = Math.min(this.height - 1, this.worldToCellZ(maxZ));
    for (let cz = czMin; cz <= czMax; cz++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        this.blocked[cz * this.width + cx] = 1;
      }
    }
  }

  /** Clear all blocked cells. */
  clear(): void {
    this.blocked.fill(0);
  }

  /** Get walkable neighbors of a cell (for A*). */
  getNeighbors(cellX: number, cellZ: number): Array<{ x: number; z: number; cost: number }> {
    const neighbors: Array<{ x: number; z: number; cost: number }> = [];
    const dirs = this.allowDiagonal
      ? [
          { dx: 0, dz: -1, cost: 1 }, { dx: 0, dz: 1, cost: 1 },
          { dx: -1, dz: 0, cost: 1 }, { dx: 1, dz: 0, cost: 1 },
          { dx: -1, dz: -1, cost: Math.SQRT2 }, { dx: 1, dz: -1, cost: Math.SQRT2 },
          { dx: -1, dz: 1, cost: Math.SQRT2 }, { dx: 1, dz: 1, cost: Math.SQRT2 },
        ]
      : [
          { dx: 0, dz: -1, cost: 1 }, { dx: 0, dz: 1, cost: 1 },
          { dx: -1, dz: 0, cost: 1 }, { dx: 1, dz: 0, cost: 1 },
        ];

    for (const d of dirs) {
      const nx = cellX + d.dx;
      const nz = cellZ + d.dz;
      if (!this.inBounds(nx, nz)) continue;
      if (this.blocked[nz * this.width + nx] === 1) continue;
      // For diagonal movement, ensure both orthogonal neighbors are walkable
      // (prevents cutting corners through walls).
      if (d.dx !== 0 && d.dz !== 0) {
        if (this.blocked[cellZ * this.width + (cellX + d.dx)] === 1) continue;
        if (this.blocked[(cellZ + d.dz) * this.width + cellX] === 1) continue;
      }
      neighbors.push({ x: nx, z: nz, cost: d.cost });
    }
    return neighbors;
  }

  /** Count blocked cells (for debugging/metrics). */
  get blockedCount(): number {
    let count = 0;
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i] === 1) count++;
    }
    return count;
  }
}
