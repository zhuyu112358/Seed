// FormationSystem: Formation control for groups of agents.
// Supports multiple formation shapes (line/column/wedge/circle/v/custom)
// with configurable spacing. Computes target positions for each formation
// member based on the leader's position and the formation slot offsets.
//
// Seed only provides the formation calculation framework; formation
// assignment, leader selection, and movement execution are handled by
// the application layer (which can use FlockingSystem or ORCA for movement).
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  FormationType,
  FormationSlot,
  FormationConfig,
  DEFAULT_FORMATION_CONFIG,
  Formation,
  FormationResult,
  FormationSlotPosition,
} from "./FormationTypes.js";

export class FormationSystem {
  readonly name = "formation";
  enabled = true;
  private formations = new Map<string, Formation>();
  private memberToFormation = new Map<string, string>(); // memberId -> formationId
  private formationCounter = 0;
  /** Formation configuration. */
  config: FormationConfig;

  constructor(config?: Partial<FormationConfig>) {
    this.config = { ...DEFAULT_FORMATION_CONFIG, ...config };
  }

  private generateId(): string {
    this.formationCounter++;
    return `formation_${Date.now()}_${this.formationCounter}`;
  }

  // --- Formation management ---

  /**
   * Create a new formation.
   * @param type Formation shape type.
   * @param leaderId ID of the leader entity.
   * @param name Optional formation name.
   * @param customOffsets Required for "custom" type.
   */
  createFormation(
    type: FormationType,
    leaderId: string,
    name?: string,
    customOffsets?: { x: number; z: number }[],
  ): FormationResult {
    if (type === "custom" && (!customOffsets || customOffsets.length === 0)) {
      return { success: false, error: "Custom formation requires customOffsets" };
    }
    if (this.memberToFormation.has(leaderId)) {
      return { success: false, error: `Leader ${leaderId} is already in a formation` };
    }

    const id = this.generateId();
    const formation: Formation = {
      id,
      type,
      leaderId,
      name: name || `Formation ${id}`,
      slots: [{ index: 0, offset: { x: 0, z: 0 }, memberId: leaderId }],
      customOffsets,
      active: true,
      createdTick: 0,
    };
    this.formations.set(id, formation);
    this.memberToFormation.set(leaderId, id);
    return { success: true, formationId: id };
  }

  /** Disband a formation and remove all members. */
  disbandFormation(formationId: string): FormationResult {
    const formation = this.formations.get(formationId);
    if (!formation) return { success: false, error: "Formation not found" };

    for (const slot of formation.slots) {
      if (slot.memberId) {
        this.memberToFormation.delete(slot.memberId);
      }
    }
    this.formations.delete(formationId);
    return { success: true, formationId };
  }

  /** Get a formation by ID. */
  getFormation(formationId: string): Formation | undefined {
    return this.formations.get(formationId);
  }

  /** Get all formations. */
  getFormations(): Formation[] {
    return Array.from(this.formations.values());
  }

  /** Get formations led by a specific leader. */
  getFormationsByLeader(leaderId: string): Formation[] {
    return Array.from(this.formations.values()).filter((f) => f.leaderId === leaderId);
  }

  /** Get the formation that a member belongs to. */
  getMemberFormation(memberId: string): Formation | undefined {
    const formationId = this.memberToFormation.get(memberId);
    return formationId ? this.formations.get(formationId) : undefined;
  }

  /** Number of formations. */
  get formationCount(): number {
    return this.formations.size;
  }

  // --- Member management ---

  /**
   * Add a member to a formation (assigns to next available slot).
   * @param formationId Target formation.
   * @param memberId Member entity ID.
   * @param slotIndex Optional specific slot index (otherwise next available).
   */
  addMember(formationId: string, memberId: string, slotIndex?: number): FormationResult {
    const formation = this.formations.get(formationId);
    if (!formation) return { success: false, error: "Formation not found" };
    if (this.memberToFormation.has(memberId)) {
      return { success: false, error: `Member ${memberId} is already in a formation` };
    }

    let targetSlot: FormationSlot | undefined;

    if (slotIndex !== undefined) {
      targetSlot = formation.slots.find((s) => s.index === slotIndex);
      if (!targetSlot) {
        // Create slots up to the requested index.
        this.ensureSlots(formation, slotIndex + 1);
        targetSlot = formation.slots.find((s) => s.index === slotIndex);
      }
      if (targetSlot && targetSlot.memberId) {
        return { success: false, error: `Slot ${slotIndex} is already occupied` };
      }
    } else {
      // Find first empty slot, or create a new one.
      targetSlot = formation.slots.find((s) => s.memberId === null);
      if (!targetSlot) {
        const newIndex = formation.slots.length;
        this.ensureSlots(formation, newIndex + 1);
        targetSlot = formation.slots.find((s) => s.index === newIndex);
      }
    }

    if (!targetSlot) return { success: false, error: "Could not assign slot" };

    targetSlot.memberId = memberId;
    this.memberToFormation.set(memberId, formationId);
    return { success: true, formationId, slotIndex: targetSlot.index };
  }

