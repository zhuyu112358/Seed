// Party system events.
import { Event } from "../event/Event.js";

/** Emitted when a party is created. */
export class PartyCreatedEvent extends Event<{
  partyId: string;
  partyName: string;
  leaderId: string;
}> {
  constructor(partyId: string, partyName: string, leaderId: string) {
    super({
      type: "party.created",
      payload: { partyId, partyName, leaderId },
      sourceId: "party-system",
    });
  }
}

/** Emitted when a party is disbanded. */
export class PartyDisbandedEvent extends Event<{
  partyId: string;
  partyName: string;
  leaderId: string;
}> {
  constructor(partyId: string, partyName: string, leaderId: string) {
    super({
      type: "party.disbanded",
      payload: { partyId, partyName, leaderId },
      sourceId: "party-system",
    });
  }
}

/** Emitted when a member joins a party. */
export class PartyMemberJoinedEvent extends Event<{
  partyId: string;
  partyName: string;
  memberId: string;
}> {
  constructor(partyId: string, partyName: string, memberId: string) {
    super({
      type: "party.member_joined",
      payload: { partyId, partyName, memberId },
      sourceId: "party-system",
    });
  }
}

/** Emitted when a member leaves a party. */
export class PartyMemberLeftEvent extends Event<{
  partyId: string;
  partyName: string;
  memberId: string;
  reason?: string;
}> {
  constructor(partyId: string, partyName: string, memberId: string, reason?: string) {
    super({
      type: "party.member_left",
      payload: { partyId, partyName, memberId, reason },
      sourceId: "party-system",
    });
  }
}

/** Emitted when party leadership changes. */
export class PartyLeaderChangedEvent extends Event<{
  partyId: string;
  partyName: string;
  oldLeaderId: string;
  newLeaderId: string;
}> {
  constructor(partyId: string, partyName: string, oldLeaderId: string, newLeaderId: string) {
    super({
      type: "party.leader_changed",
      payload: { partyId, partyName, oldLeaderId, newLeaderId },
      sourceId: "party-system",
    });
  }
}
