// M13 Social Mobility System.
// Social class hierarchy, prestige system, migration, intermarriage,
// and social status changes. All content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type {
  SocialClass,
  MobilityType,
  MobilityEvent,
  SocialStatus,
  MobilityResult,
  SocialMobilityConfig,
  SocialMobilityEvent,
  SocialMobilityEventType,
  SocialMobilityStats,
} from "./SocialMobilityTypes.js";
import {
  DEFAULT_SOCIAL_MOBILITY_CONFIG,
  SOCIAL_CLASS_RANK,
} from "./SocialMobilityTypes.js";

/** WorldSystem: social mobility with class hierarchy, prestige, migration, intermarriage. */
export class SocialMobilitySystem {
  readonly name = "social-mobility-system";
  enabled = true;

  private config: SocialMobilityConfig;
  private statuses: Map<string, SocialStatus> = new Map();
  private mobilityHistory: MobilityEvent[] = [];
  private eventHistory: SocialMobilityEvent[] = [];
  private eventCounter = 0;
  private currentTick = 0;

  constructor(config?: Partial<SocialMobilityConfig>) {
    this.config = { ...DEFAULT_SOCIAL_MOBILITY_CONFIG, ...config };
  }

  // --- Social Status Management ---

  /** Ensure a social status exists for an entity. */
  private ensureStatus(entityId: string): SocialStatus {
    let status = this.statuses.get(entityId);
    if (!status) {
      status = {
        entityId,
        socialClass: "commoner",
        prestige: 50,
        wealth: 50,
        influence: 20,
        location: "unknown",
        classHistory: [{ socialClass: "commoner", tick: this.currentTick }],
        migrationHistory: [],
        marriageHistory: [],
        totalMobilityEvents: 0,
        lastMobilityTick: null,
        isMarried: false,
        spouseId: null,
      };
      this.statuses.set(entityId, status);
    }
    return status;
  }

  /** Get social status for an entity. */
  getSocialStatus(entityId: string): SocialStatus | undefined {
    return this.statuses.get(entityId);
  }

  /** Register an entity with initial social status. */
  registerEntity(
    entityId: string,
    options?: {
      socialClass?: SocialClass;
      prestige?: number;
      wealth?: number;
      influence?: number;
      location?: string;
    },
  ): SocialStatus {
    const status = this.ensureStatus(entityId);
    if (options?.socialClass) {
      status.socialClass = options.socialClass;
      status.classHistory = [{ socialClass: options.socialClass, tick: this.currentTick }];
    }
    if (options?.prestige !== undefined) {
      status.prestige = this.clampPrestige(options.prestige);
    }
    if (options?.wealth !== undefined) status.wealth = options.wealth;
    if (options?.influence !== undefined) status.influence = options.influence;
    if (options?.location) status.location = options.location;
    return status;
  }

  /** Set social class directly. */
  setSocialClass(entityId: string, socialClass: SocialClass, reason: string): void {
    const status = this.ensureStatus(entityId);
    const previousClass = status.socialClass;
    status.socialClass = socialClass;
    status.classHistory.push({ socialClass, tick: this.currentTick });
    status.totalMobilityEvents++;
    status.lastMobilityTick = this.currentTick;

    const type: MobilityType =
      SOCIAL_CLASS_RANK[socialClass] > SOCIAL_CLASS_RANK[previousClass]
        ? "upward"
        : SOCIAL_CLASS_RANK[socialClass] < SOCIAL_CLASS_RANK[previousClass]
          ? "downward"
          : "lateral";

    this.recordMobilityEvent(entityId, type, previousClass, socialClass, 0, reason);
    this.makeEvent(
      type === "upward" ? "mobility.promoted" : type === "downward" ? "mobility.demoted" : "mobility.appointed",
      entityId, undefined, previousClass, socialClass, 0,
      `${entityId} social class changed: ${previousClass} -> ${socialClass} (${reason})`,
    );
  }

  // --- Promotion / Demotion ---

  /** Check if an entity can be promoted to the next class. */
  canPromote(entityId: string): boolean {
    const status = this.statuses.get(entityId);
    if (!status) return false;
    const currentRank = SOCIAL_CLASS_RANK[status.socialClass];
    if (currentRank >= Object.keys(SOCIAL_CLASS_RANK).length - 1) return false;

    const nextClass = this.getClassByRank(currentRank + 1);
    if (!nextClass) return false;
    const requiredPrestige = this.config.promotionThresholds[nextClass];
    return status.prestige >= requiredPrestige;
  }