  /** Remove a member from its formation. */
  removeMember(memberId: string): FormationResult {
    const formationId = this.memberToFormation.get(memberId);
    if (!formationId) return { success: false, error: "Member not in any formation" };

    const formation = this.formations.get(formationId);
    if (!formation) {
      this.memberToFormation.delete(memberId);
      return { success: false, error: "Formation not found (cleaned up member)" };
    }

    if (memberId === formation.leaderId) {
      return { success: false, error: "Cannot remove leader; disband formation or transfer leadership first" };
    }

    const slot = formation.slots.find((s) => s.memberId === memberId);
    if (slot) slot.memberId = null;
    this.memberToFormation.delete(memberId);
    return { success: true, formationId };
  }

  /** Transfer leadership to another member in the formation. */
  transferLeadership(formationId: string, newLeaderId: string): FormationResult {
    const formation = this.formations.get(formationId);
    if (!formation) return { success: false, error: "Formation not found" };

    const newLeaderSlot = formation.slots.find((s) => s.memberId === newLeaderId);
    if (!newLeaderSlot) return { success: false, error: "New leader is not in the formation" };

    const oldLeaderId = formation.leaderId;
    const oldLeaderSlot = formation.slots.find((s) => s.index === 0);

    // Swap slot 0 (leader) with new leader's slot.
    if (oldLeaderSlot && newLeaderSlot.index !== 0) {
      oldLeaderSlot.memberId = newLeaderId;
      newLeaderSlot.memberId = oldLeaderId;
    }

    formation.leaderId = newLeaderId;
    return { success: true, formationId };
  }

  /** Change formation type. */
  setFormationType(formationId: string, type: FormationType, customOffsets?: { x: number; z: number }[]): FormationResult {
    const formation = this.formations.get(formationId);
    if (!formation) return { success: false, error: "Formation not found" };
    if (type === "custom" && (!customOffsets || customOffsets.length === 0)) {
      return { success: false, error: "Custom formation requires customOffsets" };
    }

    formation.type = type;
    formation.customOffsets = customOffsets;
    // Recalculate slot offsets.
    this.recalculateOffsets(formation);
    return { success: true, formationId };
  }

  // --- Slot offset calculation ---

  /** Ensure the formation has at least `count` slots. */
  private ensureSlots(formation: Formation, count: number): void {
    while (formation.slots.length < count) {
      const index = formation.slots.length;
      formation.slots.push({
        index,
        offset: this.computeSlotOffset(formation, index),
        memberId: null,
      });
    }
  }

  /** Recalculate all slot offsets for a formation. */
  private recalculateOffsets(formation: Formation): void {
    for (const slot of formation.slots) {
      slot.offset = this.computeSlotOffset(formation, slot.index);
    }
  }

