// M13 SocialNormSystem tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { SocialNormSystem } from "../src/social/SocialNormSystem.js";
import { DEFAULT_SOCIAL_NORM_CONFIG } from "../src/social/SocialNormTypes.js";
import type {
  SocialNormType,
  NormViolationSeverity,
  SocialFeedbackType,
} from "../src/social/SocialNormTypes.js";

describe("SocialNormSystem - Norm Management", () => {
  let system: SocialNormSystem;

  beforeEach(() => {
    system = new SocialNormSystem();
  });

  test("addNorm creates a new norm", () => {
    const result = system.addNorm("custom", "Greeting", "Greet others with a nod");
    assert.equal(result.success, true);
    assert.ok(result.norm);
    assert.equal(result.norm!.type, "custom");
    assert.equal(result.norm!.name, "Greeting");
    assert.equal(result.norm!.active, true);
    assert.equal(result.norm!.complianceRate, 80); // default
  });

  test("addNorm emits established event", () => {
    const result = system.addNorm("taboo", "No stealing", "Stealing is forbidden");
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "norm.established");
    assert.equal(result.events[0].description, "Norm established: No stealing");
  });

  test("addNorm accepts custom options", () => {
    const result = system.addNorm("law", "Property rights", "Respect property ownership", {
      importance: 90,
      complianceRate: 95,
      enforcers: ["guard_1", "guard_2"],
      compliantBehavior: "respecting property",
      violatingBehavior: "stealing",
    });
    assert.equal(result.norm!.importance, 90);
    assert.equal(result.norm!.complianceRate, 95);
    assert.equal(result.norm!.enforcers.length, 2);
    assert.equal(result.norm!.violatingBehavior, "stealing");
  });

  test("addNorm enforces maxNorms limit", () => {
    const limited = new SocialNormSystem({ maxNorms: 2 });
    limited.addNorm("custom", "Norm 1", "desc");
    limited.addNorm("custom", "Norm 2", "desc");
    const result = limited.addNorm("custom", "Norm 3", "desc");
    assert.equal(result.success, false);
    assert.equal(result.failureReason, "Max norms exceeded");
  });

  test("getNorm returns norm by ID", () => {
    const result = system.addNorm("value", "Honesty", "Be honest");
    const norm = system.getNorm(result.norm!.id);
    assert.ok(norm);
    assert.equal(norm!.name, "Honesty");
  });

  test("getNorm returns undefined for unknown ID", () => {
    assert.equal(system.getNorm("nonexistent"), undefined);
  });

  test("getActiveNorms returns only active norms", () => {
    const r1 = system.addNorm("custom", "Active norm", "desc");
    const r2 = system.addNorm("custom", "Inactive norm", "desc");
    system.abolishNorm(r2.norm!.id);
    const active = system.getActiveNorms();
    assert.equal(active.length, 1);
    assert.equal(active[0].id, r1.norm!.id);
  });

  test("getNormsByType filters by type", () => {
    system.addNorm("custom", "Custom 1", "desc");
    system.addNorm("taboo", "Taboo 1", "desc");
    system.addNorm("custom", "Custom 2", "desc");
    assert.equal(system.getNormsByType("custom").length, 2);
    assert.equal(system.getNormsByType("taboo").length, 1);
    assert.equal(system.getNormsByType("law").length, 0);
  });

  test("getNormsForEntity respects scope", () => {
    system.addNorm("custom", "Everyone norm", "desc", {
      scope: { appliesTo: [] },
    });
    system.addNorm("custom", "Group norm", "desc", {
      scope: { appliesTo: ["npc_1", "npc_2"] },
    });
    system.addNorm("custom", "Excluded norm", "desc", {
      scope: { appliesTo: [], excludes: ["npc_1"] },
    });

    const npc1Norms = system.getNormsForEntity("npc_1");
    assert.equal(npc1Norms.length, 2); // everyone + group (excluded is filtered)

    const npc3Norms = system.getNormsForEntity("npc_3");
    assert.equal(npc3Norms.length, 2); // everyone + excluded (npc_3 not excluded)
  });

  test("updateNorm modifies norm properties", () => {
    const result = system.addNorm("custom", "Old name", "old desc");
    const success = system.updateNorm(result.norm!.id, {
      name: "New name",
      description: "new desc",
      importance: 75,
    });
    assert.equal(success, true);
    const updated = system.getNorm(result.norm!.id)!;
    assert.equal(updated.name, "New name");
    assert.equal(updated.description, "new desc");
    assert.equal(updated.importance, 75);
  });

  test("updateNorm returns false for unknown norm", () => {
    assert.equal(system.updateNorm("nonexistent", { name: "x" }), false);
  });

  test("abolishNorm deactivates norm", () => {
    const result = system.addNorm("custom", "To abolish", "desc");
    assert.equal(system.abolishNorm(result.norm!.id), true);
    assert.equal(system.getNorm(result.norm!.id)!.active, false);
    assert.equal(system.getActiveNorms().length, 0);
  });

  test("abolishNorm returns false for unknown norm", () => {
    assert.equal(system.abolishNorm("nonexistent"), false);
  });
});

