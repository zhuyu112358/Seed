// M13 InformationSpreadModel tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { InformationSpreadModel } from "../src/social/InformationSpreadModel.js";
import { DEFAULT_INFORMATION_SPREAD_CONFIG } from "../src/social/InformationSpreadTypes.js";
import type { InformationType } from "../src/social/InformationSpreadTypes.js";

describe("InformationSpreadModel - Information Management", () => {
  let model: InformationSpreadModel;

  beforeEach(() => {
    model = new InformationSpreadModel();
  });

  test("createInformation creates a new info item and infects source", () => {
    const info = model.createInformation("rumor", "The king is ill", "npc_1");
    assert.ok(info);
    assert.equal(info!.type, "rumor");
    assert.equal(info!.content, "The king is ill");
    assert.equal(info!.sourceId, "npc_1");
    assert.equal(info!.active, true);
    assert.equal(info!.totalInfected, 1);
    // Source should be infected.
    assert.equal(model.getNodeState("npc_1", info!.id), "infected");
  });

  test("createInformation accepts custom options", () => {
    const info = model.createInformation("news", "Breaking news", "npc_1", {
      sourceCredibility: 90,
      infectivity: 80,
      infectiousDuration: 100,
    });
    assert.equal(info!.sourceCredibility, 90);
    assert.equal(info!.infectivity, 80);
    assert.equal(info!.infectiousDuration, 100);
    assert.equal(info!.currentCredibility, 90);
  });

  test("createInformation enforces maxActiveInformation limit", () => {
    const limited = new InformationSpreadModel({ maxActiveInformation: 1 });
    limited.createInformation("rumor", "Rumor 1", "npc_1");
    assert.equal(limited.createInformation("rumor", "Rumor 2", "npc_2"), null);
  });

  test("getInformation returns item by ID", () => {
    const info = model.createInformation("idea", "New idea", "npc_1")!;
    assert.equal(model.getInformation(info.id)!.content, "New idea");
  });

  test("getInformation returns undefined for unknown ID", () => {
    assert.equal(model.getInformation("nonexistent"), undefined);
  });

  test("getActiveInformation returns only active items", () => {
    const info1 = model.createInformation("rumor", "Active rumor", "npc_1")!;
    const info2 = model.createInformation("news", "Active news", "npc_2")!;
    // Manually deactivate info2.
    (model.getInformation(info2.id) as any).active = false;
    assert.equal(model.getActiveInformation().length, 1);
    assert.equal(model.getActiveInformation()[0].id, info1.id);
  });
});

describe("InformationSpreadModel - Node Management", () => {
  let model: InformationSpreadModel;

  beforeEach(() => {
    model = new InformationSpreadModel();
  });

  test("getNode returns undefined for unknown entity", () => {
    assert.equal(model.getNode("npc_99"), undefined);
  });

  test("setNodeSkepticism updates skepticism", () => {
    model.setNodeSkepticism("npc_1", 80);
    assert.equal(model.getNode("npc_1")!.skepticism, 80);
  });

  test("setNodeSkepticism clamps to 0-100", () => {
    model.setNodeSkepticism("npc_1", 150);
    assert.equal(model.getNode("npc_1")!.skepticism, 100);
    model.setNodeSkepticism("npc_1", -50);
    assert.equal(model.getNode("npc_1")!.skepticism, 0);
  });

  test("setNodeInfluence updates influence", () => {
    model.setNodeInfluence("npc_1", 90);
    assert.equal(model.getNode("npc_1")!.influence, 90);
  });

  test("getNodeState returns susceptible for unknown info", () => {
    assert.equal(model.getNodeState("npc_1", "info_99"), "susceptible");
  });

  test("setNodeState updates state", () => {
    model.setNodeState("npc_1", "info_1", "exposed");
    assert.equal(model.getNodeState("npc_1", "info_1"), "exposed");
  });

  test("setNodeState infected records infection time", () => {
    model.setNodeState("npc_1", "info_1", "infected");
    const node = model.getNode("npc_1")!;
    assert.ok(node.infectedAt.has("info_1"));
  });
});