  /**
   * Compute the offset for a given slot index based on formation type.
   * Slot 0 is always the leader (offset 0,0).
   */
  private computeSlotOffset(formation: Formation, slotIndex: number): { x: number; z: number } {
    if (slotIndex === 0) return { x: 0, z: 0 };

    const s = this.config.spacing;

    switch (formation.type) {
      case "line": {
        // Horizontal line: spread along z-axis.
        // Slots: 1=+z, 2=-z, 3=+2z, 4=-2z, ...
        const side = slotIndex % 2 === 1 ? 1 : -1;
        const row = Math.ceil(slotIndex / 2);
        return { x: 0, z: side * row * s };
      }

      case "column": {
        // Vertical column: spread along negative x (behind leader).
        return { x: -slotIndex * s, z: 0 };
      }

      case "wedge": {
        // V / wedge formation: leader at front, members spread back and sideways.
        // Slots: 1=(-s, +s), 2=(-s, -s), 3=(-2s, +2s), 4=(-2s, -2s), ...
        const side = slotIndex % 2 === 1 ? 1 : -1;
        const row = Math.ceil(slotIndex / 2);
        return { x: -row * s, z: side * row * s };
      }

      case "v": {
        // V formation: similar to wedge but wider angle (more z spread).
        const side = slotIndex % 2 === 1 ? 1 : -1;
        const row = Math.ceil(slotIndex / 2);
        return { x: -row * s * 0.5, z: side * row * s * 1.5 };
      }

      case "circle": {
        // Circle around leader: members arranged in a circle.
        const memberCount = formation.slots.filter((sl) => sl.memberId !== null || sl.index <= slotIndex).length - 1;
        const angle = ((slotIndex - 1) / Math.max(1, memberCount)) * Math.PI * 2;
        const r = this.config.circleRadius;
        return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
      }

      case "custom": {
        if (formation.customOffsets && slotIndex - 1 < formation.customOffsets.length) {
          return { ...formation.customOffsets[slotIndex - 1] };
        }
        // Fallback: stack behind leader.
        return { x: -slotIndex * s, z: 0 };
      }

      default:
        return { x: -slotIndex * s, z: 0 };
    }
  }

  // --- Position computation ---

  /**
   * Compute world positions for all formation slots based on leader position.
   * @param formationId Target formation.
   * @param leaderPosition Current leader position (x, z).
   * @param memberPositions Optional map of memberId -> current position for inPosition check.
   */
  computeSlotPositions(
    formationId: string,
    leaderPosition: { x: number; z: number },
    memberPositions?: Map<string, { x: number; z: number }>,
  ): FormationSlotPosition[] {
    const formation = this.formations.get(formationId);
    if (!formation) return [];

    const results: FormationSlotPosition[] = [];
    for (const slot of formation.slots) {
      const position = {
        x: leaderPosition.x + slot.offset.x,
        z: leaderPosition.z + slot.offset.z,
      };

      let inPosition = false;
      if (slot.memberId && memberPositions) {
        const memberPos = memberPositions.get(slot.memberId);
        if (memberPos) {
          const dist = Math.sqrt(
            Math.pow(memberPos.x - position.x, 2) + Math.pow(memberPos.z - position.z, 2),
          );
          inPosition = dist <= this.config.positionTolerance;
        }
      }

      results.push({
        slotIndex: slot.index,
        memberId: slot.memberId,
        position,
        inPosition,
      });
    }
    return results;
  }

  /** Get the target position for a specific member. */
  getMemberTargetPosition(
    memberId: string,
    leaderPosition: { x: number; z: number },
  ): { x: number; z: number } | null {
    const formation = this.getMemberFormation(memberId);
    if (!formation) return null;

    const slot = formation.slots.find((s) => s.memberId === memberId);
    if (!slot) return null;

    return {
      x: leaderPosition.x + slot.offset.x,
      z: leaderPosition.z + slot.offset.z,
    };
  }

  /** Check if all members are in position. */
  isFormationInPosition(
    formationId: string,
    memberPositions: Map<string, { x: number; z: number }>,
    leaderPosition: { x: number; z: number },
  ): boolean {
    const positions = this.computeSlotPositions(formationId, leaderPosition, memberPositions);
    return positions.every((p) => p.memberId === null || p.inPosition);
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    // FormationSystem is stateless per-tick; positions are computed on demand.
    // This method exists for WorldSystem interface compatibility.
  }

  stop(): void {
    this.formations.clear();
    this.memberToFormation.clear();
    this.formationCounter = 0;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const formations: Record<string, Formation> = {};
    for (const [id, f] of this.formations) {
      formations[id] = f;
    }
    const memberToFormation: Record<string, string> = {};
    for (const [memberId, formationId] of this.memberToFormation) {
      memberToFormation[memberId] = formationId;
    }
    return { formations, memberToFormation, formationCounter: this.formationCounter, config: this.config };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.formations && typeof data.formations === "object") {
      for (const [id, f] of Object.entries(data.formations as Record<string, Formation>)) {
        this.formations.set(id, f);
      }
    }
    if (data.memberToFormation && typeof data.memberToFormation === "object") {
      for (const [memberId, formationId] of Object.entries(data.memberToFormation as Record<string, string>)) {
        this.memberToFormation.set(memberId, formationId);
      }
    }
    if (typeof data.formationCounter === "number") {
      this.formationCounter = data.formationCounter;
    }
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_FORMATION_CONFIG, ...(data.config as Partial<FormationConfig>) };
    }
  }
}
