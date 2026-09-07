/**
 * Distribution System - Unit Tests
 *
 * Tests for M14 Economic Foundation Layer - Phase 3
 * Covers: agent management, distribution pools, allocation methods,
 * wealth transfers, inequality measurement, class distribution,
 * social mobility, redistribution policies, serialization
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DistributionSystem } from '../src/economy/DistributionSystem.js';
import {
  DistributionMethod,
  EconomicClass,
  WealthSourceType,
  DEFAULT_DISTRIBUTION_CONFIG,
} from '../src/economy/DistributionTypes.js';

// Helper: create test agents with varying wealth
function createTestAgents(system: DistributionSystem, count: number = 5): void {
  for (let i = 0; i < count; i++) {
    system.registerAgent(`agent_${i}`, {
      name: `Agent ${i}`,
      wealth: 100 * (i + 1),
      currency: 100 * (i + 1),
      income: 10 * (i + 1),
    });
  }
}

describe('DistributionSystem - Configuration', () => {
  it('should use default configuration when none provided', () => {
    const system = new DistributionSystem();
    assert.ok(system.enabled);
    assert.equal(system.name, 'distribution-system');
  });

  it('should accept custom configuration', () => {
    const system = new DistributionSystem({
      povertyLine: 200,
      defaultMethod: DistributionMethod.NEED_BASED,
    });
    assert.ok(system);
  });

  it('should have valid default config values', () => {
    assert.equal(DEFAULT_DISTRIBUTION_CONFIG.povertyLine, 100);
    assert.equal(DEFAULT_DISTRIBUTION_CONFIG.defaultMethod, DistributionMethod.EQUAL);
    assert.equal(DEFAULT_DISTRIBUTION_CONFIG.autoCalculateClasses, true);
    assert.equal(DEFAULT_DISTRIBUTION_CONFIG.giniWarningThreshold, 0.5);
  });
});

describe('DistributionSystem - Agent Management', () => {
  it('should register and retrieve an agent', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { name: 'Test Agent', wealth: 500, currency: 500 });

    const agent = system.getAgent('a1')!;
    assert.equal(agent.id, 'a1');
    assert.equal(agent.name, 'Test Agent');
    assert.equal(agent.wealth, 500);
    assert.equal(agent.currency, 500);
  });

  it('should return undefined for non-existent agent', () => {
    const system = new DistributionSystem();
    assert.equal(system.getAgent('nonexistent'), undefined);
  });

  it('should list all agents', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 5);
    assert.equal(system.getAllAgents().length, 5);
  });

  it('should auto-calculate economic class based on wealth', () => {
    const system = new DistributionSystem();
    system.registerAgent('poor', { wealth: 50, currency: 50 });
    system.registerAgent('middle', { wealth: 600, currency: 600 });
    system.registerAgent('rich', { wealth: 10000, currency: 10000 });

    assert.equal(system.getAgent('poor')!.economicClass, EconomicClass.POOR);
    assert.equal(system.getAgent('middle')!.economicClass, EconomicClass.MIDDLE);
    assert.equal(system.getAgent('rich')!.economicClass, EconomicClass.RICH);
  });

  it('should update agent properties', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 100, currency: 100 });

    const result = system.updateAgent('a1', { currency: 200, income: 50 });
    assert.equal(result, true);
    assert.equal(system.getAgent('a1')!.currency, 200);
    assert.equal(system.getAgent('a1')!.income, 50);
  });

  it('should add wealth to agent', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 100, currency: 100 });

    const result = system.addWealth('a1', 50, WealthSourceType.LABOR);
    assert.equal(result, true);
    assert.equal(system.getAgent('a1')!.currency, 150);
    assert.equal(system.getAgent('a1')!.wealth, 150);
    assert.equal(system.getAgent('a1')!.wealthSources[WealthSourceType.LABOR], 50);
  });

  it('should remove wealth from agent', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 100, currency: 100 });

    const result = system.removeWealth('a1', 30);
    assert.equal(result, true);
    assert.equal(system.getAgent('a1')!.currency, 70);
  });

  it('should not remove more wealth than agent has', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 50, currency: 50 });

    const result = system.removeWealth('a1', 100);
    assert.equal(result, false);
    assert.equal(system.getAgent('a1')!.currency, 50);
  });

  it('should track class changes when wealth changes', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 50, currency: 50 });
    assert.equal(system.getAgent('a1')!.economicClass, EconomicClass.POOR);

    system.addWealth('a1', 500); // 50 + 500 = 550 -> MIDDLE (500-1000)
    assert.equal(system.getAgent('a1')!.economicClass, EconomicClass.MIDDLE);
  });
});

describe('DistributionSystem - Distribution Pools', () => {
  it('should create a distribution pool', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3);

    const pool = system.createPool(
      'p1', 'Test Pool', 'currency', 300,
      DistributionMethod.EQUAL,
      ['agent_0', 'agent_1', 'agent_2']
    );

    assert.equal(pool.id, 'p1');
    assert.equal(pool.totalAmount, 300);
    assert.equal(pool.method, DistributionMethod.EQUAL);
    assert.equal(pool.eligibleAgents.length, 3);
    assert.equal(pool.isComplete, false);
  });

  it('should retrieve pool by id', () => {
    const system = new DistributionSystem();
    system.createPool('p1', 'Test', 'currency', 100, DistributionMethod.EQUAL, []);
    assert.ok(system.getPool('p1'));
    assert.equal(system.getPool('nonexistent'), undefined);
  });

  it('should list all pools', () => {
    const system = new DistributionSystem();
    system.createPool('p1', 'Pool 1', 'currency', 100, DistributionMethod.EQUAL, []);
    system.createPool('p2', 'Pool 2', 'currency', 200, DistributionMethod.EQUAL, []);
    assert.equal(system.getAllPools().length, 2);
  });

  it('should list only active pools', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 2);

    system.createPool('p1', 'Pool 1', 'currency', 100, DistributionMethod.EQUAL, ['agent_0']);
    system.createPool('p2', 'Pool 2', 'currency', 200, DistributionMethod.EQUAL, ['agent_0']);

    system.executeDistribution('p1');
    assert.equal(system.getActivePools().length, 1);
  });
});

describe('DistributionSystem - Allocation Methods', () => {
  it('should distribute equally among agents', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 4);

    system.createPool(
      'p1', 'Equal Pool', 'currency', 400,
      DistributionMethod.EQUAL,
      ['agent_0', 'agent_1', 'agent_2', 'agent_3']
    );

    const results = system.executeDistribution('p1');
    assert.equal(results.length, 4);
    assert.ok(results.every(r => r.success));
    assert.ok(results.every(r => r.amount === 100));
  });

  it('should distribute proportionally to wealth', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3); // wealth: 100, 200, 300

    system.createPool(
      'p1', 'Proportional Pool', 'currency', 600,
      DistributionMethod.PROPORTIONAL,
      ['agent_0', 'agent_1', 'agent_2']
    );

    const results = system.executeDistribution('p1');
    assert.equal(results.length, 3);
    // Agent 2 (wealth 300) should get the most
    const agent2Result = results.find(r => r.agentId === 'agent_2')!;
    const agent0Result = results.find(r => r.agentId === 'agent_0')!;
    assert.ok(agent2Result.amount! > agent0Result.amount!);
  });

  it('should distribute based on need (poorer gets more)', () => {
    const system = new DistributionSystem({ povertyLine: 150 });
    createTestAgents(system, 3); // wealth: 100 (poor), 200, 300

    system.createPool(
      'p1', 'Need Pool', 'currency', 600,
      DistributionMethod.NEED_BASED,
      ['agent_0', 'agent_1', 'agent_2']
    );

    const results = system.executeDistribution('p1');
    assert.equal(results.length, 3);
    // Agent 0 (poor, below poverty line) should get more
    const agent0Result = results.find(r => r.agentId === 'agent_0')!;
    const agent2Result = results.find(r => r.agentId === 'agent_2')!;
    assert.ok(agent0Result.amount! > agent2Result.amount!);
  });

  it('should distribute based on merit (higher income gets more)', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3); // income: 10, 20, 30

    system.createPool(
      'p1', 'Merit Pool', 'currency', 300,
      DistributionMethod.MERIT_BASED,
      ['agent_0', 'agent_1', 'agent_2']
    );

    const results = system.executeDistribution('p1');
    assert.equal(results.length, 3);
    // Agent 2 (income 30) should get the most
    const agent2Result = results.find(r => r.agentId === 'agent_2')!;
    const agent0Result = results.find(r => r.agentId === 'agent_0')!;
    assert.ok(agent2Result.amount! > agent0Result.amount!);
  });

  it('should distribute randomly', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3);

    system.createPool(
      'p1', 'Random Pool', 'currency', 300,
      DistributionMethod.RANDOM,
      ['agent_0', 'agent_1', 'agent_2']
    );

    const results = system.executeDistribution('p1');
    assert.ok(results.length > 0);
    assert.ok(results.every(r => r.success));
  });

  it('should distribute first come first served', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3);

    system.createPool(
      'p1', 'FCFS Pool', 'currency', 300,
      DistributionMethod.FIRST_COME,
      ['agent_0', 'agent_1', 'agent_2']
    );

    const results = system.executeDistribution('p1');
    assert.equal(results.length, 3);
    assert.ok(results.every(r => r.success));
  });

  it('should mark pool as complete after distribution', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 2);

    system.createPool(
      'p1', 'Test', 'currency', 200,
      DistributionMethod.EQUAL,
      ['agent_0', 'agent_1']
    );

    system.executeDistribution('p1');
    assert.equal(system.getPool('p1')!.isComplete, true);
  });

  it('should not execute already complete pool', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 2);

    system.createPool(
      'p1', 'Test', 'currency', 200,
      DistributionMethod.EQUAL,
      ['agent_0', 'agent_1']
    );

    system.executeDistribution('p1');
    const results = system.executeDistribution('p1');
    assert.equal(results.length, 1);
    assert.equal(results[0].success, false);
  });
});

describe('DistributionSystem - Wealth Transfers', () => {
  it('should transfer wealth between agents', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 200, currency: 200 });
    system.registerAgent('a2', { wealth: 100, currency: 100 });

    const result = system.transferWealth('a1', 'a2', 50, 'gift');
    assert.equal(result, true);
    assert.equal(system.getAgent('a1')!.currency, 150);
    assert.equal(system.getAgent('a2')!.currency, 150);
  });

  it('should fail if sender has insufficient funds', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 50, currency: 50 });
    system.registerAgent('a2', { wealth: 100, currency: 100 });

    const result = system.transferWealth('a1', 'a2', 100, 'gift');
    assert.equal(result, false);
  });

  it('should fail if agent does not exist', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 100, currency: 100 });

    assert.equal(system.transferWealth('a1', 'nonexistent', 50, 'gift'), false);
    assert.equal(system.transferWealth('nonexistent', 'a1', 50, 'gift'), false);
  });

  it('should track transfer history', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 200, currency: 200 });
    system.registerAgent('a2', { wealth: 100, currency: 100 });

    system.transferWealth('a1', 'a2', 50, 'gift');
    system.transferWealth('a2', 'a1', 25, 'repayment');

    const allTransfers = system.getTransferHistory();
    assert.equal(allTransfers.length, 2);

    const agent1Transfers = system.getTransferHistory('a1');
    assert.equal(agent1Transfers.length, 2);
  });

  it('should mark redistribution transfers', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 200, currency: 200 });
    system.registerAgent('a2', { wealth: 50, currency: 50 });

    system.transferWealth('a1', 'a2', 50, 'tax', true);
    const transfers = system.getTransferHistory();
    assert.equal(transfers[0].isRedistribution, true);
  });
});

describe('DistributionSystem - Inequality Measurement', () => {
  it('should calculate Gini coefficient of 0 for perfect equality', () => {
    const system = new DistributionSystem();
    for (let i = 0; i < 5; i++) {
      system.registerAgent(`a${i}`, { wealth: 100, currency: 100 });
    }

    const inequality = system.calculateInequality();
    assert.equal(inequality.giniCoefficient, 0);
  });

  it('should calculate positive Gini coefficient for inequality', () => {
    const system = new DistributionSystem();
    system.registerAgent('poor', { wealth: 10, currency: 10 });
    system.registerAgent('rich', { wealth: 1000, currency: 1000 });

    const inequality = system.calculateInequality();
    assert.ok(inequality.giniCoefficient > 0);
    assert.ok(inequality.giniCoefficient <= 1);
  });

  it('should calculate Palma ratio', () => {
    const system = new DistributionSystem();
    for (let i = 0; i < 10; i++) {
      system.registerAgent(`a${i}`, { wealth: 10 * (i + 1), currency: 10 * (i + 1) });
    }

    const inequality = system.calculateInequality();
    assert.ok(inequality.palmaRatio > 0);
  });

  it('should calculate quintile share ratio', () => {
    const system = new DistributionSystem();
    for (let i = 0; i < 10; i++) {
      system.registerAgent(`a${i}`, { wealth: 10 * (i + 1), currency: 10 * (i + 1) });
    }

    const inequality = system.calculateInequality();
    assert.ok(inequality.quintileShareRatio > 0);
  });

  it('should calculate top 1% and 10% wealth shares', () => {
    const system = new DistributionSystem();
    for (let i = 0; i < 100; i++) {
      system.registerAgent(`a${i}`, { wealth: i + 1, currency: i + 1 });
    }

    const inequality = system.calculateInequality();
    assert.ok(inequality.top1PercentShare > 0);
    assert.ok(inequality.top10PercentShare > 0);
    assert.ok(inequality.top10PercentShare > inequality.top1PercentShare);
  });

  it('should calculate poverty metrics', () => {
    const system = new DistributionSystem({ povertyLine: 50 });
    system.registerAgent('poor1', { wealth: 10, currency: 10 });
    system.registerAgent('poor2', { wealth: 30, currency: 30 });
    system.registerAgent('rich', { wealth: 200, currency: 200 });

    const inequality = system.calculateInequality();
    assert.equal(inequality.povertyCount, 2);
    assert.ok(inequality.povertyRate > 0);
    assert.equal(inequality.povertyLine, 50);
  });

  it('should calculate mean and median wealth', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 100, currency: 100 });
    system.registerAgent('a2', { wealth: 200, currency: 200 });
    system.registerAgent('a3', { wealth: 300, currency: 300 });

    const inequality = system.calculateInequality();
    assert.equal(inequality.meanWealth, 200);
    assert.equal(inequality.medianWealth, 200);
  });

  it('should return empty metrics for no agents', () => {
    const system = new DistributionSystem();
    const inequality = system.calculateInequality();
    assert.equal(inequality.giniCoefficient, 0);
    assert.equal(inequality.meanWealth, 0);
  });
});

describe('DistributionSystem - Class Distribution', () => {
  it('should calculate class distribution', () => {
    const system = new DistributionSystem();
    system.registerAgent('poor', { wealth: 50, currency: 50 });
    system.registerAgent('middle', { wealth: 600, currency: 600 });
    system.registerAgent('rich', { wealth: 10000, currency: 10000 });

    const distribution = system.calculateClassDistribution();
    assert.equal(distribution.classCounts[EconomicClass.POOR], 1);
    assert.equal(distribution.classCounts[EconomicClass.MIDDLE], 1);
    assert.equal(distribution.classCounts[EconomicClass.RICH], 1);
  });

  it('should calculate class percentages', () => {
    const system = new DistributionSystem();
    for (let i = 0; i < 4; i++) {
      system.registerAgent(`poor${i}`, { wealth: 50, currency: 50 });
    }

    const distribution = system.calculateClassDistribution();
    assert.equal(distribution.classPercentages[EconomicClass.POOR], 1.0);
  });

  it('should calculate class wealth share', () => {
    const system = new DistributionSystem();
    system.registerAgent('poor', { wealth: 100, currency: 100 });
    system.registerAgent('rich', { wealth: 900, currency: 900 });

    // Both are in MIDDLE class (100 and 900 are between 500 and 1000... wait 100 is POOR)
    // 100 -> POOR (50-200), 900 -> MIDDLE (500-1000)
    const distribution = system.calculateClassDistribution();
    assert.ok(distribution.classWealthShare[EconomicClass.MIDDLE] > 0);
    assert.ok(distribution.classWealthShare[EconomicClass.POOR] > 0);
  });

  it('should calculate economic class from wealth', () => {
    const system = new DistributionSystem();
    assert.equal(system.calculateEconomicClass(0), EconomicClass.DESTITUTE);
    assert.equal(system.calculateEconomicClass(75), EconomicClass.POOR);
    assert.equal(system.calculateEconomicClass(300), EconomicClass.WORKING);
    assert.equal(system.calculateEconomicClass(700), EconomicClass.MIDDLE);
    assert.equal(system.calculateEconomicClass(1500), EconomicClass.UPPER_MIDDLE);
    assert.equal(system.calculateEconomicClass(10000), EconomicClass.RICH);
    assert.equal(system.calculateEconomicClass(50000), EconomicClass.WEALTHY);
    assert.equal(system.calculateEconomicClass(200000), EconomicClass.ULTRA_RICH);
  });
});

describe('DistributionSystem - Social Mobility', () => {
  it('should calculate mobility metrics', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 50, currency: 50, mobilityScore: 80 });
    system.registerAgent('a2', { wealth: 600, currency: 600, mobilityScore: 60 });

    // Trigger class change
    system.addWealth('a1', 1000);

    const mobility = system.calculateMobility();
    assert.ok(mobility.averageMobilityScore > 0);
    assert.ok(mobility.upwardMobilityRate >= 0);
  });

  it('should track class transition matrix', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 50, currency: 50 });

    // Move up multiple classes
    system.addWealth('a1', 1000);
    system.addWealth('a1', 10000);

    const mobility = system.calculateMobility();
    assert.ok(Object.keys(mobility.transitionMatrix).length > 0);
  });
});

describe('DistributionSystem - Redistribution Policies', () => {
  it('should add and retrieve redistribution policy', () => {
    const system = new DistributionSystem();
    system.addPolicy({
      id: 'tax1',
      name: 'Income Tax',
      type: 'tax',
      enabled: true,
      rate: 0.1,
      threshold: 100,
      resourceType: 'currency',
      priority: 1,
    });

    assert.ok(system.getPolicy('tax1'));
    assert.equal(system.getAllPolicies().length, 1);
  });

  it('should remove policy', () => {
    const system = new DistributionSystem();
    system.addPolicy({
      id: 'tax1', name: 'Tax', type: 'tax',
      enabled: true, rate: 0.1, resourceType: 'currency', priority: 1,
    });

    assert.equal(system.removePolicy('tax1'), true);
    assert.equal(system.getPolicy('tax1'), undefined);
  });

  it('should apply progressive tax policy', () => {
    const system = new DistributionSystem();
    system.registerAgent('poor', { wealth: 50, currency: 50 });
    system.registerAgent('rich', { wealth: 1000, currency: 1000 });

    system.addPolicy({
      id: 'tax1', name: 'Wealth Tax', type: 'tax',
      enabled: true, rate: 0.1, threshold: 100,
      resourceType: 'currency', priority: 1,
    });

    system.applyRedistribution();

    // Rich agent (above threshold) should be taxed
    assert.ok(system.getAgent('rich')!.currency < 1000);
    // Poor agent (below threshold) should not be taxed
    assert.equal(system.getAgent('poor')!.currency, 50);
  });

  it('should apply welfare policy', () => {
    const system = new DistributionSystem({ povertyLine: 100 });
    system.registerAgent('poor', { wealth: 50, currency: 50 });
    system.registerAgent('rich', { wealth: 1000, currency: 1000 });

    system.addPolicy({
      id: 'welfare1', name: 'Welfare', type: 'welfare',
      enabled: true, rate: 0.5, threshold: 100,
      resourceType: 'currency', priority: 1,
    });

    system.applyRedistribution();

    // Poor agent should receive welfare
    assert.ok(system.getAgent('poor')!.currency > 50);
  });

  it('should apply universal basic income', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 50, currency: 50 });
    system.registerAgent('a2', { wealth: 1000, currency: 1000 });

    system.addPolicy({
      id: 'ubi1', name: 'UBI', type: 'universal_basic_income',
      enabled: true, rate: 100, resourceType: 'currency', priority: 1,
    });

    system.applyRedistribution();

    assert.equal(system.getAgent('a1')!.currency, 150);
    assert.equal(system.getAgent('a2')!.currency, 1100);
  });
});

describe('DistributionSystem - Statistics', () => {
  it('should track distribution statistics', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3);

    system.createPool(
      'p1', 'Test', 'currency', 300,
      DistributionMethod.EQUAL,
      ['agent_0', 'agent_1', 'agent_2']
    );
    system.executeDistribution('p1');

    const stats = system.getStats();
    assert.equal(stats.totalAgents, 3);
    assert.equal(stats.totalPools, 1);
    assert.equal(stats.completedPools, 1);
    assert.ok(stats.totalDistributed > 0);
    assert.ok(stats.totalWealth > 0);
  });
});

describe('DistributionSystem - Serialization', () => {
  it('should serialize and deserialize system state', () => {
    const system = new DistributionSystem();
    createTestAgents(system, 3);

    system.createPool(
      'p1', 'Test', 'currency', 300,
      DistributionMethod.EQUAL,
      ['agent_0', 'agent_1', 'agent_2']
    );

    system.transferWealth('agent_0', 'agent_1', 50, 'test');

    const serialized = system.serialize();
    assert.ok(serialized);
    assert.ok(serialized.agents);
    assert.ok(serialized.pools);
    assert.ok(serialized.transfers);

    const newSystem = new DistributionSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllAgents().length, 3);
    assert.equal(newSystem.getAllPools().length, 1);
    assert.ok(newSystem.getTransferHistory().length >= 1);
  });

  it('should preserve agent wealth after serialization', () => {
    const system = new DistributionSystem();
    system.registerAgent('a1', { wealth: 500, currency: 500 });

    const serialized = system.serialize();
    const newSystem = new DistributionSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAgent('a1')!.wealth, 500);
    assert.equal(newSystem.getAgent('a1')!.currency, 500);
  });

  it('should handle empty system serialization', () => {
    const system = new DistributionSystem();
    const serialized = system.serialize();

    const newSystem = new DistributionSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllAgents().length, 0);
    assert.equal(newSystem.getAllPools().length, 0);
  });
});
