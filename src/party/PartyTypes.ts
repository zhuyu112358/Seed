// Party system types. All party content is defined by application layer.
/** A party of entities working together. */
export interface Party {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  /** Maximum number of members. Default 4. */
  maxSize: number;
  createdTick: number;
  metadata?: Record<string, unknown>;
}

/** Result of a party operation. */
export interface PartyResult {
  success: boolean;
  partyId?: string;
  error?: string;
}

/** Callback for experience sharing (application layer defines distribution). */
export type ExperienceShareHandler = (
  partyId: string,
  memberIds: string[],
  experience: number,
  sourceId?: string,
) => void;

/** Callback for loot sharing (application layer defines distribution). */
export type LootShareHandler = (
  partyId: string,
  memberIds: string[],
  loot: Record<string, number>,
  sourceId?: string,
) => void;
