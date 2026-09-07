/**
 * Trade Exchange System
 *
 * M14 Economic Foundation Layer - Phase 2
 *
 * Provides market management, order placement and matching, dynamic pricing
 * based on supply-demand, price history tracking, trade routes, and caravan
 * management. This extends the M7 TradingSystem with advanced exchange
 * capabilities for economic simulation.
 */

import type { World } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Event } from '../event/Event.js';
import {
  MarketType,
  OrderType,
  OrderStatus,
  PriceTrend,
  TradeRouteStatus,
  CaravanStatus,
  TradeExchangeEventType,
  type Market,
  type TradeOrder,
  type TradeResult,
  type PricePoint,
  type ResourcePrice,
  type SupplyDemand,
  type TradeRoute,
  type Caravan,
  type TradeExchangeConfig,
  DEFAULT_TRADE_EXCHANGE_CONFIG,
  type TradeRecord,
  type MarketStats,
} from './TradeExchangeTypes.js';

export class TradeExchangeSystem {
  readonly name = 'trade-exchange-system';
  enabled = true;

  private config: Required<TradeExchangeConfig>;
  private markets: Map<string, Market> = new Map();
  private orders: Map<string, TradeOrder> = new Map();
  private trades: TradeRecord[] = [];
  private priceHistory: Map<string, PricePoint[]> = new Map();
  private routes: Map<string, TradeRoute> = new Map();
  private caravans: Map<string, Caravan> = new Map();
  private currentTick: number = 0;
  private matchCounter: number = 0;
  private orderIdCounter: number = 0;
  private tradeIdCounter: number = 0;
  private caravanIdCounter: number = 0;
  private stats: MarketStats;

