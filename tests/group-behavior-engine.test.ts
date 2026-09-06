// M13 GroupBehaviorEngine tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { GroupBehaviorEngine } from "../src/social/GroupBehaviorEngine.js";
import { DEFAULT_GROUP_BEHAVIOR_CONFIG } from "../src/social/GroupBehaviorTypes.js";
import type {
  GroupEmotionType,
  CollectiveActionType,
  DecisionMethod,
} from "../src/social/GroupBehaviorTypes.js";

describe("GroupBehaviorEngine - Group Management", () => {
  let engine: GroupBehaviorEngine;

  beforeEach(() => {
    engine = new GroupBehaviorEngine();
  });

  test("createGroup creates a new group", () => {
    const group = engine.createGroup("Protesters", "crowd");
    assert.ok(group);
    assert.equal(group!.name, "Protesters");
    assert.equal(group!.type, "crowd");
    assert.equal(group!.active, true);
    assert.equal(group!.members.length, 0);
  });

  test("createGroup accepts initial members", () => {
    const group = engine.createGroup("Workers", "union", {
      members: [
        { entityId: "npc_1", role: "leader", influence: 80 },
        { entityId: "npc_2", role: "follower", influence: 20 },
      ],
    });
    assert.equal(group!.members.length, 2);
    assert.equal(group!.members[0].role, "leader");
    assert.equal(group!.members[0].influence, 80);
  });

  test("createGroup enforces maxGroups limit", () => {
    const limited = new GroupBehaviorEngine({ maxGroups: 1 });
    limited.createGroup("Group 1", "type");
    assert.equal(limited.createGroup("Group 2", "type"), null);
  });

  test("getGroup returns group by ID", () => {
    const group = engine.createGroup("Test", "type");
    const found = engine.getGroup(group!.id);
    assert.ok(found);
    assert.equal(found!.name, "Test");
  });

  test("getGroup returns undefined for unknown ID", () => {
    assert.equal(engine.getGroup("nonexistent"), undefined);
  });

  test("getActiveGroups returns only active groups", () => {
    const g1 = engine.createGroup("Active", "type");
    const g2 = engine.createGroup("Inactive", "type");
    engine.disbandGroup(g2!.id);
    assert.equal(engine.getActiveGroups().length, 1);
    assert.equal(engine.getActiveGroups()[0].id, g1!.id);
  });

  test("disbandGroup deactivates group", () => {
    const group = engine.createGroup("To disband", "type");
    assert.equal(engine.disbandGroup(group!.id), true);
    assert.equal(engine.getGroup(group!.id)!.active, false);
  });

  test("disbandGroup returns false for unknown group", () => {
    assert.equal(engine.disbandGroup("nonexistent"), false);
  });
});

describe("GroupBehaviorEngine - Member Management", () => {
  let engine: GroupBehaviorEngine;
  let groupId: string;

  beforeEach(() => {
    engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Test Group", "type");
    groupId = group!.id;
  });

  test("addMember adds entity to group", () => {
    assert.equal(engine.addMember(groupId, "npc_1", "leader", 80), true);
    const members = engine.getGroup(groupId)!.members;
    assert.equal(members.length, 1);
    assert.equal(members[0].entityId, "npc_1");
    assert.equal(members[0].role, "leader");
    assert.equal(members[0].influence, 80);
  });

  test("addMember defaults to follower role", () => {
    engine.addMember(groupId, "npc_1");
    assert.equal(engine.getGroup(groupId)!.members[0].role, "follower");
  });

  test("addMember rejects duplicate entity", () => {
    engine.addMember(groupId, "npc_1");
    assert.equal(engine.addMember(groupId, "npc_1"), false);
  });

  test("addMember enforces maxMembersPerGroup", () => {
    const limited = new GroupBehaviorEngine({ maxMembersPerGroup: 1 });
    const g = limited.createGroup("Small", "type")!;
    limited.addMember(g.id, "npc_1");
    assert.equal(limited.addMember(g.id, "npc_2"), false);
  });

  test("removeMember removes entity from group", () => {
    engine.addMember(groupId, "npc_1");
    engine.addMember(groupId, "npc_2");
    assert.equal(engine.removeMember(groupId, "npc_1"), true);
    assert.equal(engine.getGroup(groupId)!.members.length, 1);
    assert.equal(engine.getGroup(groupId)!.members[0].entityId, "npc_2");
  });

  test("removeMember returns false for non-member", () => {
    assert.equal(engine.removeMember(groupId, "npc_99"), false);
  });

  test("getGroupsForEntity returns groups entity belongs to", () => {
    const g2 = engine.createGroup("Second", "type")!;
    engine.addMember(groupId, "npc_1");
    engine.addMember(g2.id, "npc_1");
    assert.equal(engine.getGroupsForEntity("npc_1").length, 2);
  });

  test("setMemberEmotion updates member emotion", () => {
    engine.addMember(groupId, "npc_1");
    assert.equal(engine.setMemberEmotion(groupId, "npc_1", "angry", 80), true);
    const member = engine.getGroup(groupId)!.members[0];
    assert.equal(member.emotion, "angry");
    assert.equal(member.emotionIntensity, 80);
  });

  test("setMemberEmotion clamps intensity to 0-100", () => {
    engine.addMember(groupId, "npc_1");
    engine.setMemberEmotion(groupId, "npc_1", "excited", 150);
    assert.equal(engine.getGroup(groupId)!.members[0].emotionIntensity, 100);
  });

  test("setMemberAnonymity updates anonymity flag", () => {
    engine.addMember(groupId, "npc_1");
    assert.equal(engine.setMemberAnonymity(groupId, "npc_1", true), true);
    assert.equal(engine.getGroup(groupId)!.members[0].anonymous, true);
  });
});