  /** Promote an entity to the next social class. */
  promote(entityId: string, reason: string): MobilityResult {
    const status = this.statuses.get(entityId);
    if (!status) {
      return { success: false, type: null, previousClass: null, newClass: null, prestigeChange: 0, reason: "Entity not registered" };
    }

    const currentRank = SOCIAL_CLASS_RANK[status.socialClass];
    if (currentRank >= Object.keys(SOCIAL_CLASS_RANK).length - 1) {
      return { success: false, type: null, previousClass: status.socialClass, newClass: null, prestigeChange: 0, reason: "Already at highest class" };
    }

    const nextClass = this.getClassByRank(currentRank + 1)!;
    const requiredPrestige = this.config.promotionThresholds[nextClass];

    if (status.prestige < requiredPrestige) {
      return {
        success: false,
        type: null,
        previousClass: status.socialClass,
        newClass: null,
        prestigeChange: 0,
        reason: `Insufficient prestige: ${status.prestige} < ${requiredPrestige} required for ${nextClass}`,
      };
    }

    const previousClass = status.socialClass;
    const prestigeGain = this.config.promotionPrestigeGain;
    status.socialClass = nextClass;
    status.prestige = this.clampPrestige(status.prestige + prestigeGain);
    status.classHistory.push({ socialClass: nextClass, tick: this.currentTick });
    status.totalMobilityEvents++;
    status.lastMobilityTick = this.currentTick;

    this.recordMobilityEvent(entityId, "upward", previousClass, nextClass, prestigeGain, reason);
    this.makeEvent("mobility.promoted", entityId, undefined, previousClass, nextClass, prestigeGain,
      `${entityId} promoted: ${previousClass} -> ${nextClass} (${reason})`);

    return { success: true, type: "upward", previousClass, newClass: nextClass, prestigeChange: prestigeGain, reason };
  }

  /** Demote an entity to the previous social class. */
  demote(entityId: string, reason: string): MobilityResult {
    const status = this.statuses.get(entityId);
    if (!status) {
      return { success: false, type: null, previousClass: null, newClass: null, prestigeChange: 0, reason: "Entity not registered" };
    }

    const currentRank = SOCIAL_CLASS_RANK[status.socialClass];
    if (currentRank <= 0) {
      return { success: false, type: null, previousClass: status.socialClass, newClass: null, prestigeChange: 0, reason: "Already at lowest class" };
    }

    const prevClass = this.getClassByRank(currentRank - 1)!;
    const previousClass = status.socialClass;
    const prestigeLoss = this.config.demotionPrestigeLoss;
    status.socialClass = prevClass;
    status.prestige = this.clampPrestige(status.prestige - prestigeLoss);
    status.classHistory.push({ socialClass: prevClass, tick: this.currentTick });
    status.totalMobilityEvents++;
    status.lastMobilityTick = this.currentTick;

    this.recordMobilityEvent(entityId, "downward", previousClass, prevClass, -prestigeLoss, reason);
    this.makeEvent("mobility.demoted", entityId, undefined, previousClass, prevClass, -prestigeLoss,
      `${entityId} demoted: ${previousClass} -> ${prevClass} (${reason})`);

    return { success: true, type: "downward", previousClass, newClass: prevClass, prestigeChange: -prestigeLoss, reason };
  }

  // --- Prestige System ---

  /** Add prestige to an entity. */
  addPrestige(entityId: string, amount: number, reason: string): number {
    const status = this.ensureStatus(entityId);
    const previous = status.prestige;
    status.prestige = this.clampPrestige(status.prestige + amount);
    const actualChange = status.prestige - previous;

    if (actualChange !== 0) {
      this.makeEvent("mobility.prestige_changed", entityId, undefined, undefined, undefined, actualChange,
        `${entityId} prestige changed: ${previous} -> ${status.prestige} (${reason})`);
    }
    return status.prestige;
  }

  /** Remove prestige from an entity. */
  removePrestige(entityId: string, amount: number, reason: string): number {
    return this.addPrestige(entityId, -amount, reason);
  }

  /** Get prestige for an entity. */
  getPrestige(entityId: string): number {
    return this.statuses.get(entityId)?.prestige ?? 0;
  }

  /** Set wealth for an entity. */
  setWealth(entityId: string, wealth: number): void {
    const status = this.ensureStatus(entityId);
    status.wealth = Math.max(0, Math.min(1000, wealth));
  }

  /** Set influence for an entity. */
  setInfluence(entityId: string, influence: number): void {
    const status = this.ensureStatus(entityId);
    status.influence = Math.max(0, Math.min(100, influence));
  }

  // --- Migration ---

