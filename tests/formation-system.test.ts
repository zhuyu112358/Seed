// Tests for FormationSystem (M9 phase 3): Formation control.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FormationSystem } from "../src/formation/FormationSystem.js";

describe("FormationSystem - Formation Management", () => {
  test("create a line formation", () => {
    const system = new FormationSystem();
    const result = system.createFormation("line", "leader_1", "Test Line");
    assert.ok(result.success);
    const formation = system.getFormation(result.formationId!)!;
    assert.equal(formation.type, "line");
    assert.equal(formation.leaderId, "leader_1");
    assert.equal(formation.slots.length, 1);
    assert.equal(formation.slots[0].memberId, "leader_1");
    assert.deepEqual(formation.slots[0].offset, { x: 0, z: 0 });
  });

  test("create formation with each type", () => {
    const system = new FormationSystem();
    for (const type of ["line", "column", "wedge", "circle", "v"] as const) {
      const result = system.createFormation(type, `leader_${type}`);
      assert.ok(result.success, `Should create ${type} formation`);
    }
    assert.equal(system.formationCount, 5);
  });

  test("create custom formation requires offsets", () => {
    const system = new FormationSystem();
    const result = system.createFormation("custom", "leader_1");
    assert.ok(!result.success);
    assert.ok(result.error?.includes("customOffsets"));
  });

  test("create custom formation with offsets", () => {
    const system = new FormationSystem();
    const result = system.createFormation("custom", "leader_1", "Custom", [
      { x: -1, z: 1 },
      { x: -1, z: -1 },
    ]);
    assert.ok(result.success);
  });

  test("leader cannot be in two formations", () => {
    const system = new FormationSystem();
    system.createFormation("line", "leader_1");
    const result = system.createFormation("column", "leader_1");
    assert.ok(!result.success);
  });

  test("disband formation", () => {
    const system = new FormationSystem();
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "member_1");
    const result = system.disbandFormation(created.formationId!);
    assert.ok(result.success);
    assert.equal(system.getFormation(created.formationId!), undefined);
    assert.equal(system.getMemberFormation("member_1"), undefined);
  });

  test("disband nonexistent formation fails", () => {
    const system = new FormationSystem();
    const result = system.disbandFormation("nonexistent");
    assert.ok(!result.success);
  });

  test("get formations by leader", () => {
    const system = new FormationSystem();
    system.createFormation("line", "leader_1");
    system.createFormation("column", "leader_2");
    system.createFormation("wedge", "leader_3");
    assert.equal(system.getFormationsByLeader("leader_1").length, 1);
    assert.equal(system.getFormationsByLeader("leader_2").length, 1);
    assert.equal(system.formationCount, 3);
  });
});

describe("FormationSystem - Member Management", () => {
  test("add member to formation", () => {
    const system = new FormationSystem();
    const created = system.createFormation("line", "leader_1");
    const result = system.addMember(created.formationId!, "member_1");
    assert.ok(result.success);
    assert.equal(result.slotIndex, 1);
    assert.equal(system.getMemberFormation("member_1")?.id, created.formationId);
  });

  test("add multiple members to line formation", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");
    system.addMember(created.formationId!, "m3");

    const formation = system.getFormation(created.formationId!)!;
    assert.equal(formation.slots.length, 4);
    // Line: slot 1 = +z, slot 2 = -z, slot 3 = +2z.
    assert.deepEqual(formation.slots[1].offset, { x: 0, z: 2 });
    assert.deepEqual(formation.slots[2].offset, { x: 0, z: -2 });
    assert.deepEqual(formation.slots[3].offset, { x: 0, z: 4 });
  });

  test("add member to specific slot", () => {
    const system = new FormationSystem();
    const created = system.createFormation("line", "leader_1");
    const result = system.addMember(created.formationId!, "member_1", 3);
    assert.ok(result.success);
    assert.equal(result.slotIndex, 3);
    const formation = system.getFormation(created.formationId!)!;
    assert.equal(formation.slots[3].memberId, "member_1");
    // Slots 1 and 2 should be empty.
    assert.equal(formation.slots[1].memberId, null);
    assert.equal(formation.slots[2].memberId, null);
  });

  test("member cannot be in two formations", () => {
    const system = new FormationSystem();
    const f1 = system.createFormation("line", "leader_1");
    const f2 = system.createFormation("column", "leader_2");
    system.addMember(f1.formationId!, "member_1");
    const result = system.addMember(f2.formationId!, "member_1");
    assert.ok(!result.success);
  });

  test("remove member from formation", () => {
    const system = new FormationSystem();
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "member_1");
    const result = system.removeMember("member_1");
    assert.ok(result.success);
    assert.equal(system.getMemberFormation("member_1"), undefined);
    const formation = system.getFormation(created.formationId!)!;
    assert.equal(formation.slots[1].memberId, null);
  });

  test("cannot remove leader", () => {
    const system = new FormationSystem();
    const created = system.createFormation("line", "leader_1");
    const result = system.removeMember("leader_1");
    assert.ok(!result.success);
  });

  test("transfer leadership", () => {
    const system = new FormationSystem();
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "member_1");
    const result = system.transferLeadership(created.formationId!, "member_1");
    assert.ok(result.success);
    assert.equal(system.getFormation(created.formationId!)!.leaderId, "member_1");
    // Old leader should now be in slot 1.
    assert.equal(system.getFormation(created.formationId!)!.slots[1].memberId, "leader_1");
  });
});

