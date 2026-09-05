import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SoulBridgeAdapter } from "../src/bridge/SoulBridgeAdapter.js";
import type { PerceptionFrame, ActionRequest } from "../src/types/index.js";
import type { World } from "../src/engine/World.js";

function makePerceptionFrame(soulId = "soul_test"): PerceptionFrame {
  return {
    soulId,
    timestamp: Date.now(),
    worldTime: 100,
    position: { x: 5, y: 0, z: 10 },
    visibleEntities: [
      { id: "box1", name: "Wooden Box", type: "dynamic", position: { x: 6, y: 0, z: 10 }, distance: 1, visible: true },
    ],
    nearbySouls: [
      { id: "soul_nova", name: "Nova", element: "fire", position: { x: 8, y: 0, z: 10 }, distance: 3 },
    ],
    environment: {
      temperature: 22.5,
      pressure: 1013,
      humidity: 45,
      windSpeed: 3.2,
      windDirection: { x: 1, y: 0, z: 0 },
      lightLevel: 0.8,
      weather: "clear" as never,
      timeOfDay: 0.5,
    },
    events: [
      { id: "evt1", type: "weather", name: "Wind Gust", severity: "medium", distance: 10, affectsSoul: true },
    ],
    communications: [
      { id: "msg1", senderId: "soul_nova", senderType: "soul", medium: "acoustic" as never, content: "Hello there!", metadata: {}, position: { x: 8, y: 0, z: 10 }, timestamp: Date.now(), priority: 0, ttl: 30000 },
    ],
  };
}

function makeMockWorld(): World {
  return {
    tick: 0,
    worldTime: 100,
    entities: new Map(),
    systems: [],
    events: { emit: () => {} } as never,
    step: () => {},
    addEntity: () => {},
    getEntity: () => null,
    bodies: () => [],
    addSystem: () => {},
  } as unknown as World;
}