  /** Migrate an entity to a new location. */
  migrate(entityId: string, newLocation: string, reason: string): boolean {
    const status = this.statuses.get(entityId);
    if (!status) return false;

    const previousLocation = status.location;
    if (previousLocation === newLocation) return false;

    status.location = newLocation;
    status.migrationHistory.push({ from: previousLocation, to: newLocation, tick: this.currentTick });
    status.totalMobilityEvents++;
    status.lastMobilityTick = this.currentTick;

    this.recordMobilityEvent(entityId, "migration", null, null, 0, reason, previousLocation, newLocation);
    this.makeEvent("mobility.migrated", entityId, undefined, undefined, undefined, 0,
      `${entityId} migrated: ${previousLocation} -> ${newLocation} (${reason})`);

    return true;
  }

  /** Get migration history for an entity. */
  getMigrationHistory(entityId: string): Array<{ from: string; to: string; tick: number }> {
    return this.statuses.get(entityId)?.migrationHistory ?? [];
  }

  // --- Intermarriage ---

  /** Marry two entities. */
  intermarry(entityId1: string, entityId2: string, reason: string): boolean {
    const status1 = this.ensureStatus(entityId1);
    const status2 = this.ensureStatus(entityId2);

    if (status1.isMarried || status2.isMarried) return false;
    if (entityId1 === entityId2) return false;

    status1.isMarried = true;
    status1.spouseId = entityId2;
    status1.marriageHistory.push({ spouseId: entityId2, tick: this.currentTick });
    status1.totalMobilityEvents++;
    status1.lastMobilityTick = this.currentTick;

    status2.isMarried = true;
    status2.spouseId = entityId1;
    status2.marriageHistory.push({ spouseId: entityId1, tick: this.currentTick });
    status2.totalMobilityEvents++;
    status2.lastMobilityTick = this.currentTick;

    // Intermarriage can cause social mobility (lower class spouse may be promoted).
    if (this.config.intermarriageMobility) {
      const rank1 = SOCIAL_CLASS_RANK[status1.socialClass];
      const rank2 = SOCIAL_CLASS_RANK[status2.socialClass];
      if (rank1 > rank2) {
        // Promote the lower-class spouse one level.
        this.promote(entityId2, `Intermarriage with ${entityId1}`);
      } else if (rank2 > rank1) {
        this.promote(entityId1, `Intermarriage with ${entityId2}`);
      }
    }

    this.recordMobilityEvent(entityId1, "intermarriage", null, null, 0, reason, undefined, undefined, entityId2);
    this.makeEvent("mobility.married", entityId1, entityId2, undefined, undefined, 0,
      `${entityId1} married ${entityId2} (${reason})`);

    return true;
  }

  /** Divorce two entities. */
  divorce(entityId1: string, entityId2: string, reason: string): boolean {
    const status1 = this.statuses.get(entityId1);
    const status2 = this.statuses.get(entityId2);
    if (!status1 || !status2) return false;
    if (!status1.isMarried || status1.spouseId !== entityId2) return false;

    status1.isMarried = false;
    status1.spouseId = null;
    status2.isMarried = false;
    status2.spouseId = null;

    // Divorce may cause prestige loss.
    this.removePrestige(entityId1, 20, `Divorce from ${entityId2}`);
    this.removePrestige(entityId2, 20, `Divorce from ${entityId1}`);

    this.makeEvent("mobility.divorced", entityId1, entityId2, undefined, undefined, -20,
      `${entityId1} divorced ${entityId2} (${reason})`);

    return true;
  }

  /** Get marriage history for an entity. */
  getMarriageHistory(entityId: string): Array<{ spouseId: string; tick: number }> {
    return this.statuses.get(entityId)?.marriageHistory ?? [];
  }

  // --- Disgrace / Appointment ---

  /** Disgrace an entity (rapid downward mobility + prestige loss). */
  disgrace(entityId: string, levels: number, reason: string): MobilityResult {
    let lastResult: MobilityResult | null = null;
    for (let i = 0; i < levels; i++) {
      lastResult = this.demote(entityId, reason);
      if (!lastResult.success) break;
    }
    this.removePrestige(entityId, 100, `Disgrace: ${reason}`);
    this.makeEvent("mobility.disgraced", entityId, undefined, undefined, undefined, -100,
      `${entityId} disgraced: ${levels} levels (${reason})`);
    return lastResult ?? { success: false, type: null, previousClass: null, newClass: null, prestigeChange: 0, reason: "No demotion occurred" };
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    this.currentTick++;

    // Prestige decay.
    if (this.config.prestigeDecayEnabled) {
      for (const status of this.statuses.values()) {
        if (status.prestige > this.config.minPrestige) {
          const decay = status.prestige * this.config.prestigeDecayRate;
          status.prestige = Math.max(this.config.minPrestige, status.prestige - decay);
        }
      }
    }
  }

