// Trading system types. All item/inventory content is defined by application layer.
/** Status of a trade offer. */
export type TradeStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "expired";

/** An item in a trade (application-defined, Seed only stores references). */
export interface TradeItem {
  itemId: string;
  name?: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

/** A trade offer between two entities. */
export interface TradeOffer {
  id: string;
  offererId: string;
  responderId: string;
  /** Items the offerer is giving. */
  offerItems: TradeItem[];
  /** Items the offerer wants in return. */
  requestItems: TradeItem[];
  status: TradeStatus;
  createdTick: number;
  /** Tick when the offer expires. 0 = never expires. */
  expiresTick: number;
}

/** Result of a trade operation. */
export interface TradeResult {
  success: boolean;
  offerId?: string;
  error?: string;
}

/** Callback for item transfer validation (application layer manages inventory). */
export type ItemTransferValidator = (
  entityId: string,
  items: TradeItem[],
) => boolean;

/** Callback for actual item transfer (application layer manages inventory). */
export type ItemTransferHandler = (
  fromId: string,
  toId: string,
  items: TradeItem[],
) => void;
