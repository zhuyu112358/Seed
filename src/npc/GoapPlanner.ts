// GoapPlanner: A* search planner for Goal-Oriented Action Planning.
//
// The planner searches over a discrete state space to find the lowest-cost
// action sequence that transforms the current world state to match the goal's
// target state. Uses A* with a heuristic based on unmatched state keys.
//
// M12 Phase 3: GOAP Goal-Oriented Action Planning.

import {
  WorldState,
  GoapGoal,
  GoapAction,
  GoapNode,
  GoapPlanResult,
  GoapConfig,
  DEFAULT_GOAP_CONFIG,
} from "./GoapTypes.js";

export class GoapPlanner {
  private config: GoapConfig;

  constructor(config?: Partial<GoapConfig>) {
    this.config = { ...DEFAULT_GOAP_CONFIG, ...config };
  }

  /**
   * Plan an action sequence to achieve a goal from a starting state.
   * Uses A* search over the state space.
   */
  plan(startState: WorldState, goal: GoapGoal, actions: GoapAction[]): GoapPlanResult {
    if (!goal.relevant) {
      return this.failureResult(goal, "Goal is not relevant");
    }

    // Check if goal is already satisfied.
    if (this.stateMatches(startState, goal.targetState)) {
      return {
        success: true,
        actions: [],
        totalCost: 0,
        goal,
        nodesExplored: 0,
      };
    }

    // Filter to available actions.
    const availableActions = actions.filter(a => a.available !== false);
    if (availableActions.length === 0) {
      return this.failureResult(goal, "No available actions");
    }

    // A* search.
    const startNode: GoapNode = {
      state: { ...startState },
      action: null,
      parent: null,
      gScore: 0,
      hScore: this.heuristic(startState, goal.targetState),
      fScore: this.heuristic(startState, goal.targetState),
      depth: 0,
    };

    const openSet: GoapNode[] = [startNode];
    const closedSet = new Set<string>();
    let nodesExplored = 0;

    while (openSet.length > 0 && nodesExplored < this.config.maxNodesExplored) {
      // Find node with lowest f-score.
      openSet.sort((a, b) => a.fScore - b.fScore);
      const current = openSet.shift()!;
      nodesExplored++;

      // Check if current state satisfies goal.
      if (this.stateMatches(current.state, goal.targetState)) {
        return this.buildResult(current, goal, nodesExplored);
      }

      // Check max depth.
      if (current.depth >= this.config.maxSearchDepth) {
        continue;
      }

      // Add to closed set.
      const stateKey = this.stateToString(current.state);
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      // Expand neighbors.
      for (const action of availableActions) {
        // Check preconditions.
        if (!this.stateMatches(current.state, action.preconditions)) continue;

        // Apply effects to get new state.
        const newState = { ...current.state, ...action.effects };
        const newStateKey = this.stateToString(newState);
        if (closedSet.has(newStateKey)) continue;

        const actionCost = action.cost;
        const gScore = current.gScore + actionCost;
        const hScore = this.config.useHeuristic
          ? this.heuristic(newState, goal.targetState) * this.config.heuristicWeight
          : 0;

        const neighbor: GoapNode = {
          state: newState,
          action,
          parent: current,
          gScore,
          hScore,
          fScore: gScore + hScore,
          depth: current.depth + 1,
        };

        // Check if this state is already in open set with lower cost.
        const existing = openSet.find(n => this.stateToString(n.state) === newStateKey);
        if (existing && existing.gScore <= gScore) continue;
        if (existing) {
          // Replace with better path.
          const idx = openSet.indexOf(existing);
          openSet.splice(idx, 1);
        }
        openSet.push(neighbor);
      }
    }

    return this.failureResult(goal, nodesExplored >= this.config.maxNodesExplored
      ? "Max nodes explored without finding plan"
      : "No valid plan found");
  }

  /**
   * Select the highest-priority relevant goal from a list.
   */
  selectGoal(goals: GoapGoal[]): GoapGoal | null {
    const relevant = goals.filter(g => g.relevant);
    if (relevant.length === 0) return null;
    relevant.sort((a, b) => b.priority - a.priority);
    return relevant[0];
  }

  /**
   * Check if a state matches a target (partial match - only keys in target are checked).
   */
  stateMatches(state: WorldState, target: WorldState): boolean {
    for (const [key, value] of Object.entries(target)) {
      if (state[key] !== value) return false;
    }
    return true;
  }

  /**
   * Heuristic: count of unmatched target state keys.
   */
  private heuristic(state: WorldState, target: WorldState): number {
    let unmatched = 0;
    for (const [key, value] of Object.entries(target)) {
      if (state[key] !== value) unmatched++;
    }
    return unmatched;
  }

  private stateToString(state: WorldState): string {
    return Object.entries(state)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("|");
  }

  private buildResult(node: GoapNode, goal: GoapGoal, nodesExplored: number): GoapPlanResult {
    const actions: GoapAction[] = [];
    let current: GoapNode | null = node;
    while (current && current.action) {
      actions.unshift(current.action);
      current = current.parent;
    }
    return {
      success: true,
      actions,
      totalCost: node.gScore,
      goal,
      nodesExplored,
    };
  }

  private failureResult(goal: GoapGoal, reason: string): GoapPlanResult {
    return {
      success: false,
      actions: [],
      totalCost: 0,
      goal,
      nodesExplored: 0,
      failureReason: reason,
    };
  }
}
