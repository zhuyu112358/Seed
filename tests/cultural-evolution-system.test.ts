// M13 CulturalEvolutionSystem tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { CulturalEvolutionSystem } from "../src/social/CulturalEvolutionSystem.js";
import { DEFAULT_CULTURAL_EVOLUTION_CONFIG } from "../src/social/CulturalEvolutionTypes.js";
import type { CulturalTraitType } from "../src/social/CulturalEvolutionTypes.js";

describe("CulturalEvolutionSystem - Culture Management", () => {
  let system: CulturalEvolutionSystem;

  beforeEach(() => {
    system = new CulturalEvolutionSystem();
  });

  test("createCulture creates a new culture", () => {
    const culture = system.createCulture("Northern", "Northern mountain culture");
    assert.ok(culture);
    assert.equal(culture!.name, "Northern");
    assert.equal(culture!.description, "Northern mountain culture");
    assert.equal(culture!.active, true);
    assert.equal(culture!.traitIds.size, 0);
  });

  test("createCulture accepts custom options", () => {
    const culture = system.createCulture("Southern", "Southern coastal culture", {
      population: 5000,
      influence: 80,
      location: "Coast",
    });
    assert.equal(culture!.population, 5000);
    assert.equal(culture!.influence, 80);
    assert.equal(culture!.location, "Coast");
  });

  test("createCulture enforces maxCultures limit", () => {
    const limited = new CulturalEvolutionSystem({ maxCultures: 1 });
    limited.createCulture("Only", "Culture");
    assert.equal(limited.createCulture("Second", "Culture"), null);
  });

  test("getCulture returns culture by ID", () => {
    const culture = system.createCulture("Test", "Culture")!;
    assert.equal(system.getCulture(culture.id)!.name, "Test");
  });

  test("getCulture returns undefined for unknown ID", () => {
    assert.equal(system.getCulture("nonexistent"), undefined);
  });

  test("getActiveCultures returns only active cultures", () => {
    const c1 = system.createCulture("Active", "Culture")!;
    const c2 = system.createCulture("Inactive", "Culture")!;
    (system.getCulture(c2.id) as any).active = false;
    assert.equal(system.getActiveCultures().length, 1);
    assert.equal(system.getActiveCultures()[0].id, c1.id);
  });

  test("createCulture with parent registers child", () => {
    const parent = system.createCulture("Parent", "Parent culture")!;
    const child = system.createCulture("Child", "Child culture", { parentCultureId: parent.id })!;
    assert.equal(system.getCulture(parent.id)!.childCultureIds.length, 1);
    assert.equal(system.getCulture(parent.id)!.childCultureIds[0], child.id);
    assert.equal(system.getCulture(child.id)!.parentCultureId, parent.id);
  });
});

