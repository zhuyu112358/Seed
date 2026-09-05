// Tests for party event perception in SoulPerceptionSystem (M7 phase 5).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { PartySystem } from "../src/party/PartySystem.js";

function makeWorld(): World {
  return new World({ name: "party-perception-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

function findEvent(perception: SoulPerceptionSystem, soulId: string, eventType: string) {
  const frame = perception.getPerception(soulId);
  if (!frame || !frame.events) return null;
  return frame.events.find((e: any) => e.type === eventType) ?? null;
}

describe("Party event perception", () => {
  test("perceives party created event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const parties = new PartySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(parties);
    world.step(1 / 60);
    parties.createParty("npc_1", world.events, world.tick, "Adventurers");
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "party.created");
    assert.ok(evt, "party.created event should be in perception frame");
  });

  test("perceives party disbanded event with medium severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const parties = new PartySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(parties);
    world.step(1 / 60);
    const created = parties.createParty("npc_1", world.events, world.tick, "Test");
    parties.disbandParty(created.partyId!, "npc_1", world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "party.disbanded");
    assert.ok(evt, "party.disbanded event should be in perception frame");
    assert.equal(evt?.severity, "medium");
  });

  test("perceives party member joined event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const parties = new PartySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(parties);
    world.step(1 / 60);
    const created = parties.createParty("npc_1", world.events, world.tick);
    parties.joinParty(created.partyId!, "npc_2", world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "party.member_joined");
    assert.ok(evt, "party.member_joined event should be in perception frame");
    assert.ok(evt?.name.includes("npc_2"));
  });

  test("perceives party member left event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const parties = new PartySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(parties);
    world.step(1 / 60);
    const created = parties.createParty("npc_1", world.events, world.tick);
    parties.joinParty(created.partyId!, "npc_2", world.events);
    parties.leaveParty(created.partyId!, "npc_2", world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "party.member_left");
    assert.ok(evt, "party.member_left event should be in perception frame");
  });

  test("perceives party leader changed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const parties = new PartySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(parties);
    world.step(1 / 60);
    const created = parties.createParty("npc_1", world.events, world.tick);
    parties.joinParty(created.partyId!, "npc_2", world.events);
    parties.transferLeadership(created.partyId!, "npc_1", "npc_2", world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "party.leader_changed");
    assert.ok(evt, "party.leader_changed event should be in perception frame");
    assert.ok(evt?.name.includes("npc_1"));
    assert.ok(evt?.name.includes("npc_2"));
  });

  test("stop() unsubscribes all party listeners", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const parties = new PartySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(parties);
    world.step(1 / 60);
    perception.stop();
    parties.createParty("npc_1", world.events, world.tick);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "party.created");
    assert.ok(!evt, "party event should not be recorded after stop");
  });
});
