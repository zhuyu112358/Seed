// Tests for PartySystem (M7 phase 4).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { PartySystem } from "../src/party/PartySystem.js";

function makeWorld(): World {
  return new World({ name: "party-test", tickRate: 60 });
}

describe("PartySystem - Create Party", () => {
  test("create party with leader", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const result = system.createParty("npc_1", world.events, world.tick, "Adventurers");
    assert.ok(result.success);
    const party = system.getParty(result.partyId!)!;
    assert.equal(party.leaderId, "npc_1");
    assert.equal(party.memberIds.length, 1);
    assert.equal(party.name, "Adventurers");
  });

  test("create party with default name", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const result = system.createParty("npc_1", world.events, world.tick);
    assert.ok(result.success);
    assert.ok(system.getParty(result.partyId!)!.name.includes("npc_1"));
  });

  test("cannot create party if already in a party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    system.createParty("npc_1", world.events, world.tick);
    const result = system.createParty("npc_1", world.events, world.tick);
    assert.ok(!result.success);
    assert.equal(result.error, "Entity is already in a party");
  });

  test("create party emits party.created event", () => {
    const system = new PartySystem();
    const world = makeWorld();
    let created = false;
    world.events.on("party.created", () => { created = true; });
    system.createParty("npc_1", world.events, world.tick);
    assert.ok(created);
  });
});

describe("PartySystem - Join Party", () => {
  test("member can join party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    const result = system.joinParty(created.partyId!, "npc_2", world.events);
    assert.ok(result.success);
    assert.equal(system.getPartySize(created.partyId!), 2);
  });

  test("cannot join full party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick, "Test", 2);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.joinParty(created.partyId!, "npc_3", world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "Party is full");
  });

  test("cannot join if already in a party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const p1 = system.createParty("npc_1", world.events, world.tick);
    const p2 = system.createParty("npc_3", world.events, world.tick);
    const result = system.joinParty(p2.partyId!, "npc_1", world.events);
    assert.ok(!result.success);
  });

  test("join emits party.member_joined event", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    let joined = false;
    world.events.on("party.member_joined", () => { joined = true; });
    system.joinParty(created.partyId!, "npc_2", world.events);
    assert.ok(joined);
  });
});

describe("PartySystem - Leave Party", () => {
  test("member can leave party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.leaveParty(created.partyId!, "npc_2", world.events);
    assert.ok(result.success);
    assert.equal(system.getPartySize(created.partyId!), 1);
    assert.ok(!system.isInParty("npc_2"));
  });

  test("leader leaving transfers leadership", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    system.leaveParty(created.partyId!, "npc_1", world.events);
    const party = system.getParty(created.partyId!)!;
    assert.equal(party.leaderId, "npc_2");
  });

  test("last member leaving disbands party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.leaveParty(created.partyId!, "npc_1", world.events);
    assert.equal(system.getParty(created.partyId!), undefined);
  });

  test("leave emits party.member_left event", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    let left = false;
    world.events.on("party.member_left", () => { left = true; });
    system.leaveParty(created.partyId!, "npc_2", world.events);
    assert.ok(left);
  });

  test("leader leaving emits party.leader_changed event", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    let leaderChanged = false;
    world.events.on("party.leader_changed", () => { leaderChanged = true; });
    system.leaveParty(created.partyId!, "npc_1", world.events);
    assert.ok(leaderChanged);
  });
});

describe("PartySystem - Disband Party", () => {
  test("leader can disband party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.disbandParty(created.partyId!, "npc_1", world.events);
    assert.ok(result.success);
    assert.equal(system.getParty(created.partyId!), undefined);
    assert.ok(!system.isInParty("npc_2"));
  });

  test("non-leader cannot disband", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.disbandParty(created.partyId!, "npc_2", world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "Only the leader can disband");
  });

  test("disband emits party.disbanded event", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    let disbanded = false;
    world.events.on("party.disbanded", () => { disbanded = true; });
    system.disbandParty(created.partyId!, "npc_1", world.events);
    assert.ok(disbanded);
  });
});