describe("CulturalEvolutionSystem - Trait Management", () => {
  let system: CulturalEvolutionSystem;
  let cultureId: string;

  beforeEach(() => {
    system = new CulturalEvolutionSystem();
    const culture = system.createCulture("Test", "Culture");
    cultureId = culture!.id;
  });

  test("createTrait creates a new trait and adds to culture", () => {
    const trait = system.createTrait("language", "Old Tongue", "Ancient language", cultureId);
    assert.ok(trait);
    assert.equal(trait!.type, "language");
    assert.equal(trait!.name, "Old Tongue");
    assert.equal(trait!.originCultureId, cultureId);
    assert.equal(trait!.followerCount, 1);
    // Trait should be added to culture.
    assert.ok(system.getCulture(cultureId)!.traitIds.has(trait!.id));
  });

  test("createTrait accepts custom options", () => {
    const trait = system.createTrait("religion", "Sun Worship", "Worship the sun", cultureId, {
      transmissibility: 90,
      adaptability: 70,
      mutationRate: 0.05,
    });
    assert.equal(trait!.transmissibility, 90);
    assert.equal(trait!.adaptability, 70);
    assert.equal(trait!.mutationRate, 0.05);
  });

  test("getTrait returns trait by ID", () => {
    const trait = system.createTrait("art", "Cave Painting", "Ancient art", cultureId)!;
    assert.equal(system.getTrait(trait.id)!.name, "Cave Painting");
  });

  test("getTraitsForCulture returns all traits for culture", () => {
    system.createTrait("language", "Lang1", "Desc", cultureId);
    system.createTrait("religion", "Rel1", "Desc", cultureId);
    system.createTrait("art", "Art1", "Desc", cultureId);
    assert.equal(system.getTraitsForCulture(cultureId).length, 3);
  });

  test("addTraitToCulture adds existing trait", () => {
    const culture2 = system.createCulture("Other", "Culture")!;
    const trait = system.createTrait("music", "Drumming", "Tribal music", cultureId)!;
    assert.equal(system.addTraitToCulture(culture2.id, trait.id), true);
    assert.equal(system.getTraitsForCulture(culture2.id).length, 1);
    assert.equal(system.getTrait(trait.id)!.followerCount, 2);
  });

  test("addTraitToCulture rejects duplicate", () => {
    const trait = system.createTrait("food", "Bread", "Staple food", cultureId)!;
    assert.equal(system.addTraitToCulture(cultureId, trait.id), false);
  });

  test("removeTraitFromCulture removes trait", () => {
    const trait = system.createTrait("dress", "Robe", "Traditional robe", cultureId)!;
    assert.equal(system.removeTraitFromCulture(cultureId, trait.id), true);
    assert.equal(system.getTraitsForCulture(cultureId).length, 0);
    assert.equal(system.getTrait(trait.id)!.followerCount, 0);
  });
});

describe("CulturalEvolutionSystem - Transmission", () => {
  let system: CulturalEvolutionSystem;
  let cultureAId: string;
  let cultureBId: string;

  beforeEach(() => {
    system = new CulturalEvolutionSystem({ baseTransmissionRate: 1.0 });
    const cultureA = system.createCulture("Culture A", "First culture", { influence: 100 });
    const cultureB = system.createCulture("Culture B", "Second culture", { influence: 100 });
    cultureAId = cultureA!.id;
    cultureBId = cultureB!.id;
  });

  test("transmitTrait transmits trait from A to B", () => {
    const trait = system.createTrait("language", "Common Tongue", "Trade language", cultureAId, {
      transmissibility: 100,
      adaptability: 100,
    })!;
    // Run multiple attempts to ensure success.
    let success = false;
    for (let i = 0; i < 10; i++) {
      if (system.transmitTrait(trait.id, cultureAId, cultureBId)) {
        success = true;
        break;
      }
    }
    assert.equal(success, true);
    assert.ok(system.getCulture(cultureBId)!.traitIds.has(trait.id));
  });

  test("transmitTrait fails if source doesn't have trait", () => {
    const trait = system.createTrait("art", "Art", "Desc", cultureAId)!;
    assert.equal(system.transmitTrait(trait.id, cultureBId, cultureAId), false);
  });

  test("transmitTrait fails if target already has trait", () => {
    const trait = system.createTrait("music", "Music", "Desc", cultureAId)!;
    system.addTraitToCulture(cultureBId, trait.id);
    assert.equal(system.transmitTrait(trait.id, cultureAId, cultureBId), false);
  });
});

