// PartySystem: manages parties of entities.
// All party content (names, rules, sharing logic) is defined by application layer.
// Seed only manages party state, membership, and event emission.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  Party,
  PartyResult,
  ExperienceShareHandler,
  LootShareHandler,
} from "./PartyTypes.js";
import {
  PartyCreatedEvent,
  PartyDisbandedEvent,
  PartyMemberJoinedEvent,
  PartyMemberLeftEvent,
  PartyLeaderChangedEvent,
} from "./PartyEvents.js";

export class PartySystem {
  readonly name = "party";
  enabled = true;
  private parties = new Map<string, Party>();
  /** Reverse lookup: memberId -> partyId. */
  private memberToParty = new Map<string, string>();
  private partyCounter = 0;

  /** Optional experience sharing handler (application layer). */
  experienceShareHandler: ExperienceShareHandler | null = null;
  /** Optional loot sharing handler (application layer). */
  lootShareHandler: LootShareHandler | null = null;

  /** Generate a unique party ID. */
  private generateId(): string {
    this.partyCounter++;
    return `party_${Date.now()}_${this.partyCounter}`;
  }

  /** Create a new party. The creator becomes the leader and first member. */
  createParty(
    leaderId: string,
    events: EventSystem,
    worldTick: number,
    name?: string,
    maxSize = 4,
  ): PartyResult {
    if (this.memberToParty.has(leaderId)) {
      return { success: false, error: "Entity is already in a party" };
    }
    const id = this.generateId();
    const party: Party = {
      id,
      name: name ?? `Party of ${leaderId}`,
      leaderId,
      memberIds: [leaderId],
      maxSize,
      createdTick: worldTick,
    };
    this.parties.set(id, party);
    this.memberToParty.set(leaderId, id);
    events.emit(new PartyCreatedEvent(id, party.name, leaderId));
    return { success: true, partyId: id };
  }

  /** Disband a party. Only the leader can disband. */
  disbandParty(partyId: string, leaderId: string, events: EventSystem): PartyResult {
    const party = this.parties.get(partyId);
    if (!party) return { success: false, error: "Party not found" };
    if (party.leaderId !== leaderId) return { success: false, error: "Only the leader can disband" };

    for (const memberId of party.memberIds) {
      this.memberToParty.delete(memberId);
    }
    this.parties.delete(partyId);
    events.emit(new PartyDisbandedEvent(partyId, party.name, leaderId));
    return { success: true, partyId };
  }

  /** Join a party. Fails if party is full or entity is already in a party. */
  joinParty(partyId: string, memberId: string, events: EventSystem): PartyResult {
    const party = this.parties.get(partyId);
    if (!party) return { success: false, error: "Party not found" };
    if (this.memberToParty.has(memberId)) {
      return { success: false, error: "Entity is already in a party" };
    }
    if (party.memberIds.length >= party.maxSize) {
      return { success: false, error: "Party is full" };
    }
    party.memberIds.push(memberId);
    this.memberToParty.set(memberId, partyId);
    events.emit(new PartyMemberJoinedEvent(partyId, party.name, memberId));
    return { success: true, partyId };
  }

  /** Leave a party. If the leader leaves, leadership transfers to the next member. */
  leaveParty(partyId: string, memberId: string, events: EventSystem): PartyResult {
    const party = this.parties.get(partyId);
    if (!party) return { success: false, error: "Party not found" };
    if (!party.memberIds.includes(memberId)) {
      return { success: false, error: "Entity is not in this party" };
    }

    const wasLeader = party.leaderId === memberId;
    party.memberIds = party.memberIds.filter((m) => m !== memberId);
    this.memberToParty.delete(memberId);
    events.emit(new PartyMemberLeftEvent(partyId, party.name, memberId, "left"));

    if (wasLeader) {
      if (party.memberIds.length > 0) {
        // Transfer leadership to the next member.
        const oldLeaderId = memberId;
        const newLeaderId = party.memberIds[0];
        party.leaderId = newLeaderId;
        events.emit(new PartyLeaderChangedEvent(partyId, party.name, oldLeaderId, newLeaderId));
      } else {
        // No members left, disband the party.
        this.parties.delete(partyId);
        events.emit(new PartyDisbandedEvent(partyId, party.name, memberId));
      }
    }
    return { success: true, partyId };
  }