describe("SocialNormSystem - Violation Detection", () => {
  let system: SocialNormSystem;

  beforeEach(() => {
    system = new SocialNormSystem();
  });

  test("recordViolation creates a violation record", () => {
    const normResult = system.addNorm("law", "No theft", "Theft is illegal", {
      violatingBehavior: "stealing",
      enforcers: ["guard_1"],
    });
    const violation = system.recordViolation(normResult.norm!.id, "npc_1", "npc_1 was caught stealing", "moderate");
    assert.ok(violation);
    assert.equal(violation!.violatorId, "npc_1");
    assert.equal(violation!.severity, "moderate");
    assert.equal(violation!.resolved, false);
    assert.equal(violation!.normId, normResult.norm!.id);
  });

  test("recordViolation reduces compliance rate", () => {
    const normResult = system.addNorm("custom", "Norm", "desc", { complianceRate: 90 });
    system.recordViolation(normResult.norm!.id, "npc_1", "context", "major");
    const norm = system.getNorm(normResult.norm!.id)!;
    assert.ok(norm.complianceRate < 90); // major violation reduces by 10
    assert.equal(norm.complianceRate, 80);
  });

  test("recordViolation generates social feedback", () => {
    const normResult = system.addNorm("taboo", "Sacred taboo", "desc", {
      importance: 90,
      enforcers: ["priest_1"],
    });
    system.recordViolation(normResult.norm!.id, "npc_1", "context", "major");
    const feedbacks = system.getFeedbacks();
    assert.ok(feedbacks.length >= 1);
    assert.equal(feedbacks[0].targetId, "npc_1");
    assert.ok(feedbacks[0].intensity > 0);
  });

  test("recordViolation returns null for inactive norm", () => {
    const normResult = system.addNorm("custom", "Inactive", "desc");
    system.abolishNorm(normResult.norm!.id);
    const violation = system.recordViolation(normResult.norm!.id, "npc_1", "context");
    assert.equal(violation, null);
  });

  test("recordViolation returns null for unknown norm", () => {
    assert.equal(system.recordViolation("nonexistent", "npc_1", "context"), null);
  });

  test("resolveViolation marks violation as resolved", () => {
    const normResult = system.addNorm("custom", "Norm", "desc");
    const violation = system.recordViolation(normResult.norm!.id, "npc_1", "context")!;
    assert.equal(system.resolveViolation(violation.id), true);
    assert.equal(system.getViolations().find((v) => v.id === violation.id)!.resolved, true);
  });

  test("resolveViolation returns false for already resolved", () => {
    const normResult = system.addNorm("custom", "Norm", "desc");
    const violation = system.recordViolation(normResult.norm!.id, "npc_1", "context")!;
    system.resolveViolation(violation.id);
    assert.equal(system.resolveViolation(violation.id), false);
  });

  test("getUnresolvedViolations filters correctly", () => {
    const normResult = system.addNorm("custom", "Norm", "desc");
    const v1 = system.recordViolation(normResult.norm!.id, "npc_1", "context")!;
    const v2 = system.recordViolation(normResult.norm!.id, "npc_2", "context")!;
    system.resolveViolation(v1.id);
    assert.equal(system.getUnresolvedViolations().length, 1);
    assert.equal(system.getUnresolvedViolations()[0].id, v2.id);
  });

  test("getViolationsForEntity filters by violator", () => {
    const normResult = system.addNorm("custom", "Norm", "desc");
    system.recordViolation(normResult.norm!.id, "npc_1", "context");
    system.recordViolation(normResult.norm!.id, "npc_2", "context");
    system.recordViolation(normResult.norm!.id, "npc_1", "context 2");
    assert.equal(system.getViolationsForEntity("npc_1").length, 2);
    assert.equal(system.getViolationsForEntity("npc_2").length, 1);
  });
});