describe("CulturalEvolutionSystem - Mutation", () => {
  let system: CulturalEvolutionSystem;
  let cultureId: string;

  beforeEach(() => {
    system = new CulturalEvolutionSystem();
    const culture = system.createCulture("Test", "Culture");
    cultureId = culture!.id;
  });

  test("mutateTrait changes trait name", () => {
    const trait = system.createTrait("ritual", "Sun Ritual", "Daily sun worship", cultureId)!;
    const originalName = trait.name;
    const mutation = system.mutateTrait(trait.id, cultureId);
    assert.ok(mutation);
    assert.notEqual(system.getTrait(trait.id)!.name, originalName);
    assert.ok(system.getTrait(trait.id)!.name.includes("variant"));
  });

  test("mutateTrait records mutation history", () => {
    const trait = system.createTrait("myth", "Creation Myth", "World creation story", cultureId)!;
    system.mutateTrait(trait.id, cultureId);
    system.mutateTrait(trait.id, cultureId);
    assert.equal(system.getTrait(trait.id)!.mutationHistory.length, 2);
  });

  test("mutateTrait returns null if culture doesn't have trait", () => {
    const culture2 = system.createCulture("Other", "Culture")!;
    const trait = system.createTrait("value", "Honor", "Core value", cultureId)!;
    assert.equal(system.mutateTrait(trait.id, culture2), null);
  });

  test("mutateTrait increases mutation rate", () => {
    const trait = system.createTrait("holiday", "Harvest Fest", "Annual festival", cultureId, {
      mutationRate: 0.01,
    })!;
    const initialRate = trait.mutationRate;
    system.mutateTrait(trait.id, cultureId);
    assert.ok(system.getTrait(trait.id)!.mutationRate > initialRate);
  });
});

describe("CulturalEvolutionSystem - Selection", () => {
  let system: CulturalEvolutionSystem;
  let cultureId: string;

  beforeEach(() => {
    system = new CulturalEvolutionSystem({ selectionThreshold: 30 });
    const culture = system.createCulture("Test", "Culture");
    cultureId = culture!.id;
  });

  test("selectTraits prunes low-adaptability traits", () => {
    system.createTrait("language", "Good Lang", "Adaptable language", cultureId, { adaptability: 80 });
    system.createTrait("ritual", "Bad Ritual", "Poorly adapted ritual", cultureId, { adaptability: 10 });
    const pruned = system.selectTraits(cultureId);
    assert.equal(pruned, 1);
    assert.equal(system.getTraitsForCulture(cultureId).length, 1);
    assert.equal(system.getTraitsForCulture(cultureId)[0].name, "Good Lang");
  });

  test("selectTraits keeps high-adaptability traits", () => {
    system.createTrait("art", "Great Art", "Highly adaptable", cultureId, { adaptability: 90 });
    system.createTrait("music", "Great Music", "Also adaptable", cultureId, { adaptability: 70 });
    const pruned = system.selectTraits(cultureId);
    assert.equal(pruned, 0);
    assert.equal(system.getTraitsForCulture(cultureId).length, 2);
  });
});

describe("CulturalEvolutionSystem - Cultural Distance", () => {
  let system: CulturalEvolutionSystem;
  let cultureAId: string;
  let cultureBId: string;

  beforeEach(() => {
    system = new CulturalEvolutionSystem();
    const cultureA = system.createCulture("Culture A", "First");
    const cultureB = system.createCulture("Culture B", "Second");
    cultureAId = cultureA!.id;
    cultureBId = cultureB!.id;
  });

  test("getCulturalDistance returns 0 for identical cultures", () => {
    const trait = system.createTrait("language", "Shared", "Shared language", cultureAId)!;
    system.addTraitToCulture(cultureBId, trait.id);
    const result = system.getCulturalDistance(cultureAId, cultureBId)!;
    assert.equal(result.distance, 0);
    assert.equal(result.sharedTraits, 1);
  });

  test("getCulturalDistance returns high for different cultures", () => {
    system.createTrait("language", "Lang A", "Language A", cultureAId);
    system.createTrait("religion", "Rel B", "Religion B", cultureBId);
    const result = system.getCulturalDistance(cultureAId, cultureBId)!;
    assert.ok(result.distance > 0);
    assert.equal(result.sharedTraits, 0);
    assert.equal(result.uniqueToA, 1);
    assert.equal(result.uniqueToB, 1);
  });

  test("getCulturalDistance returns null for unknown culture", () => {
    assert.equal(system.getCulturalDistance(cultureAId, "nonexistent"), null);
  });
});