describe("SoulBridgeAdapter", () => {
  it("initializes with default config", () => {
    const bridge = new SoulBridgeAdapter();
    assert.equal(bridge.name, "soul-bridge");
    assert.equal(bridge.enabled, true);
    const stats = bridge.getStats();
    assert.equal(stats.perceptionsSent, 0);
    assert.equal(stats.actionsReceived, 0);
    assert.equal(stats.connectedSouls, 0);
  });

  it("accepts custom config", () => {
    const bridge = new SoulBridgeAdapter({
      soulArenaUrl: "http://test:3001",
      perceiveIntervalTicks: 5,
      enableSituationMode: false,
    });
    assert.ok(bridge);
  });

  it("converts speak action to communicate", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "speak", content: "Hello world" });
    const world = makeMockWorld();
    let capturedRequest: ActionRequest | null = null;
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => {
        capturedRequest = req;
        return { soulId: req.soulId, action: req.action, success: true, message: "ok", timestamp: Date.now() };
      },
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.ok(capturedRequest);
    assert.equal(capturedRequest!.action, "communicate");
    assert.equal((capturedRequest!.parameters as { content: string }).content, "Hello world");
    assert.equal((capturedRequest!.parameters as { medium: string }).medium, "acoustic");
  });

  it("converts expression action to custom", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "expression", expression: "happy", intensity: 0.8 });
    const world = makeMockWorld();
    let capturedRequest: ActionRequest | null = null;
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => {
        capturedRequest = req;
        return { soulId: req.soulId, action: req.action, success: true, message: "ok", timestamp: Date.now() };
      },
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.ok(capturedRequest);
    assert.equal(capturedRequest!.action, "custom");
    assert.equal((capturedRequest!.parameters as { expression: string }).expression, "happy");
  });

  it("converts move action", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "move", parameters: { x: 10, y: 0, z: 20 } });
    const world = makeMockWorld();
    let capturedRequest: ActionRequest | null = null;
    const mockActionSystem = { executeAction: (req: ActionRequest) => { capturedRequest = req; return { soulId: req.soulId, action: req.action, success: true, message: "ok", timestamp: Date.now() }; } };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.equal(capturedRequest!.action, "move");
    assert.deepEqual(capturedRequest!.parameters, { x: 10, y: 0, z: 20 });
  });

  it("converts attack action with targetId", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "attack", targetId: "enemy1", parameters: { force: 5 } });
    const world = makeMockWorld();
    let capturedRequest: ActionRequest | null = null;
    const mockActionSystem = { executeAction: (req: ActionRequest) => { capturedRequest = req; return { soulId: req.soulId, action: req.action, success: true, message: "ok", timestamp: Date.now() }; } };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.equal(capturedRequest!.action, "attack");
    assert.equal(capturedRequest!.targetId, "enemy1");
  });

  it("converts wait action", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "wait" });
    const world = makeMockWorld();
    let capturedRequest: ActionRequest | null = null;
    const mockActionSystem = { executeAction: (req: ActionRequest) => { capturedRequest = req; return { soulId: req.soulId, action: req.action, success: true, message: "ok", timestamp: Date.now() }; } };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.equal(capturedRequest!.action, "wait");
  });

  it("converts unknown action type to custom with originalType preserved", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "dance", parameters: { style: "tango" } });
    const world = makeMockWorld();
    let capturedRequest: ActionRequest | null = null;
    const mockActionSystem = { executeAction: (req: ActionRequest) => { capturedRequest = req; return { soulId: req.soulId, action: req.action, success: true, message: "ok", timestamp: Date.now() }; } };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.equal(capturedRequest!.action, "custom");
    assert.equal((capturedRequest!.parameters as { originalType: string }).originalType, "dance");
  });

  it("tracks action execution stats", () => {
    const bridge = new SoulBridgeAdapter();
    const world = makeMockWorld();
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => ({
        soulId: req.soulId, action: req.action,
        success: req.action !== "attack", // attack fails
        message: "ok", timestamp: Date.now(),
      }),
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.ingestAction("soul1", { type: "speak", content: "hi" });
    bridge.ingestAction("soul1", { type: "attack", targetId: "x" });
    bridge.tick(1 / 60, world, null as never);
    const stats = bridge.getStats();
    assert.equal(stats.actionsReceived, 2);
    assert.equal(stats.actionsExecuted, 1);
    assert.equal(stats.actionsFailed, 1);
  });

  it("drops oldest actions when queue exceeds max per soul", () => {
    const bridge = new SoulBridgeAdapter({ maxQueuedActionsPerSoul: 3 });
    for (let i = 0; i < 5; i++) {
      bridge.ingestAction("soul_test", { type: "speak", content: `msg${i}` });
    }
    const stats = bridge.getStats();
    assert.equal(stats.actionsReceived, 5);
    assert.equal(stats.actionsDropped, 2);
  });

  it("generates situation text from perception frame", () => {
    const bridge = new SoulBridgeAdapter();
    const frame = makePerceptionFrame();
    // Access private method via type assertion for testing.
    const generate = (bridge as unknown as { generateSituationText: (f: PerceptionFrame) => string }).generateSituationText;
    const text = generate.call(bridge, frame);
    assert.ok(text.includes("You are at"));
    assert.ok(text.includes("Weather:"));
    assert.ok(text.includes("Wooden Box"));
    assert.ok(text.includes("Nova"));
    assert.ok(text.includes("Hello there!"));
    assert.ok(text.includes("Wind Gust"));
  });

  it("builds situation payload with tick and situation fields", () => {
    const bridge = new SoulBridgeAdapter();
    const frame = makePerceptionFrame();
    const build = (bridge as unknown as { buildSituationPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildSituationPayload;
    const payload = build.call(bridge, "test-soul", frame);
    assert.equal(payload.tick, 100);
    assert.ok(typeof payload.situation === "string");
    assert.ok((payload.situation as string).length > 0);
  });

  it("builds structured payload with visual/auditory/proprioception", () => {
    const bridge = new SoulBridgeAdapter({ enableSituationMode: false });
    const frame = makePerceptionFrame();
    const build = (bridge as unknown as { buildStructuredPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildStructuredPayload;
    const payload = build.call(bridge, "test-soul", frame);
    assert.ok(payload.perception);
    const perception = payload.perception as Record<string, unknown>;
    assert.ok(perception.visual);
    assert.ok(perception.auditory);
    assert.ok(perception.proprioception);
    const visual = perception.visual as Record<string, unknown>;
    assert.ok(Array.isArray(visual.objects));
    assert.ok((visual.objects as unknown[]).length >= 1);
  });

  it("clearQueue removes all pending actions", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul1", { type: "wait" });
    bridge.ingestAction("soul2", { type: "wait" });
    bridge.clearQueue();
    const world = makeMockWorld();
    let executed = 0;
    const mockActionSystem = { executeAction: () => { executed++; return { soulId: "", action: "", success: true, message: "", timestamp: 0 }; } };
    bridge.bindSystems(null, mockActionSystem);
    bridge.tick(1 / 60, world, null as never);
    assert.equal(executed, 0);
  });

  it("lazy-binds to perception and action systems from world by name", () => {
    const bridge = new SoulBridgeAdapter();
    const mockPerception = { name: "soul-perception", getAllPerceptions: () => new Map() };
    const mockAction = { name: "soul-action", executeAction: () => ({ soulId: "", action: "", success: true, message: "", timestamp: 0 }) };
    const world = makeMockWorld();
    world.systems = [mockPerception as never, mockAction as never];
    bridge.tick(1 / 60, world, null as never);
    // Should not throw; systems bound lazily.
    assert.ok(true);
  });

  it("does not process actions when actionSystem is not bound", () => {
    const bridge = new SoulBridgeAdapter();
    bridge.ingestAction("soul_test", { type: "wait" });
    const world = makeMockWorld();
    // No action system bound — should not throw.
    bridge.tick(1 / 60, world, null as never);
    const stats = bridge.getStats();
    assert.equal(stats.actionsExecuted, 0);
  });

  // --- Action result feedback tests ---

  it("stores last action result and includes it in situation payload", () => {
    const bridge = new SoulBridgeAdapter();
    const world = makeMockWorld();
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => ({
        soulId: req.soulId, action: req.action,
        success: true, message: "moved to (3.0, 0.0, 0.0)",
        data: { position: { x: 3, y: 0, z: 0 } },
        timestamp: Date.now(),
      }),
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.ingestAction("soul_test", { type: "move", parameters: { x: 3, y: 0, z: 0 } });
    bridge.tick(1 / 60, world, null as never);

    // Build situation payload and verify lastActionResult is included.
    const frame = makePerceptionFrame("soul_test");
    const build = (bridge as unknown as { buildSituationPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildSituationPayload;
    const payload = build.call(bridge, "soul_test", frame);

    const ws = payload.worldState as Record<string, unknown>;
    assert.ok(ws.lastActionResult, "lastActionResult should be in worldState");
    const lar = ws.lastActionResult as Record<string, unknown>;
    assert.equal(lar.action, "move");
    assert.equal(lar.success, true);
    assert.ok(String(lar.message).includes("moved to"));

    // Situation text should mention the last action result.
    assert.ok((payload.situation as string).includes('Your last action "move" succeeded'));
  });

  it("includes failed action result in situation text with 'failed' status", () => {
    const bridge = new SoulBridgeAdapter();
    const world = makeMockWorld();
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => ({
        soulId: req.soulId, action: req.action,
        success: false, message: "target out of range",
        timestamp: Date.now(),
      }),
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.ingestAction("soul_test", { type: "interact", targetId: "far_object" });
    bridge.tick(1 / 60, world, null as never);

    const frame = makePerceptionFrame("soul_test");
    const build = (bridge as unknown as { buildSituationPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildSituationPayload;
    const payload = build.call(bridge, "soul_test", frame);

    assert.ok((payload.situation as string).includes('Your last action "interact" failed'));
    assert.ok((payload.situation as string).includes("target out of range"));
  });

  it("includes last action result in structured payload worldState", () => {
    const bridge = new SoulBridgeAdapter({ enableSituationMode: false });
    const world = makeMockWorld();
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => ({
        soulId: req.soulId, action: req.action,
        success: true, message: "spoke loudly", timestamp: Date.now(),
      }),
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.ingestAction("soul_test", { type: "speak", content: "hello" });
    bridge.tick(1 / 60, world, null as never);

    const frame = makePerceptionFrame("soul_test");
    const build = (bridge as unknown as { buildStructuredPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildStructuredPayload;
    const payload = build.call(bridge, "soul_test", frame);

    const ws = payload.worldState as Record<string, unknown>;
    assert.ok(ws.lastActionResult);
    const lar = ws.lastActionResult as Record<string, unknown>;
    assert.equal(lar.action, "communicate");
    assert.equal(lar.success, true);
  });

  it("does not include action result when enableActionFeedback is false", () => {
    const bridge = new SoulBridgeAdapter({ enableActionFeedback: false });
    const world = makeMockWorld();
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => ({
        soulId: req.soulId, action: req.action,
        success: true, message: "ok", timestamp: Date.now(),
      }),
    };
    bridge.bindSystems(null, mockActionSystem);
    bridge.ingestAction("soul_test", { type: "wait" });
    bridge.tick(1 / 60, world, null as never);

    const frame = makePerceptionFrame("soul_test");
    const build = (bridge as unknown as { buildSituationPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildSituationPayload;
    const payload = build.call(bridge, "soul_test", frame);

    const ws = payload.worldState as Record<string, unknown>;
    assert.equal(ws.lastActionResult, undefined);
    assert.ok(!(payload.situation as string).includes("Your last action"));
  });

  it("does not include action result for a different soul", () => {
    const bridge = new SoulBridgeAdapter();
    const world = makeMockWorld();
    const mockActionSystem = {
      executeAction: (req: ActionRequest) => ({
        soulId: req.soulId, action: req.action,
        success: true, message: "ok", timestamp: Date.now(),
      }),
    };
    bridge.bindSystems(null, mockActionSystem);
    // Action for soul_a only.
    bridge.ingestAction("soul_a", { type: "move", parameters: { x: 1, y: 0, z: 0 } });
    bridge.tick(1 / 60, world, null as never);

    // Build payload for soul_b — should NOT have lastActionResult.
    const frame = makePerceptionFrame("soul_b");
    const build = (bridge as unknown as { buildSituationPayload: (s: string, f: PerceptionFrame) => Record<string, unknown> }).buildSituationPayload;
    const payload = build.call(bridge, "soul_b", frame);

    const ws = payload.worldState as Record<string, unknown>;
    assert.equal(ws.lastActionResult, undefined);
  });
});
