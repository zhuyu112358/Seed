// SoulClient: talks to the SoulArena backend (default http://localhost:3000).
// Field names follow the confirmed snake_case contract; see docs/SOUL_INTERFACE.md.

import type { SoulInfo } from '../types/index.js';
import { Logger } from '../reliability/Logger.js';

const log = Logger.for('soul-client');

export class SoulClient {
  constructor(private readonly baseUrl = process.env.SOUL_URL ?? 'http://localhost:3000') {}

  /** Fetch the soul roster. Returns [] on failure so callers can fall back to mocks. */
  async listSouls(): Promise<{ souls: SoulInfo[]; usedMock: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/souls`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { souls?: SoulInfo[] } | SoulInfo[];
      const souls = Array.isArray(body) ? body : body.souls ?? [];
      log.info({ count: souls.length }, 'fetched souls from SoulArena');
      return { souls, usedMock: false };
    } catch (err) {
      log.warn({ err: String(err) }, 'SoulArena unreachable, using built-in mock souls');
      return { souls: this.mockSouls(), usedMock: true };
    }
  }

  /** Fetch one soul's full detail (personality / emotion / valueSystem). */
  async getSoul(id: string): Promise<SoulInfo | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/souls/${id}`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      return (await res.json()) as SoulInfo;
    } catch (err) {
      log.warn({ err: String(err), id }, 'getSoul failed');
      return null;
    }
  }

  private mockSouls(): SoulInfo[] {
    return [
      {
        id: 'soul_mock_vex',
        name: 'Vex',
        element: 'wind',
        status: 'active',
        current_game_id: null,
        birth_time: Date.now(),
        total_existence_ms: 0,
        last_active_at: Date.now(),
        created_at: Date.now(),
        memoryStats: { episodic: 0, semantic: 0, core: 0, links: 0, reflections: 0, total: 0 },
      },
      {
        id: 'soul_mock_nova',
        name: 'Nova',
        element: 'fire',
        status: 'active',
        current_game_id: null,
        birth_time: Date.now(),
        total_existence_ms: 0,
        last_active_at: Date.now(),
        created_at: Date.now(),
        memoryStats: { episodic: 0, semantic: 0, core: 0, links: 0, reflections: 0, total: 0 },
      },
    ];
  }
}
