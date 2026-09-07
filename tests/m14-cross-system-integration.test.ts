/**
 * M14 Economic Foundation - Cross-System Integration Tests
 *
 * Tests integration between all M14 economic systems:
 * ResourceProduction + TradeExchange + Distribution + EconSocialCoupling
 * + CivilizationSimulation + LargeScaleSimulation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ResourceProductionSystem } from '../src/economy/ResourceProductionSystem.js';
import { TradeExchangeSystem } from '../src/economy/TradeExchangeSystem.js';
import { DistributionSystem } from '../src/economy/DistributionSystem.js';
import { EconSocialCouplingSystem } from '../src/economy/EconSocialCouplingSystem.js';
import { CivilizationSimulationSystem } from '../src/economy/CivilizationSimulationSystem.js';
import { LargeScaleSimulationSystem } from '../src/performance/LargeScaleSimulationSystem.js';

import {
  ProducerType,
  type ProductionRecipe,
} from '../src/economy/ResourceProductionTypes.js';
import {
  MarketType,
  OrderType,
  OrderStatus,
} from '../src/economy/TradeExchangeTypes.js';
import {
  EconomicClass,
  DistributionMethod,
  WealthSourceType,
} from '../src/economy/DistributionTypes.js';
import {
  CivilizationState,
  CivilizationDomainType,
  CivilizationInteractionType,
} from '../src/economy/CivilizationSimulationTypes.js';
import {
  LargeScaleEntityType,
  ECSComponentType,
  BenchmarkScenarioType,
} from '../src/performance/LargeScaleSimulationTypes.js';

describe('M14 Cross-System Integration - Economic Pipeline', () => {
  it('should complete full economic pipeline: production -> trade -> distribution', () => {
    // Phase 1: Production
    const production = new ResourceProductionSystem();
    const recipe: ProductionRecipe = {
      id: 'recipe_wood',
      name: 'Wood Planks',
      inputs: [{ resourceId: 'log', amount: 2 }],
      outputs: [{ resourceId: 'plank', amount: 4 }],
      category: 'crafting',
      baseProductionTime: 5,
    };
    production.registerRecipe(recipe);
    production.registerProducer('producer_1', ProducerType.CRAFTING_STATION, 'Crafting Station', {
      baseEfficiency: 1.0,
    });

    const job = production.createJob('recipe_wood', 'producer_1', { batchSize: 2 });
    assert.ok(job);
    production.startJob(job.id);

    // Phase 2: Trade
    const trade = new TradeExchangeSystem();
    trade.createMarket('market_1', MarketType.LOCAL, { name: 'Local Market' });

    const buyOrder = trade.placeOrder('market_1', 'buyer_1', OrderType.BUY, 'plank', 10, 5.0);
    assert.ok(buyOrder);
    assert.equal(buyOrder!.success, true);

    trade.placeOrder('market_1', 'seller_1', OrderType.SELL, 'plank', 10, 4.0);
    // Orders are automatically matched on placement
    const tradeHistory = trade.getTradeHistory('market_1');
    assert.ok(tradeHistory.length > 0);

    // Phase 3: Distribution
    const distribution = new DistributionSystem();
    distribution.registerAgent('agent_1', { name: 'Producer', wealth: 100, currency: 100 });
    distribution.registerAgent('agent_2', { name: 'Consumer', wealth: 50, currency: 50 });

    distribution.createPool('pool_1', 'Trade Profits', 'gold', 50, DistributionMethod.EQUAL, ['agent_1', 'agent_2']);
    const result = distribution.executeDistribution('pool_1');
    assert.ok(result);
    assert.ok(result.length > 0);

    // Verify full pipeline completed
    assert.ok(production.getAllRecipes().length > 0);
    assert.ok(trade.getAllMarkets().length > 0);
    assert.ok(distribution.getAllAgents().length > 0);
  });

  it('should integrate production with trade pricing', () => {
    const production = new ResourceProductionSystem();
    const trade = new TradeExchangeSystem();

    const recipe: ProductionRecipe = {
      id: 'recipe_iron',
      name: 'Iron Ingot',
      inputs: [{ resourceId: 'iron_ore', amount: 3 }],
      outputs: [{ resourceId: 'iron_ingot', amount: 1 }],
      category: 'smelting',
      baseProductionTime: 10,
    };
    production.registerRecipe(recipe);

    const market = trade.createMarket('market_iron', MarketType.REGIONAL);
    assert.ok(market);

    const sellResult = trade.placeOrder('market_iron', 'smelter', OrderType.SELL, 'iron_ingot', 10, 15.0);
    const buyResult = trade.placeOrder('market_iron', 'blacksmith', OrderType.BUY, 'iron_ingot', 10, 18.0);

    // At least one order should be placed successfully
    assert.ok(sellResult.success || buyResult.success);

    // Production chain should be analyzable
    const chain = production.analyzeProductionChain('iron_ingot');
    assert.ok(chain);
  });

  it('should integrate trade with distribution wealth transfer', () => {
    const trade = new TradeExchangeSystem();
    const distribution = new DistributionSystem();

    distribution.registerAgent('merchant', { name: 'Merchant', wealth: 500, currency: 500 });
    distribution.registerAgent('farmer', { name: 'Farmer', wealth: 100, currency: 100 });

    const market = trade.createMarket('market_grain', MarketType.LOCAL);
    trade.placeOrder('market_grain', 'farmer', OrderType.SELL, 'grain', 100, 2.0);
    trade.placeOrder('market_grain', 'merchant', OrderType.BUY, 'grain', 100, 3.0);
    const trades = trade.getTradeHistory('market_grain');

    const tradeVolume = trades.reduce((sum, t) => sum + (t.totalPrice ?? 0), 0);
    const transferSuccess = distribution.transferWealth('merchant', 'farmer', Math.min(tradeVolume * 0.1, 100), 'trade_fee');

    assert.ok(transferSuccess);
  });
});

describe('M14 Cross-System Integration - Economy-Society-Culture Coupling', () => {
  it('should integrate economic status with social relations', () => {
    const distribution = new DistributionSystem();
    const coupling = new EconSocialCouplingSystem();

    distribution.registerAgent('rich_merchant', 'Rich Merchant', { wealth: 10000 });
    distribution.registerAgent('poor_farmer', 'Poor Farmer', { wealth: 100 });

    const link1 = coupling.createCouplingLink('rich_merchant', 'rich');
    const link2 = coupling.createCouplingLink('poor_farmer', 'poor');

    assert.ok(link1.derivedSocialStatus > link2.derivedSocialStatus);
  });

  it('should integrate economic norms with social behavior', () => {
    const coupling = new EconSocialCouplingSystem();

    coupling.createNorm('norm_tax', 'Tax Compliance', 'tax_compliance' as never, 'Pay taxes', {
      complianceRate: 0.8,
      violationPenalty: 20,
    });
    coupling.createNorm('norm_charity', 'Charity', 'charity' as never, 'Give to charity', {
      complianceRate: 0.6,
      complianceReward: 10,
    });

    const result1 = coupling.applyNorm('norm_tax', 'agent_1');
    const result2 = coupling.applyNorm('norm_charity', 'agent_2');

    assert.ok(result1.success);
    assert.ok(result2.success);

    const metrics = coupling.calculateMetrics();
    assert.ok(metrics.averageNormCompliance > 0);
  });

  it('should integrate culture with economic production', () => {
    const coupling = new EconSocialCouplingSystem();

    coupling.createInteraction(
      'Cultural Frugality',
      'culture_influences_consumption' as never,
      'culture_1', 'consumption',
      'econ_to_social' as never,
      { strength: 0.7 }
    );
    coupling.createInteraction(
      'Craftsmanship Tradition',
      'culture_influences_production' as never,
      'culture_2', 'production',
      'econ_to_social' as never,
      { strength: 0.8 }
    );

    const metrics = coupling.calculateMetrics();
    assert.equal(metrics.activeInteractions, 2);
  });
});

describe('M14 Cross-System Integration - Civilization Simulation', () => {
  it('should simulate civilization rise with economic foundation', () => {
    const civilization = new CivilizationSimulationSystem();
    const production = new ResourceProductionSystem();
    const distribution = new DistributionSystem();

    const civ = civilization.createCivilization('civ_rising', 'Rising Civilization');
    assert.equal(civ.state, CivilizationState.EMERGING);

    const recipe: ProductionRecipe = {
      id: 'recipe_food',
      name: 'Food',
      inputs: [],
      outputs: [{ resourceId: 'food', amount: 10 }],
      category: 'farming',
      baseProductionTime: 5,
    };
    production.registerRecipe(recipe);
    production.registerProducer('farm_1', ProducerType.FARM, 'Farm', { baseEfficiency: 1.5 });

    distribution.registerAgent('citizen_1', { name: 'Citizen', wealth: 200 });
    distribution.registerAgent('citizen_2', { name: 'Citizen', wealth: 150 });

    civilization.updateDomainScore('civ_rising', CivilizationDomainType.ECONOMIC, 40);
    civilization.updateDomainScore('civ_rising', CivilizationDomainType.SOCIAL, 35);
    civilization.updateDomainScore('civ_rising', CivilizationDomainType.CULTURAL, 30);

    const updated = civilization.getCivilization('civ_rising')!;
    assert.ok(updated.metrics.overallScore > 10);
  });

  it('should simulate civilization golden age', () => {
    const civilization = new CivilizationSimulationSystem();
    civilization.createCivilization('civ_golden', 'Golden Age Civilization');

    for (const domain of Object.values(CivilizationDomainType)) {
      civilization.updateDomainScore('civ_golden', domain, 85);
    }

    const civ = civilization.getCivilization('civ_golden')!;
    assert.ok(civ.metrics.overallScore >= 80);
    assert.equal(civ.metrics.goldenAgeMultiplier, 1.5);
    assert.equal(civ.state, CivilizationState.PROSPERING);
  });

  it('should simulate civilization decline and collapse', () => {
    const civilization = new CivilizationSimulationSystem({ collapseThreshold: 15 });
    civilization.createCivilization('civ_declining', 'Declining Civilization');

    for (const domain of Object.values(CivilizationDomainType)) {
      civilization.updateDomainScore('civ_declining', domain, 70);
    }

    civilization.triggerCrisis('civ_declining', 'Great Famine', 'economic', 90);
    civilization.triggerCrisis('civ_declining', 'Civil War', 'political', 80);

    civilization.updateDomainScore('civ_declining', CivilizationDomainType.ECONOMIC, 10);
    civilization.updateDomainScore('civ_declining', CivilizationDomainType.SOCIAL, 8);
    civilization.updateDomainScore('civ_declining', CivilizationDomainType.POLITICAL, 5);
    civilization.updateDomainScore('civ_declining', CivilizationDomainType.CULTURAL, 8);
    civilization.updateDomainScore('civ_declining', CivilizationDomainType.MILITARY, 6);
    civilization.updateDomainScore('civ_declining', CivilizationDomainType.TECHNOLOGICAL, 7);

    const civ = civilization.getCivilization('civ_declining')!;
    assert.ok(civ.metrics.crisisLevel > 0);
    assert.ok(civ.state === CivilizationState.COLLAPSED || civ.state === CivilizationState.COLLAPSING);
  });

  it('should simulate multi-civilization interaction', () => {
    const civilization = new CivilizationSimulationSystem();

    civilization.createCivilization('civ_a', 'Civilization A');
    civilization.createCivilization('civ_b', 'Civilization B');

    civilization.updateDomainScore('civ_a', CivilizationDomainType.ECONOMIC, 70);
    civilization.updateDomainScore('civ_a', CivilizationDomainType.MILITARY, 65);

    const interaction = civilization.startInteraction(
      'civ_a', 'civ_b', CivilizationInteractionType.TRADE,
      { strength: 0.6, benefitsA: 15, benefitsB: 20 }
    );
    assert.ok(interaction);
    assert.equal(interaction!.status, 'active');

    const comparison = civilization.compareCivilizations('civ_a', 'civ_b');
    assert.ok(comparison);
    assert.equal(comparison!.dominant, 'civ_a');
    assert.ok(comparison!.scoreDifference > 0);
  });

  it('should simulate civilization revival after collapse', () => {
    const civilization = new CivilizationSimulationSystem({ collapseThreshold: 10 });
    civilization.createCivilization('civ_revive', 'Reviving Civilization');

    civilization.updateDomainScore('civ_revive', CivilizationDomainType.ECONOMIC, 5);
    assert.equal(civilization.getCivilization('civ_revive')!.state, CivilizationState.COLLAPSED);

    const result = civilization.reviveCivilization('civ_revive');
    assert.equal(result, true);
    assert.equal(civilization.getCivilization('civ_revive')!.state, CivilizationState.REVIVING);
  });
});

describe('M14 Cross-System Integration - Large Scale Performance', () => {
  it('should handle large scale economic simulation', () => {
    const largeScale = new LargeScaleSimulationSystem();

    const entities = largeScale.createEntitiesBatch(500, LargeScaleEntityType.NPC, [
      ECSComponentType.POSITION,
      ECSComponentType.ECONOMIC,
      ECSComponentType.SOCIAL,
    ]);

    assert.equal(entities.length, 500);
    assert.equal(largeScale.getEntityCount(), 500);

    const economicSocial = largeScale.getEntitiesWithAllComponents([
      ECSComponentType.ECONOMIC,
      ECSComponentType.SOCIAL,
    ]);
    assert.equal(economicSocial.length, 500);

    const result = largeScale.runBenchmark(BenchmarkScenarioType.COMPONENT_UPDATE, 200, 3);
    assert.ok(result);
    assert.ok(result.operationsPerSecond > 0);
  });

  it('should evaluate ECS architecture at scale', () => {
    const largeScale = new LargeScaleSimulationSystem();

    largeScale.createEntitiesBatch(200, LargeScaleEntityType.NPC, [
      ECSComponentType.POSITION, ECSComponentType.HEALTH, ECSComponentType.AI,
    ]);
    largeScale.createEntitiesBatch(100, LargeScaleEntityType.BUILDING, [
      ECSComponentType.POSITION, ECSComponentType.ECONOMIC,
    ]);
    largeScale.createEntitiesBatch(50, LargeScaleEntityType.RESOURCE_NODE, [
      ECSComponentType.POSITION,
    ]);

    const report = largeScale.evaluateECSArchitecture();
    assert.ok(report);
    assert.equal(report.totalEntities, 350);
    assert.ok(report.avgComponentsPerEntity > 0);
    assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
    assert.ok(report.recommendations.length > 0);
  });

  it('should run full simulation benchmark', () => {
    const largeScale = new LargeScaleSimulationSystem();
    const result = largeScale.runBenchmark(BenchmarkScenarioType.FULL_SIMULATION, 100, 3);
    assert.ok(result);
    assert.equal(result.scenario, BenchmarkScenarioType.FULL_SIMULATION);
    assert.ok(result.totalTimeMs > 0);
    assert.ok(largeScale.getEntityCount() > 0);
  });
});

describe('M14 Cross-System Integration - End-to-End Civilization Lifecycle', () => {
  it('should simulate complete civilization lifecycle: emergence -> growth -> golden age -> decline -> collapse -> revival', () => {
    const civilization = new CivilizationSimulationSystem({
      goldenAgeThreshold: 80,
      collapseThreshold: 10,
    });
    const production = new ResourceProductionSystem();
    const distribution = new DistributionSystem();
    const coupling = new EconSocialCouplingSystem();

    // === Phase 1: Emergence ===
    const civ = civilization.createCivilization('civ_lifecycle', 'Lifecycle Civ');
    assert.equal(civ.state, CivilizationState.EMERGING);

    const recipe: ProductionRecipe = {
      id: 'recipe_food',
      name: 'Food',
      inputs: [],
      outputs: [{ resourceId: 'food', amount: 5 }],
      category: 'farming',
      baseProductionTime: 5,
    };
    production.registerRecipe(recipe);
    production.registerProducer('farm_1', ProducerType.FARM, 'Farm');

    for (let i = 0; i < 10; i++) {
      distribution.registerAgent(`citizen_${i}`, { name: 'Citizen', wealth: 50 + i * 10 });
    }

    // === Phase 2: Growth ===
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.ECONOMIC, 35);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.SOCIAL, 30);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.CULTURAL, 25);

    const growingCiv = civilization.getCivilization('civ_lifecycle')!;
    assert.ok(growingCiv.metrics.overallScore > 20);

    coupling.createCouplingLink('civ_lifecycle', 'middle');
    coupling.createNorm('norm_work', 'Hard Work', 'hard_work' as never, 'Work diligently');

    // === Phase 3: Golden Age ===
    for (const domain of Object.values(CivilizationDomainType)) {
      civilization.updateDomainScore('civ_lifecycle', domain, 85);
    }

    const goldenCiv = civilization.getCivilization('civ_lifecycle')!;
    assert.equal(goldenCiv.metrics.goldenAgeMultiplier, 1.5);
    assert.ok(goldenCiv.metrics.overallScore >= 80);

    const milestones = civilization.getReachedMilestones('civ_lifecycle');
    assert.ok(milestones.length >= 2);

    // === Phase 4: Decline ===
    civilization.triggerCrisis('civ_lifecycle', 'Plague', 'social', 70);
    civilization.triggerCrisis('civ_lifecycle', 'Famine', 'economic', 60);

    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.ECONOMIC, 40);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.SOCIAL, 35);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.CULTURAL, 45);

    const decliningCiv = civilization.getCivilization('civ_lifecycle')!;
    assert.ok(decliningCiv.metrics.crisisLevel > 0);
    assert.ok(decliningCiv.metrics.goldenAgeMultiplier === 1.0);

    // === Phase 5: Collapse ===
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.ECONOMIC, 8);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.SOCIAL, 5);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.POLITICAL, 3);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.CULTURAL, 6);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.MILITARY, 4);
    civilization.updateDomainScore('civ_lifecycle', CivilizationDomainType.TECHNOLOGICAL, 5);

    const collapsedCiv = civilization.getCivilization('civ_lifecycle')!;
    assert.equal(collapsedCiv.state, CivilizationState.COLLAPSED);
    assert.ok(collapsedCiv.collapseTick !== undefined);

    // === Phase 6: Revival ===
    const reviveResult = civilization.reviveCivilization('civ_lifecycle');
    assert.equal(reviveResult, true);

    const revivedCiv = civilization.getCivilization('civ_lifecycle')!;
    assert.equal(revivedCiv.state, CivilizationState.REVIVING);
    assert.equal(revivedCiv.collapseTick, undefined);

    // Verify full lifecycle completed
    const stats = civilization.getStats();
    assert.ok(stats.goldenAges >= 1);
    assert.ok(stats.collapses >= 1);
    assert.ok(stats.revivals >= 1);
  });

  it('should simulate multi-civilization world with trade and war', () => {
    const civilization = new CivilizationSimulationSystem();
    const trade = new TradeExchangeSystem();

    civilization.createCivilization('civ_east', 'Eastern Empire');
    civilization.createCivilization('civ_west', 'Western Kingdom');

    civilization.updateDomainScore('civ_east', CivilizationDomainType.ECONOMIC, 60);
    civilization.updateDomainScore('civ_east', CivilizationDomainType.MILITARY, 55);
    civilization.updateDomainScore('civ_west', CivilizationDomainType.ECONOMIC, 55);
    civilization.updateDomainScore('civ_west', CivilizationDomainType.MILITARY, 60);

    const tradeInteraction = civilization.startInteraction(
      'civ_east', 'civ_west', CivilizationInteractionType.TRADE,
      { strength: 0.7, benefitsA: 20, benefitsB: 25 }
    );
    assert.ok(tradeInteraction);

    const market = trade.createMarket('market_shared', MarketType.GLOBAL);
    trade.placeOrder('market_shared', 'civ_east', OrderType.SELL, 'silk', 50, 10.0);
    trade.placeOrder('market_shared', 'civ_west', OrderType.BUY, 'silk', 50, 12.0);
    const trades = trade.getTradeHistory('market_shared');
    assert.ok(trades.length > 0);

    civilization.endInteraction(tradeInteraction!.id);
    const warInteraction = civilization.startInteraction(
      'civ_east', 'civ_west', CivilizationInteractionType.WAR,
      { strength: 0.9, benefitsA: -30, benefitsB: -25 }
    );
    assert.ok(warInteraction);

    civilization.updateDomainScore('civ_east', CivilizationDomainType.ECONOMIC, 40);
    civilization.updateDomainScore('civ_west', CivilizationDomainType.ECONOMIC, 35);

    assert.equal(civilization.getActiveInteractions().length, 1);

    const comparison = civilization.compareCivilizations('civ_east', 'civ_west');
    assert.ok(comparison);
    assert.ok(comparison!.powerRatio > 0);
  });
});

describe('M14 Cross-System Integration - Serialization Integrity', () => {
  it('should serialize and deserialize all economic systems together', () => {
    const production = new ResourceProductionSystem();
    const trade = new TradeExchangeSystem();
    const distribution = new DistributionSystem();
    const coupling = new EconSocialCouplingSystem();
    const civilization = new CivilizationSimulationSystem();

    const recipe: ProductionRecipe = {
      id: 'r1', name: 'Recipe', inputs: [], outputs: [{ resourceId: 'out', amount: 1 }],
      category: 'test', baseProductionTime: 5,
    };
    production.registerRecipe(recipe);
    trade.createMarket('m1', MarketType.LOCAL);
    distribution.registerAgent('a1', { name: 'Agent', wealth: 100 });
    coupling.createCouplingLink('a1', 'middle');
    civilization.createCivilization('c1', 'Civ');

    const states = {
      production: production.serialize(),
      trade: trade.serialize(),
      distribution: distribution.serialize(),
      coupling: coupling.serialize(),
      civilization: civilization.serialize(),
    };

    const newProduction = new ResourceProductionSystem();
    const newTrade = new TradeExchangeSystem();
    const newDistribution = new DistributionSystem();
    const newCoupling = new EconSocialCouplingSystem();
    const newCivilization = new CivilizationSimulationSystem();

    newProduction.deserialize(states.production as Record<string, unknown>);
    newTrade.deserialize(states.trade as Record<string, unknown>);
    newDistribution.deserialize(states.distribution as Record<string, unknown>);
    newCoupling.deserialize(states.coupling as Record<string, unknown>);
    newCivilization.deserialize(states.civilization as Record<string, unknown>);

    assert.equal(newProduction.getAllRecipes().length, 1);
    assert.equal(newTrade.getAllMarkets().length, 1);
    assert.equal(newDistribution.getAllAgents().length, 1);
    assert.equal(newCoupling.getAllCouplingLinks().length, 1);
    assert.equal(newCivilization.getAllCivilizations().length, 1);
  });
});
