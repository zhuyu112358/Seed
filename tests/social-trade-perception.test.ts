// Tests for social + trade event perception integration (M7 phase 3).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { SocialGraph } from "../src/social/SocialGraph.js";
import { TradingSystem } from "../src/trade/TradingSystem.js";
import type { TradeItem } from "../src/trade/TradeTypes.js";

function makeWorld(): World {
  return new World({ name: "social-trade-perception-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

function findEvent(perception: SoulPerceptionSystem, soulId: string, eventType: string) {
  const frame = perception.getPerception(soulId);
  if (!frame || !frame.events) return null;
  return frame.events.find((e: any) => e.type === eventType) ?? null;
}

const woodItems: TradeItem[] = [{ itemId: "wood", quantity: 5 }];
const goldItems: TradeItem[] = [{ itemId: "gold", quantity: 10 }];

describe("Social Perception - Relation Changed", () => {
  test("social.relation_changed appears in perception frame", () => {
    const world = makeWorld();
    const social = new SocialGraph();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(social);
    // First tick sets up lazy listeners.
    world.step(1 / 60);
    social.setRelation("npc_1", "npc_2", "friend", world.events);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "social.relation_changed");
    assert.ok(event, "social.relation_changed event should be in perception frame");
  });

  test("social.relation_changed event contains entity names", () => {
    const world = makeWorld();
    const social = new SocialGraph();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(social);
    world.step(1 / 60);
    social.setRelation("npc_a", "npc_b", "enemy", world.events);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "social.relation_changed");
    assert.ok(event?.name.includes("npc_a"));
    assert.ok(event?.name.includes("npc_b"));
  });
});

describe("Social Perception - Trust Changed", () => {
  test("social.trust_changed appears in perception frame", () => {
    const world = makeWorld();
    const social = new SocialGraph();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(social);
    world.step(1 / 60);
    social.setRelation("npc_1", "npc_2", "neutral", world.events);
    social.modifyTrust("npc_1", "npc_2", 20, world.events);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "social.trust_changed");
    assert.ok(event, "social.trust_changed event should be in perception frame");
  });
});

describe("Social Perception - Interaction", () => {
  test("social.interaction appears in perception frame", () => {
    const world = makeWorld();
    const social = new SocialGraph();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(social);
    world.step(1 / 60);
    social.recordInteraction("npc_1", "npc_2", "gift", 10, 5, world.events, world.tick);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "social.interaction");
    assert.ok(event, "social.interaction event should be in perception frame");
    assert.ok(event?.name.includes("gift"));
  });
});

describe("Trade Perception - Offered", () => {
  test("trade.offered appears in perception frame", () => {
    const world = makeWorld();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(trading);
    world.step(1 / 60);
    trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "trade.offered");
    assert.ok(event, "trade.offered event should be in perception frame");
  });
});

describe("Trade Perception - Accepted", () => {
  test("trade.accepted appears in perception frame", () => {
    const world = makeWorld();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(trading);
    world.step(1 / 60);
    const offer = trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    trading.acceptOffer(offer.id, "npc_2", world.events);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "trade.accepted");
    assert.ok(event, "trade.accepted event should be in perception frame");
    assert.equal(event?.severity, "medium");
  });
});

describe("Trade Perception - Completed", () => {
  test("trade.completed appears in perception frame with medium severity", () => {
    const world = makeWorld();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(trading);
    world.step(1 / 60);
    const offer = trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    trading.acceptOffer(offer.id, "npc_2", world.events);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "trade.completed");
    assert.ok(event, "trade.completed event should be in perception frame");
    assert.equal(event?.severity, "medium");
  });
});

describe("Trade Perception - Rejected", () => {
  test("trade.rejected appears in perception frame", () => {
    const world = makeWorld();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(trading);
    world.step(1 / 60);
    const offer = trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    trading.rejectOffer(offer.id, "npc_2", world.events, "not interested");
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "trade.rejected");
    assert.ok(event, "trade.rejected event should be in perception frame");
  });
});

describe("Trade Perception - Cancelled", () => {
  test("trade.cancelled appears in perception frame", () => {
    const world = makeWorld();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(trading);
    world.step(1 / 60);
    const offer = trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    trading.cancelOffer(offer.id, "npc_1", world.events);
    world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "trade.cancelled");
    assert.ok(event, "trade.cancelled event should be in perception frame");
  });
});

describe("Trade Perception - Expired", () => {
  test("trade.expired appears in perception frame", () => {
    const world = makeWorld();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(trading);
    world.step(1 / 60);
    trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick, 5);
    // Advance past expiration.
    for (let i = 0; i < 6; i++) world.step(1 / 60);
    const event = findEvent(perception, "soul_1", "trade.expired");
    assert.ok(event, "trade.expired event should be in perception frame");
  });
});

describe("Social + Trade Perception - Multiple Events", () => {
  test("both social and trade events coexist in perception frame", () => {
    const world = makeWorld();
    const social = new SocialGraph();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(social);
    world.addSystem(trading);
    world.step(1 / 60);
    // Social interaction.
    social.recordInteraction("npc_1", "npc_2", "talk", 5, 5, world.events, world.tick);
    // Trade offer.
    trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    world.step(1 / 60);
    const socialEvent = findEvent(perception, "soul_1", "social.interaction");
    const tradeEvent = findEvent(perception, "soul_1", "trade.offered");
    assert.ok(socialEvent, "social.interaction should be present");
    assert.ok(tradeEvent, "trade.offered should be present");
  });
});

describe("Social + Trade Perception - Stop Cleanup", () => {
  test("stop() unsubscribes all social and trade listeners", () => {
    const world = makeWorld();
    const social = new SocialGraph();
    const trading = new TradingSystem();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(social);
    world.addSystem(trading);
    world.step(1 / 60);
    perception.stop();
    // After stop, events should not be recorded.
    social.setRelation("npc_1", "npc_2", "friend", world.events);
    trading.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    world.step(1 / 60);
    const socialEvent = findEvent(perception, "soul_1", "social.relation_changed");
    const tradeEvent = findEvent(perception, "soul_1", "trade.offered");
    assert.ok(!socialEvent, "social event should not be recorded after stop");
    assert.ok(!tradeEvent, "trade event should not be recorded after stop");
  });
});
