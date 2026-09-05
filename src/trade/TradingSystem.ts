// TradingSystem: manages trade offers between entities.
// All item/inventory content is defined by application layer via callbacks.
// Seed only manages trade state, validation, and event emission.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  TradeOffer,
  TradeItem,
  TradeStatus,
  TradeResult,
  ItemTransferValidator,
  ItemTransferHandler,
} from "./TradeTypes.js";
import {
  TradeOfferedEvent,
  TradeAcceptedEvent,
  TradeRejectedEvent,
  TradeCancelledEvent,
  TradeCompletedEvent,
  TradeExpiredEvent,
} from "./TradeEvents.js";

export class TradingSystem {
  readonly name = "trading";
  enabled = true;
  private offers = new Map<string, TradeOffer>();
  private offerCounter = 0;

  /** Optional validator: checks if entity has items to give. Application layer sets this. */
  transferValidator: ItemTransferValidator | null = null;
  /** Optional handler: performs actual item transfer. Application layer sets this. */
  transferHandler: ItemTransferHandler | null = null;

  /** Generate a unique offer ID. */
  private generateId(): string {
    this.offerCounter++;
    return `trade_${Date.now()}_${this.offerCounter}`;
  }

  /** Create a new trade offer. Returns the offer or null if invalid. */
  createOffer(
    offererId: string,
    responderId: string,
    offerItems: TradeItem[],
    requestItems: TradeItem[],
    events: EventSystem,
    worldTick: number,
    expiresTicks = 0,
  ): TradeOffer | null {
    if (offererId === responderId) return null;
    if (offerItems.length === 0 && requestItems.length === 0) return null;

    // Check if offerer already has a pending offer to this responder.
    for (const offer of this.offers.values()) {
      if (
        offer.offererId === offererId &&
        offer.responderId === responderId &&
        offer.status === "pending"
      ) {
        return null; // Already has pending offer.
      }
    }

    const id = this.generateId();
    const offer: TradeOffer = {
      id,
      offererId,
      responderId,
      offerItems: [...offerItems],
      requestItems: [...requestItems],
      status: "pending",
      createdTick: worldTick,
      expiresTick: expiresTicks > 0 ? worldTick + expiresTicks : 0,
    };
    this.offers.set(id, offer);
    events.emit(new TradeOfferedEvent(id, offererId, responderId));
    return offer;
  }

  /** Accept a trade offer. Validates items and performs transfer if handlers set. */
  acceptOffer(offerId: string, responderId: string, events: EventSystem): TradeResult {
    const offer = this.offers.get(offerId);
    if (!offer) return { success: false, error: "Offer not found" };
    if (offer.status !== "pending") return { success: false, error: "Offer is not pending" };
    if (offer.responderId !== responderId) return { success: false, error: "Not the responder" };

    // Validate responder has request items (if validator set).
    if (this.transferValidator && offer.requestItems.length > 0) {
      if (!this.transferValidator(responderId, offer.requestItems)) {
        return { success: false, error: "Responder does not have requested items" };
      }
    }
    // Validate offerer has offer items (if validator set).
    if (this.transferValidator && offer.offerItems.length > 0) {
      if (!this.transferValidator(offer.offererId, offer.offerItems)) {
        return { success: false, error: "Offerer does not have offered items" };
      }
    }

    offer.status = "accepted";
    events.emit(new TradeAcceptedEvent(offerId, offer.offererId, responderId));

    // Perform item transfer (if handler set).
    if (this.transferHandler) {
      // Offerer gives offerItems to responder.
      if (offer.offerItems.length > 0) {
        this.transferHandler(offer.offererId, responderId, offer.offerItems);
      }
      // Responder gives requestItems to offerer.
      if (offer.requestItems.length > 0) {
        this.transferHandler(responderId, offer.offererId, offer.requestItems);
      }
    }

    offer.status = "completed";
    events.emit(new TradeCompletedEvent(offerId, offer.offererId, responderId));
    return { success: true, offerId };
  }

  /** Reject a trade offer. */
  rejectOffer(offerId: string, responderId: string, events: EventSystem, reason?: string): TradeResult {
    const offer = this.offers.get(offerId);
    if (!offer) return { success: false, error: "Offer not found" };
    if (offer.status !== "pending") return { success: false, error: "Offer is not pending" };
    if (offer.responderId !== responderId) return { success: false, error: "Not the responder" };

    offer.status = "rejected";
    events.emit(new TradeRejectedEvent(offerId, responderId, reason));
    return { success: true, offerId };
  }

  /** Cancel a trade offer (by offerer). */
  cancelOffer(offerId: string, offererId: string, events: EventSystem): TradeResult {
    const offer = this.offers.get(offerId);
    if (!offer) return { success: false, error: "Offer not found" };
    if (offer.status !== "pending") return { success: false, error: "Offer is not pending" };
    if (offer.offererId !== offererId) return { success: false, error: "Not the offerer" };

    offer.status = "cancelled";
    events.emit(new TradeCancelledEvent(offerId, offererId));
    return { success: true, offerId };
  }

  /** Get a trade offer by ID. */
  getOffer(offerId: string): TradeOffer | undefined {
    return this.offers.get(offerId);
  }

  /** Get all pending offers for an entity (as offerer or responder). */
  getPendingOffers(entityId: string): TradeOffer[] {
    return Array.from(this.offers.values()).filter(
      (o) => o.status === "pending" && (o.offererId === entityId || o.responderId === entityId),
    );
  }

  /** Get all offers involving an entity. */
  getOffersByEntity(entityId: string): TradeOffer[] {
    return Array.from(this.offers.values()).filter(
      (o) => o.offererId === entityId || o.responderId === entityId,
    );
  }

  /** Get all active (pending) offers. */
  getActiveOffers(): TradeOffer[] {
    return Array.from(this.offers.values()).filter((o) => o.status === "pending");
  }

  /** Number of offers in the system. */
  get offerCount(): number {
    return this.offers.size;
  }

  /** WorldSystem interface: expire old offers. */
  tick(_dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;
    for (const offer of this.offers.values()) {
      if (offer.status === "pending" && offer.expiresTick > 0 && world.tick >= offer.expiresTick) {
        offer.status = "expired";
        events.emit(new TradeExpiredEvent(offer.id, offer.offererId, offer.responderId));
      }
    }
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.offers.clear();
    this.offerCounter = 0;
  }

  /** Remove completed/rejected/cancelled/expired offers (cleanup). */
  cleanupFinishedOffers(): number {
    let removed = 0;
    for (const [id, offer] of this.offers) {
      if (offer.status !== "pending" && offer.status !== "accepted") {
        this.offers.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Serialize all offers. */
  serialize(): Record<string, unknown> {
    const offers: Record<string, TradeOffer> = {};
    for (const [id, offer] of this.offers) {
      offers[id] = offer;
    }
    return { offers, offerCounter: this.offerCounter };
  }

  /** Deserialize offers. */
  deserialize(data: Record<string, unknown>): void {
    if (data.offers && typeof data.offers === "object") {
      for (const [id, offer] of Object.entries(data.offers as Record<string, TradeOffer>)) {
        this.offers.set(id, offer);
      }
    }
    if (typeof data.offerCounter === "number") {
      this.offerCounter = data.offerCounter;
    }
  }
}
