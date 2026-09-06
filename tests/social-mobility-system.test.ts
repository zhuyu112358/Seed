// M13 SocialMobilitySystem tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { SocialMobilitySystem } from "../src/social/SocialMobilitySystem.js";
import { DEFAULT_SOCIAL_MOBILITY_CONFIG, SOCIAL_CLASS_RANK } from "../src/social/SocialMobilityTypes.js";
import type { SocialClass } from "../src/social/SocialMobilityTypes.js";

describe("SocialMobilitySystem - Social Status Management", () => {
  let system: SocialMobilitySystem;

  beforeEach(() => {
    system = new SocialMobilitySystem();
  });

  test("registerEntity creates a social status", () => {
    const status = system.registerEntity("npc_1", {
      socialClass: "merchant",
      prestige: 200,
      wealth: 300,
      location: "Market Town",
    });
    assert.equal(status.entityId, "npc_1");
    assert.equal(status.socialClass, "merchant");
    assert.equal(status.prestige, 200);
    assert.equal(status.wealth, 300);
    assert.equal(status.location, "Market Town");
  });

  test("registerEntity defaults to commoner with 50 prestige", () => {
    const status = system.registerEntity("npc_1");
    assert.equal(status.socialClass, "commoner");
    assert.equal(status.prestige, 50);
  });

  test("getSocialStatus returns undefined for unknown entity", () => {
    assert.equal(system.getSocialStatus("npc_99"), undefined);
  });

  test("getSocialStatus returns registered status", () => {
    system.registerEntity("npc_1", { socialClass: "noble" });
    assert.equal(system.getSocialStatus("npc_1")!.socialClass, "noble");
  });

  test("setSocialClass changes class and records history", () => {
    system.registerEntity("npc_1", { socialClass: "commoner" });
    system.setSocialClass("npc_1", "merchant", "Business success");
    const status = system.getSocialStatus("npc_1")!;
    assert.equal(status.socialClass, "merchant");
    assert.equal(status.classHistory.length, 2);
    assert.equal(status.classHistory[1].socialClass, "merchant");
  });

  test("setWealth updates wealth", () => {
    system.registerEntity("npc_1");
    system.setWealth("npc_1", 500);
    assert.equal(system.getSocialStatus("npc_1")!.wealth, 500);
  });

  test("setWealth clamps to 0-1000", () => {
    system.registerEntity("npc_1");
    system.setWealth("npc_1", 1500);
    assert.equal(system.getSocialStatus("npc_1")!.wealth, 1000);
    system.setWealth("npc_1", -100);
    assert.equal(system.getSocialStatus("npc_1")!.wealth, 0);
  });

  test("setInfluence updates influence", () => {
    system.registerEntity("npc_1");
    system.setInfluence("npc_1", 80);
    assert.equal(system.getSocialStatus("npc_1")!.influence, 80);
  });
});

describe("SocialMobilitySystem - Promotion / Demotion", () => {
  let system: SocialMobilitySystem;

  beforeEach(() => {
    system = new SocialMobilitySystem();
  });

  test("canPromote returns false with insufficient prestige", () => {
    system.registerEntity("npc_1", { socialClass: "commoner", prestige: 10 });
    assert.equal(system.canPromote("npc_1"), false);
  });

  test("canPromote returns true with sufficient prestige", () => {
    system.registerEntity("npc_1", { socialClass: "commoner", prestige: 100 });
    assert.equal(system.canPromote("npc_1"), true);
  });

  test("canPromote returns false at highest class", () => {
    system.registerEntity("npc_1", { socialClass: "royal", prestige: 1000 });
    assert.equal(system.canPromote("npc_1"), false);
  });

  test("promote advances to next class and gains prestige", () => {
    system.registerEntity("npc_1", { socialClass: "commoner", prestige: 100 });
    const result = system.promote("npc_1", "Hard work");
    assert.equal(result.success, true);
    assert.equal(result.type, "upward");
    assert.equal(result.previousClass, "commoner");
    assert.equal(result.newClass, "artisan");
    assert.ok(result.prestigeChange > 0);
    assert.equal(system.getSocialStatus("npc_1")!.socialClass, "artisan");
  });

  test("promote fails with insufficient prestige", () => {
    system.registerEntity("npc_1", { socialClass: "commoner", prestige: 10 });
    const result = system.promote("npc_1", "Trying");
    assert.equal(result.success, false);
    assert.ok(result.reason.includes("Insufficient prestige"));
  });

  test("promote fails at highest class", () => {
    system.registerEntity("npc_1", { socialClass: "royal", prestige: 1000 });
    const result = system.promote("npc_1", "Trying");
    assert.equal(result.success, false);
    assert.ok(result.reason.includes("highest class"));
  });

  test("demote lowers class and loses prestige", () => {
    system.registerEntity("npc_1", { socialClass: "noble", prestige: 500 });
    const result = system.demote("npc_1", "Scandal");
    assert.equal(result.success, true);
    assert.equal(result.type, "downward");
    assert.equal(result.previousClass, "noble");
    assert.equal(result.newClass, "clergy");
    assert.ok(result.prestigeChange < 0);
  });

  test("demote fails at lowest class", () => {
    system.registerEntity("npc_1", { socialClass: "serf", prestige: 0 });
    const result = system.demote("npc_1", "Trying");
    assert.equal(result.success, false);
    assert.ok(result.reason.includes("lowest class"));
  });

  test("SOCIAL_CLASS_RANK has correct ordering", () => {
    assert.equal(SOCIAL_CLASS_RANK.serf, 0);
    assert.equal(SOCIAL_CLASS_RANK.commoner, 1);
    assert.equal(SOCIAL_CLASS_RANK.royal, 7);
    assert.ok(SOCIAL_CLASS_RANK.noble > SOCIAL_CLASS_RANK.merchant);
  });
});