  constructor(config?: TradeExchangeConfig) {
    this.config = { ...DEFAULT_TRADE_EXCHANGE_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }

  // ---------------------------------------------------------------------------
  // Market Management
  // ---------------------------------------------------------------------------

  createMarket(
    id: string,
    name: string,
    type: MarketType,
    options?: Partial<Market>
  ): Market {
    const market: Market = {
      id,
      name,
      type,
      description: options?.description,
      location: options?.location,
      operatingHours: options?.operatingHours,
      taxRate: options?.taxRate ?? this.config.defaultTaxRate,
      transactionFee: options?.transactionFee ?? this.config.defaultTransactionFee,
      minPrice: options?.minPrice,
      maxPrice: options?.maxPrice,
      supportedResources: options?.supportedResources,
      reputation: options?.reputation ?? 50,
      isOpen: options?.isOpen ?? true,
      metadata: options?.metadata,
    };
    this.markets.set(id, market);
    this.stats.totalMarkets++;
    if (market.isOpen) this.stats.activeMarkets++;
    this.emitEvent(TradeExchangeEventType.MARKET_CREATED, { marketId: id });
    return market;
  }

  getMarket(marketId: string): Market | undefined {
    return this.markets.get(marketId);
  }

  getAllMarkets(): Market[] {
    return Array.from(this.markets.values());
  }

  getOpenMarkets(): Market[] {
    return Array.from(this.markets.values()).filter(m => m.isOpen);
  }

  updateMarket(marketId: string, updates: Partial<Market>): boolean {
    const market = this.markets.get(marketId);
    if (!market) return false;
    Object.assign(market, updates);
    this.emitEvent(TradeExchangeEventType.MARKET_UPDATED, { marketId });
    return true;
  }

  openMarket(marketId: string): boolean {
    const market = this.markets.get(marketId);
    if (!market || market.isOpen) return false;
    market.isOpen = true;
    this.stats.activeMarkets++;
    this.emitEvent(TradeExchangeEventType.MARKET_OPENED, { marketId });
    return true;
  }

  closeMarket(marketId: string): boolean {
    const market = this.markets.get(marketId);
    if (!market || !market.isOpen) return false;
    market.isOpen = false;
    this.stats.activeMarkets--;
    this.emitEvent(TradeExchangeEventType.MARKET_CLOSED, { marketId });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Order Management
  // ---------------------------------------------------------------------------

  placeOrder(
    marketId: string,
    traderId: string,
    type: OrderType,
    resourceTypeId: string,
    amount: number,
    price: number,
    options?: {
      limitPrice?: number;
      expiresAtTick?: number;
      priority?: number;
      metadata?: Record<string, unknown>;
    }
  ): TradeResult {
    const market = this.markets.get(marketId);
    if (!market) {
      return { success: false, reason: `Market not found: ${marketId}` };
    }
    if (!market.isOpen) {
      return { success: false, reason: `Market is closed: ${marketId}` };
    }

    // Validate amount
    if (amount < this.config.minOrderAmount) {
      return { success: false, reason: `Amount ${amount} below minimum ${this.config.minOrderAmount}` };
    }
    if (amount > this.config.maxOrderAmount) {
      return { success: false, reason: `Amount ${amount} exceeds maximum ${this.config.maxOrderAmount}` };
    }

    // Validate price
    if (market.minPrice !== undefined && price < market.minPrice) {
      return { success: false, reason: `Price ${price} below minimum ${market.minPrice}` };
    }
    if (market.maxPrice !== undefined && price > market.maxPrice) {
      return { success: false, reason: `Price ${price} exceeds maximum ${market.maxPrice}` };
    }

    // Check supported resources
    if (market.supportedResources && market.supportedResources.length > 0) {
      if (!market.supportedResources.includes(resourceTypeId)) {
        return { success: false, reason: `Resource ${resourceTypeId} not supported on this market` };
      }
    }

    const orderId = `order_${++this.orderIdCounter}`;
    const order: TradeOrder = {
      id: orderId,
      marketId,
      traderId,
      type,
      resourceTypeId,
      amount,
      price,
      limitPrice: options?.limitPrice,
      status: OrderStatus.PENDING,
      filledAmount: 0,
      createdTick: this.currentTick,
      expiresAtTick: options?.expiresAtTick,
      priority: options?.priority ?? 0,
      metadata: options?.metadata,
    };

    this.orders.set(orderId, order);
    this.stats.totalOrders++;
    this.stats.pendingOrders++;

    this.emitEvent(TradeExchangeEventType.ORDER_PLACED, { orderId, marketId, traderId, type });

    // Try to match immediately
    if (this.config.autoMatchOrders) {
      this.matchOrder(order);
    }

    if (order.status === OrderStatus.FILLED) {
      return {
        success: true,
        tradeId: orderId,
        executedPrice: order.lastExecutedPrice ?? order.price,
        executedAmount: order.filledAmount,
        totalCost: (order.lastExecutedPrice ?? order.price) * order.filledAmount,
      };
    }

    return { success: true, tradeId: orderId, reason: 'Order placed, pending match' };
  }

  getOrder(orderId: string): TradeOrder | undefined {
    return this.orders.get(orderId);
  }

  getOrdersByTrader(traderId: string): TradeOrder[] {
    return Array.from(this.orders.values()).filter(o => o.traderId === traderId);
  }

  getOrdersByMarket(marketId: string): TradeOrder[] {
    return Array.from(this.orders.values()).filter(o => o.marketId === marketId);
  }

  getPendingOrders(marketId?: string): TradeOrder[] {
    let orders = Array.from(this.orders.values()).filter(o => o.status === OrderStatus.PENDING);
    if (marketId) orders = orders.filter(o => o.marketId === marketId);
    return orders;
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIAL) return false;

    order.status = OrderStatus.CANCELLED;
    this.stats.pendingOrders--;
    this.stats.cancelledOrders++;
    this.emitEvent(TradeExchangeEventType.ORDER_CANCELLED, { orderId });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Order Matching
  // ---------------------------------------------------------------------------

  private matchOrder(order: TradeOrder): void {
    const market = this.markets.get(order.marketId);
    if (!market || !market.isOpen) return;

    // Find matching orders (opposite type, same resource, compatible price)
    const matchingOrders = Array.from(this.orders.values())
      .filter(o =>
        o.marketId === order.marketId &&
        o.resourceTypeId === order.resourceTypeId &&
        o.type !== order.type &&
        (o.status === OrderStatus.PENDING || o.status === OrderStatus.PARTIAL) &&
        o.id !== order.id
      )
      .sort((a, b) => {
        // Sort by priority first, then by price (best price first)
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (order.type === OrderType.BUY) {
          // For buy orders, prefer lower sell prices
          return a.price - b.price;
        } else {
          // For sell orders, prefer higher buy prices
          return b.price - a.price;
        }
      });

    for (const matchingOrder of matchingOrders) {
      if (order.status === OrderStatus.FILLED) break;

      // Check price compatibility
      const buyOrder = order.type === OrderType.BUY ? order : matchingOrder;
      const sellOrder = order.type === OrderType.SELL ? order : matchingOrder;

      // Buy price must be >= sell price
      if (buyOrder.price < sellOrder.price) continue;

      // Check limit prices
      if (buyOrder.limitPrice !== undefined && buyOrder.price > buyOrder.limitPrice) continue;
      if (sellOrder.limitPrice !== undefined && sellOrder.price < sellOrder.limitPrice) continue;

      // Execute trade
      const remainingOrder = order.amount - order.filledAmount;
      const remainingMatching = matchingOrder.amount - matchingOrder.filledAmount;
      const tradeAmount = Math.min(remainingOrder, remainingMatching);

      if (tradeAmount <= 0) continue;

      // Execute at the matching order's price (maker-taker model)
      const executedPrice = matchingOrder.price;

      this.executeTrade(order, matchingOrder, tradeAmount, executedPrice, market);
    }
  }

  private executeTrade(
    orderA: TradeOrder,
    orderB: TradeOrder,
    amount: number,
    price: number,
    market: Market
  ): void {
    const buyOrder = orderA.type === OrderType.BUY ? orderA : orderB;
    const sellOrder = orderA.type === OrderType.SELL ? orderA : orderB;

    const totalValue = price * amount;
    const taxPaid = totalValue * market.taxRate;
    const feePaid = totalValue * market.transactionFee;

    const tradeId = `trade_${++this.tradeIdCounter}`;
    const trade: TradeRecord = {
      id: tradeId,
      marketId: market.id,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyerId: buyOrder.traderId,
      sellerId: sellOrder.traderId,
      resourceTypeId: buyOrder.resourceTypeId,
      amount,
      price,
      totalValue,
      taxPaid,
      feePaid,
      tick: this.currentTick,
    };

    this.trades.push(trade);
    if (this.trades.length > this.config.maxTradeHistory) {
      this.trades.shift();
    }

    // Update order statuses
    buyOrder.filledAmount += amount;
    sellOrder.filledAmount += amount;
    buyOrder.lastExecutedPrice = price;
    sellOrder.lastExecutedPrice = price;

    buyOrder.status = buyOrder.filledAmount >= buyOrder.amount ? OrderStatus.FILLED : OrderStatus.PARTIAL;
    sellOrder.status = sellOrder.filledAmount >= sellOrder.amount ? OrderStatus.FILLED : OrderStatus.PARTIAL;

    // Update stats
    this.stats.pendingOrders = Array.from(this.orders.values())
      .filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PARTIAL).length;
    this.stats.filledOrders = Array.from(this.orders.values())
      .filter(o => o.status === OrderStatus.FILLED).length;
    this.stats.totalTrades++;
    this.stats.totalVolume += amount;
    this.stats.totalValue += totalValue;
    this.stats.totalTaxCollected += taxPaid;
    this.stats.totalFeesCollected += feePaid;
    this.stats.tradeVolumeByResource[buyOrder.resourceTypeId] =
      (this.stats.tradeVolumeByResource[buyOrder.resourceTypeId] ?? 0) + amount;
    this.stats.tradeValueByResource[buyOrder.resourceTypeId] =
      (this.stats.tradeValueByResource[buyOrder.resourceTypeId] ?? 0) + totalValue;

    // Update price history
    this.recordPrice(market.id, buyOrder.resourceTypeId, price, amount);

    this.emitEvent(TradeExchangeEventType.TRADE_EXECUTED, {
      tradeId,
      marketId: market.id,
      resourceTypeId: buyOrder.resourceTypeId,
      amount,
      price,
    });
  }

  // ---------------------------------------------------------------------------
  // Pricing
  // ---------------------------------------------------------------------------

  private recordPrice(marketId: string, resourceTypeId: string, price: number, volume: number): void {
    const key = `${marketId}:${resourceTypeId}`;
    if (!this.priceHistory.has(key)) {
      this.priceHistory.set(key, []);
    }

    const history = this.priceHistory.get(key)!;
    const lastPoint = history[history.length - 1];

    if (lastPoint && lastPoint.tick === this.currentTick) {
      // Update current tick's point
      lastPoint.volume += volume;
      lastPoint.tradeCount++;
      // Weighted average price
      lastPoint.price = ((lastPoint.price * (lastPoint.volume - volume)) + (price * volume)) / lastPoint.volume;
    } else {
      history.push({
        tick: this.currentTick,
        price,
        volume,
        tradeCount: 1,
      });
    }

    // Trim history
    while (history.length > this.config.priceHistorySize) {
      history.shift();
    }
  }

  getResourcePrice(marketId: string, resourceTypeId: string): ResourcePrice | undefined {
    const key = `${marketId}:${resourceTypeId}`;
    const history = this.priceHistory.get(key);
    if (!history || history.length === 0) return undefined;

    const current = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : current;
    const priceChange = current.price - previous.price;
    const priceChangePercent = previous.price > 0 ? (priceChange / previous.price) * 100 : 0;

    // Determine trend
    let trend = PriceTrend.STABLE;
    if (history.length >= 5) {
      const recent = history.slice(-5);
      const changes = recent.slice(1).map((p, i) => p.price - recent[i].price);
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
      const variance = changes.reduce((a, b) => a + (b - avgChange) ** 2, 0) / changes.length;

      if (variance > current.price * 0.1) {
        trend = PriceTrend.VOLATILE;
      } else if (avgChange > current.price * 0.01) {
        trend = PriceTrend.RISING;
      } else if (avgChange < -current.price * 0.01) {
        trend = PriceTrend.FALLING;
      }
    }

    // 24-tick high/low
    const recent24 = history.slice(-24);
    const high24 = Math.max(...recent24.map(p => p.price));
    const low24 = Math.min(...recent24.map(p => p.price));
    const volume24 = recent24.reduce((a, p) => a + p.volume, 0);

    // Best bid/ask
    const pendingOrders = this.getPendingOrders(marketId)
      .filter(o => o.resourceTypeId === resourceTypeId);
    const bestBid = pendingOrders
      .filter(o => o.type === OrderType.BUY)
      .reduce((max, o) => Math.max(max, o.price), 0);
    const bestAsk = pendingOrders
      .filter(o => o.type === OrderType.SELL)
      .reduce((min, o) => min === 0 ? o.price : Math.min(min, o.price), 0);

    return {
      resourceTypeId,
      currentPrice: current.price,
      previousPrice: previous.price,
      priceChange,
      priceChangePercent,
      trend,
      high24,
      low24,
      volume24,
      bestBid: bestBid > 0 ? bestBid : undefined,
      bestAsk: bestAsk > 0 ? bestAsk : undefined,
      spread: bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : undefined,
      history: [...history],
    };
  }

  getPriceHistory(marketId: string, resourceTypeId: string, limit?: number): PricePoint[] {
    const key = `${marketId}:${resourceTypeId}`;
    const history = this.priceHistory.get(key) ?? [];
    return limit ? history.slice(-limit) : [...history];
  }

  // ---------------------------------------------------------------------------
  // Supply-Demand Analysis
  // ---------------------------------------------------------------------------

  getSupplyDemand(marketId: string, resourceTypeId: string): SupplyDemand {
    const pendingOrders = this.getPendingOrders(marketId)
      .filter(o => o.resourceTypeId === resourceTypeId);

    const buyOrders = pendingOrders.filter(o => o.type === OrderType.BUY);
    const sellOrders = pendingOrders.filter(o => o.type === OrderType.SELL);

    const totalDemand = buyOrders.reduce((a, o) => a + (o.amount - o.filledAmount), 0);
    const totalSupply = sellOrders.reduce((a, o) => a + (o.amount - o.filledAmount), 0);

    const ratio = totalSupply > 0 ? totalDemand / totalSupply : (totalDemand > 0 ? Infinity : 1);
    const pricePressure = totalSupply > 0 ? (totalDemand - totalSupply) / totalSupply : 0;

    // Calculate equilibrium price (simplified: midpoint of best bid/ask)
    const price = this.getResourcePrice(marketId, resourceTypeId);
    const equilibriumPrice = price ? price.currentPrice * (1 + pricePressure * this.config.priceVolatility) : 0;

    // Market depth
    const allPrices = new Set([
      ...buyOrders.map(o => o.price),
      ...sellOrders.map(o => o.price),
    ]);
    const depth = Array.from(allPrices).sort((a, b) => a - b).map(p => ({
      price: p,
      buyVolume: buyOrders.filter(o => o.price === p).reduce((a, o) => a + (o.amount - o.filledAmount), 0),
      sellVolume: sellOrders.filter(o => o.price === p).reduce((a, o) => a + (o.amount - o.filledAmount), 0),
    }));

    return {
      resourceTypeId,
      totalSupply,
      totalDemand,
      ratio,
      equilibriumPrice,
      pricePressure,
      depth,
    };
  }

  // ---------------------------------------------------------------------------
  // Trade Routes
  // ---------------------------------------------------------------------------

  createTradeRoute(
    id: string,
    name: string,
    originMarketId: string,
    destinationMarketId: string,
    options?: Partial<TradeRoute>
  ): TradeResult {
    const origin = this.markets.get(originMarketId);
    const destination = this.markets.get(destinationMarketId);

    if (!origin) return { success: false, reason: `Origin market not found: ${originMarketId}` };
    if (!destination) return { success: false, reason: `Destination market not found: ${destinationMarketId}` };

    const distance = options?.distance ?? 10;
    const route: TradeRoute = {
      id,
      name,
      description: options?.description,
      originMarketId,
      destinationMarketId,
      distance,
      dangerLevel: options?.dangerLevel ?? 10,
      status: options?.status ?? TradeRouteStatus.ACTIVE,
      typicalGoods: options?.typicalGoods ?? [],
      averageProfitMargin: options?.averageProfitMargin ?? 0.2,
      successfulTrips: 0,
      failedTrips: 0,
      createdTick: this.currentTick,
      metadata: options?.metadata,
    };

    this.routes.set(id, route);
    this.emitEvent(TradeExchangeEventType.ROUTE_CREATED, { routeId: id });
    return { success: true, tradeId: id };
  }

  getTradeRoute(routeId: string): TradeRoute | undefined {
    return this.routes.get(routeId);
  }

  getAllTradeRoutes(): TradeRoute[] {
    return Array.from(this.routes.values());
  }

  getActiveTradeRoutes(): TradeRoute[] {
    return Array.from(this.routes.values()).filter(r => r.status === TradeRouteStatus.ACTIVE);
  }

  updateTradeRoute(routeId: string, updates: Partial<TradeRoute>): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;
    Object.assign(route, updates);
    this.emitEvent(TradeExchangeEventType.ROUTE_UPDATED, { routeId });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Caravan Management
  // ---------------------------------------------------------------------------

  sendCaravan(
    ownerId: string,
    routeId: string,
    cargo: Array<{ resourceTypeId: string; amount: number; purchasePrice: number }>,
    gold: number,
    options?: Partial<Caravan>
  ): TradeResult {
    const route = this.routes.get(routeId);
    if (!route) return { success: false, reason: `Trade route not found: ${routeId}` };
    if (route.status !== TradeRouteStatus.ACTIVE) {
      return { success: false, reason: `Trade route is not active: ${routeId}` };
    }

    const caravanId = `caravan_${++this.caravanIdCounter}`;
    const cargoValue = cargo.reduce((a, c) => a + c.amount * c.purchasePrice, 0);

    const caravan: Caravan = {
      id: caravanId,
      name: options?.name ?? `Caravan ${caravanId}`,
      ownerId,
      routeId,
      status: CaravanStatus.TRAVELING,
      progress: 0,
      cargo,
      cargoValue,
      gold,
      departureTick: this.currentTick,
      expectedArrivalTick: this.currentTick + Math.round(route.distance / this.config.caravanSpeed),
      speedModifier: options?.speedModifier ?? 1.0,
      guardLevel: options?.guardLevel ?? 20,
      metadata: options?.metadata,
    };

    this.caravans.set(caravanId, caravan);
    this.emitEvent(TradeExchangeEventType.CARAVAN_DEPARTED, { caravanId, routeId, ownerId });
    return { success: true, tradeId: caravanId };
  }

  getCaravan(caravanId: string): Caravan | undefined {
    return this.caravans.get(caravanId);
  }

  getCaravansByOwner(ownerId: string): Caravan[] {
    return Array.from(this.caravans.values()).filter(c => c.ownerId === ownerId);
  }

  getActiveCaravans(): Caravan[] {
    return Array.from(this.caravans.values()).filter(
      c => c.status === CaravanStatus.TRAVELING || c.status === CaravanStatus.RETURNING
    );
  }

  // ---------------------------------------------------------------------------
  // Trade History & Stats
  // ---------------------------------------------------------------------------

  getTradeHistory(marketId?: string, resourceTypeId?: string, limit?: number): TradeRecord[] {
    let trades = [...this.trades];
    if (marketId) trades = trades.filter(t => t.marketId === marketId);
    if (resourceTypeId) trades = trades.filter(t => t.resourceTypeId === resourceTypeId);
    return limit ? trades.slice(-limit) : trades;
  }

  getStats(): MarketStats {
    // Recalculate dynamic stats
    this.stats.pendingOrders = Array.from(this.orders.values())
      .filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PARTIAL).length;
    this.stats.filledOrders = Array.from(this.orders.values())
      .filter(o => o.status === OrderStatus.FILLED).length;
    this.stats.cancelledOrders = Array.from(this.orders.values())
      .filter(o => o.status === OrderStatus.CANCELLED).length;
    this.stats.averageTradeSize = this.stats.totalTrades > 0
      ? this.stats.totalVolume / this.stats.totalTrades : 0;
    this.stats.averagePrice = this.stats.totalVolume > 0
      ? this.stats.totalValue / this.stats.totalVolume : 0;

    return { ...this.stats };
  }

