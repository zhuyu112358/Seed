// Trading system events.
import { Event } from "../event/Event.js";

/** Emitted when a trade offer is created. */
export class TradeOfferedEvent extends Event<{
  offerId: string;
  offererId: string;
  responderId: string;
}> {
  constructor(offerId: string, offererId: string, responderId: string) {
    super({
      type: "trade.offered",
      payload: { offerId, offererId, responderId },
      sourceId: "trading-system",
    });
  }
}

/** Emitted when a trade offer is accepted (before transfer). */
export class TradeAcceptedEvent extends Event<{
  offerId: string;
  offererId: string;
  responderId: string;
}> {
  constructor(offerId: string, offererId: string, responderId: string) {
    super({
      type: "trade.accepted",
      payload: { offerId, offererId, responderId },
      sourceId: "trading-system",
    });
  }
}

/** Emitted when a trade offer is rejected. */
export class TradeRejectedEvent extends Event<{
  offerId: string;
  responderId: string;
  reason?: string;
}> {
  constructor(offerId: string, responderId: string, reason?: string) {
    super({
      type: "trade.rejected",
      payload: { offerId, responderId, reason },
      sourceId: "trading-system",
    });
  }
}

/** Emitted when a trade offer is cancelled by the offerer. */
export class TradeCancelledEvent extends Event<{
  offerId: string;
  offererId: string;
}> {
  constructor(offerId: string, offererId: string) {
    super({
      type: "trade.cancelled",
      payload: { offerId, offererId },
      sourceId: "trading-system",
    });
  }
}

/** Emitted when a trade is completed (items transferred). */
export class TradeCompletedEvent extends Event<{
  offerId: string;
  offererId: string;
  responderId: string;
}> {
  constructor(offerId: string, offererId: string, responderId: string) {
    super({
      type: "trade.completed",
      payload: { offerId, offererId, responderId },
      sourceId: "trading-system",
    });
  }
}

/** Emitted when a trade offer expires. */
export class TradeExpiredEvent extends Event<{
  offerId: string;
  offererId: string;
  responderId: string;
}> {
  constructor(offerId: string, offererId: string, responderId: string) {
    super({
      type: "trade.expired",
      payload: { offerId, offererId, responderId },
      sourceId: "trading-system",
    });
  }
}
