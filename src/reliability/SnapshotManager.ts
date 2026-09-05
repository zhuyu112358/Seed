// SnapshotManager: serialises the world to JSON files under snapshots/, keeps at
// most N snapshots on disk, and can restore the world from a snapshot.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Entity } from '../entity/Entity.js';
import type { WorldSnapshot } from '../types/index.js';
import { Logger } from './Logger.js';

const log = Logger.for('snapshot');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = path.resolve(process.cwd(), 'snapshots');

export class SnapshotManager {
  private readonly dir: string;
  private readonly keep: number;

  constructor(opts: { dir?: string; keep?: number } = {}) {
    this.dir = opts.dir ?? SNAP_DIR;
    this.keep = opts.keep ?? 20;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /** Serialise every entity in the world to a snapshot file and prune old ones. */
  save(opts: {
    worldName: string;
    worldTime: number;
    tick: number;
    entities: Entity[];
    version?: string;
  }): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshot: WorldSnapshot = {
      schema: 'seed/world-snapshot@1',
      version: opts.version ?? '0.1.0',
      worldTime: opts.worldTime,
      tick: opts.tick,
      savedAt: new Date().toISOString(),
      entities: opts.entities.map((e) => e.toJSON()),
    };
    const file = path.join(this.dir, `${opts.worldName}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8');
    log.info({ file }, 'snapshot saved');
    this.prune();
    return file;
  }

  /** Load a snapshot by file name. */
  load(file: string): WorldSnapshot {
    const abs = path.isAbsolute(file) ? file : path.join(this.dir, file);
    const raw = fs.readFileSync(abs, 'utf8');
    return JSON.parse(raw) as WorldSnapshot;
  }

  /** List snapshot files, newest first. */
  list(): string[] {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
  }

  /** Rollback helper: load the most recent snapshot. */
  rollback(): WorldSnapshot | null {
    const files = this.list();
    if (files.length === 0) return null;
    return this.load(files[0]);
  }

  /** Keep only the newest `keep` snapshots. */
  private prune(): void {
    const files = this.list();
    if (files.length <= this.keep) return;
    for (const stale of files.slice(this.keep)) {
      fs.rmSync(path.join(this.dir, stale), { force: true });
    }
  }
}