describe("PartySystem - Kick Member", () => {
  test("leader can kick member", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.kickMember(created.partyId!, "npc_1", "npc_2", world.events);
    assert.ok(result.success);
    assert.ok(!system.isInParty("npc_2"));
  });

  test("non-leader cannot kick", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.kickMember(created.partyId!, "npc_2", "npc_1", world.events);
    assert.ok(!result.success);
  });

  test("cannot kick yourself", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    const result = system.kickMember(created.partyId!, "npc_1", "npc_1", world.events);
    assert.ok(!result.success);
  });
});

describe("PartySystem - Transfer Leadership", () => {
  test("leader can transfer leadership", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.transferLeadership(created.partyId!, "npc_1", "npc_2", world.events);
    assert.ok(result.success);
    assert.equal(system.getParty(created.partyId!)!.leaderId, "npc_2");
  });

  test("non-leader cannot transfer", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const result = system.transferLeadership(created.partyId!, "npc_2", "npc_1", world.events);
    assert.ok(!result.success);
  });

  test("transfer emits party.leader_changed event", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    let changed = false;
    world.events.on("party.leader_changed", () => { changed = true; });
    system.transferLeadership(created.partyId!, "npc_1", "npc_2", world.events);
    assert.ok(changed);
  });
});

describe("PartySystem - Queries", () => {
  test("getPartyByMember returns correct party", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    const party = system.getPartyByMember("npc_2");
    assert.equal(party?.id, created.partyId);
  });

  test("isInParty returns correct status", () => {
    const system = new PartySystem();
    const world = makeWorld();
    system.createParty("npc_1", world.events, world.tick);
    assert.ok(system.isInParty("npc_1"));
    assert.ok(!system.isInParty("npc_2"));
  });

  test("getParties returns all parties", () => {
    const system = new PartySystem();
    const world = makeWorld();
    system.createParty("npc_1", world.events, world.tick);
    system.createParty("npc_3", world.events, world.tick);
    assert.equal(system.getParties().length, 2);
  });
});

describe("PartySystem - Sharing", () => {
  test("shareExperience calls handler with all members", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    system.joinParty(created.partyId!, "npc_2", world.events);
    let called = false;
    let receivedMembers: string[] = [];
    system.experienceShareHandler = (partyId, members, exp) => {
      called = true;
      receivedMembers = members;
      assert.equal(exp, 100);
    };
    system.shareExperience(created.partyId!, 100);
    assert.ok(called);
    assert.equal(receivedMembers.length, 2);
  });

  test("shareLoot calls handler with all members", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick);
    let called = false;
    system.lootShareHandler = () => { called = true; };
    system.shareLoot(created.partyId!, { gold: 50 });
    assert.ok(called);
  });
});

describe("PartySystem - Serialization", () => {
  test("serialize and deserialize preserves parties", () => {
    const system = new PartySystem();
    const world = makeWorld();
    const created = system.createParty("npc_1", world.events, world.tick, "Test Party");
    system.joinParty(created.partyId!, "npc_2", world.events);
    const data = system.serialize();

    const system2 = new PartySystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.partyCount, 1);
    const party = system2.getParty(created.partyId!)!;
    assert.equal(party.name, "Test Party");
    assert.equal(party.memberIds.length, 2);
    assert.ok(system2.isInParty("npc_2"));
  });
});

describe("PartySystem - WorldSystem", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const system = new PartySystem();
    world.addSystem(system);
    system.createParty("npc_1", world.events, world.tick);
    world.step(1 / 60);
    assert.equal(system.partyCount, 1);
  });

  test("stop clears all parties", () => {
    const system = new PartySystem();
    const world = makeWorld();
    system.createParty("npc_1", world.events, world.tick);
    system.stop();
    assert.equal(system.partyCount, 0);
  });
});
