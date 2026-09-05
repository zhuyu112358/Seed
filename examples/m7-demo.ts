/**
 * M7 End-to-End Demo: Social + Trade + Party + Perception
 *
 * Demonstrates the full M7 multiplayer interaction pipeline:
 * 1. Social graph: NPCs form relationships, interact, trust changes
 * 2. Trading: NPCs create trade offers, accept, complete trades
 * 3. Party: NPCs form a party, join, leave, transfer leadership
 * 4. Perception: SoulPerceptionSystem captures all social/trade/party events
 *
 * Architecture: Seed provides execution frameworks + event emission.
 * All decisions (who to befriend, what to trade, party formation) are
 * simulated here as application-layer logic.
 */

import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { SocialGraph } from "../src/social/SocialGraph.js";
import { TradingSystem } from "../src/trade/TradingSystem.js";
import type { TradeItem } from "../src/trade/TradeTypes.js";
import { PartySystem } from "../src/party/PartySystem.js";

// --- Setup ---
const world = new World({ name: "M7 Multiplayer Demo", tickRate: 60 });

// Create NPCs
const alice = new GameObject({ id: "alice", type: "npc", name: "Alice", position: { x: 0, y: 0, z: 0 } });
const bob = new GameObject({ id: "bob", type: "npc", name: "Bob", position: { x: 2, y: 0, z: 0 } });
const charlie = new GameObject({ id: "charlie", type: "npc", name: "Charlie", position: { x: -2, y: 0, z: 0 } });
const observer = new GameObject({ id: "observer", type: "soul", name: "Observer", position: { x: 0, y: 0, z: 5 } });

world.addEntity(alice);
world.addEntity(bob);
world.addEntity(charlie);
world.addEntity(observer);

// Add systems
const social = new SocialGraph();
const trading = new TradingSystem();
const parties = new PartySystem();
const perception = new SoulPerceptionSystem();

world.addSystem(social);
world.addSystem(trading);
world.addSystem(parties);
world.addSystem(perception);

// Setup inventory simulation for trades
const inventories: Record<string, Record<string, number>> = {
  alice: { wood: 10, gold: 5 },
  bob: { wood: 0, gold: 20 },
  charlie: { wood: 5, gold: 10 },
};

trading.transferValidator = (entityId, items) => {
  const inv = inventories[entityId] ?? {};
  return items.every((item) => (inv[item.itemId] ?? 0) >= item.quantity);
};

trading.transferHandler = (fromId, toId, items) => {
  for (const item of items) {
    inventories[fromId][item.itemId] -= item.quantity;
    if (!inventories[toId][item.itemId]) inventories[toId][item.itemId] = 0;
    inventories[toId][item.itemId] += item.quantity;
  }
};

console.log("=== M7 Multiplayer Interaction Demo ===\n");

// --- Phase 1: Social Interactions ---
console.log("--- Phase 1: Social Graph ---");

// Alice and Bob meet and become friends
world.step(1 / 60);
social.recordInteraction("alice", "bob", "greeting", 5, 10, world.events, world.tick);
console.log(`[Tick ${world.tick}] Alice and Bob greet each other (trust +5, familiarity +10)`);

// Multiple interactions build trust
for (let i = 0; i < 3; i++) {
  social.recordInteraction("alice", "bob", "conversation", 3, 5, world.events, world.tick);
  world.step(1 / 60);
}
console.log(`[Tick ${world.tick}] Alice and Bob have 3 conversations (trust +9, familiarity +15)`);

// They become friends
social.setRelation("alice", "bob", "friend", world.events, social.getTrust("alice", "bob"), social.getRelation("alice", "bob")?.familiarity ?? 0);
console.log(`[Tick ${world.tick}] Alice and Bob become friends (trust: ${social.getTrust("alice", "bob")})`);

// Charlie meets Alice (neutral initially)
social.recordInteraction("alice", "charlie", "greeting", 2, 5, world.events, world.tick);
world.step(1 / 60);
console.log(`[Tick ${world.tick}] Alice meets Charlie (trust +2)`);

// --- Phase 2: Trading ---
console.log("\n--- Phase 2: Trading System ---");

// Alice offers 5 wood for 10 gold
const woodOffer: TradeItem[] = [{ itemId: "wood", quantity: 5 }];
const goldRequest: TradeItem[] = [{ itemId: "gold", quantity: 10 }];

const offer = trading.createOffer("alice", "bob", woodOffer, goldRequest, world.events, world.tick);
console.log(`[Tick ${world.tick}] Alice offers 5 wood for 10 gold to Bob`);

