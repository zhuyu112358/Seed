// M13 Social-Cultural Integration types.
// Bridges M13 social simulation systems with M12 NPC AI and narrative systems.
// All content is defined by application layer.

/** Configuration for SocialCulturalIntegrationSystem. */
export interface SocialCulturalIntegrationConfig {
  /** Whether social relations influence NPC behavior. */
  socialInfluenceEnabled: boolean;
  /** Whether social events trigger narrative arcs. */
  socialNarrativeEnabled: boolean;
  /** Whether culture influences NPC personality. */
  culturalInfluenceEnabled: boolean;
  /** Weight of social relation influence on behavior (0-1). */
  socialInfluenceWeight: number;
  /** Weight of cultural influence on personality (0-1). */
  culturalInfluenceWeight: number;
  /** Whether to auto-bridge events each tick. */
  autoBridgeEvents: boolean;
  /** Whether to emit integration events. */
  emitEvents: boolean;
  /** Maximum integration event history. */
  maxEventHistory: number;
}

/** Default configuration. */
export const DEFAULT_SOCIAL_CULTURAL_INTEGRATION_CONFIG: SocialCulturalIntegrationConfig = {
  socialInfluenceEnabled: true,
  socialNarrativeEnabled: true,
  culturalInfluenceEnabled: true,
  socialInfluenceWeight: 0.3,
  culturalInfluenceWeight: 0.2,
  autoBridgeEvents: true,
  emitEvents: true,
  maxEventHistory: 500,
};

/** Result of applying social influence to an NPC. */
export interface SocialInfluenceResult {
  /** NPC entity ID. */
  entityId: string;
  /** Number of social relations considered. */
  relationsConsidered: number;
  /** Aggregate social influence score (-100 to 100). */
  socialInfluence: number;
  /** Behavior modifier applied (0-2, 1 = neutral). */
  behaviorModifier: number;
  /** Dominant relation type influencing this NPC. */
  dominantRelationType: string | null;
  /** Description of the influence. */
  description: string;
}

/** Result of bridging a social event to narrative. */
export interface SocialNarrativeBridgeResult {
  /** Social event ID. */
  socialEventId: string;
  /** Social event type. */
  socialEventType: string;
  /** Whether a narrative arc was created/triggered. */
  narrativeTriggered: boolean;
  /** Narrative arc ID (if triggered). */
  narrativeArcId: string | null;
  /** Narrative event ID (if recorded). */
  narrativeEventId: string | null;
  /** Description of the bridge. */
  description: string;
}

/** Result of applying cultural influence to NPC personality. */
export interface CulturalInfluenceResult {
  /** NPC entity ID. */
  entityId: string;
  /** Culture ID influencing the NPC. */
  cultureId: string;
  /** Number of cultural traits considered. */
  traitsConsidered: number;
  /** Personality trait modifications applied. */
  traitModifications: Record<string, number>;
  /** Overall cultural influence score (0-100). */
  culturalInfluence: number;
  /** Description of the influence. */
  description: string;
}

/** Types of integration events. */
export type IntegrationEventType =
  | "integration.social_influence_applied"
  | "integration.social_event_bridged"
  | "integration.cultural_influence_applied"
  | "integration.sync_completed";

/** Integration event payload. */
export interface IntegrationEvent {
  type: IntegrationEventType;
  entityId?: string;
  socialEventId?: string;
  cultureId?: string;
  description?: string;
  tick: number;
}

/** Statistics for SocialCulturalIntegrationSystem. */
export interface SocialCulturalIntegrationStats {
  /** Total social influence applications. */
  totalSocialInfluences: number;
  /** Total social event bridges. */
  totalSocialEventBridges: number;
  /** Total cultural influence applications. */
  totalCulturalInfluences: number;
  /** Total sync cycles completed. */
  totalSyncCycles: number;
  /** Active bridges count. */
  activeBridges: number;
  /** Average social influence score. */
  averageSocialInfluence: number;
  /** Average cultural influence score. */
  averageCulturalInfluence: number;
}