describe("SocialNormSystem - Compliance Check", () => {
  let system: SocialNormSystem;

  beforeEach(() => {
    system = new SocialNormSystem();
  });

  test("checkCompliance detects violating behavior", () => {
    system.addNorm("law", "No theft", "desc", {
      violatingBehavior: "stealing",
      compliantBehavior: "respecting property",
    });
    const results = system.checkCompliance("npc_1", "npc_1 was caught stealing bread");
    assert.ok(results.length >= 1);
    assert.equal(results[0].compliant, false);
    assert.equal(results[0].normName, "No theft");
    assert.ok(results[0].violationSeverity);
  });

  test("checkCompliance detects compliant behavior", () => {
    system.addNorm("custom", "Greeting", "desc", {
      violatingBehavior: "ignoring",
      compliantBehavior: "greeting",
    });
    const results = system.checkCompliance("npc_1", "npc_1 was greeting neighbors");
    assert.ok(results.length >= 1);
    assert.equal(results[0].compliant, true);
  });

  test("checkCompliance returns empty for neutral behavior", () => {
    system.addNorm("custom", "Greeting", "desc", {
      violatingBehavior: "ignoring",
      compliantBehavior: "greeting",
    });
    const results = system.checkCompliance("npc_1", "npc_1 was walking down the street");
    assert.equal(results.length, 0);
  });

  test("checkCompliance respects entity scope", () => {
    system.addNorm("custom", "Group only", "desc", {
      scope: { appliesTo: ["npc_2"] },
      violatingBehavior: "violating",
    });
    const results = system.checkCompliance("npc_1", "npc_1 was violating the norm");
    assert.equal(results.length, 0); // npc_1 not in scope
  });
});

describe("SocialNormSystem - Social Feedback", () => {
  let system: SocialNormSystem;

  beforeEach(() => {
    system = new SocialNormSystem();
  });

  test("givePositiveFeedback creates approval feedback", () => {
    const feedback = system.givePositiveFeedback("npc_1", "praise", ["community"], 80);
    assert.equal(feedback.type, "praise");
    assert.equal(feedback.targetId, "npc_1");
    assert.equal(feedback.intensity, 80);
    assert.equal(feedback.sourceIds[0], "community");
  });

  test("givePositiveFeedback clamps intensity to 0-100", () => {
    const f1 = system.givePositiveFeedback("npc_1", "approval", ["x"], 150);
    const f2 = system.givePositiveFeedback("npc_1", "approval", ["x"], -50);
    assert.equal(f1.intensity, 100);
    assert.equal(f2.intensity, 0);
  });

  test("givePositiveFeedback increases norm compliance rate", () => {
    const normResult = system.addNorm("custom", "Norm", "desc", { complianceRate: 50 });
    system.givePositiveFeedback("npc_1", "praise", ["x"], 50, normResult.norm!.id);
    const norm = system.getNorm(normResult.norm!.id)!;
    assert.ok(norm.complianceRate > 50); // 50 + 50*0.1 = 55
  });

  test("taboo violations get harsher social response", () => {
    const tabooResult = system.addNorm("taboo", "Sacred", "desc", { importance: 90 });
    const customResult = system.addNorm("custom", "Casual", "desc", { importance: 50 });

    const tabooViolation = system.recordViolation(tabooResult.norm!.id, "npc_1", "ctx", "major")!;
    const customViolation = system.recordViolation(customResult.norm!.id, "npc_2", "ctx", "major")!;

    // Taboo major -> punishment, custom major -> ostracism
    assert.equal(tabooViolation.socialResponse, "punishment");
    assert.equal(customViolation.socialResponse, "ostracism");
  });
});