describe("GroupBehaviorEngine - Group Emotion", () => {
  let engine: GroupBehaviorEngine;
  let groupId: string;

  beforeEach(() => {
    engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Emotional", "crowd", {
      members: [
        { entityId: "npc_1" },
        { entityId: "npc_2" },
        { entityId: "npc_3" },
      ],
    });
    groupId = group!.id;
  });

  test("getGroupEmotion returns default calm state", () => {
    const emotion = engine.getGroupEmotion(groupId);
    assert.ok(emotion);
    assert.equal(emotion!.dominantEmotion, "calm");
    // Default members have intensity 10, so arousal = 10.
    assert.equal(emotion!.arousal, 10);
  });

  test("setGroupEmotion changes all members' emotions", () => {
    engine.setGroupEmotion(groupId, "excited", 70);
    const members = engine.getGroup(groupId)!.members;
    assert.ok(members.every((m) => m.emotion === "excited"));
    assert.ok(members.every((m) => m.emotionIntensity === 70));
  });

  test("setGroupEmotion updates dominant emotion", () => {
    engine.setGroupEmotion(groupId, "angry", 90);
    assert.equal(engine.getGroupEmotion(groupId)!.dominantEmotion, "angry");
    assert.ok(engine.getGroupEmotion(groupId)!.arousal > 0);
  });

  test("recalculateEmotionState finds dominant emotion from members", () => {
    engine.setMemberEmotion(groupId, "npc_1", "angry", 80);
    engine.setMemberEmotion(groupId, "npc_2", "angry", 70);
    engine.setMemberEmotion(groupId, "npc_3", "calm", 10);
    assert.equal(engine.getGroupEmotion(groupId)!.dominantEmotion, "angry");
  });

  test("spreadEmotion spreads from source to other members", () => {
    engine.setMemberEmotion(groupId, "npc_1", "excited", 100);
    engine.setMemberEmotion(groupId, "npc_2", "calm", 5);
    engine.setMemberEmotion(groupId, "npc_3", "calm", 5);
    // Spread multiple times to increase chance.
    for (let i = 0; i < 10; i++) {
      engine.spreadEmotion(groupId, "npc_1", 2.0);
    }
    const emotion = engine.getGroupEmotion(groupId)!;
    // At least some members should have shifted to excited or increased intensity.
    assert.ok(emotion.arousal > 5);
  });

  test("spreadEmotion returns false for unknown source", () => {
    assert.equal(engine.spreadEmotion(groupId, "npc_99"), false);
  });

  test("negative valence for angry group", () => {
    engine.setGroupEmotion(groupId, "angry", 80);
    assert.ok(engine.getGroupEmotion(groupId)!.valence < 0);
  });

  test("positive valence for joyful group", () => {
    engine.setGroupEmotion(groupId, "joyful", 80);
    assert.ok(engine.getGroupEmotion(groupId)!.valence > 0);
  });
});

