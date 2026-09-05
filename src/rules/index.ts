// Rules module: world-level rule engine for condition->action triggers.
// This is NOT soul cognition/decision — that remains in SoulArena.
// Seed only provides world-level rule evaluation and action execution.

export { WorldRuleEngine } from "./WorldRuleEngine.js";
export type {
  RuleConfig,
  RuleContext,
  RuleCondition,
  RuleAction,
} from "./WorldRuleEngine.js";
