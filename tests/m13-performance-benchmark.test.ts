/**
 * M13 Social Simulation Systems - Performance Benchmark Tests
 *
 * Measures performance of all 8 M13 social simulation systems under
 * large-scale scenarios. Validates that systems remain performant
 * with hundreds of entities and thousands of operations.
 *
 * Performance thresholds are intentionally generous to avoid flaky
 * tests in CI environments. These tests serve as regression guards
 * rather than absolute performance guarantees.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SocialRelationGraph } from '../src/social/SocialRelationGraph.js';
import { SocialNormSystem } from '../src/social/SocialNormSystem.js';
import { SocialEventSystem } from '../src/social/SocialEventSystem.js';
import { GroupBehaviorEngine } from '../src/social/GroupBehaviorEngine.js';
import { InformationSpreadModel } from '../src/social/InformationSpreadModel.js';
import { SocialMobilitySystem } from '../src/social/SocialMobilitySystem.js';
import { CulturalEvolutionSystem } from '../src/social/CulturalEvolutionSystem.js';
import { SocialCulturalIntegrationSystem } from '../src/social/SocialCulturalIntegrationSystem.js';

// Performance thresholds (milliseconds) - generous for CI environments
const THRESHOLDS = {
  relationAdd1000: 500,
  relationPathQuery100: 200,
  normAdd500: 300,
  normViolation100: 200,
  eventCreate100: 300,
  eventTick100: 200,
  groupCreate50: 200,
  groupTick50: 300,
  infoSpread100Nodes: 500,
  infoTick100: 300,
  mobilityRegister500: 300,
  mobilityPromote100: 200,
  cultureCreate50: 200,
  cultureTick50: 300,
  integrationSync100: 300,
  serializeLarge: 500,
  deserializeLarge: 500,
};

// Helper: measure execution time of a function
function measureTime(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // Convert to milliseconds
}

// Helper: generate entity IDs
function generateEntityIds(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}_${i}`);
}

describe('M13 Performance Benchmark - SocialRelationGraph', () => {
  it('should add 1000 relations within threshold', () => {
    const graph = new SocialRelationGraph();
    const entities = generateEntityIds(100, 'npc');

    const elapsed = measureTime(() => {
      for (let i = 0; i < 1000; i++) {
        const a = entities[i % entities.length];
        const b = entities[(i + 1) % entities.length];
        if (a !== b) {
          graph.addRelation(a, b, 'friendship', 'friend', {
            trust: 50 + (i % 30),
            intimacy: 30 + (i % 20),
            respect: 40 + (i % 25),
            influence: 20 + (i % 15),
          });
        }
      }
    });

    assert.ok(elapsed < THRESHOLDS.relationAdd1000,
      `Adding 1000 relations took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.relationAdd1000}ms`);
  });

  it('should perform 100 social path queries within threshold', () => {
    const graph = new SocialRelationGraph();
    const entities = generateEntityIds(50, 'npc');

    // Build a chain: npc_0 -> npc_1 -> ... -> npc_49
    for (let i = 0; i < 49; i++) {
      graph.addRelation(entities[i], entities[i + 1], 'friendship', 'friend', {
        trust: 60, intimacy: 40, respect: 50, influence: 30,
      });
    }

    const elapsed = measureTime(() => {
      for (let i = 0; i < 100; i++) {
        const source = entities[i % 25];
        const target = entities[25 + (i % 25)];
        graph.findSocialPath(source, target, 50);
      }
    });

    assert.ok(elapsed < THRESHOLDS.relationPathQuery100,
      `100 path queries took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.relationPathQuery100}ms`);
  });

  it('should detect groups in large graph within threshold', () => {
    const graph = new SocialRelationGraph();
    const entities = generateEntityIds(100, 'npc');

    // Create 5 groups of 20 entities each
    for (let g = 0; g < 5; g++) {
      for (let i = 0; i < 20; i++) {
        for (let j = i + 1; j < 20; j++) {
          graph.addRelation(
            entities[g * 20 + i],
            entities[g * 20 + j],
            'friendship', 'close_friend',
            { trust: 80, intimacy: 70, respect: 75, influence: 60 }
          );
        }
      }
    }

    const elapsed = measureTime(() => {
      graph.detectGroups(60);
    });

    assert.ok(elapsed < 500,
      `Group detection took ${elapsed.toFixed(2)}ms, threshold 500ms`);
  });
});

describe('M13 Performance Benchmark - SocialNormSystem', () => {
  it('should add 500 norms within threshold', () => {
    const system = new SocialNormSystem();

    const elapsed = measureTime(() => {
      for (let i = 0; i < 500; i++) {
        const types = ['custom', 'taboo', 'value', 'tradition', 'etiquette', 'law'] as const;
        system.addNorm(types[i % 6], `norm_${i}`, `Description for norm ${i}`);
      }
    });

    assert.ok(elapsed < THRESHOLDS.normAdd500,
      `Adding 500 norms took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.normAdd500}ms`);
  });

  it('should record 100 violations within threshold', () => {
    const system = new SocialNormSystem();
    const entities = generateEntityIds(20, 'npc');

    for (let i = 0; i < 50; i++) {
      system.addNorm('custom', `norm_${i}`, `Norm ${i}`);
    }

    const norms = system.getActiveNorms();

    const elapsed = measureTime(() => {
      for (let i = 0; i < 100; i++) {
        const norm = norms[i % norms.length];
        const entity = entities[i % entities.length];
        system.recordViolation(norm.id, entity, `Violation ${i}`, 'minor');
      }
    });

    assert.ok(elapsed < THRESHOLDS.normViolation100,
      `100 violations took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.normViolation100}ms`);
  });
});

describe('M13 Performance Benchmark - SocialEventSystem', () => {
  it('should create 100 events within threshold', () => {
    const system = new SocialEventSystem();

    const elapsed = measureTime(() => {
      for (let i = 0; i < 100; i++) {
        const types = ['wedding', 'funeral', 'festival', 'celebration', 'gathering',
          'conflict', 'war', 'migration', 'birth', 'coming_of_age',
          'graduation', 'coronation', 'treaty', 'trade_fair',
          'religious_ceremony', 'protest', 'riot', 'diplomatic_meeting'] as const;
        system.createEvent(types[i % 18], `event_${i}`, `Event ${i} description`);
      }
    });

    assert.ok(elapsed < THRESHOLDS.eventCreate100,
      `Creating 100 events took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.eventCreate100}ms`);
  });

  it('should tick 100 events within threshold', () => {
    const system = new SocialEventSystem();
    const events: string[] = [];

    for (let i = 0; i < 100; i++) {
      const result = system.createEvent('festival', `event_${i}`, `Event ${i}`, {
        durationTicks: 10 + (i % 20),
      });
      if (result.event) events.push(result.event.id);
    }

    // Add participants
    const entities = generateEntityIds(20, 'npc');
    for (const eventId of events.slice(0, 50)) {
      for (const entity of entities.slice(0, 5)) {
        system.addParticipant(eventId, entity, 'attendee');
      }
    }

    const elapsed = measureTime(() => {
      for (let tick = 0; tick < 30; tick++) {
        system.tick(1 / 60, null as any, null as any);
      }
    });

    assert.ok(elapsed < THRESHOLDS.eventTick100,
      `Ticking 100 events for 30 frames took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.eventTick100}ms`);
  });
});

describe('M13 Performance Benchmark - GroupBehaviorEngine', () => {
  it('should create 50 groups with 20 members each within threshold', () => {
    const engine = new GroupBehaviorEngine();

    const elapsed = measureTime(() => {
      for (let g = 0; g < 50; g++) {
        const group = engine.createGroup(`group_${g}`, 'community');
        for (let m = 0; m < 20; m++) {
          engine.addMember(group.id, `npc_${g}_${m}`, 50 + (m % 30));
        }
      }
    });

    assert.ok(elapsed < THRESHOLDS.groupCreate50,
      `Creating 50 groups with 1000 members took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.groupCreate50}ms`);
  });

  it('should tick 50 groups within threshold', () => {
    const engine = new GroupBehaviorEngine();

    for (let g = 0; g < 50; g++) {
      const group = engine.createGroup(`group_${g}`, 'community');
      for (let m = 0; m < 10; m++) {
        engine.addMember(group.id, `npc_${g}_${m}`, 50);
      }
      engine.setGroupEmotion(group.id, 'excited', 60);
    }

    const elapsed = measureTime(() => {
      for (let tick = 0; tick < 20; tick++) {
        engine.tick(1 / 60, null as any, null as any);
      }
    });

    assert.ok(elapsed < THRESHOLDS.groupTick50,
      `Ticking 50 groups for 20 frames took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.groupTick50}ms`);
  });
});

describe('M13 Performance Benchmark - InformationSpreadModel', () => {
  it('should spread information across 100 nodes within threshold', () => {
    const model = new InformationSpreadModel();
    const nodes = generateEntityIds(100, 'npc');

    // Create fully connected network (simplified: each node connects to 10 others)
    for (let i = 0; i < 100; i++) {
      model.setNodeInfluence(nodes[i], 50);
      model.setNodeSkepticism(nodes[i], 30);
      for (let j = 1; j <= 10; j++) {
        const target = nodes[(i + j) % 100];
        model.addInfluenceConnection(nodes[i], target, 50);
      }
    }

    const info = model.createInformation('rumor', 'Test rumor', nodes[0], {
      infectivity: 80, sourceCredibility: 70,
    });

    const elapsed = measureTime(() => {
      for (let tick = 0; tick < 50; tick++) {
        if (info) model.tick(1 / 60, null as any, null as any);
      }
    });

    assert.ok(elapsed < THRESHOLDS.infoSpread100Nodes,
      `Spreading info across 100 nodes for 50 ticks took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.infoSpread100Nodes}ms`);
  });

  it('should handle 50 concurrent information items within threshold', () => {
    const model = new InformationSpreadModel();
    const nodes = generateEntityIds(50, 'npc');

    for (let i = 0; i < 50; i++) {
      model.setNodeInfluence(nodes[i], 50);
      model.setNodeSkepticism(nodes[i], 30);
    }

    // Create 50 information items
    for (let i = 0; i < 50; i++) {
      model.createInformation('news', `News ${i}`, nodes[i % 50], {
        infectivity: 60, sourceCredibility: 50,
      });
    }

    const elapsed = measureTime(() => {
      for (let tick = 0; tick < 20; tick++) {
        model.tick(1 / 60, null as any, null as any);
      }
    });

    assert.ok(elapsed < THRESHOLDS.infoTick100,
      `Ticking 50 info items for 20 frames took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.infoTick100}ms`);
  });
});

describe('M13 Performance Benchmark - SocialMobilitySystem', () => {
  it('should register 500 entities within threshold', () => {
    const system = new SocialMobilitySystem();

    const elapsed = measureTime(() => {
      for (let i = 0; i < 500; i++) {
        system.registerEntity(`npc_${i}`, {
          socialClass: 'commoner',
          wealth: 100 + (i % 500),
          influence: 20 + (i % 30),
        });
      }
    });

    assert.ok(elapsed < THRESHOLDS.mobilityRegister500,
      `Registering 500 entities took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.mobilityRegister500}ms`);
  });

  it('should promote 100 entities within threshold', () => {
    const system = new SocialMobilitySystem();

    for (let i = 0; i < 100; i++) {
      system.registerEntity(`npc_${i}`, { socialClass: 'serf', wealth: 50, influence: 10 });
      system.addPrestige(`npc_${i}`, 500, 'benchmark');
    }

    const elapsed = measureTime(() => {
      for (let i = 0; i < 100; i++) {
        system.promote(`npc_${i}`, 'benchmark promotion');
      }
    });

    assert.ok(elapsed < THRESHOLDS.mobilityPromote100,
      `Promoting 100 entities took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.mobilityPromote100}ms`);
  });
});

describe('M13 Performance Benchmark - CulturalEvolutionSystem', () => {
  it('should create 50 cultures with 10 traits each within threshold', () => {
    const system = new CulturalEvolutionSystem();

    const elapsed = measureTime(() => {
      for (let c = 0; c < 50; c++) {
        const culture = system.createCulture(`culture_${c}`, `Culture ${c}`);
        if (culture) {
          for (let t = 0; t < 10; t++) {
            const trait = system.createTrait(
              'custom', `trait_${c}_${t}`, `Trait ${t} of culture ${c}`,
              culture.id, { transmissibility: 50, adaptability: 50 }
            );
            if (trait) system.addTraitToCulture(culture.id, trait.id);
          }
        }
      }
    });

    assert.ok(elapsed < THRESHOLDS.cultureCreate50,
      `Creating 50 cultures with 500 traits took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.cultureCreate50}ms`);
  });

  it('should tick 50 cultures within threshold', () => {
    const system = new CulturalEvolutionSystem();

    for (let c = 0; c < 50; c++) {
      const culture = system.createCulture(`culture_${c}`, `Culture ${c}`, {
        influence: 50, population: 1000,
      });
      if (culture) {
        for (let t = 0; t < 5; t++) {
          const trait = system.createTrait(
            'custom', `trait_${c}_${t}`, `Trait ${t}`,
            culture.id, { transmissibility: 50, adaptability: 50 }
          );
          if (trait) system.addTraitToCulture(culture.id, trait.id);
        }
      }
    }

    const elapsed = measureTime(() => {
      for (let tick = 0; tick < 20; tick++) {
        system.tick(1 / 60, null as any, null as any);
      }
    });

    assert.ok(elapsed < THRESHOLDS.cultureTick50,
      `Ticking 50 cultures for 20 frames took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.cultureTick50}ms`);
  });
});

describe('M13 Performance Benchmark - SocialCulturalIntegrationSystem', () => {
  it('should sync 100 entities within threshold', () => {
    const integration = new SocialCulturalIntegrationSystem();
    const relationGraph = new SocialRelationGraph();
    const eventSystem = new SocialEventSystem();
    const culturalSystem = new CulturalEvolutionSystem();

    integration.registerSocialSystems(relationGraph, eventSystem, culturalSystem);

    // Setup: 100 entities with relations
    const entities = generateEntityIds(100, 'npc');
    for (let i = 0; i < 100; i++) {
      for (let j = i + 1; j < Math.min(i + 5, 100); j++) {
        relationGraph.addRelation(entities[i], entities[j], 'friendship', 'friend', {
          trust: 50, intimacy: 30, respect: 40, influence: 20,
        });
      }
    }

    // Create some social events
    for (let i = 0; i < 20; i++) {
      eventSystem.createEvent('festival', `event_${i}`, `Event ${i}`);
    }

    const elapsed = measureTime(() => {
      for (let sync = 0; sync < 10; sync++) {
        integration.sync();
      }
    });

    assert.ok(elapsed < THRESHOLDS.integrationSync100,
      `10 sync cycles with 100 entities took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.integrationSync100}ms`);
  });
});

describe('M13 Performance Benchmark - Serialization', () => {
  it('should serialize large SocialRelationGraph within threshold', () => {
    const graph = new SocialRelationGraph();
    const entities = generateEntityIds(100, 'npc');

    for (let i = 0; i < 500; i++) {
      const a = entities[i % entities.length];
      const b = entities[(i + 3) % entities.length];
      if (a !== b) {
        graph.addRelation(a, b, 'friendship', 'friend', {
          trust: 50, intimacy: 30, respect: 40, influence: 20,
        });
      }
    }

    const elapsed = measureTime(() => {
      graph.serialize();
    });

    assert.ok(elapsed < THRESHOLDS.serializeLarge,
      `Serializing 500 relations took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.serializeLarge}ms`);
  });

  it('should deserialize large SocialRelationGraph within threshold', () => {
    const graph = new SocialRelationGraph();
    const entities = generateEntityIds(100, 'npc');

    for (let i = 0; i < 500; i++) {
      const a = entities[i % entities.length];
      const b = entities[(i + 3) % entities.length];
      if (a !== b) {
        graph.addRelation(a, b, 'friendship', 'friend', {
          trust: 50, intimacy: 30, respect: 40, influence: 20,
        });
      }
    }

    const serialized = graph.serialize();
    const newGraph = new SocialRelationGraph();

    const elapsed = measureTime(() => {
      newGraph.deserialize(serialized);
    });

    assert.ok(elapsed < THRESHOLDS.deserializeLarge,
      `Deserializing 500 relations took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.deserializeLarge}ms`);
  });

  it('should serialize large GroupBehaviorEngine within threshold', () => {
    const engine = new GroupBehaviorEngine();

    for (let g = 0; g < 30; g++) {
      const group = engine.createGroup(`group_${g}`, 'community');
      for (let m = 0; m < 15; m++) {
        engine.addMember(group.id, `npc_${g}_${m}`, 50);
      }
      engine.setGroupEmotion(group.id, 'calm', 50);
    }

    const elapsed = measureTime(() => {
      engine.serialize();
    });

    assert.ok(elapsed < THRESHOLDS.serializeLarge,
      `Serializing 30 groups with 450 members took ${elapsed.toFixed(2)}ms, threshold ${THRESHOLDS.serializeLarge}ms`);
  });
});

describe('M13 Performance Benchmark - Full Ecosystem', () => {
  it('should run full M13 ecosystem with 50 entities within threshold', () => {
    const relationGraph = new SocialRelationGraph();
    const normSystem = new SocialNormSystem();
    const eventSystem = new SocialEventSystem();
    const groupEngine = new GroupBehaviorEngine();
    const infoModel = new InformationSpreadModel();
    const mobilitySystem = new SocialMobilitySystem();
    const culturalSystem = new CulturalEvolutionSystem();
    const integration = new SocialCulturalIntegrationSystem();

    integration.registerSocialSystems(relationGraph, eventSystem, culturalSystem);

    const entities = generateEntityIds(50, 'npc');

    // Setup all systems
    for (const entity of entities) {
      mobilitySystem.registerEntity(entity, { socialClass: 'commoner', wealth: 100, influence: 30 });
      infoModel.setNodeInfluence(entity, 50);
      infoModel.setNodeSkepticism(entity, 30);
    }

    // Create relations
    for (let i = 0; i < 100; i++) {
      const a = entities[i % entities.length];
      const b = entities[(i + 1) % entities.length];
      relationGraph.addRelation(a, b, 'friendship', 'friend', {
        trust: 50, intimacy: 30, respect: 40, influence: 20,
      });
    }

    // Create norms
    for (let i = 0; i < 20; i++) {
      normSystem.addNorm('custom', `norm_${i}`, `Norm ${i}`);
    }

    // Create groups
    for (let g = 0; g < 5; g++) {
      const group = groupEngine.createGroup(`group_${g}`, 'community');
      for (let m = 0; m < 10; m++) {
        groupEngine.addMember(group.id, entities[(g * 10 + m) % 50], 50);
      }
    }

    // Create culture
    const culture = culturalSystem.createCulture('test_culture', 'Test Culture');
    if (culture) {
      for (let t = 0; t < 10; t++) {
        const trait = culturalSystem.createTrait(
          'custom', `trait_${t}`, `Trait ${t}`, culture.id,
          { transmissibility: 50, adaptability: 50 }
        );
        if (trait) culturalSystem.addTraitToCulture(culture.id, trait.id);
      }
    }

    // Create information
    infoModel.createInformation('rumor', 'Test rumor', entities[0], {
      infectivity: 70, sourceCredibility: 60,
    });

    // Run 50 ticks of full ecosystem
    const elapsed = measureTime(() => {
      for (let tick = 0; tick < 50; tick++) {
        relationGraph.tick(1 / 60, null as any, null as any);
        normSystem.tick(1 / 60, null as any, null as any);
        eventSystem.tick(1 / 60, null as any, null as any);
        groupEngine.tick(1 / 60, null as any, null as any);
        infoModel.tick(1 / 60, null as any, null as any);
        mobilitySystem.tick(1 / 60, null as any, null as any);
        culturalSystem.tick(1 / 60, null as any, null as any);
        integration.tick(1 / 60, null as any, null as any);
      }
    });

    // Full ecosystem with 50 entities for 50 ticks should complete within 5 seconds
    assert.ok(elapsed < 5000,
      `Full M13 ecosystem 50 ticks took ${elapsed.toFixed(2)}ms, threshold 5000ms`);
  });
});