describe("GroupBehaviorEngine - Mob Psychology", () => {
  let engine: GroupBehaviorEngine;

  beforeEach(() => {
    engine = new GroupBehaviorEngine();
  });

  test("getMobState returns default state for calm group", () => {
    const group = engine.createGroup("Calm", "crowd", {
      members: [{ entityId: "npc_1" }, { entityId: "npc_2" }],
    })!;
    const mob = engine.getMobState(group.id);
    assert.ok(mob);
    assert.equal(mob!.isMob, false);
    assert.equal(mob!.actionTendency, 0);
  });

  test("updateMobPsychology increases with group size", () => {
    const small = engine.createGroup("Small", "crowd", {
      members: [{ entityId: "a" }, { entityId: "b" }],
    })!;
    const large = engine.createGroup("Large", "crowd", {
      members: Array.from({ length: 20 }, (_, i) => ({ entityId: `npc_${i}` })),
    })!;

    engine.setGroupEmotion(small.id, "angry", 70);
    engine.setGroupEmotion(large.id, "angry", 70);

    const smallMob = engine.updateMobPsychology(small.id)!;
    const largeMob = engine.updateMobPsychology(large.id)!;
    assert.ok(largeMob.deindividuation > smallMob.deindividuation);
  });

  test("updateMobPsychology increases with arousal", () => {
    const group = engine.createGroup("Test", "crowd", {
      members: [{ entityId: "a" }, { entityId: "b" }, { entityId: "c" }],
    })!;

    engine.setGroupEmotion(group.id, "calm", 10);
    const calmMob = engine.updateMobPsychology(group.id)!;

    engine.setGroupEmotion(group.id, "angry", 90);
    const angryMob = engine.updateMobPsychology(group.id)!;

    assert.ok(angryMob.polarization > calmMob.polarization);
    assert.ok(angryMob.actionTendency > calmMob.actionTendency);
  });

  test("updateMobPsychology increases with anonymity", () => {
    const group = engine.createGroup("Anonymous", "crowd", {
      members: [{ entityId: "a" }, { entityId: "b" }, { entityId: "c" }],
    })!;
    engine.setGroupEmotion(group.id, "angry", 70);

    const withoutAnon = engine.updateMobPsychology(group.id)!;

    engine.setMemberAnonymity(group.id, "a", true);
    engine.setMemberAnonymity(group.id, "b", true);
    engine.setMemberAnonymity(group.id, "c", true);

    const withAnon = engine.updateMobPsychology(group.id)!;
    assert.ok(withAnon.deindividuation > withoutAnon.deindividuation);
  });

  test("large angry anonymous group becomes mob", () => {
    const group = engine.createGroup("Mob", "crowd", {
      members: Array.from({ length: 30 }, (_, i) => ({ entityId: `npc_${i}` })),
    })!;
    engine.setGroupEmotion(group.id, "angry", 95);
    for (const m of group.members) {
      engine.setMemberAnonymity(group.id, m.entityId, true);
    }
    const mob = engine.updateMobPsychology(group.id)!;
    assert.equal(mob.isMob, true);
  });

  test("mob formation emits event", () => {
    const group = engine.createGroup("Mob", "crowd", {
      members: Array.from({ length: 30 }, (_, i) => ({ entityId: `npc_${i}` })),
    })!;
    engine.setGroupEmotion(group.id, "angry", 95);
    for (const m of group.members) {
      engine.setMemberAnonymity(group.id, m.entityId, true);
    }
    engine.updateMobPsychology(group.id);
    // Event should have been emitted (we can't easily check event history without getter,
    // but the mob state should be true).
    assert.equal(engine.getMobState(group.id)!.isMob, true);
  });
});

