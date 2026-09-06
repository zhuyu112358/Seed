// Tests for M12 Phase 4: Behavior Tree Enhancement.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BehaviorStatus } from "../src/behavior/BehaviorStatus.js";
import { Blackboard } from "../src/behavior/Blackboard.js";
import { BehaviorTree } from "../src/behavior/BehaviorTree.js";
import {
  Sequence,
  Selector,
  ActionNode,
  ConditionNode,
  WaitNode,
  BehaviorAgent,
} from "../src/behavior/BehaviorNode.js";
import {
  RandomSequence,
  RandomSelector,
  StatefulSelector,
  Cooldown,
  TimeLimit,
  ForceSuccess,
  ForceFailure,
  RepeatUntil,
  Counter,
  SubTree,
  LogNode,
} from "../src/behavior/BehaviorEnhanced.js";
import { BehaviorTreeBuilder } from "../src/behavior/BehaviorTreeBuilder.js";

const agent: BehaviorAgent = { id: "test_agent" };

// Helper: create an action that always succeeds.
function successAction(name = "success"): ActionNode {
  return new ActionNode(name, () => BehaviorStatus.Success);
}

// Helper: create an action that always fails.
function failureAction(name = "failure"): ActionNode {
  return new ActionNode(name, () => BehaviorStatus.Failure);
}

// Helper: create an action that runs for N ticks then succeeds.
function runningAction(ticks: number, name = "running"): ActionNode {
  let count = 0;
  return new ActionNode(name, () => {
    count++;
    if (count >= ticks) return BehaviorStatus.Success;
    return BehaviorStatus.Running;
  });
}