describe("SocialNormSystem - Norm Evolution", () => {
  test("evolveNorms mutates norms when autoEvolve is enabled", () => {
    const system = new SocialNormSystem({ mutationRate: 1.0, autoEvolve: true });
    system.addNorm("custom", "Evolving norm", "desc", { complianceRate: 50 });
    const mutations = system.evolveNorms();
    assert.ok(mutations >= 1);
    const history = system.getEvolutionHistory(system.getActiveNorms()[0].id);
    assert.ok(history.length >= 1);
  });

  test("evolveNorms does nothing when autoEvolve is disabled", () => {
    const system = new SocialNormSystem({ mutationRate: 1.0, autoEvolve: false });
    system.addNorm("custom", "Static norm", "desc");
    const mutations = system.evolveNorms();
    assert.equal(mutations, 0);
  });

  test("weak norms generate weakened events", () => {
    const system = new SocialNormSystem({ mutationRate: 0, autoEvolve: true, weakNormThreshold: 50 });
    system.addNorm("custom", "Weak norm", "desc", { complianceRate: 10 });
    // Run multiple times to trigger weak norm event (10% chance per tick)
    for (let i = 0; i < 20; i++) {
      system.evolveNorms();
    }
    const stats = system.getStats();
    assert.ok(stats.weakNorms >= 1);
  });
});

describe("SocialNormSystem - Serialization", () => {
  test("serialize and deserialize preserves norms and violations", () => {
    const system1 = new SocialNormSystem();
    const normResult = system1.addNorm("law", "Property", "desc", { importance: 80 });
    system1.recordViolation(normResult.norm!.id, "npc_1", "stealing", "major");
    system1.givePositiveFeedback("npc_2", "praise", ["x"], 70);

    const data = system1.serialize();
    const system2 = new SocialNormSystem();
    system2.deserialize(data);

    assert.equal(system2.getActiveNorms().length, 1);
    assert.equal(system2.getActiveNorms()[0].name, "Property");
    assert.equal(system2.getViolations().length, 1);
    assert.equal(system2.getFeedbacks().length, 2); // 1 auto from violation + 1 positive
  });
});

describe("SocialNormSystem - Statistics", () => {
  test("getStats returns correct counts", () => {
    const system = new SocialNormSystem();
    system.addNorm("custom", "Norm 1", "desc");
    system.addNorm("taboo", "Norm 2", "desc");
    system.addNorm("law", "Norm 3", "desc");

    const stats = system.getStats();
    assert.equal(stats.totalNorms, 3);
    assert.equal(stats.activeNorms, 3);
    assert.equal(stats.normsByType["custom"], 1);
    assert.equal(stats.normsByType["taboo"], 1);
    assert.equal(stats.normsByType["law"], 1);
    assert.equal(stats.totalViolations, 0);
    assert.ok(stats.averageComplianceRate > 0);
  });
});

describe("SocialNormSystem - Configuration", () => {
  test("uses default config when none provided", () => {
    const system = new SocialNormSystem();
    const data = system.serialize();
    assert.deepEqual(data.config, DEFAULT_SOCIAL_NORM_CONFIG);
  });

  test("accepts partial config override", () => {
    const system = new SocialNormSystem({ maxNorms: 50, mutationRate: 0.01 });
    const data = system.serialize();
    assert.equal(data.config.maxNorms, 50);
    assert.equal(data.config.mutationRate, 0.01);
    assert.equal(data.config.autoEvolve, true); // default preserved
  });
});
