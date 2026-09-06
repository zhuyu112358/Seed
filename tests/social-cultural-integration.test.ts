// M13 SocialCulturalIntegrationSystem tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { SocialCulturalIntegrationSystem } from "../src/social/SocialCulturalIntegrationSystem.js";
import { DEFAULT_SOCIAL_CULTURAL_INTEGRATION_CONFIG } from "../src/social/SocialCulturalIntegrationTypes.js";
import { SocialRelationGraph } from "../src/social/SocialRelationGraph.js";
import { SocialEventSystem } from "../src/social/SocialEventSystem.js";
import { CulturalEvolutionSystem } from "../src/social/CulturalEvolutionSystem.js";
import { NPCPersonalitySystem } from "../src/npc/NPCPersonalitySystem.js";
import { DynamicNarrativeSystem } from "../src/narrative/DynamicNarrativeSystem.js";

describe("SocialCulturalIntegrationSystem - System Registration", () => {
  let system: SocialCulturalIntegrationSystem;

  beforeEach(() => {
    system = new SocialCulturalIntegrationSystem();
  });

  test("registerSocialSystems stores M13 system references", () => {
    const relationGraph = new SocialRelationGraph();
    const eventSystem = new SocialEventSystem();
    const culturalSystem = new CulturalEvolutionSystem();
    system.registerSocialSystems(relationGraph, eventSystem, culturalSystem);
    // Should not throw.
    assert.ok(system);
  });

  test("registerM12Systems stores M12 system references", () => {
    const personality = new NPCPersonalitySystem();
    const narrative = new DynamicNarrativeSystem();
    system.registerM12Systems(personality, narrative);
    assert.ok(system);
  });
});

describe("SocialCulturalIntegrationSystem - Social Influence", () => {
  let system: SocialCulturalIntegrationSystem;
  let relationGraph: SocialRelationGraph;

  beforeEach(() => {
    system = new SocialCulturalIntegrationSystem();
    relationGraph = new SocialRelationGraph();
    system.registerSocialSystems(relationGraph, new SocialEventSystem(), new CulturalEvolutionSystem());
  });

  test("applySocialInfluence returns neutral for entity with no relations", () => {
    const result = system.applySocialInfluence("npc_1");
    assert.ok(result);
    assert.equal(result!.relationsConsidered, 0);
    assert.equal(result!.socialInfluence, 0);
    assert.equal(result!.behaviorModifier, 1.0);
  });

  test("applySocialInfluence returns null when disabled", () => {
    const disabled = new SocialCulturalIntegrationSystem({ socialInfluenceEnabled: false });
    disabled.registerSocialSystems(relationGraph, new SocialEventSystem(), new CulturalEvolutionSystem());
    assert.equal(disabled.applySocialInfluence("npc_1"), null);
  });

  test("applySocialInfluence considers positive relations", () => {
    // Add a friendship relation (strength passed directly as Partial<RelationStrength>).
    relationGraph.addRelation("npc_1", "npc_2", "friendship", "friend", {
      trust: 80, intimacy: 60, respect: 70, fear: 5, influence: 50, overallScore: 70,
    });
    const result = system.applySocialInfluence("npc_1");
    assert.ok(result);
    assert.ok(result!.relationsConsidered >= 1);
    // Positive relations should give positive influence.
    assert.ok(result!.socialInfluence > 0);
    assert.ok(result!.behaviorModifier > 1.0);
  });

  test("applySocialInfluence considers negative relations", () => {
    relationGraph.addRelation("npc_1", "npc_2", "enmity", "enemy", {
      trust: 5, intimacy: 0, respect: 10, fear: 80, influence: 60, overallScore: 30,
    });
    const result = system.applySocialInfluence("npc_1");
    assert.ok(result);
    // Negative relations should give negative influence.
    assert.ok(result!.socialInfluence < 0);
    assert.ok(result!.behaviorModifier < 1.0);
  });

  test("applySocialInfluence identifies dominant relation type", () => {
    relationGraph.addRelation("npc_1", "npc_2", "friendship", "friend");
    relationGraph.addRelation("npc_1", "npc_3", "friendship", "close_friend");
    relationGraph.addRelation("npc_1", "npc_4", "family", "sibling");
    const result = system.applySocialInfluence("npc_1");
    assert.ok(result);
    assert.equal(result!.dominantRelationType, "friendship");
  });
});

