/**
 * Economic-Social Coupling System - Unit Tests
 *
 * Tests for M14 Economic Foundation Layer - Phase 4
 * Covers: relation modifiers, economic norms, culture-economy interactions,
 * coupling links, feedback loops, metrics, serialization
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EconSocialCouplingSystem } from '../src/economy/EconSocialCouplingSystem.js';
import {
  CouplingDirection,
  RelationEconomicModifierType,
  EconomicNormType,
  CultureEconomyInteractionType,
  DEFAULT_ECON_SOCIAL_COUPLING_CONFIG,
} from '../src/economy/EconSocialCouplingTypes.js';

describe('EconSocialCouplingSystem - Configuration', () => {
  it('should use default configuration when none provided', () => {
    const system = new EconSocialCouplingSystem();
    assert.ok(system.enabled);
    assert.equal(system.name, 'econ-social-coupling-system');
  });

  it('should accept custom configuration', () => {
    const system = new EconSocialCouplingSystem({
      autoDeriveSocialStatus: false,
      wealthStatusConversionRate: 0.8,
    });
    assert.ok(system);
  });

  it('should have valid default config values', () => {
    assert.equal(DEFAULT_ECON_SOCIAL_COUPLING_CONFIG.autoDeriveSocialStatus, true);
    assert.equal(DEFAULT_ECON_SOCIAL_COUPLING_CONFIG.wealthStatusConversionRate, 0.5);
    assert.equal(DEFAULT_ECON_SOCIAL_COUPLING_CONFIG.enableFeedbackLoops, true);
    assert.equal(DEFAULT_ECON_SOCIAL_COUPLING_CONFIG.feedbackInterval, 10);
  });
});

describe('EconSocialCouplingSystem - Relation Modifiers', () => {
  it('should create a relation modifier', () => {
    const system = new EconSocialCouplingSystem();
    const modifier = system.createRelationModifier(
      'rel_1', 'agent_a', 'agent_b',
      RelationEconomicModifierType.WEALTH_BASED,
      { influenceStrength: 0.8, wealthDifference: 500 }
    );

    assert.ok(modifier.id);
    assert.equal(modifier.relationId, 'rel_1');
    assert.equal(modifier.agentAId, 'agent_a');
    assert.equal(modifier.agentBId, 'agent_b');
    assert.equal(modifier.type, RelationEconomicModifierType.WEALTH_BASED);
    assert.equal(modifier.influenceStrength, 0.8);
    assert.equal(modifier.wealthDifference, 500);
    assert.equal(modifier.isActive, true);
  });

  it('should retrieve modifier by id', () => {
    const system = new EconSocialCouplingSystem();
    const modifier = system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.CLASS_BASED);
    assert.ok(system.getModifier(modifier.id));
    assert.equal(system.getModifier('nonexistent'), undefined);
  });

  it('should list all modifiers', () => {
    const system = new EconSocialCouplingSystem();
    system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED);
    system.createRelationModifier('rel_2', 'c', 'd', RelationEconomicModifierType.TRADE_PARTNER);
    assert.equal(system.getAllModifiers().length, 2);
  });

  it('should list only active modifiers', () => {
    const system = new EconSocialCouplingSystem();
    system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED);
    system.createRelationModifier('rel_2', 'c', 'd', RelationEconomicModifierType.TRADE_PARTNER, { isActive: false });
    assert.equal(system.getActiveModifiers().length, 1);
  });

  it('should get modifiers by agent', () => {
    const system = new EconSocialCouplingSystem();
    system.createRelationModifier('rel_1', 'agent_a', 'agent_b', RelationEconomicModifierType.WEALTH_BASED);
    system.createRelationModifier('rel_2', 'agent_a', 'agent_c', RelationEconomicModifierType.TRADE_PARTNER);
    system.createRelationModifier('rel_3', 'agent_d', 'agent_e', RelationEconomicModifierType.CLASS_BASED);

    assert.equal(system.getModifiersByAgent('agent_a').length, 2);
    assert.equal(system.getModifiersByAgent('agent_d').length, 1);
  });

  it('should get modifiers by relation', () => {
    const system = new EconSocialCouplingSystem();
    system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED);
    system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.TRADE_PARTNER);
    system.createRelationModifier('rel_2', 'c', 'd', RelationEconomicModifierType.CLASS_BASED);

    assert.equal(system.getModifiersByRelation('rel_1').length, 2);
  });

  it('should update modifier', () => {
    const system = new EconSocialCouplingSystem();
    const modifier = system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED, { influenceStrength: 0.5 });

    const result = system.updateModifier(modifier.id, { influenceStrength: 0.9, wealthDifference: 1000 });
    assert.equal(result, true);
    assert.equal(system.getModifier(modifier.id)!.influenceStrength, 0.9);
    assert.equal(system.getModifier(modifier.id)!.wealthDifference, 1000);
  });

  it('should remove modifier', () => {
    const system = new EconSocialCouplingSystem();
    const modifier = system.createRelationModifier('rel_1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED);
    assert.equal(system.removeModifier(modifier.id), true);
    assert.equal(system.getModifier(modifier.id), undefined);
  });
});

describe('EconSocialCouplingSystem - Economic Norms', () => {
  it('should create an economic norm', () => {
    const system = new EconSocialCouplingSystem();
    const norm = system.createNorm(
      'norm_1', 'Tax Compliance', EconomicNormType.TAX_COMPLIANCE,
      'Pay taxes on time',
      { complianceRate: 0.8, violationPenalty: 20 }
    );

    assert.equal(norm.id, 'norm_1');
    assert.equal(norm.name, 'Tax Compliance');
    assert.equal(norm.type, EconomicNormType.TAX_COMPLIANCE);
    assert.equal(norm.complianceRate, 0.8);
    assert.equal(norm.violationPenalty, 20);
    assert.equal(norm.isActive, true);
  });

  it('should retrieve norm by id', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('norm_1', 'Test', EconomicNormType.CHARITY, 'Give to charity');
    assert.ok(system.getNorm('norm_1'));
    assert.equal(system.getNorm('nonexistent'), undefined);
  });

  it('should list all norms', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('n1', 'Norm 1', EconomicNormType.CHARITY, 'Be charitable');
    system.createNorm('n2', 'Norm 2', EconomicNormType.HARD_WORK, 'Work hard');
    assert.equal(system.getAllNorms().length, 2);
  });

  it('should list only active norms', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('n1', 'Active', EconomicNormType.CHARITY, 'Be charitable');
    system.createNorm('n2', 'Inactive', EconomicNormType.HARD_WORK, 'Work hard', { isActive: false });
    assert.equal(system.getActiveNorms().length, 1);
  });

  it('should get norms for specific class', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('n1', 'Rich Norm', EconomicNormType.CONSPICUOUS_CONSUMPTION, 'Show wealth', { applicableClasses: ['rich', 'wealthy'] });
    system.createNorm('n2', 'Poor Norm', EconomicNormType.FRUGALITY, 'Be frugal', { applicableClasses: ['poor', 'working'] });
    system.createNorm('n3', 'Universal Norm', EconomicNormType.HARD_WORK, 'Work hard');

    assert.equal(system.getNormsForClass('rich').length, 2); // n1 + n3
    assert.equal(system.getNormsForClass('poor').length, 2); // n2 + n3
  });

  it('should apply norm and return social change', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('n1', 'Test', EconomicNormType.CHARITY, 'Be charitable', {
      complianceRate: 1.0, // Always compliant for test
      complianceReward: 10,
      violationPenalty: 20,
    });

    const result = system.applyNorm('n1', 'agent_1');
    assert.equal(result.success, true);
    assert.equal(result.socialChange, 10); // Compliant -> reward
  });

  it('should violate norm and return penalty', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('n1', 'Test', EconomicNormType.CHARITY, 'Be charitable', { violationPenalty: 25 });

    const result = system.violateNorm('n1', 'agent_1');
    assert.equal(result.success, true);
    assert.equal(result.penalty, 25);
  });

  it('should remove norm', () => {
    const system = new EconSocialCouplingSystem();
    system.createNorm('n1', 'Test', EconomicNormType.CHARITY, 'Be charitable');
    assert.equal(system.removeNorm('n1'), true);
    assert.equal(system.getNorm('n1'), undefined);
  });
});

describe('EconSocialCouplingSystem - Culture-Economy Interactions', () => {
  it('should create a culture-economy interaction', () => {
    const system = new EconSocialCouplingSystem();
    const interaction = system.createInteraction(
      'Cultural Frugality',
      CultureEconomyInteractionType.CULTURE_INFLUENCES_CONSUMPTION,
      'culture_1', 'consumption',
      CouplingDirection.CULTURE_INFLUENCES_CONSUMPTION as unknown as CouplingDirection,
      { strength: 0.7, effects: { consumptionReduction: 0.3 } }
    );

    assert.ok(interaction.id);
    assert.equal(interaction.name, 'Cultural Frugality');
    assert.equal(interaction.type, CultureEconomyInteractionType.CULTURE_INFLUENCES_CONSUMPTION);
    assert.equal(interaction.cultureId, 'culture_1');
    assert.equal(interaction.economicDomain, 'consumption');
    assert.equal(interaction.strength, 0.7);
    assert.equal(interaction.isActive, true);
  });

  it('should retrieve interaction by id', () => {
    const system = new EconSocialCouplingSystem();
    const interaction = system.createInteraction('Test', CultureEconomyInteractionType.CULTURE_INFLUENCES_TRADE, 'c1', 'trade', CouplingDirection.ECON_TO_SOCIAL);
    assert.ok(system.getInteraction(interaction.id));
    assert.equal(system.getInteraction('nonexistent'), undefined);
  });

  it('should list all interactions', () => {
    const system = new EconSocialCouplingSystem();
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    system.createInteraction('I2', CultureEconomyInteractionType.ECON_INFLUENCES_CULTURE, 'c2', 'distribution', CouplingDirection.SOCIAL_TO_ECON);
    assert.equal(system.getAllInteractions().length, 2);
  });

  it('should list only active interactions', () => {
    const system = new EconSocialCouplingSystem();
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    system.createInteraction('I2', CultureEconomyInteractionType.ECON_INFLUENCES_CULTURE, 'c2', 'distribution', CouplingDirection.SOCIAL_TO_ECON, { isActive: false });
    assert.equal(system.getActiveInteractions().length, 1);
  });

  it('should get interactions by culture', () => {
    const system = new EconSocialCouplingSystem();
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    system.createInteraction('I2', CultureEconomyInteractionType.CULTURE_INFLUENCES_TRADE, 'c1', 'trade', CouplingDirection.ECON_TO_SOCIAL);
    system.createInteraction('I3', CultureEconomyInteractionType.ECON_INFLUENCES_CULTURE, 'c2', 'distribution', CouplingDirection.SOCIAL_TO_ECON);

    assert.equal(system.getInteractionsByCulture('c1').length, 2);
  });

  it('should get interactions by domain', () => {
    const system = new EconSocialCouplingSystem();
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    system.createInteraction('I2', CultureEconomyInteractionType.CULTURE_INFLUENCES_TRADE, 'c1', 'trade', CouplingDirection.ECON_TO_SOCIAL);

    assert.equal(system.getInteractionsByDomain('production').length, 1);
    assert.equal(system.getInteractionsByDomain('trade').length, 1);
  });

  it('should update interaction', () => {
    const system = new EconSocialCouplingSystem();
    const interaction = system.createInteraction('Test', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL, { strength: 0.5 });

    const result = system.updateInteraction(interaction.id, { strength: 0.9, isActive: false });
    assert.equal(result, true);
    assert.equal(system.getInteraction(interaction.id)!.strength, 0.9);
    assert.equal(system.getInteraction(interaction.id)!.isActive, false);
  });

  it('should remove interaction', () => {
    const system = new EconSocialCouplingSystem();
    const interaction = system.createInteraction('Test', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    assert.equal(system.removeInteraction(interaction.id), true);
    assert.equal(system.getInteraction(interaction.id), undefined);
  });
});

describe('EconSocialCouplingSystem - Coupling Links', () => {
  it('should create a coupling link', () => {
    const system = new EconSocialCouplingSystem();
    const link = system.createCouplingLink('agent_1', 'middle');

    assert.equal(link.agentId, 'agent_1');
    assert.equal(link.economicClass, 'middle');
    assert.ok(link.derivedSocialStatus > 0);
    assert.ok(link.derivedSocialStatus <= 100);
  });

  it('should derive social status based on economic class', () => {
    const system = new EconSocialCouplingSystem();
    const poorLink = system.createCouplingLink('poor', 'poor');
    const richLink = system.createCouplingLink('rich', 'rich');

    assert.ok(richLink.derivedSocialStatus > poorLink.derivedSocialStatus);
  });

  it('should retrieve coupling link by agent id', () => {
    const system = new EconSocialCouplingSystem();
    system.createCouplingLink('agent_1', 'middle');
    assert.ok(system.getCouplingLink('agent_1'));
    assert.equal(system.getCouplingLink('nonexistent'), undefined);
  });

  it('should list all coupling links', () => {
    const system = new EconSocialCouplingSystem();
    system.createCouplingLink('a1', 'poor');
    system.createCouplingLink('a2', 'middle');
    system.createCouplingLink('a3', 'rich');
    assert.equal(system.getAllCouplingLinks().length, 3);
  });

  it('should update coupling link', () => {
    const system = new EconSocialCouplingSystem();
    system.createCouplingLink('agent_1', 'middle');
    const result = system.updateCouplingLink('agent_1', { economicClass: 'rich', derivedSocialStatus: 90 });
    assert.equal(result, true);
    assert.equal(system.getCouplingLink('agent_1')!.economicClass, 'rich');
    assert.equal(system.getCouplingLink('agent_1')!.derivedSocialStatus, 90);
  });

  it('should remove coupling link', () => {
    const system = new EconSocialCouplingSystem();
    system.createCouplingLink('agent_1', 'middle');
    assert.equal(system.removeCouplingLink('agent_1'), true);
    assert.equal(system.getCouplingLink('agent_1'), undefined);
  });
});

describe('EconSocialCouplingSystem - Feedback Loops', () => {
  it('should create a feedback loop', () => {
    const system = new EconSocialCouplingSystem();
    const loop = system.createFeedbackLoop(
      'loop_1', 'Wealth Reinforcement',
      'positive',
      'High wealth leads to higher social status',
      'Higher social status leads to more economic opportunities',
      { strength: 0.6 }
    );

    assert.equal(loop.id, 'loop_1');
    assert.equal(loop.name, 'Wealth Reinforcement');
    assert.equal(loop.feedbackType, 'positive');
    assert.equal(loop.strength, 0.6);
    assert.equal(loop.isActive, true);
    assert.equal(loop.triggerCount, 0);
  });

  it('should retrieve feedback loop by id', () => {
    const system = new EconSocialCouplingSystem();
    system.createFeedbackLoop('l1', 'Loop', 'positive', 'trigger', 'effect');
    assert.ok(system.getFeedbackLoop('l1'));
    assert.equal(system.getFeedbackLoop('nonexistent'), undefined);
  });

  it('should list all feedback loops', () => {
    const system = new EconSocialCouplingSystem();
    system.createFeedbackLoop('l1', 'Positive Loop', 'positive', 't1', 'e1');
    system.createFeedbackLoop('l2', 'Negative Loop', 'negative', 't2', 'e2');
    assert.equal(system.getAllFeedbackLoops().length, 2);
  });

  it('should list only active feedback loops', () => {
    const system = new EconSocialCouplingSystem();
    system.createFeedbackLoop('l1', 'Active', 'positive', 't', 'e');
    system.createFeedbackLoop('l2', 'Inactive', 'negative', 't', 'e', { isActive: false });
    assert.equal(system.getActiveFeedbackLoops().length, 1);
  });

  it('should trigger feedback loop', () => {
    const system = new EconSocialCouplingSystem();
    system.createFeedbackLoop('l1', 'Test', 'positive', 't', 'e');

    const result = system.triggerFeedbackLoop('l1');
    assert.equal(result, true);
    assert.equal(system.getFeedbackLoop('l1')!.triggerCount, 1);

    system.triggerFeedbackLoop('l1');
    assert.equal(system.getFeedbackLoop('l1')!.triggerCount, 2);
  });

  it('should not trigger inactive loop', () => {
    const system = new EconSocialCouplingSystem();
    system.createFeedbackLoop('l1', 'Test', 'positive', 't', 'e', { isActive: false });
    assert.equal(system.triggerFeedbackLoop('l1'), false);
  });

  it('should remove feedback loop', () => {
    const system = new EconSocialCouplingSystem();
    system.createFeedbackLoop('l1', 'Test', 'positive', 't', 'e');
    assert.equal(system.removeFeedbackLoop('l1'), true);
    assert.equal(system.getFeedbackLoop('l1'), undefined);
  });
});

describe('EconSocialCouplingSystem - Metrics', () => {
  it('should calculate coupling metrics', () => {
    const system = new EconSocialCouplingSystem();

    system.createRelationModifier('r1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED, { influenceStrength: 0.8 });
    system.createRelationModifier('r2', 'c', 'd', RelationEconomicModifierType.CLASS_BASED, { influenceStrength: 0.4 });
    system.createNorm('n1', 'Norm', EconomicNormType.CHARITY, 'Be charitable', { complianceRate: 0.7 });
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    system.createFeedbackLoop('l1', 'Loop', 'positive', 't', 'e');
    system.createCouplingLink('a1', 'middle');
    system.createCouplingLink('a2', 'rich');

    const metrics = system.calculateMetrics();
    assert.ok(metrics.totalCouplings >= 2);
    assert.ok(metrics.averageInfluenceStrength > 0);
    assert.ok(metrics.averageNormCompliance > 0);
    assert.equal(metrics.activeInteractions, 1);
    assert.equal(metrics.activeFeedbackLoops, 1);
  });

  it('should calculate wealth-status correlation', () => {
    const system = new EconSocialCouplingSystem();
    system.createCouplingLink('poor', 'poor');
    system.createCouplingLink('working', 'working');
    system.createCouplingLink('middle', 'middle');
    system.createCouplingLink('rich', 'rich');

    const metrics = system.calculateMetrics();
    // With ordered classes, correlation should be positive
    assert.ok(metrics.wealthStatusCorrelation > 0);
  });
});

describe('EconSocialCouplingSystem - History', () => {
  it('should track coupling history', () => {
    const system = new EconSocialCouplingSystem();
    system.createRelationModifier('r1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED);
    system.createNorm('n1', 'Norm', EconomicNormType.CHARITY, 'Be charitable');
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);

    const history = system.getHistory();
    assert.ok(history.length >= 3);
  });

  it('should limit history results', () => {
    const system = new EconSocialCouplingSystem();
    for (let i = 0; i < 10; i++) {
      system.createRelationModifier(`r${i}`, 'a', 'b', RelationEconomicModifierType.WEALTH_BASED);
    }

    const history = system.getHistory(5);
    assert.equal(history.length, 5);
  });
});

describe('EconSocialCouplingSystem - Serialization', () => {
  it('should serialize and deserialize system state', () => {
    const system = new EconSocialCouplingSystem();
    system.createRelationModifier('r1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED, { influenceStrength: 0.8 });
    system.createNorm('n1', 'Norm', EconomicNormType.CHARITY, 'Be charitable');
    system.createInteraction('I1', CultureEconomyInteractionType.CULTURE_INFLUENCES_PRODUCTION, 'c1', 'production', CouplingDirection.ECON_TO_SOCIAL);
    system.createCouplingLink('agent_1', 'middle');
    system.createFeedbackLoop('l1', 'Loop', 'positive', 't', 'e');

    const serialized = system.serialize();
    assert.ok(serialized);
    assert.ok(serialized.modifiers);
    assert.ok(serialized.norms);
    assert.ok(serialized.interactions);
    assert.ok(serialized.couplingLinks);
    assert.ok(serialized.feedbackLoops);

    const newSystem = new EconSocialCouplingSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllModifiers().length, 1);
    assert.equal(newSystem.getAllNorms().length, 1);
    assert.equal(newSystem.getAllInteractions().length, 1);
    assert.equal(newSystem.getAllCouplingLinks().length, 1);
    assert.equal(newSystem.getAllFeedbackLoops().length, 1);
  });

  it('should preserve modifier data after serialization', () => {
    const system = new EconSocialCouplingSystem();
    const modifier = system.createRelationModifier('r1', 'a', 'b', RelationEconomicModifierType.WEALTH_BASED, {
      influenceStrength: 0.85,
      wealthDifference: 500,
    });

    const serialized = system.serialize();
    const newSystem = new EconSocialCouplingSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    const restored = newSystem.getModifier(modifier.id)!;
    assert.equal(restored.influenceStrength, 0.85);
    assert.equal(restored.wealthDifference, 500);
    assert.equal(restored.type, RelationEconomicModifierType.WEALTH_BASED);
  });

  it('should handle empty system serialization', () => {
    const system = new EconSocialCouplingSystem();
    const serialized = system.serialize();

    const newSystem = new EconSocialCouplingSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllModifiers().length, 0);
    assert.equal(newSystem.getAllNorms().length, 0);
    assert.equal(newSystem.getAllInteractions().length, 0);
  });
});
