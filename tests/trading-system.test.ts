// Tests for TradingSystem (M7 phase 2).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { TradingSystem } from "../src/trade/TradingSystem.js";
import type { TradeItem } from "../src/trade/TradeTypes.js";

function makeWorld(): World {
  return new World({ name: "trade-test", tickRate: 60 });
}

const woodItems: TradeItem[] = [{ itemId: "wood", name: "Wood", quantity: 5 }];
const goldItems: TradeItem[] = [{ itemId: "gold", name: "Gold", quantity: 10 }];

describe("TradingSystem - Create Offer", () => {
  test("create valid offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    assert.ok(offer);
    assert.equal(offer?.offererId, "npc_1");
    assert.equal(offer?.responderId, "npc_2");
    assert.equal(offer?.status, "pending");
  });

  test("cannot create offer to self", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_1", woodItems, goldItems, world.events, world.tick);
    assert.equal(offer, null);
  });

  test("cannot create empty offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", [], [], world.events, world.tick);
    assert.equal(offer, null);
  });

  test("cannot create duplicate pending offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    const second = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    assert.equal(second, null);
  });

  test("create offer emits trade.offered event", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    let offered = false;
    world.events.on("trade.offered", () => { offered = true; });
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    assert.ok(offered);
  });
});

describe("TradingSystem - Accept Offer", () => {
  test("accept pending offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.acceptOffer(offer.id, "npc_2", world.events);
    assert.ok(result.success);
    assert.equal(system.getOffer(offer.id)?.status, "completed");
  });

  test("accept emits trade.accepted and trade.completed events", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    let accepted = false;
    let completed = false;
    world.events.on("trade.accepted", () => { accepted = true; });
    world.events.on("trade.completed", () => { completed = true; });
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.acceptOffer(offer.id, "npc_2", world.events);
    assert.ok(accepted);
    assert.ok(completed);
  });

  test("cannot accept non-pending offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.acceptOffer(offer.id, "npc_2", world.events);
    const result = system.acceptOffer(offer.id, "npc_2", world.events);
    assert.ok(!result.success);
  });

  test("cannot accept if not responder", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.acceptOffer(offer.id, "npc_3", world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "Not the responder");
  });

  test("accept with transfer validator fails if items missing", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    system.transferValidator = (entityId, items) => {
      // Responder doesn't have gold.
      if (entityId === "npc_2" && items[0].itemId === "gold") return false;
      return true;
    };
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.acceptOffer(offer.id, "npc_2", world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "Responder does not have requested items");
  });

  test("accept with transfer handler performs transfer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    let transfers: Array<{ from: string; to: string; items: TradeItem[] }> = [];
    system.transferHandler = (from, to, items) => {
      transfers.push({ from, to, items });
    };
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.acceptOffer(offer.id, "npc_2", world.events);
    assert.equal(transfers.length, 2);
    assert.equal(transfers[0].from, "npc_1"); // offerer gives wood
    assert.equal(transfers[1].from, "npc_2"); // responder gives gold
  });
});

describe("TradingSystem - Reject Offer", () => {
  test("reject pending offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.rejectOffer(offer.id, "npc_2", world.events, "not interested");
    assert.ok(result.success);
    assert.equal(system.getOffer(offer.id)?.status, "rejected");
  });

  test("reject emits trade.rejected event", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    let rejected = false;
    world.events.on("trade.rejected", () => { rejected = true; });
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.rejectOffer(offer.id, "npc_2", world.events);
    assert.ok(rejected);
  });

  test("cannot reject if not responder", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.rejectOffer(offer.id, "npc_1", world.events);
    assert.ok(!result.success);
  });
});

describe("TradingSystem - Cancel Offer", () => {
  test("cancel pending offer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.cancelOffer(offer.id, "npc_1", world.events);
    assert.ok(result.success);
    assert.equal(system.getOffer(offer.id)?.status, "cancelled");
  });

  test("cancel emits trade.cancelled event", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    let cancelled = false;
    world.events.on("trade.cancelled", () => { cancelled = true; });
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.cancelOffer(offer.id, "npc_1", world.events);
    assert.ok(cancelled);
  });

  test("cannot cancel if not offerer", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    const result = system.cancelOffer(offer.id, "npc_2", world.events);
    assert.ok(!result.success);
  });
});

describe("TradingSystem - Expiration", () => {
  test("offer expires after expiresTicks", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    world.addSystem(system);
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick, 10)!;
    assert.equal(offer.status, "pending");
    // Advance 11 ticks.
    for (let i = 0; i < 11; i++) world.step(1 / 60);
    assert.equal(system.getOffer(offer.id)?.status, "expired");
  });

  test("expired offer emits trade.expired event", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    world.addSystem(system);
    let expired = false;
    world.events.on("trade.expired", () => { expired = true; });
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick, 5);
    for (let i = 0; i < 6; i++) world.step(1 / 60);
    assert.ok(expired);
  });

  test("offer with expiresTick=0 never expires", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    world.addSystem(system);
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick, 0)!;
    for (let i = 0; i < 100; i++) world.step(1 / 60);
    assert.equal(system.getOffer(offer.id)?.status, "pending");
  });
});

describe("TradingSystem - Queries", () => {
  test("getPendingOffers returns pending offers", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    system.createOffer("npc_3", "npc_1", goldItems, woodItems, world.events, world.tick);
    const pending = system.getPendingOffers("npc_1");
    assert.equal(pending.length, 2);
  });

  test("getActiveOffers returns only pending", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.acceptOffer(offer.id, "npc_2", world.events);
    system.createOffer("npc_3", "npc_4", woodItems, goldItems, world.events, world.tick);
    assert.equal(system.getActiveOffers().length, 1);
  });

  test("getOffersByEntity returns all offers", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    system.createOffer("npc_2", "npc_3", goldItems, woodItems, world.events, world.tick);
    const offers = system.getOffersByEntity("npc_2");
    assert.equal(offers.length, 2);
  });
});

describe("TradingSystem - Cleanup and Serialization", () => {
  test("cleanupFinishedOffers removes non-pending", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    const offer = system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick)!;
    system.acceptOffer(offer.id, "npc_2", world.events);
    system.createOffer("npc_3", "npc_4", woodItems, goldItems, world.events, world.tick);
    const removed = system.cleanupFinishedOffers();
    assert.equal(removed, 1);
    assert.equal(system.offerCount, 1);
  });

  test("serialize and deserialize preserves offers", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    const data = system.serialize();

    const system2 = new TradingSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.offerCount, 1);
    assert.equal(system2.getActiveOffers()[0].offererId, "npc_1");
  });
});

describe("TradingSystem - WorldSystem", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const system = new TradingSystem();
    world.addSystem(system);
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    world.step(1 / 60);
    assert.equal(system.offerCount, 1);
  });

  test("stop clears all offers", () => {
    const system = new TradingSystem();
    const world = makeWorld();
    system.createOffer("npc_1", "npc_2", woodItems, goldItems, world.events, world.tick);
    system.stop();
    assert.equal(system.offerCount, 0);
  });
});