  // ---------------------------------------------------------------------------
  // Tick / Update
  // ---------------------------------------------------------------------------

  tick(_dt: number, _world: World | null, events: EventSystem | null): void {
    if (!this.enabled) return;
    this.currentTick++;
    this.matchCounter++;

    if (this.matchCounter >= this.config.matchInterval) {
      this.matchCounter = 0;
      this.matchAllPendingOrders();
    }

    this.expireOrders();
    this.updateCaravans(events);
  }

  private matchAllPendingOrders(): void {
    const pendingOrders = Array.from(this.orders.values())
      .filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PARTIAL)
      .sort((a, b) => b.priority - a.priority);

    for (const order of pendingOrders) {
      if (order.status === OrderStatus.FILLED) continue;
      this.matchOrder(order);
    }
  }

  private expireOrders(): void {
    for (const order of this.orders.values()) {
      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIAL) continue;
      if (order.expiresAtTick !== undefined && this.currentTick >= order.expiresAtTick) {
        order.status = OrderStatus.EXPIRED;
        this.stats.pendingOrders--;
        this.emitEvent(TradeExchangeEventType.ORDER_EXPIRED, { orderId: order.id });
      }
    }
  }

  private updateCaravans(events: EventSystem | null): void {
    for (const caravan of this.caravans.values()) {
      if (caravan.status !== CaravanStatus.TRAVELING && caravan.status !== CaravanStatus.RETURNING) continue;

      const route = this.routes.get(caravan.routeId);
      if (!route) continue;

      // Update progress
      const progressIncrement = (this.config.caravanSpeed * caravan.speedModifier) / route.distance;
      caravan.progress += progressIncrement;

      // Check for danger/attack
      if (route.dangerLevel > 0 && caravan.status === CaravanStatus.TRAVELING) {
        const attackChance = (route.dangerLevel / 100) * progressIncrement;
        if (Math.random() < attackChance && caravan.guardLevel < 50) {
          caravan.status = CaravanStatus.ATTACKED;
          route.failedTrips++;
          this.emitEvent(TradeExchangeEventType.CARAVAN_ATTACKED, {
            caravanId: caravan.id,
            routeId: caravan.routeId,
          }, events);
          continue;
        }
      }

      // Check arrival
      if (caravan.progress >= 1) {
        caravan.progress = 1;
        caravan.arrivalTick = this.currentTick;
        caravan.status = CaravanStatus.IDLE;
        route.successfulTrips++;
        this.emitEvent(TradeExchangeEventType.CARAVAN_ARRIVED, {
          caravanId: caravan.id,
          routeId: caravan.routeId,
          ownerId: caravan.ownerId,
        }, events);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private emitEvent(type: TradeExchangeEventType, payload: Record<string, unknown>, events?: EventSystem | null): void {
    if (events) {
      const event = new Event({ type, payload, sourceId: this.name });
      events.emit(event);
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      markets: Array.from(this.markets.values()),
      orders: Array.from(this.orders.values()),
      trades: this.trades,
      priceHistory: Array.from(this.priceHistory.entries()),
      routes: Array.from(this.routes.values()),
      caravans: Array.from(this.caravans.values()),
      currentTick: this.currentTick,
      orderIdCounter: this.orderIdCounter,
      tradeIdCounter: this.tradeIdCounter,
      caravanIdCounter: this.caravanIdCounter,
      stats: this.stats,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config) this.config = { ...DEFAULT_TRADE_EXCHANGE_CONFIG, ...(data.config as object) };
    if (data.markets) {
      this.markets = new Map((data.markets as Market[]).map(m => [m.id, m]));
    }
    if (data.orders) {
      this.orders = new Map((data.orders as TradeOrder[]).map(o => [o.id, o]));
    }
    if (data.trades) this.trades = data.trades as TradeRecord[];
    if (data.priceHistory) {
      this.priceHistory = new Map(data.priceHistory as Array<[string, PricePoint[]]>);
    }
    if (data.routes) {
      this.routes = new Map((data.routes as TradeRoute[]).map(r => [r.id, r]));
    }
    if (data.caravans) {
      this.caravans = new Map((data.caravans as Caravan[]).map(c => [c.id, c]));
    }
    if (typeof data.currentTick === 'number') this.currentTick = data.currentTick;
    if (typeof data.orderIdCounter === 'number') this.orderIdCounter = data.orderIdCounter;
    if (typeof data.tradeIdCounter === 'number') this.tradeIdCounter = data.tradeIdCounter;
    if (typeof data.caravanIdCounter === 'number') this.caravanIdCounter = data.caravanIdCounter;
    if (data.stats) this.stats = data.stats as MarketStats;
  }

  private createEmptyStats(): MarketStats {
    return {
      totalMarkets: 0,
      activeMarkets: 0,
      totalOrders: 0,
      pendingOrders: 0,
      filledOrders: 0,
      cancelledOrders: 0,
      totalTrades: 0,
      totalVolume: 0,
      totalValue: 0,
      totalTaxCollected: 0,
      totalFeesCollected: 0,
      averageTradeSize: 0,
      averagePrice: 0,
      tradeVolumeByResource: {},
      tradeValueByResource: {},
    };
  }
}