describe("GroupBehaviorEngine - Collective Action", () => {
  let engine: GroupBehaviorEngine;
  let groupId: string;

  beforeEach(() => {
    engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Activists", "movement", {
      members: Array.from({ length: 10 }, (_, i) => ({ entityId: `npc_${i}` })),
    });
    groupId = group!.id;
  });

  test("startCollectiveAction creates a new action", () => {
    const action = engine.startCollectiveAction(groupId, "protest", "March", "Town Square");
    assert.ok(action);
    assert.equal(action!.type, "protest");
    assert.equal(action!.name, "March");
    assert.equal(action!.target, "Town Square");
    assert.equal(action!.status, "mobilizing");
  });

  test("startCollectiveAction accepts initial participants", () => {
    const action = engine.startCollectiveAction(groupId, "celebration", "Festival", "Park", {
      initialParticipants: ["npc_1", "npc_2", "npc_3"],
    });
    assert.equal(action!.participants.length, 3);
  });

  test("getAction returns action by ID", () => {
    const action = engine.startCollectiveAction(groupId, "protest", "March", "Square")!;
    assert.equal(engine.getAction(action.id)!.name, "March");
  });

  test("getGroupActions returns actions for group", () => {
    engine.startCollectiveAction(groupId, "protest", "March", "Square");
    engine.startCollectiveAction(groupId, "strike", "Walkout", "Factory");
    assert.equal(engine.getGroupActions(groupId).length, 2);
  });

  test("addActionParticipant adds participant", () => {
    const action = engine.startCollectiveAction(groupId, "protest", "March", "Square")!;
    assert.equal(engine.addActionParticipant(action.id, "npc_1"), true);
    assert.equal(engine.getAction(action.id)!.participants.length, 1);
  });

  test("addActionParticipant auto-starts when 50% mobilized", () => {
    const action = engine.startCollectiveAction(groupId, "protest", "March", "Square", {
      maxParticipants: 4,
    })!;
    engine.addActionParticipant(action.id, "npc_1");
    engine.addActionParticipant(action.id, "npc_2");
    // 2/4 = 50%, should auto-start.
    assert.equal(engine.getAction(action.id)!.status, "active");
    assert.ok(engine.getAction(action.id)!.startTick !== null);
  });

  test("completeAction marks action as completed", () => {
    const action = engine.startCollectiveAction(groupId, "protest", "March", "Square")!;
    // Manually set to active for testing.
    (engine.getAction(action.id)! as any).status = "active";
    (engine.getAction(action.id)! as any).startTick = 0;
    assert.equal(engine.completeAction(action.id, true), true);
    assert.equal(engine.getAction(action.id)!.status, "completed");
  });

  test("completeAction with success=false marks as failed", () => {
    const action = engine.startCollectiveAction(groupId, "attack", "Raid", "Fort")!;
    (engine.getAction(action.id)! as any).status = "active";
    (engine.getAction(action.id)! as any).startTick = 0;
    engine.completeAction(action.id, false);
    assert.equal(engine.getAction(action.id)!.status, "failed");
  });

  test("mob group protest may turn violent", () => {
    // Create a mob group.
    const mobGroup = engine.createGroup("Mob", "crowd", {
      members: Array.from({ length: 30 }, (_, i) => ({ entityId: `m_${i}` })),
    })!;
    engine.setGroupEmotion(mobGroup.id, "angry", 95);
    for (const m of mobGroup.members) {
      engine.setMemberAnonymity(mobGroup.id, m.entityId, true);
    }
    engine.updateMobPsychology(mobGroup.id);

    // Start multiple protests to increase chance of violence.
    let violentCount = 0;
    for (let i = 0; i < 10; i++) {
      const action = engine.startCollectiveAction(mobGroup.id, "protest", `Protest ${i}`, "Street")!;
      if (action.turnedViolent) violentCount++;
    }
    // At least some should turn violent with high irrationality.
    assert.ok(violentCount > 0);
  });
});

