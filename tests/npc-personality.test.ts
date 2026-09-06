// Tests for M12 Phase 2: NPC Personality System.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NPCPersonalitySystem } from "../src/npc/NPCPersonalitySystem.js";
import {
  NEUTRAL_PERSONALITY,
  PERSONALITY_ARCHETYPES,
  DEFAULT_PERSONALITY_CONFIG,
} from "../src/npc/PersonalityTypes.js";
import { World } from "../src/engine/World.js";

describe("NPCPersonalitySystem - Profile Management", () => {
  test("setPersonality creates a profile with traits", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", {
      extraversion: 80,
      agreeableness: 60,
    });
    assert.equal(profile.entityId, "npc_1");
    assert.equal(profile.traits.extraversion, 80);
    assert.equal(profile.traits.agreeableness, 60);
    // Unspecified traits default to neutral (50).
    assert.equal(profile.traits.openness, 50);
    assert.equal(profile.traits.conscientiousness, 50);
    assert.equal(profile.traits.neuroticism, 50);
  });

  test("setPersonality clamps trait values to 0-100", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", {
      extraversion: 150,
      neuroticism: -20,
    });
    assert.equal(profile.traits.extraversion, 100);
    assert.equal(profile.traits.neuroticism, 0);
  });

  test("setPersonality auto-derives tendencies and decision style", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { extraversion: 90 });
    assert.ok(profile.tendencies.socialTendency > 0.5, "High extraversion should give high social tendency");
    assert.ok(profile.decisionStyle.socialPreference === "social" || profile.decisionStyle.socialPreference === "gregarious");
  });

  test("setPersonalityFromArchetype creates profile from preset", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonalityFromArchetype("npc_1", "socialite");
    assert.ok(profile);
    assert.equal(profile?.archetype, "socialite");
    assert.equal(profile?.traits.extraversion, 90);
  });

  test("setPersonalityFromArchetype returns null for unknown archetype", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonalityFromArchetype("npc_1", "nonexistent");
    assert.equal(profile, null);
  });

  test("getPersonality returns stored profile", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 70 });
    const profile = system.getPersonality("npc_1");
    assert.ok(profile);
    assert.equal(profile?.traits.extraversion, 70);
  });

  test("getPersonality returns undefined for unknown entity", () => {
    const system = new NPCPersonalitySystem();
    assert.equal(system.getPersonality("unknown"), undefined);
  });

  test("getOrCreatePersonality creates neutral profile if missing", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.getOrCreatePersonality("npc_1");
    assert.equal(profile.traits.extraversion, 50);
    assert.equal(profile.traits.openness, 50);
  });

  test("hasPersonality checks profile existence", () => {
    const system = new NPCPersonalitySystem();
    assert.equal(system.hasPersonality("npc_1"), false);
    system.setPersonality("npc_1", {});
    assert.equal(system.hasPersonality("npc_1"), true);
  });

  test("removePersonality deletes profile", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", {});
    assert.equal(system.removePersonality("npc_1"), true);
    assert.equal(system.hasPersonality("npc_1"), false);
  });
});

describe("NPCPersonalitySystem - Trait Modification", () => {
  test("modifyTrait changes a single trait", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 50 });
    const updated = system.modifyTrait("npc_1", "extraversion", 20);
    assert.equal(updated?.traits.extraversion, 70);
  });

  test("modifyTrait clamps to 0-100", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 90 });
    const updated = system.modifyTrait("npc_1", "extraversion", 30);
    assert.equal(updated?.traits.extraversion, 100);
  });

  test("modifyTrait re-derives tendencies", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 20 });
    const before = system.getPersonality("npc_1")?.tendencies.socialTendency ?? 0;
    system.modifyTrait("npc_1", "extraversion", 60);
    const after = system.getPersonality("npc_1")?.tendencies.socialTendency ?? 0;
    assert.ok(after > before, "Increasing extraversion should increase social tendency");
  });

  test("modifyTrait returns null for unknown entity", () => {
    const system = new NPCPersonalitySystem();
    assert.equal(system.modifyTrait("unknown", "extraversion", 10), null);
  });
});

