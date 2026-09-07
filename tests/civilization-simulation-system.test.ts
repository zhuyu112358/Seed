/**
 * Civilization Simulation System - Unit Tests
 *
 * Tests for M14 Economic Foundation Layer - Phase 5
 * Covers: civilization management, metrics, state changes, crises,
 * milestones, multi-civilization interactions, comparison, serialization
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CivilizationSimulationSystem } from '../src/economy/CivilizationSimulationSystem.js';
import {
  CivilizationState,
  CivilizationDomainType,
  CivilizationInteractionType,
  DEFAULT_CIVILIZATION_SIMULATION_CONFIG,
} from '../src/economy/CivilizationSimulationTypes.js';

describe('CivilizationSimulationSystem - Configuration', () => {
  it('should use default configuration when none provided', () => {
    const system = new CivilizationSimulationSystem();
    assert.ok(system.enabled);
    assert.equal(system.name, 'civilization-simulation-system');
  });

  it('should accept custom configuration', () => {
    const system = new CivilizationSimulationSystem({
      goldenAgeThreshold: 90,
      collapseThreshold: 5,
    });
    assert.ok(system);
  });

  it('should have valid default config values', () => {
    assert.equal(DEFAULT_CIVILIZATION_SIMULATION_CONFIG.autoCalculateMetrics, true);
    assert.equal(DEFAULT_CIVILIZATION_SIMULATION_CONFIG.goldenAgeThreshold, 80);
    assert.equal(DEFAULT_CIVILIZATION_SIMULATION_CONFIG.collapseThreshold, 10);
    assert.equal(DEFAULT_CIVILIZATION_SIMULATION_CONFIG.enableInteractions, true);
  });
});

describe('CivilizationSimulationSystem - Civilization Management', () => {
  it('should create a civilization', () => {
    const system = new CivilizationSimulationSystem();
    const civ = system.createCivilization('civ1', 'Test Civilization');

    assert.equal(civ.id, 'civ1');
    assert.equal(civ.name, 'Test Civilization');
    assert.equal(civ.state, CivilizationState.EMERGING);
    assert.ok(civ.metrics);
    assert.equal(civ.metrics.overallScore, 10);
    assert.ok(civ.milestones.length > 0);
  });

  it('should create civilization with custom options', () => {
    const system = new CivilizationSimulationSystem();
    const civ = system.createCivilization('civ1', 'Custom', {
      description: 'A test civilization',
      leaderId: 'leader_1',
      dominantCultureId: 'culture_1',
    });

    assert.equal(civ.description, 'A test civilization');
    assert.equal(civ.leaderId, 'leader_1');
    assert.equal(civ.dominantCultureId, 'culture_1');
  });

  it('should retrieve civilization by id', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    assert.ok(system.getCivilization('civ1'));
    assert.equal(system.getCivilization('nonexistent'), undefined);
  });

  it('should list all civilizations', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Civ 1');
    system.createCivilization('civ2', 'Civ 2');
    system.createCivilization('civ3', 'Civ 3');
    assert.equal(system.getAllCivilizations().length, 3);
  });

  it('should list only active civilizations', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Active');
    const collapsed = system.createCivilization('civ2', 'Collapsed', { state: CivilizationState.COLLAPSED });
    assert.equal(system.getActiveCivilizations().length, 1);
  });

  it('should get civilizations by state', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Emerging', { state: CivilizationState.EMERGING });
    system.createCivilization('civ2', 'Growing', { state: CivilizationState.GROWING });
    system.createCivilization('civ3', 'Growing 2', { state: CivilizationState.GROWING });

    assert.equal(system.getCivilizationsByState(CivilizationState.GROWING).length, 2);
    assert.equal(system.getCivilizationsByState(CivilizationState.EMERGING).length, 1);
  });

  it('should update civilization', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const result = system.updateCivilization('civ1', { name: 'Updated', description: 'New desc' });
    assert.equal(result, true);
    assert.equal(system.getCivilization('civ1')!.name, 'Updated');
    assert.equal(system.getCivilization('civ1')!.description, 'New desc');
  });
});

describe('CivilizationSimulationSystem - Metrics', () => {
  it('should update metrics', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const result = system.updateMetrics('civ1', { overallScore: 30, population: 500 });
    assert.equal(result, true);
    assert.equal(system.getCivilization('civ1')!.metrics.overallScore, 30);
    assert.equal(system.getCivilization('civ1')!.metrics.population, 500);
  });

  it('should update domain score', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const result = system.updateDomainScore('civ1', CivilizationDomainType.ECONOMIC, 50);
    assert.equal(result, true);
    assert.equal(system.getCivilization('civ1')!.metrics.domainScores[CivilizationDomainType.ECONOMIC].score, 50);
  });

  it('should clamp domain score between 0 and 100', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    system.updateDomainScore('civ1', CivilizationDomainType.ECONOMIC, 150);
    assert.equal(system.getCivilization('civ1')!.metrics.domainScores[CivilizationDomainType.ECONOMIC].score, 100);

    system.updateDomainScore('civ1', CivilizationDomainType.ECONOMIC, -50);
    assert.equal(system.getCivilization('civ1')!.metrics.domainScores[CivilizationDomainType.ECONOMIC].score, 0);
  });

  it('should recalculate overall score from domain scores', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');

    // Set all domains to 50
    for (const domain of Object.values(CivilizationDomainType)) {
      system.updateDomainScore('civ1', domain, 50);
    }

    // Overall should be approximately 50 (weighted average)
    const overall = system.getCivilization('civ1')!.metrics.overallScore;
    assert.ok(overall > 45 && overall < 55);
  });

  it('should track domain score trend', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');

    system.updateDomainScore('civ1', CivilizationDomainType.ECONOMIC, 30);
    system.updateDomainScore('civ1', CivilizationDomainType.ECONOMIC, 50);

    const domainScore = system.getCivilization('civ1')!.metrics.domainScores[CivilizationDomainType.ECONOMIC];
    assert.equal(domainScore.previousScore, 30);
    assert.equal(domainScore.score, 50);
    assert.equal(domainScore.trend, 1); // Rising
  });
});

describe('CivilizationSimulationSystem - State Changes', () => {
  it('should change state based on overall score', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');

    // Score 10 -> EMERGING (default)
    assert.equal(system.getCivilization('civ1')!.state, CivilizationState.EMERGING);

    // Raise score to 40 -> GROWING
    system.updateMetrics('civ1', { overallScore: 40 });
    assert.equal(system.getCivilization('civ1')!.state, CivilizationState.GROWING);

    // Raise score to 70 -> PROSPERING
    system.updateMetrics('civ1', { overallScore: 70 });
    assert.equal(system.getCivilization('civ1')!.state, CivilizationState.PROSPERING);
  });

  it('should detect golden age', () => {
    const system = new CivilizationSimulationSystem({ goldenAgeThreshold: 80 });
    system.createCivilization('civ1', 'Test');

    system.updateMetrics('civ1', { overallScore: 85 });
    assert.equal(system.getCivilization('civ1')!.metrics.goldenAgeMultiplier, 1.5);

    // Drop below threshold
    system.updateMetrics('civ1', { overallScore: 70 });
    assert.equal(system.getCivilization('civ1')!.metrics.goldenAgeMultiplier, 1.0);
  });

  it('should detect collapse', () => {
    const system = new CivilizationSimulationSystem({ collapseThreshold: 10 });
    system.createCivilization('civ1', 'Test');

    system.updateMetrics('civ1', { overallScore: 5 });
    assert.equal(system.getCivilization('civ1')!.state, CivilizationState.COLLAPSED);
    assert.ok(system.getCivilization('civ1')!.collapseTick !== undefined);
  });

  it('should revive collapsed civilization', () => {
    const system = new CivilizationSimulationSystem({ collapseThreshold: 10 });
    system.createCivilization('civ1', 'Test');
    system.updateMetrics('civ1', { overallScore: 5 });
    assert.equal(system.getCivilization('civ1')!.state, CivilizationState.COLLAPSED);

    const result = system.reviveCivilization('civ1');
    assert.equal(result, true);
    assert.equal(system.getCivilization('civ1')!.state, CivilizationState.REVIVING);
    assert.equal(system.getCivilization('civ1')!.collapseTick, undefined);
  });

  it('should not revive non-collapsed civilization', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const result = system.reviveCivilization('civ1');
    assert.equal(result, false);
  });
});

describe('CivilizationSimulationSystem - Crises', () => {
  it('should trigger a crisis', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');

    const crisis = system.triggerCrisis('civ1', 'Economic Depression', 'economic', 60);
    assert.ok(crisis);
    assert.equal(crisis!.name, 'Economic Depression');
    assert.equal(crisis!.type, 'economic');
    assert.equal(crisis!.severity, 60);
    assert.equal(crisis!.isActive, true);
    assert.equal(system.getActiveCrises('civ1').length, 1);
  });

  it('should increase crisis level when crisis triggered', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const initialLevel = system.getCivilization('civ1')!.metrics.crisisLevel;

    system.triggerCrisis('civ1', 'Famine', 'social', 80);
    assert.ok(system.getCivilization('civ1')!.metrics.crisisLevel > initialLevel);
  });

  it('should resolve a crisis', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const crisis = system.triggerCrisis('civ1', 'War', 'military', 50);

    const result = system.resolveCrisis('civ1', crisis!.id);
    assert.equal(result, true);
    assert.equal(system.getActiveCrises('civ1').length, 0);
    assert.equal(system.getCivilization('civ1')!.resolvedCrises.length, 1);
  });

  it('should not resolve non-existent crisis', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const result = system.resolveCrisis('civ1', 'nonexistent');
    assert.equal(result, false);
  });

  it('should clamp crisis severity between 0 and 100', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    const crisis = system.triggerCrisis('civ1', 'Extreme', 'economic', 150);
    assert.equal(crisis!.severity, 100);
  });
});

describe('CivilizationSimulationSystem - Milestones', () => {
  it('should have default milestones', () => {
    const system = new CivilizationSimulationSystem();
    const civ = system.createCivilization('civ1', 'Test');
    assert.ok(civ.milestones.length > 0);
    assert.ok(civ.milestones.some(m => m.id === 'milestone_founding'));
  });

  it('should reach milestones when score increases', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');

    // Initially only founding milestone reached
    assert.equal(system.getReachedMilestones('civ1').length, 1);

    // Raise score to reach early development (required 20)
    system.updateMetrics('civ1', { overallScore: 25 });
    assert.ok(system.getReachedMilestones('civ1').length > 1);
  });

  it('should reach golden age milestone', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');

    system.updateMetrics('civ1', { overallScore: 85 });
    const goldenAge = system.getMilestones('civ1').find(m => m.id === 'milestone_golden_age');
    assert.ok(goldenAge);
    assert.equal(goldenAge!.isReached, true);
  });

  it('should get all milestones', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    assert.ok(system.getMilestones('civ1').length >= 5);
  });
});

describe('CivilizationSimulationSystem - Multi-Civilization Interactions', () => {
  it('should start an interaction', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Civ A');
    system.createCivilization('civ2', 'Civ B');

    const interaction = system.startInteraction('civ1', 'civ2', CivilizationInteractionType.TRADE);
    assert.ok(interaction);
    assert.equal(interaction!.type, CivilizationInteractionType.TRADE);
    assert.equal(interaction!.status, 'active');
    assert.equal(system.getActiveInteractions().length, 1);
  });

  it('should add interaction to both civilizations', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Civ A');
    system.createCivilization('civ2', 'Civ B');

    const interaction = system.startInteraction('civ1', 'civ2', CivilizationInteractionType.ALLIANCE);
    assert.ok(system.getCivilization('civ1')!.activeInteractions.includes(interaction!.id));
    assert.ok(system.getCivilization('civ2')!.activeInteractions.includes(interaction!.id));
  });

  it('should end an interaction', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Civ A');
    system.createCivilization('civ2', 'Civ B');

    const interaction = system.startInteraction('civ1', 'civ2', CivilizationInteractionType.TRADE);
    const result = system.endInteraction(interaction!.id);
    assert.equal(result, true);
    assert.equal(system.getInteraction(interaction!.id)!.status, 'ended');
    assert.equal(system.getActiveInteractions().length, 0);
  });

  it('should not start interaction with collapsed civilization', () => {
    const system = new CivilizationSimulationSystem({ collapseThreshold: 10 });
    system.createCivilization('civ1', 'Active');
    system.createCivilization('civ2', 'Collapsed', { state: CivilizationState.COLLAPSED });

    const interaction = system.startInteraction('civ1', 'civ2', CivilizationInteractionType.TRADE);
    assert.equal(interaction, null);
  });

  it('should get interactions for a civilization', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Civ A');
    system.createCivilization('civ2', 'Civ B');
    system.createCivilization('civ3', 'Civ C');

    system.startInteraction('civ1', 'civ2', CivilizationInteractionType.TRADE);
    system.startInteraction('civ1', 'civ3', CivilizationInteractionType.ALLIANCE);

    assert.equal(system.getInteractionsForCivilization('civ1').length, 2);
    assert.equal(system.getInteractionsForCivilization('civ2').length, 1);
  });

  it('should respect max interactions per civilization', () => {
    const system = new CivilizationSimulationSystem({ maxInteractionsPerCiv: 1 });
    system.createCivilization('civ1', 'Civ A');
    system.createCivilization('civ2', 'Civ B');
    system.createCivilization('civ3', 'Civ C');

    system.startInteraction('civ1', 'civ2', CivilizationInteractionType.TRADE);
    const second = system.startInteraction('civ1', 'civ3', CivilizationInteractionType.ALLIANCE);
    assert.equal(second, null); // civ1 already at max
  });
});

describe('CivilizationSimulationSystem - Comparison', () => {
  it('should compare two civilizations', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Strong');
    system.createCivilization('civ2', 'Weak');

    system.updateMetrics('civ1', { overallScore: 80 });
    system.updateMetrics('civ2', { overallScore: 40 });

    const comparison = system.compareCivilizations('civ1', 'civ2');
    assert.ok(comparison);
    assert.equal(comparison!.scoreDifference, 40);
    assert.equal(comparison!.dominant, 'civ1');
    assert.ok(comparison!.relativePowerA > comparison!.relativePowerB);
  });

  it('should return null for non-existent civilization', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    assert.equal(system.compareCivilizations('civ1', 'nonexistent'), null);
  });

  it('should calculate domain differences', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'A');
    system.createCivilization('civ2', 'B');

    system.updateDomainScore('civ1', CivilizationDomainType.ECONOMIC, 80);
    system.updateDomainScore('civ2', CivilizationDomainType.ECONOMIC, 30);

    const comparison = system.compareCivilizations('civ1', 'civ2');
    assert.equal(comparison!.domainDifferences[CivilizationDomainType.ECONOMIC], 50);
  });
});

describe('CivilizationSimulationSystem - Statistics', () => {
  it('should calculate simulation statistics', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Civ 1');
    system.createCivilization('civ2', 'Civ 2');
    system.createCivilization('civ3', 'Civ 3', { state: CivilizationState.COLLAPSED });

    system.updateMetrics('civ1', { overallScore: 60 });
    system.updateMetrics('civ2', { overallScore: 40 });

    const stats = system.getStats();
    assert.equal(stats.totalCivilizations, 3);
    assert.equal(stats.activeCivilizations, 2);
    assert.equal(stats.collapsedCivilizations, 1);
    assert.ok(stats.averageOverallScore > 0);
    assert.equal(stats.highestScore, 60);
    assert.equal(stats.lowestScore, 40);
  });
});

describe('CivilizationSimulationSystem - Serialization', () => {
  it('should serialize and deserialize system state', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test Civ');
    system.createCivilization('civ2', 'Another Civ');
    system.startInteraction('civ1', 'civ2', CivilizationInteractionType.TRADE);
    system.triggerCrisis('civ1', 'Famine', 'social', 50);

    const serialized = system.serialize();
    assert.ok(serialized);
    assert.ok(serialized.civilizations);
    assert.ok(serialized.interactions);

    const newSystem = new CivilizationSimulationSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllCivilizations().length, 2);
    assert.equal(newSystem.getAllInteractions().length, 1);
    assert.equal(newSystem.getActiveCrises('civ1').length, 1);
  });

  it('should preserve civilization metrics after serialization', () => {
    const system = new CivilizationSimulationSystem();
    system.createCivilization('civ1', 'Test');
    system.updateMetrics('civ1', { overallScore: 65, population: 1000, wealth: 5000 });

    const serialized = system.serialize();
    const newSystem = new CivilizationSimulationSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    const civ = newSystem.getCivilization('civ1')!;
    assert.equal(civ.metrics.overallScore, 65);
    assert.equal(civ.metrics.population, 1000);
    assert.equal(civ.metrics.wealth, 5000);
  });

  it('should handle empty system serialization', () => {
    const system = new CivilizationSimulationSystem();
    const serialized = system.serialize();

    const newSystem = new CivilizationSimulationSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllCivilizations().length, 0);
    assert.equal(newSystem.getAllInteractions().length, 0);
  });
});