  /** Kick a member from the party. Only the leader can kick. */
  kickMember(partyId: string, leaderId: string, memberId: string, events: EventSystem): PartyResult {
    const party = this.parties.get(partyId);
    if (!party) return { success: false, error: "Party not found" };
    if (party.leaderId !== leaderId) return { success: false, error: "Only the leader can kick" };
    if (memberId === leaderId) return { success: false, error: "Cannot kick yourself" };
    if (!party.memberIds.includes(memberId)) {
      return { success: false, error: "Entity is not in this party" };
    }

    party.memberIds = party.memberIds.filter((m) => m !== memberId);
    this.memberToParty.delete(memberId);
    events.emit(new PartyMemberLeftEvent(partyId, party.name, memberId, "kicked"));
    return { success: true, partyId };
  }

  /** Transfer leadership to another member. Only the current leader can transfer. */
  transferLeadership(partyId: string, currentLeaderId: string, newLeaderId: string, events: EventSystem): PartyResult {
    const party = this.parties.get(partyId);
    if (!party) return { success: false, error: "Party not found" };
    if (party.leaderId !== currentLeaderId) return { success: false, error: "Only the leader can transfer" };
    if (!party.memberIds.includes(newLeaderId)) {
      return { success: false, error: "New leader is not in this party" };
    }
    if (currentLeaderId === newLeaderId) return { success: false, error: "Already the leader" };

    const oldLeaderId = party.leaderId;
    party.leaderId = newLeaderId;
    events.emit(new PartyLeaderChangedEvent(partyId, party.name, oldLeaderId, newLeaderId));
    return { success: true, partyId };
  }

  /** Get a party by ID. */
  getParty(partyId: string): Party | undefined {
    return this.parties.get(partyId);
  }

  /** Get the party that a member belongs to. */
  getPartyByMember(memberId: string): Party | undefined {
    const partyId = this.memberToParty.get(memberId);
    return partyId ? this.parties.get(partyId) : undefined;
  }

  /** Get all parties. */
  getParties(): Party[] {
    return Array.from(this.parties.values());
  }

  /** Check if an entity is in a party. */
  isInParty(memberId: string): boolean {
    return this.memberToParty.has(memberId);
  }

  /** Get the size of a party. */
  getPartySize(partyId: string): number {
    return this.parties.get(partyId)?.memberIds.length ?? 0;
  }

  /** Number of parties. */
  get partyCount(): number {
    return this.parties.size;
  }

  /** Share experience among party members (if handler set). */
  shareExperience(partyId: string, experience: number, sourceId?: string): void {
    const party = this.parties.get(partyId);
    if (!party || !this.experienceShareHandler) return;
    this.experienceShareHandler(partyId, [...party.memberIds], experience, sourceId);
  }

  /** Share loot among party members (if handler set). */
  shareLoot(partyId: string, loot: Record<string, number>, sourceId?: string): void {
    const party = this.parties.get(partyId);
    if (!party || !this.lootShareHandler) return;
    this.lootShareHandler(partyId, [...party.memberIds], loot, sourceId);
  }

  /** WorldSystem interface: called each tick. Currently no per-tick logic. */
  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    // Future: party buffs, shared quest progress, etc.
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.parties.clear();
    this.memberToParty.clear();
    this.partyCounter = 0;
  }

  /** Serialize all parties. */
  serialize(): Record<string, unknown> {
    const parties: Record<string, Party> = {};
    for (const [id, party] of this.parties) {
      parties[id] = party;
    }
    const memberToParty: Record<string, string> = {};
    for (const [memberId, partyId] of this.memberToParty) {
      memberToParty[memberId] = partyId;
    }
    return { parties, memberToParty, partyCounter: this.partyCounter };
  }

  /** Deserialize parties. */
  deserialize(data: Record<string, unknown>): void {
    if (data.parties && typeof data.parties === "object") {
      for (const [id, party] of Object.entries(data.parties as Record<string, Party>)) {
        this.parties.set(id, party);
      }
    }
    if (data.memberToParty && typeof data.memberToParty === "object") {
      for (const [memberId, partyId] of Object.entries(data.memberToParty as Record<string, string>)) {
        this.memberToParty.set(memberId, partyId);
      }
    }
    if (typeof data.partyCounter === "number") {
      this.partyCounter = data.partyCounter;
    }
  }
}