describe("SocialMobilitySystem - Prestige System", () => {
  let system: SocialMobilitySystem;

  beforeEach(() => {
    system = new SocialMobilitySystem();
    system.registerEntity("npc_1", { prestige: 100 });
  });

  test("addPrestige increases prestige", () => {
    const newPrestige = system.addPrestige("npc_1", 50, "Achievement");
    assert.equal(newPrestige, 150);
  });

  test("addPrestige clamps to max", () => {
    system.addPrestige("npc_1", 2000, "Huge achievement");
    assert.equal(system.getPrestige("npc_1"), 1000);
  });

  test("removePrestige decreases prestige", () => {
    system.removePrestige("npc_1", 30, "Penalty");
    assert.equal(system.getPrestige("npc_1"), 70);
  });

  test("removePrestige clamps to min", () => {
    system.removePrestige("npc_1", 500, "Huge penalty");
    assert.equal(system.getPrestige("npc_1"), 0);
  });

  test("getPrestige returns 0 for unknown entity", () => {
    assert.equal(system.getPrestige("npc_99"), 0);
  });
});

describe("SocialMobilitySystem - Migration", () => {
  let system: SocialMobilitySystem;

  beforeEach(() => {
    system = new SocialMobilitySystem();
    system.registerEntity("npc_1", { location: "Village A" });
  });

  test("migrate changes location", () => {
    assert.equal(system.migrate("npc_1", "City B", "Seeking work"), true);
    assert.equal(system.getSocialStatus("npc_1")!.location, "City B");
  });

  test("migrate records history", () => {
    system.migrate("npc_1", "City B", "Seeking work");
    const history = system.getMigrationHistory("npc_1");
    assert.equal(history.length, 1);
    assert.equal(history[0].from, "Village A");
    assert.equal(history[0].to, "City B");
  });

  test("migrate returns false for same location", () => {
    assert.equal(system.migrate("npc_1", "Village A", "No move"), false);
  });

  test("migrate returns false for unknown entity", () => {
    assert.equal(system.migrate("npc_99", "City", "Reason"), false);
  });

  test("getMigrationHistory returns empty for unknown entity", () => {
    assert.equal(system.getMigrationHistory("npc_99").length, 0);
  });
});

describe("SocialMobilitySystem - Intermarriage", () => {
  let system: SocialMobilitySystem;

  beforeEach(() => {
    system = new SocialMobilitySystem({ intermarriageMobility: false });
  });

  test("intermarry marries two entities", () => {
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    assert.equal(system.intermarry("npc_1", "npc_2", "Love"), true);
    assert.equal(system.getSocialStatus("npc_1")!.isMarried, true);
    assert.equal(system.getSocialStatus("npc_1")!.spouseId, "npc_2");
    assert.equal(system.getSocialStatus("npc_2")!.isMarried, true);
    assert.equal(system.getSocialStatus("npc_2")!.spouseId, "npc_1");
  });

  test("intermarry fails if already married", () => {
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    system.registerEntity("npc_3");
    system.intermarry("npc_1", "npc_2", "First");
    assert.equal(system.intermarry("npc_1", "npc_3", "Second"), false);
  });

  test("intermarry fails for same entity", () => {
    system.registerEntity("npc_1");
    assert.equal(system.intermarry("npc_1", "npc_1", "Self"), false);
  });

  test("intermarry records marriage history", () => {
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    system.intermarry("npc_1", "npc_2", "Love");
    assert.equal(system.getMarriageHistory("npc_1").length, 1);
    assert.equal(system.getMarriageHistory("npc_1")[0].spouseId, "npc_2");
  });

  test("divorce ends marriage", () => {
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    system.intermarry("npc_1", "npc_2", "Love");
    assert.equal(system.divorce("npc_1", "npc_2", "Differences"), true);
    assert.equal(system.getSocialStatus("npc_1")!.isMarried, false);
    assert.equal(system.getSocialStatus("npc_1")!.spouseId, null);
  });

  test("divorce fails if not married to each other", () => {
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    assert.equal(system.divorce("npc_1", "npc_2", "Reason"), false);
  });

  test("intermarriage promotes lower-class spouse when enabled", () => {
    const mobilitySystem = new SocialMobilitySystem({ intermarriageMobility: true });
    mobilitySystem.registerEntity("npc_1", { socialClass: "noble", prestige: 600 });
    mobilitySystem.registerEntity("npc_2", { socialClass: "commoner", prestige: 100 });
    mobilitySystem.intermarry("npc_1", "npc_2", "Royal marriage");
    // npc_2 should be promoted from commoner to artisan.
    assert.equal(mobilitySystem.getSocialStatus("npc_2")!.socialClass, "artisan");
  });
});

