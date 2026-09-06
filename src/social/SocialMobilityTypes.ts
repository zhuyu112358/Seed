// M13 Social Mobility types.
// Social class hierarchy, prestige system, migration, intermarriage,
// and social status changes. All content is defined by application layer.

/** Social class hierarchy (lower index = lower class). */
export type SocialClass =
  | "serf"        // 农奴
  | "commoner"    // 平民
  | "merchant"    // 商人
  | "artisan"     // 工匠
  | "noble"       // 贵族
  | "aristocrat"  // 贵族精英
  | "royal"       // 皇室
  | "clergy";     // 神职人员

/** Rank order for social classes (higher = more prestigious). */
export const SOCIAL_CLASS_RANK: Record<SocialClass, number> = {
  serf: 0,
  commoner: 1,
  artisan: 2,
  merchant: 3,
  clergy: 4,
  noble: 5,
  aristocrat: 6,
  royal: 7,
};

/** Types of social mobility. */
export type MobilityType =
  | "upward"       // 上升流动
  | "downward"     // 下降流动
  | "lateral"      // 横向流动
  | "migration"    // 移民
  | "intermarriage" // 通婚
  | "appointment"  // 任命
  | "inheritance"  // 继承
  | "disgrace";    // 失势

/** A record of social mobility event. */
export interface MobilityEvent {
  /** Event ID. */
  id: string;
  /** Entity that experienced mobility. */
  entityId: string;
  /** Type of mobility. */
  type: MobilityType;
  /** Previous social class. */
  previousClass: SocialClass | null;
  /** New social class. */
  newClass: SocialClass | null;
  /** Previous location (for migration). */
  previousLocation?: string;
  /** New location (for migration). */
  newLocation?: string;
  /** Other entity involved (for intermarriage). */
  otherEntityId?: string;
  /** Prestige change. */
  prestigeChange: number;
  /** Reason/description. */
  reason: string;
  /** Tick when event occurred. */
  tick: number;
}

/** Social status of an entity. */
export interface SocialStatus {
  /** Entity ID. */
  entityId: string;
  /** Current social class. */
  socialClass: SocialClass;
  /** Prestige score (0-1000). */
  prestige: number;
  /** Wealth score (0-1000, application-defined). */
  wealth: number;
  /** Social influence (0-100). */
  influence: number;
  /** Current location/community. */
  location: string;
  /** Class change history. */
  classHistory: Array<{ socialClass: SocialClass; tick: number }>;
  /** Migration history. */
  migrationHistory: Array<{ from: string; to: string; tick: number }>;
  /** Marriage history. */
  marriageHistory: Array<{ spouseId: string; tick: number }>;
  /** Total mobility events. */
  totalMobilityEvents: number;
  /** Last mobility tick. */
  lastMobilityTick: number | null;
  /** Whether entity is currently married. */
  isMarried: boolean;
  /** Current spouse ID. */
  spouseId: string | null;
}

/** Result of a promotion/demotion attempt. */
export interface MobilityResult {
  /** Whether the mobility was successful. */
  success: boolean;
  /** Type of mobility that occurred. */
  type: MobilityType | null;
  /** Previous class. */
  previousClass: SocialClass | null;
  /** New class. */
  newClass: SocialClass | null;
  /** Prestige change. */
  prestigeChange: number;
  /** Reason for success/failure. */
  reason: string;
}

/** Configuration for SocialMobilitySystem. */
export interface SocialMobilityConfig {
  /** Minimum prestige required for each class promotion (class -> required prestige). */
  promotionThresholds: Record<SocialClass, number>;
  /** Prestige gained per class level on promotion. */
  promotionPrestigeGain: number;
  /** Prestige lost per class level on demotion. */
  demotionPrestigeLoss: number;
  /** Whether prestige decays over time. */
  prestigeDecayEnabled: boolean;
  /** Prestige decay per tick (0-1). */
  prestigeDecayRate: number;
  /** Minimum prestige (floor). */
  minPrestige: number;
  /** Maximum prestige (cap). */
  maxPrestige: number;
  /** Whether intermarriage can change social class. */
  intermarriageMobility: boolean;
  /** Maximum mobility history per entity. */
  maxMobilityHistory: number;
  /** Whether to emit events. */
  emitEvents: boolean;
}

/** Default configuration. */
export const DEFAULT_SOCIAL_MOBILITY_CONFIG: SocialMobilityConfig = {
  promotionThresholds: {
    serf: 0,
    commoner: 50,
    artisan: 100,
    merchant: 200,
    clergy: 300,
    noble: 500,
    aristocrat: 750,
    royal: 1000,
  },
  promotionPrestigeGain: 50,
  demotionPrestigeLoss: 30,
  prestigeDecayEnabled: true,
  prestigeDecayRate: 0.01,
  minPrestige: 0,
  maxPrestige: 1000,
  intermarriageMobility: true,
  maxMobilityHistory: 100,
  emitEvents: true,
};

/** Event types emitted by SocialMobilitySystem. */
export type SocialMobilityEventType =
  | "mobility.promoted"
  | "mobility.demoted"
  | "mobility.migrated"
  | "mobility.married"
  | "mobility.divorced"
  | "mobility.prestige_changed"
  | "mobility.appointed"
  | "mobility.disgraced";

/** Event payload for social mobility events. */
export interface SocialMobilityEvent {
  type: SocialMobilityEventType;
  entityId?: string;
  otherEntityId?: string;
  previousClass?: SocialClass;
  newClass?: SocialClass;
  prestigeChange?: number;
  description?: string;
  tick: number;
}

/** Statistics for SocialMobilitySystem. */
export interface SocialMobilityStats {
  totalEntities: number;
  totalMobilityEvents: number;
  totalPromotions: number;
  totalDemotions: number;
  totalMigrations: number;
  totalMarriages: number;
  averagePrestige: number;
  classDistribution: Record<SocialClass, number>;
  mostMobileEntity: string | null;
  highestPrestigeEntity: string | null;
}
