import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoulBridge } from '../../src/bridge/SoulBridge.js';
import type { SoulInfo } from '../../src/types/index.js';

const souls: SoulInfo[] = [
  {
    id: 'soul_1',
    name: 'TestSoul',
    element: 'wind',
    status: 'active',
    current_game_id: null,
    birth_time: 0,
    total_existence_ms: 0,
    last_active_at: 0,
    created_at: 0,
    memoryStats: { episodic: 0, semantic: 0, core: 0, links: 0, reflections: 0, total: 0 },
  },
];

function installFetchMock(): { restore: () => void } {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    const body: unknown = url.includes('/api/souls') && !url.endsWith('/action')
      ? souls
      : { ok: true };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

test('connect reports true when soul system responds', async () => {
  const mock = installFetchMock();
  try {
    const bridge = new SoulBridge({ soulSystemUrl: 'http://localhost:3000', worldId: 'w' });
    const ok = await bridge.connect();
    assert.equal(ok, true);
    assert.equal(bridge.isConnected, true);
  } finally { mock.restore(); }
});

test('getSoulList maps the roster', async () => {
  const mock = installFetchMock();
  try {
    const bridge = new SoulBridge({ soulSystemUrl: 'http://localhost:3000', worldId: 'w' });
    await bridge.connect();
    const list = await bridge.getSoulList();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'TestSoul');
  } finally { mock.restore(); }
});

test('joinWorld registers the soul; leaveWorld removes it', async () => {
  const mock = installFetchMock();
  try {
    const bridge = new SoulBridge({ soulSystemUrl: 'http://localhost:3000', worldId: 'w' });
    await bridge.connect();
    const join = await bridge.joinWorld('soul_1', { x: 0, y: 1, z: 0 });
    assert.equal(join.success, true);
    assert.deepEqual(bridge.getConnectedSouls(), ['soul_1']);
    await bridge.leaveWorld('soul_1');
    assert.deepEqual(bridge.getConnectedSouls(), []);
  } finally { mock.restore(); }
});

test('executeAction returns a result without a world attached', async () => {
  const mock = installFetchMock();
  try {
    const bridge = new SoulBridge({ soulSystemUrl: 'http://localhost:3000', worldId: 'w' });
    await bridge.connect();
    const result = await bridge.executeAction({
      soulId: 'soul_1', action: 'wait', parameters: {}, timestamp: Date.now(),
    });
    assert.equal(result.soulId, 'soul_1');
    assert.equal(result.success, true);
  } finally { mock.restore(); }
});

test('applyWorldEffect posts and emits', async () => {
  const mock = installFetchMock();
  try {
    const bridge = new SoulBridge({ soulSystemUrl: 'http://localhost:3000', worldId: 'w' });
    await bridge.connect();
    let emitted = false;
    bridge.on('effectApplied', () => { emitted = true; });
    const ok = await bridge.applyWorldEffect({
      soulId: 'soul_1', source: 'wind', effectType: 'emotion',
      magnitude: 0.3, description: 'gust', timestamp: Date.now(),
    });
    assert.equal(ok, true);
    assert.equal(emitted, true);
  } finally { mock.restore(); }
});

test('connection failure degrades gracefully', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch;
  try {
    const bridge = new SoulBridge({ soulSystemUrl: 'http://localhost:3000', worldId: 'w' });
    const ok = await bridge.connect();
    assert.equal(ok, false);
    assert.equal(bridge.isConnected, false);
    assert.ok(bridge.nextBackoffMs >= 500);
  } finally { globalThis.fetch = original; }
});