describe("SocialMobilitySystem - Disgrace", () => {
  let system: SocialMobilitySystem;

  beforeEach(() => {
    system = new SocialMobilitySystem();
  });

  test("disgrace demotes multiple levels", () => {
    system.registerEntity("npc_1", { socialClass: "aristocrat", prestige: 800 });
    const result = system.disgrace("npc_1", 2, "Treason");
    assert.equal(result.success, true);
    // aristocrat(6) -> demote 1 -> noble(5) -> demote 2 -> clergy(4)
    assert.equal(system.getSocialStatus("npc_1")!.socialClass, "clergy");
  });

  test("disgrace reduces prestige", () => {
    system.registerEntity("npc_1", { socialClass: "noble", prestige: 600 });
    const initialPrestige = system.getPrestige("npc_1");
    system.disgrace("npc_1", 1, "Scandal");
    assert.ok(system.getPrestige("npc_1") < initialPrestige);
  });
});

describe("SocialMobilitySystem - Serialization", () => {
  test("serialize and deserialize preserves statuses and history", () => {
    const system1 = new SocialMobilitySystem();
    system1.registerEntity("npc_1", { socialClass: "merchant", prestige: 200, location: "City" });
    system1.registerEntity("npc_2", { socialClass: "noble", prestige: 500 });
    system1.intermarry("npc_1", "npc_2", "Marriage");
    system1.migrate("npc_1", "Capital", "Relocation");
    system1.addPrestige("npc_1", 50, "Achievement");

    const data = system1.serialize();
    const system2 = new SocialMobilitySystem();
    system2.deserialize(data);

    assert.equal(system2.getSocialStatus("npc_1")!.socialClass, "merchant");
    assert.equal(system2.getSocialStatus("npc_1")!.location, "Capital");
    assert.equal(system2.getSocialStatus("npc_1")!.isMarried, true);
    assert.equal(system2.getSocialStatus("npc_2")!.socialClass, "noble");
    assert.equal(system2.getMigrationHistory("npc_1").length, 1);
  });
});

describe("SocialMobilitySystem - Statistics", () => {
  test("getStats returns correct counts", () => {
    const system = new SocialMobilitySystem();
    system.registerEntity("npc_1", { socialClass: "commoner", prestige: 100 });
    system.registerEntity("npc_2", { socialClass: "noble", prestige: 500 });
    system.registerEntity("npc_3", { socialClass: "merchant", prestige: 250 });

    const stats = system.getStats();
    assert.equal(stats.totalEntities, 3);
    assert.equal(stats.classDistribution.commoner, 1);
    assert.equal(stats.classDistribution.noble, 1);
    assert.equal(stats.classDistribution.merchant, 1);
    assert.ok(stats.averagePrestige > 0);
    assert.equal(stats.highestPrestigeEntity, "npc_2");
  });
});

describe("SocialMobilitySystem - Configuration", () => {
  test("uses default config when none provided", () => {
    const system = new SocialMobilitySystem();
    const data = system.serialize();
    assert.deepEqual(data.config, DEFAULT_SOCIAL_MOBILITY_CONFIG);
  });

  test("accepts partial config override", () => {
    const system = new SocialMobilitySystem({ prestigeDecayRate: 0.05, maxPrestige: 500 });
    const data = system.serialize();
    assert.equal(data.config.prestigeDecayRate, 0.05);
    assert.equal(data.config.maxPrestige, 500);
    assert.equal(data.config.promotionPrestigeGain, 50); // default preserved
  });
});