describe("InformationSpreadModel - Social Influence Network", () => {
  let model: InformationSpreadModel;

  beforeEach(() => {
    model = new InformationSpreadModel();
  });

  test("addInfluenceConnection adds connection", () => {
    model.addInfluenceConnection("npc_1", "npc_2", 80);
    const connections = model.getInfluenceConnections("npc_1");
    assert.equal(connections.size, 1);
    assert.equal(connections.get("npc_2"), 80);
  });

  test("addInfluenceConnection clamps weight to 0-100", () => {
    model.addInfluenceConnection("npc_1", "npc_2", 150);
    assert.equal(model.getInfluenceConnections("npc_1").get("npc_2"), 100);
  });

  test("getInfluenceConnections returns empty map for unknown entity", () => {
    assert.equal(model.getInfluenceConnections("npc_99").size, 0);
  });

  test("removeInfluenceConnection removes connection", () => {
    model.addInfluenceConnection("npc_1", "npc_2", 50);
    model.removeInfluenceConnection("npc_1", "npc_2");
    assert.equal(model.getInfluenceConnections("npc_1").size, 0);
  });
});

describe("InformationSpreadModel - SIR Spread", () => {
  let model: InformationSpreadModel;

  beforeEach(() => {
    model = new InformationSpreadModel({ baseInfectionRate: 1.0, mutationRate: 0 });
    // Set up a simple network with high infectivity.
    model.setNodeInfluence("npc_1", 100);
    model.setNodeSkepticism("npc_2", 0);
    model.setNodeSkepticism("npc_3", 0);
    model.addInfluenceConnection("npc_1", "npc_2", 100);
    model.addInfluenceConnection("npc_1", "npc_3", 100);
  });

  test("spreadInformation infects susceptible nodes", () => {
    const info = model.createInformation("rumor", "Test rumor", "npc_1", {
      infectivity: 100,
    })!;
    const newInfections = model.spreadInformation(info.id, "npc_1");
    assert.ok(newInfections >= 1);
    // At least npc_2 or npc_3 should be infected (probability is high).
    const state2 = model.getNodeState("npc_2", info.id);
    const state3 = model.getNodeState("npc_3", info.id);
    assert.ok(state2 === "infected" || state2 === "exposed" || state3 === "infected" || state3 === "exposed");
  });

  test("spreadInformation returns 0 for non-infected source", () => {
    const info = model.createInformation("rumor", "Test", "npc_1")!;
    // npc_2 is not infected.
    assert.equal(model.spreadInformation(info.id, "npc_2"), 0);
  });

  test("spreadInformation does not reinfect already infected nodes", () => {
    const info = model.createInformation("rumor", "Test", "npc_1", { infectivity: 100 })!;
    model.setNodeState("npc_2", info.id, "infected");
    // npc_2 already infected, should not be counted again.
    const result = model.spreadInformation(info.id, "npc_1");
    // npc_3 might be infected, npc_2 won't be double-counted.
    assert.ok(result <= 1);
  });

  test("recoverInfectedNodes recovers nodes after duration", () => {
    const info = model.createInformation("rumor", "Test", "npc_1", {
      infectiousDuration: 1,
    })!;
    // Manually advance tick to simulate time passing.
    for (let i = 0; i < 5; i++) {
      (model as any).currentTick++;
    }
    const recovered = model.recoverInfectedNodes(info.id);
    assert.ok(recovered >= 1);
    assert.equal(model.getNodeState("npc_1", info.id), "recovered");
  });

  test("checkExtinction returns true when no infected nodes", () => {
    const info = model.createInformation("rumor", "Test", "npc_1")!;
    // Recover the only infected node.
    model.setNodeState("npc_1", info.id, "recovered");
    assert.equal(model.checkExtinction(info.id), true);
    assert.equal(model.getInformation(info.id)!.active, false);
  });

  test("checkExtinction returns false when infected nodes exist", () => {
    const info = model.createInformation("rumor", "Test", "npc_1")!;
    assert.equal(model.checkExtinction(info.id), false);
    assert.equal(model.getInformation(info.id)!.active, true);
  });

  test("skeptical nodes are harder to infect", () => {
    const lowSkeptic = new InformationSpreadModel({ baseInfectionRate: 0.3, mutationRate: 0 });
    lowSkeptic.setNodeInfluence("npc_1", 50);
    lowSkeptic.setNodeSkepticism("npc_2", 0);
    lowSkeptic.addInfluenceConnection("npc_1", "npc_2", 50);
    const info1 = lowSkeptic.createInformation("rumor", "Test", "npc_1", { infectivity: 50 })!;

    const highSkeptic = new InformationSpreadModel({ baseInfectionRate: 0.3, mutationRate: 0 });
    highSkeptic.setNodeInfluence("npc_1", 50);
    highSkeptic.setNodeSkepticism("npc_2", 100);
    highSkeptic.addInfluenceConnection("npc_1", "npc_2", 50);
    const info2 = highSkeptic.createInformation("rumor", "Test", "npc_1", { infectivity: 50 })!;

    // Run multiple spread attempts and compare infection rates.
    let lowInfected = 0;
    let highInfected = 0;
    for (let i = 0; i < 100; i++) {
      lowSkeptic.setNodeState("npc_2", info1.id, "susceptible");
      highSkeptic.setNodeState("npc_2", info2.id, "susceptible");
      lowSkeptic.spreadInformation(info1.id, "npc_1");
      highSkeptic.spreadInformation(info2.id, "npc_1");
      if (lowSkeptic.getNodeState("npc_2", info1.id) === "infected") lowInfected++;
      if (highSkeptic.getNodeState("npc_2", info2.id) === "infected") highInfected++;
    }
    // Low skeptic should have more infections than high skeptic.
    assert.ok(lowInfected > highInfected, `Expected low (${lowInfected}) > high (${highInfected})`);
  });
});