describe("SocialCulturalIntegrationSystem - Social Event to Narrative Bridge", () => {
  let system: SocialCulturalIntegrationSystem;
  let socialEventSystem: SocialEventSystem;
  let narrativeSystem: DynamicNarrativeSystem;

  beforeEach(() => {
    system = new SocialCulturalIntegrationSystem();
    socialEventSystem = new SocialEventSystem();
    narrativeSystem = new DynamicNarrativeSystem();
    system.registerSocialSystems(new SocialRelationGraph(), socialEventSystem, new CulturalEvolutionSystem());
    system.registerM12Systems(new NPCPersonalitySystem(), narrativeSystem);
  });

  test("bridgeSocialEventToNarrative returns null for unknown event", () => {
    const result = system.bridgeSocialEventToNarrative("nonexistent");
    assert.ok(result);
    assert.equal(result!.narrativeTriggered, false);
  });

  test("bridgeSocialEventToNarrative bridges a real social event", () => {
    const result = socialEventSystem.createEvent("wedding", "Royal Wedding", "Grand Cathedral")!;
    const event = result.event;
    const bridgeResult = system.bridgeSocialEventToNarrative(event.id);
    assert.ok(bridgeResult);
    assert.equal(bridgeResult!.narrativeTriggered, true);
    assert.equal(bridgeResult!.socialEventType, "wedding");
    assert.ok(bridgeResult!.narrativeEventId);
  });

  test("bridgeSocialEventToNarrative avoids duplicate bridging", () => {
    const result = socialEventSystem.createEvent("festival", "Harvest Festival", "Town Square")!;
    const event = result.event;
    const first = system.bridgeSocialEventToNarrative(event.id);
    const second = system.bridgeSocialEventToNarrative(event.id);
    assert.ok(first);
    assert.equal(first!.narrativeTriggered, true);
    assert.equal(second, null); // Already bridged.
  });

  test("bridgeSocialEventToNarrative returns null when disabled", () => {
    const disabled = new SocialCulturalIntegrationSystem({ socialNarrativeEnabled: false });
    disabled.registerSocialSystems(new SocialRelationGraph(), socialEventSystem, new CulturalEvolutionSystem());
    disabled.registerM12Systems(new NPCPersonalitySystem(), narrativeSystem);
    const event = socialEventSystem.createEvent("funeral", "State Funeral", "Royal Crypt")!;
    assert.equal(disabled.bridgeSocialEventToNarrative(event.id), null);
  });
});

describe("SocialCulturalIntegrationSystem - Cultural Influence", () => {
  let system: SocialCulturalIntegrationSystem;
  let culturalSystem: CulturalEvolutionSystem;
  let personalitySystem: NPCPersonalitySystem;

  beforeEach(() => {
    system = new SocialCulturalIntegrationSystem();
    culturalSystem = new CulturalEvolutionSystem();
    personalitySystem = new NPCPersonalitySystem();
    system.registerSocialSystems(new SocialRelationGraph(), new SocialEventSystem(), culturalSystem);
    system.registerM12Systems(personalitySystem, new DynamicNarrativeSystem());
  });

  test("applyCulturalInfluence returns null when disabled", () => {
    const disabled = new SocialCulturalIntegrationSystem({ culturalInfluenceEnabled: false });
    disabled.registerSocialSystems(new SocialRelationGraph(), new SocialEventSystem(), culturalSystem);
    disabled.registerM12Systems(personalitySystem, new DynamicNarrativeSystem());
    const culture = culturalSystem.createCulture("Test", "Culture")!;
    assert.equal(disabled.applyCulturalInfluence("npc_1", culture.id), null);
  });

  test("applyCulturalInfluence returns neutral for culture with no traits", () => {
    const culture = culturalSystem.createCulture("Empty", "Culture with no traits")!;
    const result = system.applyCulturalInfluence("npc_1", culture.id);
    assert.ok(result);
    assert.equal(result!.traitsConsidered, 0);
    assert.equal(result!.culturalInfluence, 0);
  });

  test("applyCulturalInfluence applies trait-based personality modifications", () => {
    const culture = culturalSystem.createCulture("Artistic", "Artistic culture")!;
    culturalSystem.createTrait("art", "Painting", "Visual arts", culture.id, { adaptability: 80 });
    culturalSystem.createTrait("music", "Symphony", "Orchestral music", culture.id, { adaptability: 70 });
    culturalSystem.createTrait("myth", "Creation Myth", "Ancient stories", culture.id, { adaptability: 60 });

    // Register NPC personality.
    personalitySystem.setPersonality("npc_1", { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 });

    const result = system.applyCulturalInfluence("npc_1", culture.id);
    assert.ok(result);
    assert.equal(result!.traitsConsidered, 3);
    assert.ok(result!.culturalInfluence > 0);
    // Art/music/myth should increase openness.
    assert.ok(result!.traitModifications["openness"] > 0);
  });

  test("applyCulturalInfluence maps religion to conscientiousness", () => {
    const culture = culturalSystem.createCulture("Religious", "Devout culture")!;
    culturalSystem.createTrait("religion", "Sun Worship", "Daily prayers", culture.id, { adaptability: 90 });
    culturalSystem.createTrait("ritual", "Daily Ritual", "Morning ceremony", culture.id, { adaptability: 80 });

    personalitySystem.setPersonality("npc_1", { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 });

    const result = system.applyCulturalInfluence("npc_1", culture.id);
    assert.ok(result);
    assert.ok(result!.traitModifications["conscientiousness"] > 0);
  });

  test("applyCulturalInfluence returns null for unknown culture", () => {
    const result = system.applyCulturalInfluence("npc_1", "nonexistent");
    assert.ok(result);
    assert.equal(result!.culturalInfluence, 0);
  });
});

