/**
 * Trade Exchange System - Unit Tests
 *
 * Tests for M14 Economic Foundation Layer - Phase 2
 * Covers: market management, order management, order matching, pricing,
 * supply-demand analysis, trade routes, caravan management, serialization
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TradeExchangeSystem } from '../src/economy/TradeExchangeSystem.js';
import {
  MarketType,
  OrderType,
  OrderStatus,
  PriceTrend,
  TradeRouteStatus,
  CaravanStatus,
  DEFAULT_TRADE_EXCHANGE_CONFIG,
} from '../src/economy/TradeExchangeTypes.js';

// Helper: create a basic market
function createTestMarket(system: TradeExchangeSystem, id: string = 'test_market'): void {
  system.createMarket(id, 'Test Market', MarketType.LOCAL, {
    taxRate: 0.05,
    transactionFee: 0.01,
  });
}

describe('TradeExchangeSystem - Configuration', () => {
  it('should use default configuration when none provided', () => {
    const system = new TradeExchangeSystem();
    assert.ok(system.enabled);
    assert.equal(system.name, 'trade-exchange-system');
  });

  it('should accept custom configuration', () => {
    const system = new TradeExchangeSystem({
      autoMatchOrders: false,
      defaultTaxRate: 0.1,
      priceVolatility: 0.2,
    });
    assert.ok(system);
  });

  it('should have valid default config values', () => {
    assert.equal(DEFAULT_TRADE_EXCHANGE_CONFIG.autoMatchOrders, true);
    assert.equal(DEFAULT_TRADE_EXCHANGE_CONFIG.defaultTaxRate, 0.05);
    assert.equal(DEFAULT_TRADE_EXCHANGE_CONFIG.defaultTransactionFee, 0.01);
    assert.equal(DEFAULT_TRADE_EXCHANGE_CONFIG.priceHistorySize, 100);
    assert.equal(DEFAULT_TRADE_EXCHANGE_CONFIG.dynamicPricing, true);
  });
});

describe('TradeExchangeSystem - Market Management', () => {
  it('should create and retrieve a market', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    const market = system.getMarket('m1');
    assert.ok(market);
    assert.equal(market!.id, 'm1');
    assert.equal(market!.name, 'Test Market');
    assert.equal(market!.type, MarketType.LOCAL);
    assert.equal(market!.taxRate, 0.05);
    assert.equal(market!.isOpen, true);
  });

  it('should return undefined for non-existent market', () => {
    const system = new TradeExchangeSystem();
    assert.equal(system.getMarket('nonexistent'), undefined);
  });

  it('should list all markets', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');
    createTestMarket(system, 'm3');

    assert.equal(system.getAllMarkets().length, 3);
  });

  it('should list only open markets', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');
    system.closeMarket('m2');

    assert.equal(system.getOpenMarkets().length, 1);
  });

  it('should update market properties', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    const result = system.updateMarket('m1', { name: 'Updated Market', taxRate: 0.1 });
    assert.equal(result, true);

    const market = system.getMarket('m1')!;
    assert.equal(market.name, 'Updated Market');
    assert.equal(market.taxRate, 0.1);
  });

  it('should open and close markets', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    assert.equal(system.closeMarket('m1'), true);
    assert.equal(system.getMarket('m1')!.isOpen, false);

    assert.equal(system.openMarket('m1'), true);
    assert.equal(system.getMarket('m1')!.isOpen, true);
  });

  it('should not close already closed market', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    system.closeMarket('m1');

    assert.equal(system.closeMarket('m1'), false);
  });
});

describe('TradeExchangeSystem - Order Management', () => {
  it('should place a buy order successfully', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    assert.equal(result.success, true);
    assert.ok(result.tradeId);

    const order = system.getOrder(result.tradeId!)!;
    assert.equal(order.type, OrderType.BUY);
    assert.equal(order.resourceTypeId, 'iron');
    assert.equal(order.amount, 10);
    assert.equal(order.price, 5.0);
    assert.equal(order.status, OrderStatus.PENDING);
  });

  it('should place a sell order successfully', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader_1', OrderType.SELL, 'iron', 10, 5.0);
    assert.equal(result.success, true);

    const order = system.getOrder(result.tradeId!)!;
    assert.equal(order.type, OrderType.SELL);
  });

  it('should fail when market does not exist', () => {
    const system = new TradeExchangeSystem();
    const result = system.placeOrder('nonexistent', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('Market not found'));
  });

  it('should fail when market is closed', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    system.closeMarket('m1');

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('closed'));
  });

  it('should fail when amount below minimum', () => {
    const system = new TradeExchangeSystem({ minOrderAmount: 5 });
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 3, 5.0);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('below minimum'));
  });

  it('should fail when amount exceeds maximum', () => {
    const system = new TradeExchangeSystem({ maxOrderAmount: 100 });
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 200, 5.0);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('exceeds maximum'));
  });

  it('should fail when price below market minimum', () => {
    const system = new TradeExchangeSystem();
    system.createMarket('m1', 'Test', MarketType.LOCAL, { minPrice: 10 });

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('below minimum'));
  });

  it('should fail when resource not supported', () => {
    const system = new TradeExchangeSystem();
    system.createMarket('m1', 'Test', MarketType.LOCAL, { supportedResources: ['iron', 'wood'] });

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'gold', 10, 5.0);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('not supported'));
  });

  it('should retrieve orders by trader', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    system.placeOrder('m1', 'trader_1', OrderType.SELL, 'wood', 5, 3.0);
    system.placeOrder('m1', 'trader_2', OrderType.BUY, 'iron', 20, 5.5);

    assert.equal(system.getOrdersByTrader('trader_1').length, 2);
    assert.equal(system.getOrdersByTrader('trader_2').length, 1);
  });

  it('should retrieve orders by market', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');

    system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    system.placeOrder('m2', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);

    assert.equal(system.getOrdersByMarket('m1').length, 1);
    assert.equal(system.getOrdersByMarket('m2').length, 1);
  });

  it('should cancel a pending order', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader_1', OrderType.BUY, 'iron', 10, 5.0);
    assert.equal(system.cancelOrder(result.tradeId!), true);
    assert.equal(system.getOrder(result.tradeId!)!.status, OrderStatus.CANCELLED);
  });

  it('should not cancel a filled order', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    // Place matching orders
    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    // Order should be filled immediately
    assert.equal(system.cancelOrder(buyResult.tradeId!), false);
  });
});

describe('TradeExchangeSystem - Order Matching', () => {
  it('should match buy and sell orders at same price', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    // Place sell order first
    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);

    // Place buy order at same price - should match immediately
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const buyOrder = system.getOrder(buyResult.tradeId!)!;
    assert.equal(buyOrder.status, OrderStatus.FILLED);
    assert.equal(buyOrder.filledAmount, 10);
  });

  it('should match when buy price >= sell price', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 6.0);

    const buyOrder = system.getOrder(buyResult.tradeId!)!;
    assert.equal(buyOrder.status, OrderStatus.FILLED);
    // Executes at sell order's price (maker-taker)
    assert.equal(buyResult.executedPrice, 5.0);
  });

  it('should not match when buy price < sell price', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 6.0);
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const buyOrder = system.getOrder(buyResult.tradeId!)!;
    assert.equal(buyOrder.status, OrderStatus.PENDING);
  });

  it('should partially fill when amounts differ', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 5, 5.0);
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const buyOrder = system.getOrder(buyResult.tradeId!)!;
    assert.equal(buyOrder.status, OrderStatus.PARTIAL);
    assert.equal(buyOrder.filledAmount, 5);
  });

  it('should match multiple sell orders for one large buy order', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 5, 5.0);
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'iron', 5, 5.5);
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 6.0);

    const buyOrder = system.getOrder(buyResult.tradeId!)!;
    assert.equal(buyOrder.status, OrderStatus.FILLED);
    assert.equal(buyOrder.filledAmount, 10);
  });

  it('should prioritize lower sell prices for buy orders', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 5, 6.0);
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'iron', 5, 5.0);
    const buyResult = system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 5, 6.0);

    // Should match with seller2 (lower price)
    assert.equal(buyResult.executedPrice, 5.0);
  });

  it('should record trade in trade history', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const trades = system.getTradeHistory('m1');
    assert.equal(trades.length, 1);
    assert.equal(trades[0].resourceTypeId, 'iron');
    assert.equal(trades[0].amount, 10);
    assert.equal(trades[0].price, 5.0);
  });

  it('should calculate tax and fees on trade', () => {
    const system = new TradeExchangeSystem();
    system.createMarket('m1', 'Test', MarketType.LOCAL, { taxRate: 0.1, transactionFee: 0.05 });

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 10.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 10.0);

    const trades = system.getTradeHistory('m1');
    assert.equal(trades.length, 1);
    assert.equal(trades[0].totalValue, 100);
    assert.equal(trades[0].taxPaid, 10); // 10% of 100
    assert.equal(trades[0].feePaid, 5); // 5% of 100
  });
});

describe('TradeExchangeSystem - Pricing', () => {
  it('should record price after trade', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const price = system.getResourcePrice('m1', 'iron');
    assert.ok(price);
    assert.equal(price!.currentPrice, 5.0);
  });

  it('should return undefined for resource with no price history', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    assert.equal(system.getResourcePrice('m1', 'gold'), undefined);
  });

  it('should calculate price change', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    // First trade at 5.0
    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer1', OrderType.BUY, 'iron', 10, 5.0);

    // Advance tick
    system.tick(1 / 60, null, null);

    // Second trade at 6.0
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'iron', 10, 6.0);
    system.placeOrder('m1', 'buyer2', OrderType.BUY, 'iron', 10, 6.0);

    const price = system.getResourcePrice('m1', 'iron');
    assert.ok(price);
    assert.equal(price!.currentPrice, 6.0);
    assert.equal(price!.previousPrice, 5.0);
    assert.equal(price!.priceChange, 1.0);
    assert.ok(price!.priceChangePercent > 0);
  });

  it('should retrieve price history', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    for (let i = 0; i < 5; i++) {
      system.placeOrder('m1', `seller${i}`, OrderType.SELL, 'iron', 10, 5.0 + i);
      system.placeOrder('m1', `buyer${i}`, OrderType.BUY, 'iron', 10, 5.0 + i);
      system.tick(1 / 60, null, null);
    }

    const history = system.getPriceHistory('m1', 'iron');
    assert.ok(history.length >= 5);
  });

  it('should limit price history size', () => {
    const system = new TradeExchangeSystem({ priceHistorySize: 3 });
    createTestMarket(system, 'm1');

    for (let i = 0; i < 10; i++) {
      system.placeOrder('m1', `seller${i}`, OrderType.SELL, 'iron', 10, 5.0);
      system.placeOrder('m1', `buyer${i}`, OrderType.BUY, 'iron', 10, 5.0);
      system.tick(1 / 60, null, null);
    }

    const history = system.getPriceHistory('m1', 'iron');
    assert.ok(history.length <= 3);
  });
});

describe('TradeExchangeSystem - Supply-Demand Analysis', () => {
  it('should calculate supply and demand', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'iron', 20, 5.5);
    system.placeOrder('m1', 'buyer1', OrderType.BUY, 'iron', 15, 6.0);

    const sd = system.getSupplyDemand('m1', 'iron');
    assert.equal(sd.totalSupply, 30);
    assert.equal(sd.totalDemand, 15);
    assert.ok(sd.ratio < 1); // Demand < Supply
  });

  it('should calculate price pressure', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    // High demand, low supply -> positive price pressure
    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 5, 5.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 20, 6.0);

    const sd = system.getSupplyDemand('m1', 'iron');
    assert.ok(sd.pricePressure > 0);
  });

  it('should return market depth', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'iron', 5, 5.5);
    system.placeOrder('m1', 'buyer1', OrderType.BUY, 'iron', 8, 4.5);

    const sd = system.getSupplyDemand('m1', 'iron');
    assert.ok(sd.depth.length > 0);
    assert.ok(sd.depth.some(d => d.buyVolume > 0));
    assert.ok(sd.depth.some(d => d.sellVolume > 0));
  });
});

describe('TradeExchangeSystem - Trade Routes', () => {
  it('should create a trade route', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'origin');
    createTestMarket(system, 'destination');

    const result = system.createTradeRoute('route1', 'Test Route', 'origin', 'destination', {
      distance: 20,
      dangerLevel: 10,
    });

    assert.equal(result.success, true);
    const route = system.getTradeRoute('route1')!;
    assert.equal(route.name, 'Test Route');
    assert.equal(route.distance, 20);
    assert.equal(route.status, TradeRouteStatus.ACTIVE);
  });

  it('should fail when origin market does not exist', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'destination');

    const result = system.createTradeRoute('route1', 'Test', 'nonexistent', 'destination');
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('Origin market not found'));
  });

  it('should fail when destination market does not exist', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'origin');

    const result = system.createTradeRoute('route1', 'Test', 'origin', 'nonexistent');
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('Destination market not found'));
  });

  it('should list all trade routes', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');
    createTestMarket(system, 'm3');

    system.createTradeRoute('r1', 'Route 1', 'm1', 'm2');
    system.createTradeRoute('r2', 'Route 2', 'm2', 'm3');

    assert.equal(system.getAllTradeRoutes().length, 2);
  });

  it('should list only active routes', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');

    system.createTradeRoute('r1', 'Route 1', 'm1', 'm2');
    system.createTradeRoute('r2', 'Route 2', 'm1', 'm2', { status: TradeRouteStatus.BLOCKED });

    assert.equal(system.getActiveTradeRoutes().length, 1);
  });

  it('should update trade route', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');

    system.createTradeRoute('r1', 'Route 1', 'm1', 'm2');
    const result = system.updateTradeRoute('r1', { dangerLevel: 50, averageProfitMargin: 0.3 });

    assert.equal(result, true);
    assert.equal(system.getTradeRoute('r1')!.dangerLevel, 50);
  });
});

describe('TradeExchangeSystem - Caravan Management', () => {
  it('should send a caravan', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'origin');
    createTestMarket(system, 'destination');
    system.createTradeRoute('route1', 'Test Route', 'origin', 'destination', { distance: 10 });

    const result = system.sendCaravan('owner1', 'route1', [
      { resourceTypeId: 'iron', amount: 50, purchasePrice: 5.0 },
    ], 100);

    assert.equal(result.success, true);
    const caravan = system.getCaravan(result.tradeId!)!;
    assert.equal(caravan.ownerId, 'owner1');
    assert.equal(caravan.status, CaravanStatus.TRAVELING);
    assert.equal(caravan.cargo.length, 1);
    assert.equal(caravan.cargoValue, 250); // 50 * 5.0
  });

  it('should fail when route does not exist', () => {
    const system = new TradeExchangeSystem();
    const result = system.sendCaravan('owner1', 'nonexistent', [], 100);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('Trade route not found'));
  });

  it('should fail when route is not active', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'origin');
    createTestMarket(system, 'destination');
    system.createTradeRoute('route1', 'Test', 'origin', 'destination', {
      status: TradeRouteStatus.BLOCKED,
    });

    const result = system.sendCaravan('owner1', 'route1', [], 100);
    assert.equal(result.success, false);
    assert.ok(result.reason!.includes('not active'));
  });

  it('should retrieve caravans by owner', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'origin');
    createTestMarket(system, 'destination');
    system.createTradeRoute('route1', 'Test', 'origin', 'destination', { distance: 100 });

    system.sendCaravan('owner1', 'route1', [], 100);
    system.sendCaravan('owner1', 'route1', [], 200);
    system.sendCaravan('owner2', 'route1', [], 300);

    assert.equal(system.getCaravansByOwner('owner1').length, 2);
    assert.equal(system.getCaravansByOwner('owner2').length, 1);
  });

  it('should update caravan progress on tick', () => {
    const system = new TradeExchangeSystem({ caravanSpeed: 1.0 });
    createTestMarket(system, 'origin');
    createTestMarket(system, 'destination');
    system.createTradeRoute('route1', 'Test', 'origin', 'destination', { distance: 10 });

    const result = system.sendCaravan('owner1', 'route1', [], 100);
    const caravanId = result.tradeId!;

    // Initial progress
    assert.equal(system.getCaravan(caravanId)!.progress, 0);

    // Tick several times
    for (let i = 0; i < 5; i++) {
      system.tick(1 / 60, null, null);
    }

    // Progress should have increased
    assert.ok(system.getCaravan(caravanId)!.progress > 0);
  });

  it('should complete caravan journey after enough ticks', () => {
    const system = new TradeExchangeSystem({ caravanSpeed: 10.0 });
    createTestMarket(system, 'origin');
    createTestMarket(system, 'destination');
    system.createTradeRoute('route1', 'Test', 'origin', 'destination', { distance: 1, dangerLevel: 0 });

    const result = system.sendCaravan('owner1', 'route1', [], 100);
    const caravanId = result.tradeId!;

    // Tick enough to complete (distance 1 / speed 10 = 0.1 per tick, so ~10 ticks)
    for (let i = 0; i < 20; i++) {
      system.tick(1 / 60, null, null);
    }

    const caravan = system.getCaravan(caravanId)!;
    assert.equal(caravan.status, CaravanStatus.IDLE);
    assert.equal(caravan.progress, 1);
    assert.ok(caravan.arrivalTick);
  });
});

describe('TradeExchangeSystem - Order Expiration', () => {
  it('should expire orders after expiration tick', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader1', OrderType.BUY, 'iron', 10, 5.0, {
      expiresAtTick: 5,
    });

    // Tick past expiration
    for (let i = 0; i < 6; i++) {
      system.tick(1 / 60, null, null);
    }

    assert.equal(system.getOrder(result.tradeId!)!.status, OrderStatus.EXPIRED);
  });

  it('should not expire orders without expiration', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader1', OrderType.BUY, 'iron', 10, 5.0);

    for (let i = 0; i < 10; i++) {
      system.tick(1 / 60, null, null);
    }

    assert.equal(system.getOrder(result.tradeId!)!.status, OrderStatus.PENDING);
  });
});

describe('TradeExchangeSystem - Statistics', () => {
  it('should track market statistics', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const stats = system.getStats();
    assert.equal(stats.totalMarkets, 1);
    assert.equal(stats.activeMarkets, 1);
    assert.ok(stats.totalOrders >= 2);
    assert.equal(stats.totalTrades, 1);
    assert.equal(stats.totalVolume, 10);
    assert.equal(stats.totalValue, 50);
    assert.ok(stats.totalTaxCollected > 0);
    assert.ok(stats.totalFeesCollected > 0);
  });

  it('should track trade volume by resource', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer1', OrderType.BUY, 'iron', 10, 5.0);
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'wood', 20, 3.0);
    system.placeOrder('m1', 'buyer2', OrderType.BUY, 'wood', 20, 3.0);

    const stats = system.getStats();
    assert.equal(stats.tradeVolumeByResource['iron'], 10);
    assert.equal(stats.tradeVolumeByResource['wood'], 20);
  });
});

describe('TradeExchangeSystem - Trade History', () => {
  it('should retrieve trade history by market', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);
    system.placeOrder('m2', 'seller', OrderType.SELL, 'wood', 5, 3.0);
    system.placeOrder('m2', 'buyer', OrderType.BUY, 'wood', 5, 3.0);

    assert.equal(system.getTradeHistory('m1').length, 1);
    assert.equal(system.getTradeHistory('m2').length, 1);
  });

  it('should retrieve trade history by resource', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    system.placeOrder('m1', 'seller1', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer1', OrderType.BUY, 'iron', 10, 5.0);
    system.placeOrder('m1', 'seller2', OrderType.SELL, 'wood', 5, 3.0);
    system.placeOrder('m1', 'buyer2', OrderType.BUY, 'wood', 5, 3.0);

    assert.equal(system.getTradeHistory(undefined, 'iron').length, 1);
    assert.equal(system.getTradeHistory(undefined, 'wood').length, 1);
  });

  it('should limit trade history', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');

    for (let i = 0; i < 10; i++) {
      system.placeOrder('m1', `seller${i}`, OrderType.SELL, 'iron', 1, 5.0);
      system.placeOrder('m1', `buyer${i}`, OrderType.BUY, 'iron', 1, 5.0);
    }

    const history = system.getTradeHistory('m1', undefined, 5);
    assert.equal(history.length, 5);
  });
});

describe('TradeExchangeSystem - Serialization', () => {
  it('should serialize and deserialize system state', () => {
    const system = new TradeExchangeSystem();
    createTestMarket(system, 'm1');
    createTestMarket(system, 'm2');
    system.createTradeRoute('r1', 'Route', 'm1', 'm2', { distance: 10 });

    system.placeOrder('m1', 'seller', OrderType.SELL, 'iron', 10, 5.0);
    system.placeOrder('m1', 'buyer', OrderType.BUY, 'iron', 10, 5.0);

    const serialized = system.serialize();
    assert.ok(serialized);
    assert.ok(serialized.markets);
    assert.ok(serialized.orders);
    assert.ok(serialized.trades);
    assert.ok(serialized.routes);

    const newSystem = new TradeExchangeSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllMarkets().length, 2);
    assert.equal(newSystem.getAllTradeRoutes().length, 1);
    assert.ok(newSystem.getTradeHistory('m1').length >= 1);
  });

  it('should preserve order state after serialization', () => {
    const system = new TradeExchangeSystem({ autoMatchOrders: false });
    createTestMarket(system, 'm1');

    const result = system.placeOrder('m1', 'trader1', OrderType.BUY, 'iron', 10, 5.0);
    const orderId = result.tradeId!;

    const serialized = system.serialize();
    const newSystem = new TradeExchangeSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    const restoredOrder = newSystem.getOrder(orderId)!;
    assert.equal(restoredOrder.status, OrderStatus.PENDING);
    assert.equal(restoredOrder.amount, 10);
    assert.equal(restoredOrder.price, 5.0);
  });

  it('should handle empty system serialization', () => {
    const system = new TradeExchangeSystem();
    const serialized = system.serialize();

    const newSystem = new TradeExchangeSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getAllMarkets().length, 0);
    assert.equal(newSystem.getAllTradeRoutes().length, 0);
  });
});