describe("FormationSystem - Slot Offsets", () => {
  test("column formation offsets", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("column", "leader_1");
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");
    const formation = system.getFormation(created.formationId!)!;
    assert.deepEqual(formation.slots[1].offset, { x: -2, z: 0 });
    assert.deepEqual(formation.slots[2].offset, { x: -4, z: 0 });
  });

  test("wedge formation offsets", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("wedge", "leader_1");
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");
    const formation = system.getFormation(created.formationId!)!;
    // Wedge: slot 1 = (-s, +s), slot 2 = (-s, -s).
    assert.deepEqual(formation.slots[1].offset, { x: -2, z: 2 });
    assert.deepEqual(formation.slots[2].offset, { x: -2, z: -2 });
  });

  test("v formation offsets (wider than wedge)", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("v", "leader_1");
    system.addMember(created.formationId!, "m1");
    const formation = system.getFormation(created.formationId!)!;
    // V: x = -row*s*0.5, z = side*row*s*1.5.
    assert.deepEqual(formation.slots[1].offset, { x: -1, z: 3 });
  });

  test("custom formation offsets", () => {
    const system = new FormationSystem();
    const created = system.createFormation("custom", "leader_1", "Custom", [
      { x: -5, z: 3 },
      { x: -5, z: -3 },
    ]);
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");
    const formation = system.getFormation(created.formationId!)!;
    assert.deepEqual(formation.slots[1].offset, { x: -5, z: 3 });
    assert.deepEqual(formation.slots[2].offset, { x: -5, z: -3 });
  });

  test("change formation type recalculates offsets", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "m1");
    assert.deepEqual(system.getFormation(created.formationId!)!.slots[1].offset, { x: 0, z: 2 });

    system.setFormationType(created.formationId!, "column");
    assert.deepEqual(system.getFormation(created.formationId!)!.slots[1].offset, { x: -2, z: 0 });
  });
});

describe("FormationSystem - Position Computation", () => {
  test("compute slot positions for line formation", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");

    const positions = system.computeSlotPositions(created.formationId!, { x: 10, z: 5 });
    assert.equal(positions.length, 3);
    // Leader at (10, 5).
    assert.deepEqual(positions[0].position, { x: 10, z: 5 });
    // Slot 1: +z offset 2 -> (10, 7).
    assert.deepEqual(positions[1].position, { x: 10, z: 7 });
    // Slot 2: -z offset 2 -> (10, 3).
    assert.deepEqual(positions[2].position, { x: 10, z: 3 });
  });

  test("get member target position", () => {
    const system = new FormationSystem({ spacing: 2 });
    const created = system.createFormation("column", "leader_1");
    system.addMember(created.formationId!, "m1");

    const target = system.getMemberTargetPosition("m1", { x: 0, z: 0 });
    assert.deepEqual(target, { x: -2, z: 0 });
  });

  test("get member target position returns null for non-member", () => {
    const system = new FormationSystem();
    const target = system.getMemberTargetPosition("nobody", { x: 0, z: 0 });
    assert.equal(target, null);
  });

  test("inPosition check", () => {
    const system = new FormationSystem({ spacing: 2, positionTolerance: 0.5 });
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "m1");

    const memberPositions = new Map<string, { x: number; z: number }>();
    memberPositions.set("m1", { x: 0, z: 2.1 }); // Close to target (0, 2).

    const positions = system.computeSlotPositions(created.formationId!, { x: 0, z: 0 }, memberPositions);
    assert.equal(positions[1].inPosition, true); // Within 0.5 tolerance.
  });

  test("not inPosition when far from target", () => {
    const system = new FormationSystem({ spacing: 2, positionTolerance: 0.5 });
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "m1");

    const memberPositions = new Map<string, { x: number; z: number }>();
    memberPositions.set("m1", { x: 0, z: 5 }); // Far from target (0, 2).

    const positions = system.computeSlotPositions(created.formationId!, { x: 0, z: 0 }, memberPositions);
    assert.equal(positions[1].inPosition, false);
  });

  test("isFormationInPosition", () => {
    const system = new FormationSystem({ spacing: 2, positionTolerance: 1.0 });
    const created = system.createFormation("line", "leader_1");
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");

    const memberPositions = new Map<string, { x: number; z: number }>();
    memberPositions.set("leader_1", { x: 0, z: 0 }); // Leader at exact position.
    memberPositions.set("m1", { x: 0, z: 2 }); // Exact target.
    memberPositions.set("m2", { x: 0, z: -2 }); // Exact target.

    assert.equal(system.isFormationInPosition(created.formationId!, memberPositions, { x: 0, z: 0 }), true);
  });
});

describe("FormationSystem - Serialization", () => {
  test("serialize and deserialize preserves formations", () => {
    const system = new FormationSystem({ spacing: 3 });
    const created = system.createFormation("wedge", "leader_1", "Test Wedge");
    system.addMember(created.formationId!, "m1");
    system.addMember(created.formationId!, "m2");
    const data = system.serialize();

    const system2 = new FormationSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.formationCount, 1);
    const formation = system2.getFormation(created.formationId!)!;
    assert.equal(formation.type, "wedge");
    assert.equal(formation.leaderId, "leader_1");
    assert.equal(formation.slots.length, 3);
    assert.equal(system2.config.spacing, 3);
    assert.equal(system2.getMemberFormation("m1")?.id, created.formationId);
  });

  test("stop clears all formations", () => {
    const system = new FormationSystem();
    system.createFormation("line", "leader_1");
    system.createFormation("column", "leader_2");
    system.stop();
    assert.equal(system.formationCount, 0);
  });
});