// Bob accepts the trade
world.step(1 / 60);
const acceptResult = trading.acceptOffer(offer!.id, "bob", world.events);
console.log(`[Tick ${world.tick}] Bob accepts trade: ${acceptResult.success ? "SUCCESS" : "FAILED"}`);
console.log(`  Alice inventory: ${JSON.stringify(inventories.alice)}`);
console.log(`  Bob inventory: ${JSON.stringify(inventories.bob)}`);

// Social impact: successful trade increases trust
social.modifyTrust("alice", "bob", 10, world.events);
console.log(`  Trust increased: ${social.getTrust("alice", "bob")}`);

// Charlie offers wood to Alice but Alice rejects
world.step(1 / 60);
const offer2 = trading.createOffer("charlie", "alice", [{ itemId: "wood", quantity: 3 }], [{ itemId: "gold", quantity: 15 }], world.events, world.tick);
trading.rejectOffer(offer2!.id, "alice", world.events, "too expensive");
console.log(`[Tick ${world.tick}] Charlie offers 3 wood for 15 gold, Alice rejects (too expensive)`);

// --- Phase 3: Party Formation ---
console.log("\n--- Phase 3: Party System ---");

// Alice creates a party
world.step(1 / 60);
const partyResult = parties.createParty("alice", world.events, world.tick, "Adventurers", 4);
console.log(`[Tick ${world.tick}] Alice creates party "Adventurers"`);

// Bob joins
parties.joinParty(partyResult.partyId!, "bob", world.events);
console.log(`[Tick ${world.tick}] Bob joins the party`);

// Charlie joins
world.step(1 / 60);
parties.joinParty(partyResult.partyId!, "charlie", world.events);
console.log(`[Tick ${world.tick}] Charlie joins the party (size: ${parties.getPartySize(partyResult.partyId!)})`);

// Share experience among party members
let expDistribution: Record<string, number> = {};
parties.experienceShareHandler = (partyId, members, exp) => {
  const share = Math.floor(exp / members.length);
  for (const m of members) expDistribution[m] = share;
};
parties.shareExperience(partyResult.partyId!, 300, "quest_complete");
console.log(`[Tick ${world.tick}] Party shares 300 XP: ${JSON.stringify(expDistribution)}`);

// Alice transfers leadership to Bob
world.step(1 / 60);
parties.transferLeadership(partyResult.partyId!, "alice", "bob", world.events);
console.log(`[Tick ${world.tick}] Alice transfers leadership to Bob`);

// Charlie leaves the party
world.step(1 / 60);
parties.leaveParty(partyResult.partyId!, "charlie", world.events);
console.log(`[Tick ${world.tick}] Charlie leaves the party (size: ${parties.getPartySize(partyResult.partyId!)})`);

// --- Phase 4: Perception Summary ---
console.log("\n--- Phase 4: Perception Summary ---");

world.step(1 / 60);
const frame = perception.getPerception("observer");
if (!frame) {
  console.error("ERROR: No perception frame for observer");
  process.exit(1);
}
console.log(`Observer perception frame at tick ${world.tick}:`);
console.log(`  Total events perceived: ${frame.events.length}`);

const socialEvents = frame.events.filter((e) => e.type.startsWith("social."));
const tradeEvents = frame.events.filter((e) => e.type.startsWith("trade."));
const partyEvents = frame.events.filter((e) => e.type.startsWith("party."));

console.log(`  Social events: ${socialEvents.length}`);
console.log(`  Trade events: ${tradeEvents.length}`);
console.log(`  Party events: ${partyEvents.length}`);

const highSeverity = frame.events.filter((e) => e.severity === "high");
const mediumSeverity = frame.events.filter((e) => e.severity === "medium");
console.log(`  High severity: ${highSeverity.length}`);
console.log(`  Medium severity: ${mediumSeverity.length}`);

console.log("\n  Recent events:");
for (const evt of frame.events.slice(-8)) {
    console.log(`    [${evt.severity.toUpperCase()}] ${evt.type}: ${evt.name}`);
}

// --- Final Stats ---
console.log("\n=== Final Stats ===");
console.log(`Social relations: ${social.relationCount}`);
console.log(`  Alice-Bob: ${social.getRelationType("alice", "bob")} (trust: ${social.getTrust("alice", "bob")})`);
console.log(`  Alice-Charlie: ${social.getRelationType("alice", "charlie")} (trust: ${social.getTrust("alice", "charlie")})`);
console.log(`Trades: ${trading.offerCount} total offers`);
console.log(`Parties: ${parties.partyCount} active`);
console.log(`  Adventurers: leader=${parties.getParty(partyResult.partyId!)?.leaderId}, members=${parties.getParty(partyResult.partyId!)?.memberIds.join(", ")}`);
console.log(`Perceived events: ${frame.events.length} total`);

console.log("\n=== M7 Demo Complete ===");
