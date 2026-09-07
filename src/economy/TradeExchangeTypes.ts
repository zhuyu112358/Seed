/**
 * Trade Exchange System - Type Definitions
 *
 * M14 Economic Foundation Layer - Phase 2
 *
 * Defines types for market management, dynamic pricing, trade execution,
 * supply-demand modeling, and trade routes.
 */

// Market type
export enum MarketType {
  LOCAL = 'local',
  REGIONAL = 'regional',
  NATIONAL = 'national',
  GLOBAL = 'global',
  BLACK_MARKET = 'black_market',
  AUCTION = 'auction',
  CUSTOM = 'custom',
}

// Order type (buy/sell)
export enum OrderType {
  BUY = 'buy',
  SELL = 'sell',
}

// Order status
export enum OrderStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

// Price trend direction
export enum PriceTrend {
  RISING = 'rising',
  FALLING = 'falling',
  STABLE = 'stable',
  VOLATILE = 'volatile',
}

// Trade route status
export enum TradeRouteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  DANGEROUS = 'dangerous',
}

// Caravan status
export enum CaravanStatus {
  IDLE = 'idle',
  TRAVELING = 'traveling',
  TRADING = 'trading',
  RETURNING = 'returning',
  DELAYED = 'delayed',
  ATTACKED = 'attacked',
}