describe("InformationSpreadModel - Mutation", () => {
  let model: InformationSpreadModel;

  beforeEach(() => {
    model = new InformationSpreadModel();
  });

  test("mutateInformation changes content", () => {
    const info = model.createInformation("rumor", "Original content", "npc_1")!;
    const mutation = model.mutateInformation(info.id, "npc_2");
    assert.ok(mutation);
    assert.notEqual(model.getInformation(info.id)!.content, "Original content");
    assert.ok(model.getInformation(info.id)!.content.includes("variant"));
  });

  test("mutateInformation reduces credibility", () => {
    const info = model.createInformation("rumor", "Test", "npc_1", { sourceCredibility: 90 })!;
    const initialCredibility = info.currentCredibility;
    model.mutateInformation(info.id, "npc_2");
    assert.ok(model.getInformation(info.id)!.currentCredibility < initialCredibility);
  });

  test("mutateInformation increments mutationCount", () => {
    const info = model.createInformation("rumor", "Test", "npc_1")!;
    model.mutateInformation(info.id, "npc_2");
    model.mutateInformation(info.id, "npc_3");
    assert.equal(model.getInformation(info.id)!.mutationCount, 2);
  });

  test("getMutationHistory returns all mutations", () => {
    const info = model.createInformation("rumor", "Test", "npc_1")!;
    model.mutateInformation(info.id, "npc_2");
    model.mutateInformation(info.id, "npc_3");
    assert.equal(model.getMutationHistory(info.id).length, 2);
  });

  test("mutateInformation returns null for unknown info", () => {
    assert.equal(model.mutateInformation("nonexistent", "npc_1"), null);
  });
});