  stop(): void {
    // Cleanup if needed.
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      statuses: [...this.statuses.values()],
      mobilityHistory: this.mobilityHistory.slice(-100),
      eventHistory: this.eventHistory.slice(-100),
      currentTick: this.currentTick,
      eventCounter: this.eventCounter,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_SOCIAL_MOBILITY_CONFIG, ...(data.config as object) };
    this.statuses.clear();
    this.mobilityHistory = [];
    this.eventHistory = [];

    const statuses = data.statuses as SocialStatus[];
    for (const s of statuses) {
      this.statuses.set(s.entityId, s);
    }

    this.mobilityHistory = (data.mobilityHistory as MobilityEvent[]) ?? [];
    this.eventHistory = (data.eventHistory as SocialMobilityEvent[]) ?? [];
    this.currentTick = (data.currentTick as number) ?? 0;
    this.eventCounter = (data.eventCounter as number) ?? 0;
  }

  // --- Statistics ---

  getStats(): SocialMobilityStats {
    const statuses = [...this.statuses.values()];
    let totalPrestige = 0;
    let maxMobility = 0;
    let mostMobileEntity: string | null = null;
    let maxPrestige = -1;
    let highestPrestigeEntity: string | null = null;
    const classDistribution: Record<SocialClass, number> = {
      serf: 0, commoner: 0, artisan: 0, merchant: 0,
      clergy: 0, noble: 0, aristocrat: 0, royal: 0,
    };

    for (const s of statuses) {
      totalPrestige += s.prestige;
      classDistribution[s.socialClass]++;
      if (s.totalMobilityEvents > maxMobility) {
        maxMobility = s.totalMobilityEvents;
        mostMobileEntity = s.entityId;
      }
      if (s.prestige > maxPrestige) {
        maxPrestige = s.prestige;
        highestPrestigeEntity = s.entityId;
      }
    }

    const promotions = this.mobilityHistory.filter((e) => e.type === "upward").length;
    const demotions = this.mobilityHistory.filter((e) => e.type === "downward").length;
    const migrations = this.mobilityHistory.filter((e) => e.type === "migration").length;
    const marriages = this.mobilityHistory.filter((e) => e.type === "intermarriage").length;

    return {
      totalEntities: statuses.length,
      totalMobilityEvents: this.mobilityHistory.length,
      totalPromotions: promotions,
      totalDemotions: demotions,
      totalMigrations: migrations,
      totalMarriages: marriages,
      averagePrestige: statuses.length > 0 ? totalPrestige / statuses.length : 0,
      classDistribution,
      mostMobileEntity,
      highestPrestigeEntity,
    };
  }

  // --- Internal Helpers ---

  private getClassByRank(rank: number): SocialClass | null {
    for (const [cls, r] of Object.entries(SOCIAL_CLASS_RANK)) {
      if (r === rank) return cls as SocialClass;
    }
    return null;
  }

  private clampPrestige(value: number): number {
    return Math.max(this.config.minPrestige, Math.min(this.config.maxPrestige, value));
  }

  private recordMobilityEvent(
    entityId: string,
    type: MobilityType,
    previousClass: SocialClass | null,
    newClass: SocialClass | null,
    prestigeChange: number,
    reason: string,
    previousLocation?: string,
    newLocation?: string,
    otherEntityId?: string,
  ): void {
    this.eventCounter++;
    const event: MobilityEvent = {
      id: `mobility_${this.eventCounter}`,
      entityId,
      type,
      previousClass,
      newClass,
      previousLocation,
      newLocation,
      otherEntityId,
      prestigeChange,
      reason,
      tick: this.currentTick,
    };
    this.mobilityHistory.push(event);
    if (this.mobilityHistory.length > 500) {
      this.mobilityHistory.shift();
    }
  }

  private makeEvent(
    type: SocialMobilityEventType,
    entityId?: string,
    otherEntityId?: string,
    previousClass?: SocialClass,
    newClass?: SocialClass,
    prestigeChange?: number,
    description?: string,
  ): SocialMobilityEvent {
    const event: SocialMobilityEvent = {
      type,
      entityId,
      otherEntityId,
      previousClass,
      newClass,
      prestigeChange,
      description,
      tick: this.currentTick,
    };
    this.eventHistory.push(event);
    if (this.eventHistory.length > 500) {
      this.eventHistory.shift();
    }
    return event;
  }
}