describe("NPCPersonalitySystem - Tendency Derivation", () => {
  test("high extraversion gives high social tendency", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { extraversion: 95, agreeableness: 90 });
    assert.ok(profile.tendencies.socialTendency > 0.7);
  });

  test("low agreeableness + high extraversion gives high aggression", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { agreeableness: 10, extraversion: 90, neuroticism: 80 });
    assert.ok(profile.tendencies.aggressionTendency > 0.6);
  });

  test("high conscientiousness + low neuroticism gives high patience", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { conscientiousness: 95, neuroticism: 5 });
    assert.ok(profile.tendencies.patienceTendency > 0.7);
  });

  test("high neuroticism gives high anxiety", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { neuroticism: 95 });
    assert.ok(profile.tendencies.anxietyTendency > 0.8);
  });

  test("high extraversion + conscientiousness gives high leadership", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { extraversion: 90, conscientiousness: 85, agreeableness: 30 });
    assert.ok(profile.tendencies.leadershipTendency > 0.6);
  });

  test("neutral personality gives neutral tendencies", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", NEUTRAL_PERSONALITY);
    for (const key of Object.keys(profile.tendencies) as (keyof typeof profile.tendencies)[]) {
      assert.ok(profile.tendencies[key] >= 0.4 && profile.tendencies[key] <= 0.6,
        `Neutral ${key} should be ~0.5, got ${profile.tendencies[key]}`);
    }
  });
});

describe("NPCPersonalitySystem - Decision Style Derivation", () => {
  test("high risk tendency gives risk_seeking or reckless", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { conscientiousness: 5, openness: 95, neuroticism: 5 });
    assert.ok(["risk_seeking", "reckless"].includes(profile.decisionStyle.riskPreference));
  });

  test("low risk tendency gives risk_averse or cautious", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { conscientiousness: 95, openness: 5, neuroticism: 95 });
    assert.ok(["risk_averse", "cautious"].includes(profile.decisionStyle.riskPreference));
  });

  test("high social tendency gives social or gregarious", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { extraversion: 95, agreeableness: 90 });
    assert.ok(["social", "gregarious"].includes(profile.decisionStyle.socialPreference));
  });

  test("high aggression gives competitive conflict style", () => {
    const system = new NPCPersonalitySystem();
    const profile = system.setPersonality("npc_1", { agreeableness: 5, extraversion: 90, neuroticism: 80 });
    assert.equal(profile.decisionStyle.conflictStyle, "competitive");
  });
});

describe("NPCPersonalitySystem - Behavior Modifiers", () => {
  test("high aggression gives >1 modifier for attack", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { agreeableness: 5, extraversion: 90, neuroticism: 80 });
    const modifier = system.getBehaviorModifier("npc_1", "attack");
    assert.ok(modifier > 1.0, `Aggressive NPC should have >1 attack modifier, got ${modifier}`);
  });

  test("low aggression gives <1 modifier for attack", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { agreeableness: 95, extraversion: 10, neuroticism: 10 });
    const modifier = system.getBehaviorModifier("npc_1", "attack");
    assert.ok(modifier < 1.0, `Peaceful NPC should have <1 attack modifier, got ${modifier}`);
  });

  test("high social gives >1 modifier for talk", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 95 });
    const modifier = system.getBehaviorModifier("npc_1", "talk");
    assert.ok(modifier > 1.0);
  });

  test("high anxiety gives >1 modifier for flee", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { neuroticism: 95 });
    const modifier = system.getBehaviorModifier("npc_1", "flee");
    assert.ok(modifier > 1.0);
  });

  test("unknown entity returns neutral modifier (1.0)", () => {
    const system = new NPCPersonalitySystem();
    assert.equal(system.getBehaviorModifier("unknown", "attack"), 1.0);
  });

  test("unknown action returns neutral modifier (1.0)", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", {});
    assert.equal(system.getBehaviorModifier("npc_1", "unknown_action"), 1.0);
  });
});