describe("InformationSpreadModel - Credibility Assessment", () => {
  let model: InformationSpreadModel;

  beforeEach(() => {
    model = new InformationSpreadModel();
  });

  test("assessCredibility returns assessment for info", () => {
    const info = model.createInformation("news", "Credible news", "npc_1", {
      sourceCredibility: 90,
    })!;
    const assessment = model.assessCredibility(info.id);
    assert.ok(assessment);
    assert.equal(assessment!.infoId, info.id);
    assert.ok(assessment!.overallCredibility > 0);
    assert.equal(assessment!.sourceScore, 90);
  });

  test("rumors have lower type credibility than news", () => {
    const rumor = model.createInformation("rumor", "Rumor", "npc_1", { sourceCredibility: 70 })!;
    const news = model.createInformation("news", "News", "npc_2", { sourceCredibility: 70 })!;
    const rumorAssessment = model.assessCredibility(rumor.id)!;
    const newsAssessment = model.assessCredibility(news.id)!;
    assert.ok(newsAssessment.typeScore > rumorAssessment.typeScore);
  });

  test("mutations reduce credibility", () => {
    const info = model.createInformation("news", "Test", "npc_1", { sourceCredibility: 90 })!;
    const before = model.assessCredibility(info.id)!.overallCredibility;
    for (let i = 0; i < 5; i++) {
      model.mutateInformation(info.id, "npc_2");
    }
    const after = model.assessCredibility(info.id)!.overallCredibility;
    assert.ok(after < before);
  });

  test("knowledge has high type credibility", () => {
    const info = model.createInformation("knowledge", "Scientific fact", "npc_1", {
      sourceCredibility: 80,
    })!;
    const assessment = model.assessCredibility(info.id)!;
    assert.equal(assessment.typeScore, 90);
    assert.equal(assessment.likelyTrue, true);
  });

  test("assessCredibility returns null for unknown info", () => {
    assert.equal(model.assessCredibility("nonexistent"), null);
  });
});

describe("InformationSpreadModel - Serialization", () => {
  test("serialize and deserialize preserves information and nodes", () => {
    const model1 = new InformationSpreadModel();
    const info = model1.createInformation("rumor", "Test rumor", "npc_1", {
      sourceCredibility: 80,
    })!;
    model1.addInfluenceConnection("npc_1", "npc_2", 70);
    model1.setNodeSkepticism("npc_2", 50);
    model1.mutateInformation(info.id, "npc_1");

    const data = model1.serialize();
    const model2 = new InformationSpreadModel();
    model2.deserialize(data);

    assert.equal(model2.getAllInformation().length, 1);
    assert.equal(model2.getInformation(info.id)!.content, model1.getInformation(info.id)!.content);
    assert.equal(model2.getInformation(info.id)!.mutationCount, 1);
    assert.equal(model2.getNode("npc_1")!.influence, 30); // default
    assert.equal(model2.getNode("npc_2")!.skepticism, 50);
    assert.equal(model2.getInfluenceConnections("npc_1").get("npc_2"), 70);
  });
});

describe("InformationSpreadModel - Statistics", () => {
  test("getStats returns correct counts", () => {
    const model = new InformationSpreadModel();
    model.createInformation("rumor", "Rumor 1", "npc_1");
    model.createInformation("news", "News 1", "npc_2");
    model.createInformation("idea", "Idea 1", "npc_3");

    const stats = model.getStats();
    assert.equal(stats.totalInformation, 3);
    assert.equal(stats.activeInformation, 3);
    assert.equal(stats.totalNodes, 3);
    assert.equal(stats.totalInfected, 3); // each info infects its source
  });
});

describe("InformationSpreadModel - Configuration", () => {
  test("uses default config when none provided", () => {
    const model = new InformationSpreadModel();
    const data = model.serialize();
    assert.deepEqual(data.config, DEFAULT_INFORMATION_SPREAD_CONFIG);
  });

  test("accepts partial config override", () => {
    const model = new InformationSpreadModel({ baseInfectionRate: 0.8, mutationRate: 0.2 });
    const data = model.serialize();
    assert.equal(data.config.baseInfectionRate, 0.8);
    assert.equal(data.config.mutationRate, 0.2);
    assert.equal(data.config.autoSpread, true); // default preserved
  });
});