describe("Enhanced Composites - RandomSequence", () => {
  test("succeeds when all children succeed", () => {
    const tree = new BehaviorTree(new RandomSequence().addChild(successAction()).addChild(successAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("fails when a child fails", () => {
    const tree = new BehaviorTree(new RandomSequence().addChild(successAction()).addChild(failureAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });

  test("handles running child", () => {
    const tree = new BehaviorTree(new RandomSequence().addChild(runningAction(2)).addChild(successAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });
});

describe("Enhanced Composites - RandomSelector", () => {
  test("succeeds when a child succeeds", () => {
    const tree = new BehaviorTree(new RandomSelector().addChild(failureAction()).addChild(successAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("fails when all children fail", () => {
    const tree = new BehaviorTree(new RandomSelector().addChild(failureAction()).addChild(failureAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });
});

describe("Enhanced Composites - StatefulSelector", () => {
  test("resumes from running child on next tick", () => {
    const selector = new StatefulSelector();
    selector.addChild(runningAction(3));
    selector.addChild(successAction());
    const tree = new BehaviorTree(selector);

    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("fails when all children fail", () => {
    const tree = new BehaviorTree(new StatefulSelector().addChild(failureAction()).addChild(failureAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });
});

describe("Enhanced Decorators - Cooldown", () => {
  test("runs child normally when not on cooldown", () => {
    const tree = new BehaviorTree(new Cooldown(2, successAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("returns failure during cooldown", () => {
    const tree = new BehaviorTree(new Cooldown(3, successAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Success); // Triggers cooldown.
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown tick 1.
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown tick 2.
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown tick 3.
    assert.equal(tree.tick(agent), BehaviorStatus.Success); // Cooldown over.
  });

  test("does not start cooldown while child is running", () => {
    const tree = new BehaviorTree(new Cooldown(2, runningAction(2)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success); // Completes, starts cooldown.
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown.
  });
});

describe("Enhanced Decorators - TimeLimit", () => {
  test("succeeds if child completes within limit", () => {
    const tree = new BehaviorTree(new TimeLimit(5, runningAction(2)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("fails if child exceeds time limit", () => {
    const tree = new BehaviorTree(new TimeLimit(2, runningAction(5)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Limit reached.
  });

  test("resets timer after completion", () => {
    const tree = new BehaviorTree(new TimeLimit(3, new WaitNode(2)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success); // Completes, resets.
    assert.equal(tree.tick(agent), BehaviorStatus.Running); // New run, timer reset.
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });
});

describe("Enhanced Decorators - ForceSuccess", () => {
  test("returns success even when child fails", () => {
    const tree = new BehaviorTree(new ForceSuccess(failureAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("returns running when child is running", () => {
    const tree = new BehaviorTree(new ForceSuccess(runningAction(2)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });
});

describe("Enhanced Decorators - ForceFailure", () => {
  test("returns failure even when child succeeds", () => {
    const tree = new BehaviorTree(new ForceFailure(successAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });

  test("returns running when child is running", () => {
    const tree = new BehaviorTree(new ForceFailure(runningAction(2)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });
});

describe("Enhanced Decorators - RepeatUntil", () => {
  test("succeeds when child reaches target status", () => {
    let callCount = 0;
    const action = new ActionNode("flaky", () => {
      callCount++;
      return callCount >= 3 ? BehaviorStatus.Success : BehaviorStatus.Failure;
    });
    const tree = new BehaviorTree(new RepeatUntil(BehaviorStatus.Success, 5, action));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
    assert.equal(callCount, 3);
  });

  test("fails if max iterations exceeded", () => {
    const tree = new BehaviorTree(new RepeatUntil(BehaviorStatus.Success, 3, failureAction()));
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });

  test("handles running child", () => {
    const tree = new BehaviorTree(new RepeatUntil(BehaviorStatus.Success, 5, runningAction(2)));
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });
});

describe("Enhanced Leaf - Counter", () => {
  test("fails until target count reached", () => {
    const counter = new Counter(3);
    assert.equal(counter.tick(agent, new Blackboard()), BehaviorStatus.Failure);
    assert.equal(counter.tick(agent, new Blackboard()), BehaviorStatus.Failure);
    assert.equal(counter.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("resets after reaching target", () => {
    const counter = new Counter(2);
    counter.tick(agent, new Blackboard());
    counter.tick(agent, new Blackboard()); // Success, resets.
    assert.equal(counter.getCount(), 0);
    assert.equal(counter.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });
});

describe("Enhanced Leaf - SubTree", () => {
  test("executes registered subtree", () => {
    const bb = new Blackboard();
    const subtrees = new Map();
    const innerTree = new BehaviorTree(successAction("inner"));
    subtrees.set("my_tree", innerTree);
    bb.set("subtrees", subtrees);

    const tree = new BehaviorTree(new SubTree("my_tree"), bb);
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("fails if subtree not registered", () => {
    const tree = new BehaviorTree(new SubTree("nonexistent"));
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
  });
});

describe("Enhanced Leaf - LogNode", () => {
  test("logs message to blackboard", () => {
    const bb = new Blackboard();
    const tree = new BehaviorTree(new LogNode("test message"), bb);
    tree.tick(agent);
    const log = bb.get<string[]>("bt_log");
    assert.ok(log);
    assert.equal(log?.length, 1);
    assert.ok(log?.[0].includes("test message"));
  });

  test("always returns success", () => {
    const tree = new BehaviorTree(new LogNode("always success"));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });
});

describe("BehaviorTreeBuilder", () => {
  test("builds a simple tree with fluent API", () => {
    const builder = BehaviorTreeBuilder.create();
    const tree = builder
      .rootNode(
        builder.sequence(
          builder.condition("has energy", () => true),
          builder.action("work", () => BehaviorStatus.Success),
        ),
      )
      .build();
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("builds a tree with all composite types", () => {
    const builder = BehaviorTreeBuilder.create();
    const tree = builder
      .rootNode(
        builder.selector(
          builder.sequence(builder.action("a", () => BehaviorStatus.Failure)),
          builder.randomSelector(builder.action("b", () => BehaviorStatus.Success)),
          builder.statefulSelector(builder.action("c", () => BehaviorStatus.Success)),
        ),
      )
      .build();
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("builds a tree with decorators", () => {
    const builder = BehaviorTreeBuilder.create();
    const tree = builder
      .rootNode(
        builder.forceSuccess(
          builder.inverter(
            builder.action("fail", () => BehaviorStatus.Failure),
          ),
        ),
      )
      .build();
    // inverter(fail) = success, forceSuccess(success) = success
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("builds a tree with cooldown and time limit", () => {
    const builder = BehaviorTreeBuilder.create();
    const tree = builder
      .rootNode(
        builder.cooldown(1,
          builder.timeLimit(5,
            builder.action("do work", () => BehaviorStatus.Success),
          ),
        ),
      )
      .build();
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown.
  });

  test("builds a tree with custom blackboard", () => {
    const bb = new Blackboard();
    bb.set("test_key", "test_value");
    const builder = BehaviorTreeBuilder.create();
    const tree = builder
      .withBlackboard(bb)
      .rootNode(builder.action("check", (_a, blackboard) => {
        return blackboard.get("test_key") === "test_value"
          ? BehaviorStatus.Success
          : BehaviorStatus.Failure;
      }))
      .build();
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("throws if root not set", () => {
    const builder = BehaviorTreeBuilder.create();
    assert.throws(() => builder.build(), /root node not set/);
  });
});

describe("Enhanced Blackboard", () => {
  test("getOrDefault returns default for missing key", () => {
    const bb = new Blackboard();
    assert.equal(bb.getOrDefault("missing", "default"), "default");
  });

  test("getOrDefault returns value for existing key", () => {
    const bb = new Blackboard();
    bb.set("key", "value");
    assert.equal(bb.getOrDefault("key", "default"), "value");
  });

  test("consume gets and deletes a value", () => {
    const bb = new Blackboard();
    bb.set("key", "value");
    assert.equal(bb.consume("key"), "value");
    assert.equal(bb.has("key"), false);
  });

  test("increment increments numeric value", () => {
    const bb = new Blackboard();
    assert.equal(bb.increment("counter"), 1);
    assert.equal(bb.increment("counter", 5), 6);
  });

  test("scoped set/get/has", () => {
    const bb = new Blackboard();
    bb.setScoped("agent1", "health", 100);
    assert.equal(bb.getScoped("agent1", "health"), 100);
    assert.equal(bb.hasScoped("agent1", "health"), true);
    assert.equal(bb.hasScoped("agent2", "health"), false);
  });

  test("keysInScope returns only scoped keys", () => {
    const bb = new Blackboard();
    bb.setScoped("a", "x", 1);
    bb.setScoped("a", "y", 2);
    bb.setScoped("b", "z", 3);
    const keys = bb.keysInScope("a");
    assert.equal(keys.length, 2);
    assert.ok(keys.includes("x"));
    assert.ok(keys.includes("y"));
  });

  test("clearScope removes only scoped keys", () => {
    const bb = new Blackboard();
    bb.setScoped("a", "x", 1);
    bb.setScoped("b", "y", 2);
    bb.clearScope("a");
    assert.equal(bb.hasScoped("a", "x"), false);
    assert.equal(bb.hasScoped("b", "y"), true);
  });
});

describe("Integration - Enhanced Tree with GOAP-style state", () => {
  test("complex tree: check state -> find food -> eat with cooldown", () => {
    const bb = new Blackboard();
    bb.set("hungry", true);
    bb.set("has_food", false);

    const builder = BehaviorTreeBuilder.create();
    const tree = builder
      .withBlackboard(bb)
      .rootNode(
        builder.sequence(
          builder.condition("is hungry", (_a, b) => b.get("hungry") === true),
          builder.sequence(
            // Ensure we have food (find if needed).
            builder.selector(
              builder.condition("has food", (_a, b) => b.get("has_food") === true),
              builder.action("find food", (_a, b) => {
                b.set("has_food", true);
                return BehaviorStatus.Success;
              }),
            ),
            // Eat with cooldown.
            builder.cooldown(2, builder.action("eat", (_a, b) => {
              b.set("hungry", false);
              b.set("has_food", false);
              return BehaviorStatus.Success;
            })),
          ),
        ),
      )
      .build();

    // First tick: hungry, no food -> find food -> eat (cooldown starts).
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
    assert.equal(bb.get("has_food"), false); // Ate the food.
    assert.equal(bb.get("hungry"), false);

    // Reset hungry, next tick: hungry, no food -> find food -> eat on cooldown -> Failure.
    bb.set("hungry", true);
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown active on eat.
    assert.equal(bb.get("hungry"), true); // Still hungry (eat blocked).

    // Cooldown expires after 2 ticks.
    bb.set("hungry", true);
    assert.equal(tree.tick(agent), BehaviorStatus.Failure); // Cooldown tick 2.
    bb.set("hungry", true);
    assert.equal(tree.tick(agent), BehaviorStatus.Success); // Cooldown over, eat succeeds.
    assert.equal(bb.get("hungry"), false);
  });
});
