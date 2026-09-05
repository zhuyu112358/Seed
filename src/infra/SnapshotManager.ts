import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ILogger } from '../types/index.js';

export interface SnapshotEntity {
  id: string; type: string; name: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  mass: number; material: string;
  state: Record<string, unknown>; properties: Record<string, unknown>; active: boolean;
}
export interface SnapshotInput {
  version: string; worldId: string; tickCount: number;
  entities: SnapshotEntity[]; events: Array<Record<string, unknown>>;
  weather: string; clock: { timeOfDay: number; day: number }; stats: Record<string, unknown>;
}
export interface StoredSnapshot extends SnapshotInput { id: string; timestamp: number; checksum: string; }
export interface SnapshotManagerConfig { directory: string; intervalMs: number; maxSnapshots: number; logger?: ILogger; }
export interface SnapshotListing { id: string; timestamp: number; tickCount: number; entityCount: number; filePath: string; }

class NullLogger implements ILogger {
  debug(): void {} info(): void {} warn(): void {} error(): void {} fatal(): void {}
  child(): ILogger { return this; }
}

export class SnapshotManager {
  private readonly directory: string;
  private readonly intervalMs: number;
  private readonly maxSnapshots: number;
  private readonly logger: ILogger;
  private autoTimer: NodeJS.Timeout | null = null;

  constructor(config: SnapshotManagerConfig) {
    this.directory = config.directory;
    this.intervalMs = Math.max(config.intervalMs, 0);
    this.maxSnapshots = Math.max(config.maxSnapshots, 1);
    this.logger = config.logger ?? new NullLogger();
    fs.mkdirSync(this.directory, { recursive: true });
  }

  private computeChecksum(payload: SnapshotInput & { id: string; timestamp: number }): string {
    return crypto.createHash('sha256').update(JSON.stringify(this.sortKeys(payload)), 'utf8').digest('hex');
  }
  private sortKeys<T>(value: T): T {
    if (Array.isArray(value)) return value.map((v) => this.sortKeys(v)) as unknown as T;
    if (value !== null && typeof value === 'object') {
      const src = value as Record<string, unknown>; const out: Record<string, unknown> = {};
      for (const k of Object.keys(src).sort()) out[k] = this.sortKeys(src[k]);
      return out as unknown as T;
    }
    return value;
  }

  takeSnapshot(worldState: SnapshotInput): StoredSnapshot {
    const id = crypto.randomUUID(); const timestamp = Date.now();
    const payload = { ...worldState, id, timestamp };
    const checksum = this.computeChecksum(payload);
    const snapshot: StoredSnapshot = { ...payload, checksum };
    fs.writeFileSync(this.filePathFor(timestamp, id), JSON.stringify(snapshot, null, 2), 'utf8');
    this.logger.debug('Snapshot written', { id });
    this.pruneOldSnapshots();
    return snapshot;
  }

  loadLatest(): StoredSnapshot | null {
    const l = this.listSnapshots(); if (l.length === 0) return null;
    return this.readSnapshot(l[0].filePath);
  }
  loadById(snapshotId: string): StoredSnapshot | null {
    const m = this.listSnapshots().find((e) => e.id === snapshotId);
    return m ? this.readSnapshot(m.filePath) : null;
  }
  listSnapshots(): SnapshotListing[] {
    let files: string[];
    try { files = fs.readdirSync(this.directory); } catch { return []; }
    const entries: SnapshotListing[] = [];
    for (const file of files) {
      if (!file.startsWith('snapshot-') || !file.endsWith('.json')) continue;
      const fp = path.join(this.directory, file);
      try {
        const d = JSON.parse(fs.readFileSync(fp, 'utf8')) as Partial<StoredSnapshot>;
        if (typeof d.id === 'string') entries.push({ id: d.id, timestamp: typeof d.timestamp === 'number' ? d.timestamp : 0, tickCount: typeof d.tickCount === 'number' ? d.tickCount : 0, entityCount: Array.isArray(d.entities) ? d.entities.length : 0, filePath: fp });
      } catch (err) { this.logger.warn('Unreadable snapshot', { file, error: err instanceof Error ? err.message : String(err) }); }
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries;
  }
  deleteSnapshot(snapshotId: string): boolean {
    const m = this.listSnapshots().find((e) => e.id === snapshotId); if (!m) return false;
    try { fs.unlinkSync(m.filePath); return true; } catch { return false; }
  }
  startAutoSnapshot(getState: () => SnapshotInput): void {
    this.stopAutoSnapshot(); if (this.intervalMs <= 0) return;
    this.autoTimer = setInterval(() => { try { this.takeSnapshot(getState()); } catch { /* noop */ } }, this.intervalMs);
    if (this.autoTimer && typeof this.autoTimer.unref === 'function') this.autoTimer.unref();
  }
  stopAutoSnapshot(): void { if (this.autoTimer !== null) { clearInterval(this.autoTimer); this.autoTimer = null; } }
  recoverOnStartup(): StoredSnapshot | null {
    for (const e of this.listSnapshots()) { const s = this.readSnapshot(e.filePath); if (s) return s; }
    return null;
  }
  private readSnapshot(fp: string): StoredSnapshot | null {
    try {
      const s = JSON.parse(fs.readFileSync(fp, 'utf8')) as StoredSnapshot;
      return this.verifyChecksum(s) ? s : null;
    } catch { return null; }
  }
  private verifyChecksum(s: StoredSnapshot): boolean {
    const { checksum, ...payload } = s;
    const exp = Buffer.from(this.computeChecksum(payload), 'hex');
    const act = Buffer.from(checksum, 'hex');
    return exp.length === act.length && crypto.timingSafeEqual(exp, act);
  }
  private filePathFor(ts: number, id: string): string { return path.join(this.directory, `snapshot-${ts}-${id}.json`); }
  private pruneOldSnapshots(): void {
    for (const e of this.listSnapshots().slice(this.maxSnapshots)) {
      try { fs.unlinkSync(e.filePath); } catch { /* best effort */ }
    }
  }
}
