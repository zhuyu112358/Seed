// WorldSaveManager: manages world save files (save/load/list/delete).
// Uses WorldSerializer for serialization, adds file I/O and save metadata.
//
// No hardcoded paths — save directory is configurable.
// No hardcoded world content — works with any world configuration.

import * as fs from "node:fs";
import * as path from "node:path";
import type { World } from "../engine/World.js";
import type { Entity } from "../entity/Entity.js";
import { WorldSerializer } from "./WorldSerializer.js";
import type { SerializedEntity, SerializedWorld } from "./WorldSerializer.js";

/** Metadata for a saved game. */
export interface SaveMetadata {
  /** Save slot name (filename without extension). */
  name: string;
  /** Full file path. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** Last modified timestamp (ms since epoch). */
  modifiedAt: number;
  /** World name from the save. */
  worldName: string;
  /** World tick count at save time. */
  tick: number;
  /** Serialization format version. */
  version: number;
}

/** Configuration for WorldSaveManager. */
export interface SaveManagerConfig {
  /** Directory where save files are stored. Default: "./saves". */
  saveDirectory?: string;
  /** File extension for save files. Default: ".seed.json". */
  fileExtension?: string;
  /** WorldSerializer instance. If not provided, a new one is created. */
  serializer?: WorldSerializer;
}

/**
 * WorldSaveManager: manages world save files.
 *
 * Provides save/load/list/delete operations for world state persistence.
 * Save files are JSON with configurable extension. Metadata is extracted
 * from the serialized world data and file system info.
 */
export class WorldSaveManager {
  readonly saveDirectory: string;
  readonly fileExtension: string;
  readonly serializer: WorldSerializer;

  constructor(config: SaveManagerConfig = {}) {
    this.saveDirectory = config.saveDirectory ?? "./saves";
    this.fileExtension = config.fileExtension ?? ".seed.json";
    this.serializer = config.serializer ?? new WorldSerializer();
  }

  /**
   * Save a world to a named slot.
   * @param world The world to save.
   * @param name Save slot name (filename without extension).
   * @param metadata Optional additional metadata to store in the save.
   */
  save(world: World, name: string, metadata: Record<string, unknown> = {}): void {
    this.ensureDirectory();
    const data = this.serializer.serialize(world);
    // Merge user metadata into the save's metadata field.
    data.metadata = { ...data.metadata, ...metadata, savedAt: Date.now() };
    const filePath = this.savePath(name);
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, json, "utf-8");
  }

  /**
   * Load a world from a named slot into an existing world.
   * @param name Save slot name.
   * @param world The world to load into (systems must already be added).
   * @param entityFactory Factory function to create entities from serialized data.
   */
  load(name: string, world: World, entityFactory: (e: SerializedEntity) => Entity): void {
    const filePath = this.savePath(name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Save not found: ${name} (${filePath})`);
    }
    const json = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(json) as SerializedWorld;
    if (data.version !== WorldSerializer.VERSION) {
      throw new Error(`Unsupported save version: ${data.version}, expected ${WorldSerializer.VERSION}`);
    }
    this.serializer.deserialize(data, world, entityFactory);
  }

  /** Check if a save slot exists. */
  exists(name: string): boolean {
    return fs.existsSync(this.savePath(name));
  }

  /** Delete a save slot. Returns true if deleted, false if not found. */
  delete(name: string): boolean {
    const filePath = this.savePath(name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * List all available saves with metadata.
   * Sorted by modification time (newest first).
   */
  list(): SaveMetadata[] {
    if (!fs.existsSync(this.saveDirectory)) {
      return [];
    }
    const files = fs.readdirSync(this.saveDirectory)
      .filter((f) => f.endsWith(this.fileExtension));

    const saves: SaveMetadata[] = [];
    for (const file of files) {
      const filePath = path.join(this.saveDirectory, file);
      try {
        const stat = fs.statSync(filePath);
        const json = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(json) as SerializedWorld;
        const name = file.slice(0, -this.fileExtension.length);
        saves.push({
          name,
          path: filePath,
          size: stat.size,
          modifiedAt: stat.mtimeMs,
          worldName: data.name,
          tick: data.tick,
          version: data.version,
        });
      } catch {
        // Skip corrupted or unreadable save files.
      }
    }
    // Sort by modified time, newest first.
    return saves.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  /** Get metadata for a specific save slot. */
  getMetadata(name: string): SaveMetadata | undefined {
    return this.list().find((s) => s.name === name);
  }

  /** Get the full file path for a save slot. */
  savePath(name: string): string {
    return path.join(this.saveDirectory, `${name}${this.fileExtension}`);
  }

  /** Ensure the save directory exists. */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.saveDirectory)) {
      fs.mkdirSync(this.saveDirectory, { recursive: true });
    }
  }
}