describe("SocialCulturalIntegrationSystem - Full Sync", () => {
  let system: SocialCulturalIntegrationSystem;

  beforeEach(() => {
    system = new SocialCulturalIntegrationSystem();
    system.registerSocialSystems(new SocialRelationGraph(), new SocialEventSystem(), new CulturalEvolutionSystem());
    system.registerM12Systems(new NPCPersonalitySystem(), new DynamicNarrativeSystem());
  });

  test("sync runs all bridge operations", () => {
    const result = system.sync();
    assert.ok(result);
    assert.ok(Array.isArray(result.socialInfluences));
    assert.ok(Array.isArray(result.socialEventBridges));
    assert.ok(Array.isArray(result.culturalInfluences));
  });

  test("sync increments sync counter", () => {
    system.sync();
    system.sync();
    const stats = system.getStats();
    assert.equal(stats.totalSyncCycles, 2);
  });
});

describe("SocialCulturalIntegrationSystem - Serialization", () => {
  test("serialize and deserialize preserves config and stats", () => {
    const system1 = new SocialCulturalIntegrationSystem({ socialInfluenceWeight: 0.5 });
    system1.sync();
    system1.sync();

    const data = system1.serialize();
    const system2 = new SocialCulturalIntegrationSystem();
    system2.deserialize(data);

    assert.equal(system2.getStats().totalSyncCycles, 2);
    assert.equal((system2.serialize() as any).config.socialInfluenceWeight, 0.5);
  });
});

describe("SocialCulturalIntegrationSystem - Statistics", () => {
  test("getStats returns correct counts", () => {
    const system = new SocialCulturalIntegrationSystem();
    system.registerSocialSystems(new SocialRelationGraph(), new SocialEventSystem(), new CulturalEvolutionSystem());
    system.registerM12Systems(new NPCPersonalitySystem(), new DynamicNarrativeSystem());
    system.sync();

    const stats = system.getStats();
    assert.equal(stats.totalSyncCycles, 1);
    assert.equal(stats.activeBridges, 5); // 3 M13 + 2 M12
  });
});

describe("SocialCulturalIntegrationSystem - Configuration", () => {
  test("uses default config when none provided", () => {
    const system = new SocialCulturalIntegrationSystem();
    const data = system.serialize();
    assert.deepEqual(data.config, DEFAULT_SOCIAL_CULTURAL_INTEGRATION_CONFIG);
  });

  test("accepts partial config override", () => {
    const system = new SocialCulturalIntegrationSystem({
      socialInfluenceWeight: 0.8,
      culturalInfluenceWeight: 0.5,
      autoBridgeEvents: false,
    });
    const data = system.serialize();
    assert.equal(data.config.socialInfluenceWeight, 0.8);
    assert.equal(data.config.culturalInfluenceWeight, 0.5);
    assert.equal(data.config.autoBridgeEvents, false);
    assert.equal(data.config.socialInfluenceEnabled, true); // default preserved
  });
});
