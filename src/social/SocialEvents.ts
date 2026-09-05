// Social system events.
import { Event } from "../event/Event.js";
import type { SocialRelationType } from "./SocialTypes.js";

/** Emitted when a social relation type changes. */
export class SocialRelationChangedEvent extends Event<{
  entityA: string;
  entityB: string;
  oldType: SocialRelationType;
  newType: SocialRelationType;
}> {
  constructor(entityA: string, entityB: string, oldType: SocialRelationType, newType: SocialRelationType) {
    super({
      type: "social.relation_changed",
      payload: { entityA, entityB, oldType, newType },
      sourceId: "social-system",
    });
  }
}

/** Emitted when trust level changes. */
export class SocialTrustChangedEvent extends Event<{
  entityA: string;
  entityB: string;
  oldTrust: number;
  newTrust: number;
}> {
  constructor(entityA: string, entityB: string, oldTrust: number, newTrust: number) {
    super({
      type: "social.trust_changed",
      payload: { entityA, entityB, oldTrust, newTrust },
      sourceId: "social-system",
    });
  }
}

/** Emitted when two entities interact socially. */
export class SocialInteractionEvent extends Event<{
  entityA: string;
  entityB: string;
  interactionType: string;
  trustDelta: number;
  familiarityDelta: number;
}> {
  constructor(
    entityA: string,
    entityB: string,
    interactionType: string,
    trustDelta: number,
    familiarityDelta: number,
  ) {
    super({
      type: "social.interaction",
      payload: { entityA, entityB, interactionType, trustDelta, familiarityDelta },
      sourceId: "social-system",
    });
  }
}