describe("NPCPersonalitySystem - Memory Importance Modifiers", () => {
  test("high social gives >1 modifier for interaction memories", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 95, agreeableness: 90 });
    const modifier = system.getMemoryImportanceModifier("npc_1", "interaction");
    assert.ok(modifier > 1.0);
  });

  test("high curiosity gives >1 modifier for knowledge memories", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { openness: 95 });
    const modifier = system.getMemoryImportanceModifier("npc_1", "knowledge");
    assert.ok(modifier > 1.0);
  });
});

describe("NPCPersonalitySystem - Archetypes", () => {
  test("getArchetypeNames returns all archetypes", () => {
    const system = new NPCPersonalitySystem();
    const names = system.getArchetypeNames();
    assert.ok(names.length >= 8);
    assert.ok(names.includes("socialite"));
    assert.ok(names.includes("warrior"));
    assert.ok(names.includes("guardian"));
  });

  test("getArchetype returns trait values", () => {
    const system = new NPCPersonalitySystem();
    const archetype = system.getArchetype("explorer");
    assert.ok(archetype);
    assert.equal(archetype?.openness, 95);
  });

  test("all archetypes have valid trait values", () => {
    for (const [name, traits] of Object.entries(PERSONALITY_ARCHETYPES)) {
      for (const key of ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"] as const) {
        assert.ok(traits[key] >= 0 && traits[key] <= 100,
          `Archetype ${name} trait ${key} should be 0-100, got ${traits[key]}`);
      }
    }
  });
});

describe("NPCPersonalitySystem - Events", () => {
  test("personality.changed event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCPersonalitySystem();
    world.addSystem(system);
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("personality.changed", () => { eventReceived = true; });
    system.setPersonality("npc_1", { extraversion: 70 });
    assert.equal(eventReceived, true);
  });

  test("personality.trait_changed event is emitted on modifyTrait", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new NPCPersonalitySystem();
    world.addSystem(system);
    system.setPersonality("npc_1", { extraversion: 50 });
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("personality.trait_changed", () => { eventReceived = true; });
    system.modifyTrait("npc_1", "extraversion", 20);
    assert.equal(eventReceived, true);
  });
});

describe("NPCPersonalitySystem - Serialization", () => {
  test("serialize and deserialize preserves profiles", () => {
    const system = new NPCPersonalitySystem();
    system.setPersonality("npc_1", { extraversion: 80 });
    system.setPersonalityFromArchetype("npc_2", "warrior");

    const data = system.serialize();
    const system2 = new NPCPersonalitySystem();
    system2.deserialize(data as Record<string, unknown>);

    assert.equal(system2.getPersonality("npc_1")?.traits.extraversion, 80);
    assert.equal(system2.getPersonality("npc_2")?.archetype, "warrior");
  });
});

describe("NPCPersonalitySystem - Configuration", () => {
  test("DEFAULT_PERSONALITY_CONFIG has expected values", () => {
    assert.equal(DEFAULT_PERSONALITY_CONFIG.autoDeriveTendencies, true);
    assert.equal(DEFAULT_PERSONALITY_CONFIG.autoDeriveDecisionStyle, true);
    assert.equal(DEFAULT_PERSONALITY_CONFIG.minTrait, 0);
    assert.equal(DEFAULT_PERSONALITY_CONFIG.maxTrait, 100);
  });

  test("NEUTRAL_PERSONALITY has all 50s", () => {
    assert.equal(NEUTRAL_PERSONALITY.openness, 50);
    assert.equal(NEUTRAL_PERSONALITY.conscientiousness, 50);
    assert.equal(NEUTRAL_PERSONALITY.extraversion, 50);
    assert.equal(NEUTRAL_PERSONALITY.agreeableness, 50);
    assert.equal(NEUTRAL_PERSONALITY.neuroticism, 50);
  });

  test("disabled auto-derive gives neutral tendencies", () => {
    const system = new NPCPersonalitySystem({ autoDeriveTendencies: false, autoDeriveDecisionStyle: false });
    const profile = system.setPersonality("npc_1", { extraversion: 95 });
    assert.equal(profile.tendencies.socialTendency, 0.5);
    assert.equal(profile.decisionStyle.riskPreference, "neutral");
  });
});