// Market entity
export interface Market {
  id: string;
  name: string;
  type: MarketType;
  description?: string;
  // Location (optional, for spatial markets)
  location?: { x: number; y: number; z: number };
  // Operating hours (tick ranges, empty = always open)
  operatingHours?: Array<{ startTick: number; endTick: number }>;
  // Tax rate (0-1)
  taxRate: number;
  // Transaction fee (0-1)
  transactionFee: number;
  // Minimum price allowed
  minPrice?: number;
  // Maximum price allowed
  maxPrice?: number;
  // Supported resource types (empty = all)
  supportedResources?: string[];
  // Market reputation (0-100)
  reputation: number;
  // Whether market is currently open
  isOpen: boolean;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Order (buy/sell order)
export interface TradeOrder {
  id: string;
  marketId: string;
  traderId: string;
  type: OrderType;
  resourceTypeId: string;
  amount: number;
  // Price per unit
  price: number;
  // Minimum acceptable price (for sell) or maximum (for buy)
  limitPrice?: number;
  status: OrderStatus;
  // Amount already filled
  filledAmount: number;
  // Last executed price (for partially/fully filled orders)
  lastExecutedPrice?: number;
  // Creation tick
  createdTick: number;
  // Expiration tick (undefined = never expires)
  expiresAtTick?: number;
  // Priority (higher = matched first)
  priority: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Trade execution result
export interface TradeResult {
  success: boolean;
  tradeId?: string;
  reason?: string;
  // Actual price executed
  executedPrice?: number;
  // Amount executed
  executedAmount?: number;
  // Total cost (price * amount)
  totalCost?: number;
  // Tax paid
  taxPaid?: number;
  // Fee paid
  feePaid?: number;
}

// Price point for price history
export interface PricePoint {
  tick: number;
  price: number;
  volume: number;
  // Number of trades at this price
  tradeCount: number;
}

// Resource price info
export interface ResourcePrice {
  resourceTypeId: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePercent: number;
  trend: PriceTrend;
  // 24-tick high/low
  high24: number;
  low24: number;
  // Volume (24 ticks)
  volume24: number;
  // Bid/ask spread
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  // Price history
  history: PricePoint[];
}

// Supply-demand model
export interface SupplyDemand {
  resourceTypeId: string;
  // Total supply (sell orders)
  totalSupply: number;
  // Total demand (buy orders)
  totalDemand: number;
  // Supply-demand ratio (>1 = oversupply, <1 = undersupply)
  ratio: number;
  // Equilibrium price (where supply = demand)
  equilibriumPrice: number;
  // Price pressure (positive = upward pressure, negative = downward)
  pricePressure: number;
  // Market depth at various price levels
  depth: Array<{ price: number; buyVolume: number; sellVolume: number }>;
}

// Trade route
export interface TradeRoute {
  id: string;
  name: string;
  description?: string;
  // Origin market ID
  originMarketId: string;
  // Destination market ID
  destinationMarketId: string;
  // Distance (in ticks of travel time)
  distance: number;
  // Danger level (0-100)
  dangerLevel: number;
  // Status
  status: TradeRouteStatus;
  // Goods typically traded on this route
  typicalGoods: string[];
  // Average profit margin (0-1)
  averageProfitMargin: number;
  // Number of successful trips
  successfulTrips: number;
  // Number of failed trips
  failedTrips: number;
  // Creation tick
  createdTick: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Caravan (trade caravan traveling a route)
export interface Caravan {
  id: string;
  name: string;
  ownerId: string;
  routeId: string;
  status: CaravanStatus;
  // Current position along route (0-1)
  progress: number;
  // Cargo being carried
  cargo: Array<{ resourceTypeId: string; amount: number; purchasePrice: number }>;
  // Total cargo value
  cargoValue: number;
  // Gold carried
  gold: number;
  // Departure tick
  departureTick: number;
  // Expected arrival tick
  expectedArrivalTick: number;
  // Actual arrival tick
  arrivalTick?: number;
  // Speed modifier (1.0 = normal)
  speedModifier: number;
  // Guard level (0-100, affects attack survival)
  guardLevel: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Trade exchange system configuration
export interface TradeExchangeConfig {
  // Whether to automatically match orders
  autoMatchOrders?: boolean;
  // Tick interval for order matching
  matchInterval?: number;
  // Default tax rate (0-1)
  defaultTaxRate?: number;
  // Default transaction fee (0-1)
  defaultTransactionFee?: number;
  // Price history size (number of points to keep)
  priceHistorySize?: number;
  // Whether to enable dynamic pricing based on supply-demand
  dynamicPricing?: boolean;
  // Price volatility factor (0-1, higher = more volatile)
  priceVolatility?: number;
  // Maximum order amount
  maxOrderAmount?: number;
  // Minimum order amount
  minOrderAmount?: number;
  // Whether to enable trade routes
  enableTradeRoutes?: boolean;
  // Caravan speed (ticks per unit distance)
  caravanSpeed?: number;
  // Maximum history size for trades
  maxTradeHistory?: number;
}

// Default configuration
export const DEFAULT_TRADE_EXCHANGE_CONFIG: Required<TradeExchangeConfig> = {
  autoMatchOrders: true,
  matchInterval: 1,
  defaultTaxRate: 0.05,
  defaultTransactionFee: 0.01,
  priceHistorySize: 100,
  dynamicPricing: true,
  priceVolatility: 0.1,
  maxOrderAmount: 10000,
  minOrderAmount: 1,
  enableTradeRoutes: true,
  caravanSpeed: 1.0,
  maxTradeHistory: 10000,
};

// Trade exchange event types
export enum TradeExchangeEventType {
  MARKET_CREATED = 'trade.market_created',
  MARKET_UPDATED = 'trade.market_updated',
  MARKET_OPENED = 'trade.market_opened',
  MARKET_CLOSED = 'trade.market_closed',
  ORDER_PLACED = 'trade.order_placed',
  ORDER_FILLED = 'trade.order_filled',
  ORDER_PARTIAL = 'trade.order_partial',
  ORDER_CANCELLED = 'trade.order_cancelled',
  ORDER_EXPIRED = 'trade.order_expired',
  TRADE_EXECUTED = 'trade.executed',
  PRICE_CHANGED = 'trade.price_changed',
  SUPPLY_DEMAND_CHANGED = 'trade.supply_demand_changed',
  ROUTE_CREATED = 'trade.route_created',
  ROUTE_UPDATED = 'trade.route_updated',
  CARAVAN_DEPARTED = 'trade.caravan_departed',
  CARAVAN_ARRIVED = 'trade.caravan_arrived',
  CARAVAN_ATTACKED = 'trade.caravan_attacked',
}

// Trade record (completed trade)
export interface TradeRecord {
  id: string;
  marketId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  resourceTypeId: string;
  amount: number;
  price: number;
  totalValue: number;
  taxPaid: number;
  feePaid: number;
  tick: number;
}

// Market statistics
export interface MarketStats {
  totalMarkets: number;
  activeMarkets: number;
  totalOrders: number;
  pendingOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  totalTrades: number;
  totalVolume: number;
  totalValue: number;
  totalTaxCollected: number;
  totalFeesCollected: number;
  averageTradeSize: number;
  averagePrice: number;
  tradeVolumeByResource: Record<string, number>;
  tradeValueByResource: Record<string, number>;
}