describe("GroupBehaviorEngine - Group Decision", () => {
  let engine: GroupBehaviorEngine;
  let groupId: string;

  beforeEach(() => {
    engine = new GroupBehaviorEngine();
    const group = engine.createGroup("Council", "assembly", {
      members: [
        { entityId: "npc_1", role: "leader" },
        { entityId: "npc_2" },
        { entityId: "npc_3" },
      ],
    });
    groupId = group!.id;
  });

  test("proposeDecision creates a new decision", () => {
    const decision = engine.proposeDecision(
      groupId,
      "Should we attack?",
      [
        { id: "yes", text: "Yes, attack now" },
        { id: "no", text: "No, wait" },
      ],
      "majority_vote",
    );
    assert.ok(decision);
    assert.equal(decision!.issue, "Should we attack?");
    assert.equal(decision!.options.length, 2);
    assert.equal(decision!.status, "proposed");
    assert.equal(decision!.method, "majority_vote");
  });

  test("vote casts a vote for an option", () => {
    const decision = engine.proposeDecision(
      groupId,
      "Vote",
      [{ id: "a", text: "A" }, { id: "b", text: "B" }],
    )!;
    assert.equal(engine.vote(decision.id, "npc_1", "a"), true);
    assert.equal(engine.getDecision(decision.id)!.options[0].votes, 1);
    assert.equal(engine.getDecision(decision.id)!.votedEntities.length, 1);
  });

  test("vote rejects duplicate vote from same entity", () => {
    const decision = engine.proposeDecision(groupId, "Vote", [{ id: "a", text: "A" }])!;
    engine.vote(decision.id, "npc_1", "a");
    assert.equal(engine.vote(decision.id, "npc_1", "a"), false);
  });

  test("vote rejects invalid option", () => {
    const decision = engine.proposeDecision(groupId, "Vote", [{ id: "a", text: "A" }])!;
    assert.equal(engine.vote(decision.id, "npc_1", "invalid"), false);
  });

  test("resolveDecision with majority_vote picks most voted option", () => {
    const decision = engine.proposeDecision(
      groupId,
      "Vote",
      [{ id: "a", text: "A" }, { id: "b", text: "B" }],
      "majority_vote",
    )!;
    engine.vote(decision.id, "npc_1", "a");
    engine.vote(decision.id, "npc_2", "a");
    engine.vote(decision.id, "npc_3", "b");
    const resolved = engine.resolveDecision(decision.id)!;
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.resolvedOptionId, "a");
  });

  test("resolveDecision with no votes rejects", () => {
    const decision = engine.proposeDecision(groupId, "Vote", [{ id: "a", text: "A" }], "majority_vote")!;
    const resolved = engine.resolveDecision(decision.id)!;
    assert.equal(resolved.status, "rejected");
  });

  test("resolveDecision with leader_decides picks first option", () => {
    const decision = engine.proposeDecision(
      groupId,
      "Leader decision",
      [{ id: "x", text: "X" }, { id: "y", text: "Y" }],
      "leader_decides",
      { leaderId: "npc_1" },
    )!;
    const resolved = engine.resolveDecision(decision.id)!;
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.resolvedOptionId, "x");
  });

  test("resolveDecision with consensus requires single voted option", () => {
    const decision = engine.proposeDecision(
      groupId,
      "Consensus",
      [{ id: "a", text: "A" }, { id: "b", text: "B" }],
      "consensus",
    )!;
    engine.vote(decision.id, "npc_1", "a");
    engine.vote(decision.id, "npc_2", "b");
    const resolved = engine.resolveDecision(decision.id)!;
    assert.equal(resolved.status, "rejected"); // No consensus (split vote)
  });

  test("getDecision returns decision by ID", () => {
    const decision = engine.proposeDecision(groupId, "Vote", [{ id: "a", text: "A" }])!;
    assert.equal(engine.getDecision(decision.id)!.issue, "Vote");
  });
});

describe("GroupBehaviorEngine - Serialization", () => {
  test("serialize and deserialize preserves groups and members", () => {
    const engine1 = new GroupBehaviorEngine();
    const group = engine1.createGroup("Test", "crowd", {
      members: [{ entityId: "npc_1", role: "leader" }, { entityId: "npc_2" }],
    })!;
    engine1.setGroupEmotion(group.id, "excited", 60);
    engine1.startCollectiveAction(group.id, "protest", "March", "Square");
    engine1.proposeDecision(group.id, "Vote", [{ id: "a", text: "A" }]);

    const data = engine1.serialize();
    const engine2 = new GroupBehaviorEngine();
    engine2.deserialize(data);

    assert.equal(engine2.getActiveGroups().length, 1);
    assert.equal(engine2.getGroup(group.id)!.name, "Test");
    assert.equal(engine2.getGroup(group.id)!.members.length, 2);
    assert.equal(engine2.getGroup(group.id)!.emotionState.dominantEmotion, "excited");
  });
});

describe("GroupBehaviorEngine - Statistics", () => {
  test("getStats returns correct counts", () => {
    const engine = new GroupBehaviorEngine();
    engine.createGroup("Group 1", "crowd", {
      members: [{ entityId: "a" }, { entityId: "b" }],
    });
    engine.createGroup("Group 2", "assembly", {
      members: [{ entityId: "c" }],
    });

    const stats = engine.getStats();
    assert.equal(stats.totalGroups, 2);
    assert.equal(stats.activeGroups, 2);
    assert.equal(stats.totalMembers, 3);
    assert.equal(stats.averageGroupSize, 1.5);
  });
});

describe("GroupBehaviorEngine - Configuration", () => {
  test("uses default config when none provided", () => {
    const engine = new GroupBehaviorEngine();
    const data = engine.serialize();
    assert.deepEqual(data.config, DEFAULT_GROUP_BEHAVIOR_CONFIG);
  });

  test("accepts partial config override", () => {
    const engine = new GroupBehaviorEngine({ maxGroups: 10, mobThreshold: 50 });
    const data = engine.serialize();
    assert.equal(data.config.maxGroups, 10);
    assert.equal(data.config.mobThreshold, 50);
    assert.equal(data.config.autoSpreadEmotions, true); // default preserved
  });
});