describe("CulturalEvolutionSystem - Cultural Fusion", () => {
  let system: CulturalEvolutionSystem;
  let cultureAId: string;
  let cultureBId: string;

  beforeEach(() => {
    system = new CulturalEvolutionSystem();
    const cultureA = system.createCulture("Culture A", "First", { population: 1000, influence: 60 });
    const cultureB = system.createCulture("Culture B", "Second", { population: 2000, influence: 40 });
    cultureAId = cultureA!.id;
    cultureBId = cultureB!.id;
  });

  test("mergeCultures creates a new fused culture", () => {
    system.createTrait("language", "Lang A", "Language A", cultureAId);
    system.createTrait("religion", "Rel B", "Religion B", cultureBId);
    const result = system.mergeCultures(cultureAId, cultureBId, "Fused", "Fused culture");
    assert.equal(result.success, true);
    assert.ok(result.mergedCultureId);
    assert.equal(result.traitsCombined, 2);
    // Original cultures should be deactivated.
    assert.equal(system.getCulture(cultureAId)!.active, false);
    assert.equal(system.getCulture(cultureBId)!.active, false);
    // Fused culture should have combined population.
    const fused = system.getCulture(result.mergedCultureId!)!;
    assert.equal(fused.population, 3000);
  });

  test("mergeCultures fails for unknown culture", () => {
    const result = system.mergeCultures(cultureAId, "nonexistent", "Fused", "Desc");
    assert.equal(result.success, false);
  });
});

describe("CulturalEvolutionSystem - Serialization", () => {
  test("serialize and deserialize preserves cultures and traits", () => {
    const system1 = new CulturalEvolutionSystem();
    const culture = system1.createCulture("Test", "Culture", { population: 5000 })!;
    const trait = system1.createTrait("language", "Old Tongue", "Ancient", culture.id, {
      transmissibility: 80,
    })!;
    system1.mutateTrait(trait.id, culture.id);

    const data = system1.serialize();
    const system2 = new CulturalEvolutionSystem();
    system2.deserialize(data);

    assert.equal(system2.getAllCultures().length, 1);
    assert.equal(system2.getCulture(culture.id)!.name, "Test");
    assert.equal(system2.getCulture(culture.id)!.population, 5000);
    assert.equal(system2.getTrait(trait.id)!.mutationHistory.length, 1);
    assert.ok(system2.getCulture(culture.id)!.traitIds.has(trait.id));
  });
});

describe("CulturalEvolutionSystem - Statistics", () => {
  test("getStats returns correct counts", () => {
    const system = new CulturalEvolutionSystem();
    const c1 = system.createCulture("Culture 1", "First")!;
    const c2 = system.createCulture("Culture 2", "Second")!;
    system.createTrait("language", "Lang1", "Desc", c1.id);
    system.createTrait("religion", "Rel1", "Desc", c1.id);
    system.createTrait("art", "Art1", "Desc", c2.id);

    const stats = system.getStats();
    assert.equal(stats.totalCultures, 2);
    assert.equal(stats.activeCultures, 2);
    assert.equal(stats.totalTraits, 3);
    assert.equal(stats.activeTraits, 3);
  });
});

describe("CulturalEvolutionSystem - Configuration", () => {
  test("uses default config when none provided", () => {
    const system = new CulturalEvolutionSystem();
    const data = system.serialize();
    assert.deepEqual(data.config, DEFAULT_CULTURAL_EVOLUTION_CONFIG);
  });

  test("accepts partial config override", () => {
    const system = new CulturalEvolutionSystem({ baseMutationRate: 0.05, maxCultures: 20 });
    const data = system.serialize();
    assert.equal(data.config.baseMutationRate, 0.05);
    assert.equal(data.config.maxCultures, 20);
    assert.equal(data.config.autoTransmit, true); // default preserved
  });
});
