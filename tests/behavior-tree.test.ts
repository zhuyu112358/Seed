// Tests for behavior tree system (M6 phase 1).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BehaviorStatus,
  Blackboard,
  Sequence,
  Selector,
  Parallel,
  ParallelPolicy,
  Inverter,
  Repeater,
  UntilFail,
  ActionNode,
  ConditionNode,
  WaitNode,
  BehaviorTree,
  BehaviorTreeSystem,
  BehaviorAgent,
} from "../src/behavior/index.js";

const agent: BehaviorAgent = { id: "test-agent" };

describe("Blackboard", () => {
  test("set and get values", () => {
    const bb = new Blackboard();
    bb.set("health", 100);
    assert.equal(bb.get("health"), 100);
  });

  test("has returns true for set keys", () => {
    const bb = new Blackboard();
    bb.set("key", "value");
    assert.ok(bb.has("key"));
    assert.ok(!bb.has("missing"));
  });

  test("delete removes keys", () => {
    const bb = new Blackboard();
    bb.set("key", "value");
    assert.ok(bb.delete("key"));
    assert.ok(!bb.has("key"));
  });

  test("onChange fires when value changes", () => {
    const bb = new Blackboard();
    let changedKey = "";
    bb.onChange((key) => { changedKey = key; });
    bb.set("test", 42);
    assert.equal(changedKey, "test");
  });

  test("onKeyChange fires for specific key", () => {
    const bb = new Blackboard();
    let value = 0;
    bb.onKeyChange("health", (v) => { value = v as number; });
    bb.set("health", 50);
    assert.equal(value, 50);
  });

  test("clear removes all data", () => {
    const bb = new Blackboard();
    bb.set("a", 1);
    bb.set("b", 2);
    bb.clear();
    assert.equal(bb.size, 0);
  });

  test("toJSON and fromJSON roundtrip", () => {
    const bb = new Blackboard();
    bb.set("x", 10);
    bb.set("y", "hello");
    const json = bb.toJSON();
    const bb2 = Blackboard.fromJSON(json);
    assert.equal(bb2.get("x"), 10);
    assert.equal(bb2.get("y"), "hello");
  });
});

describe("ActionNode", () => {
  test("returns success from callback", () => {
    const node = new ActionNode("test", () => BehaviorStatus.Success);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("returns failure from callback", () => {
    const node = new ActionNode("test", () => BehaviorStatus.Failure);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });

  test("can access blackboard", () => {
    const bb = new Blackboard();
    bb.set("counter", 0);
    const node = new ActionNode("inc", (_a, b) => {
      b.set("counter", (b.get("counter") as number) + 1);
      return BehaviorStatus.Success;
    });
    node.tick(agent, bb);
    assert.equal(bb.get("counter"), 1);
  });
});

describe("ConditionNode", () => {
  test("returns success when condition true", () => {
    const node = new ConditionNode("test", () => true);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("returns failure when condition false", () => {
    const node = new ConditionNode("test", () => false);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });
});

describe("WaitNode", () => {
  test("returns running until wait complete", () => {
    const node = new WaitNode(3);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Running);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Running);
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("reset clears wait state", () => {
    const node = new WaitNode(2);
    node.tick(agent, new Blackboard());
    node.reset();
    assert.equal(node.tick(agent, new Blackboard()), BehaviorStatus.Running);
  });
});

describe("Sequence", () => {
  test("succeeds when all children succeed", () => {
    const seq = new Sequence()
      .addChild(new ActionNode("a", () => BehaviorStatus.Success))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(seq.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("fails when first child fails", () => {
    const seq = new Sequence()
      .addChild(new ActionNode("a", () => BehaviorStatus.Failure))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(seq.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });

  test("does not execute children after failure", () => {
    let bExecuted = false;
    const seq = new Sequence()
      .addChild(new ActionNode("a", () => BehaviorStatus.Failure))
      .addChild(new ActionNode("b", () => { bExecuted = true; return BehaviorStatus.Success; }));
    seq.tick(agent, new Blackboard());
    assert.ok(!bExecuted);
  });

  test("handles running child across ticks", () => {
    const seq = new Sequence()
      .addChild(new WaitNode(2))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(seq.tick(agent, new Blackboard()), BehaviorStatus.Running);
    assert.equal(seq.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });
});

describe("Selector", () => {
  test("succeeds when first child succeeds", () => {
    const sel = new Selector()
      .addChild(new ActionNode("a", () => BehaviorStatus.Success))
      .addChild(new ActionNode("b", () => BehaviorStatus.Failure));
    assert.equal(sel.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("tries next child when first fails", () => {
    const sel = new Selector()
      .addChild(new ActionNode("a", () => BehaviorStatus.Failure))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(sel.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("fails when all children fail", () => {
    const sel = new Selector()
      .addChild(new ActionNode("a", () => BehaviorStatus.Failure))
      .addChild(new ActionNode("b", () => BehaviorStatus.Failure));
    assert.equal(sel.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });
});

describe("Parallel", () => {
  test("RequireAll succeeds when all succeed", () => {
    const par = new Parallel(ParallelPolicy.RequireAll)
      .addChild(new ActionNode("a", () => BehaviorStatus.Success))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(par.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("RequireAll fails when any fails", () => {
    const par = new Parallel(ParallelPolicy.RequireAll)
      .addChild(new ActionNode("a", () => BehaviorStatus.Success))
      .addChild(new ActionNode("b", () => BehaviorStatus.Failure));
    assert.equal(par.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });

  test("RequireAny succeeds when any succeeds", () => {
    const par = new Parallel(ParallelPolicy.RequireAny)
      .addChild(new ActionNode("a", () => BehaviorStatus.Failure))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(par.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("handles running children", () => {
    const par = new Parallel(ParallelPolicy.RequireAll)
      .addChild(new WaitNode(2))
      .addChild(new ActionNode("b", () => BehaviorStatus.Success));
    assert.equal(par.tick(agent, new Blackboard()), BehaviorStatus.Running);
    assert.equal(par.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });
});

describe("Inverter", () => {
  test("inverts success to failure", () => {
    const inv = new Inverter(new ActionNode("a", () => BehaviorStatus.Success));
    assert.equal(inv.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });

  test("inverts failure to success", () => {
    const inv = new Inverter(new ActionNode("a", () => BehaviorStatus.Failure));
    assert.equal(inv.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("passes through running", () => {
    const inv = new Inverter(new WaitNode(2));
    assert.equal(inv.tick(agent, new Blackboard()), BehaviorStatus.Running);
  });
});

describe("Repeater", () => {
  test("repeats child N times then succeeds", () => {
    let count = 0;
    const rep = new Repeater(3, new ActionNode("a", () => { count++; return BehaviorStatus.Success; }));
    assert.equal(rep.tick(agent, new Blackboard()), BehaviorStatus.Success);
    assert.equal(count, 3);
  });

  test("fails on first child failure", () => {
    const rep = new Repeater(5, new ActionNode("a", () => BehaviorStatus.Failure));
    assert.equal(rep.tick(agent, new Blackboard()), BehaviorStatus.Failure);
  });
});

describe("UntilFail", () => {
  test("succeeds when child fails", () => {
    const uf = new UntilFail(new ActionNode("a", () => BehaviorStatus.Failure));
    assert.equal(uf.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });

  test("returns running while child succeeds", () => {
    let count = 0;
    const uf = new UntilFail(new ActionNode("a", () => {
      count++;
      return count >= 3 ? BehaviorStatus.Failure : BehaviorStatus.Success;
    }));
    assert.equal(uf.tick(agent, new Blackboard()), BehaviorStatus.Running);
    assert.equal(uf.tick(agent, new Blackboard()), BehaviorStatus.Running);
    assert.equal(uf.tick(agent, new Blackboard()), BehaviorStatus.Success);
  });
});

describe("BehaviorTree", () => {
  test("executes root node", () => {
    const tree = new BehaviorTree(new ActionNode("root", () => BehaviorStatus.Success));
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
  });

  test("has its own blackboard", () => {
    const tree = new BehaviorTree(new ActionNode("set", (_a, bb) => {
      bb.set("x", 42);
      return BehaviorStatus.Success;
    }));
    tree.tick(agent);
    assert.equal(tree.getBlackboard().get("x"), 42);
  });

  test("reset resets root", () => {
    const tree = new BehaviorTree(new WaitNode(2));
    tree.tick(agent);
    tree.reset();
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
  });

  test("tracks tick count", () => {
    const tree = new BehaviorTree(new ActionNode("a", () => BehaviorStatus.Success));
    tree.tick(agent);
    tree.tick(agent);
    assert.equal(tree.getTickCount(), 2);
  });

  test("serialize/deserialize preserves blackboard", () => {
    const tree = new BehaviorTree(new ActionNode("set", (_a, bb) => {
      bb.set("health", 80);
      return BehaviorStatus.Success;
    }));
    tree.tick(agent);
    const data = tree.serialize();
    const tree2 = new BehaviorTree(new ActionNode("noop", () => BehaviorStatus.Success));
    tree2.deserialize(data);
    assert.equal(tree2.getBlackboard().get("health"), 80);
  });
});

describe("BehaviorTreeSystem", () => {
  test("registers and executes agent trees", () => {
    const system = new BehaviorTreeSystem();
    let executed = false;
    const tree = new BehaviorTree(new ActionNode("a", () => {
      executed = true;
      return BehaviorStatus.Success;
    }));
    system.registerAgent("agent1", tree);
    system.tick(1 / 60, {} as any, {} as any);
    assert.ok(executed);
  });

  test("unregister removes agent", () => {
    const system = new BehaviorTreeSystem();
    system.registerAgent("a1", new BehaviorTree(new ActionNode("a", () => BehaviorStatus.Success)));
    assert.ok(system.hasAgent("a1"));
    system.unregisterAgent("a1");
    assert.ok(!system.hasAgent("a1"));
  });

  test("executes multiple agents", () => {
    const system = new BehaviorTreeSystem();
    let count1 = 0, count2 = 0;
    system.registerAgent("a1", new BehaviorTree(new ActionNode("a", () => { count1++; return BehaviorStatus.Success; })));
    system.registerAgent("a2", new BehaviorTree(new ActionNode("b", () => { count2++; return BehaviorStatus.Success; })));
    system.tick(1 / 60, {} as any, {} as any);
    assert.equal(count1, 1);
    assert.equal(count2, 1);
  });

  test("disabled system does not execute", () => {
    const system = new BehaviorTreeSystem();
    let executed = false;
    system.registerAgent("a1", new BehaviorTree(new ActionNode("a", () => {
      executed = true;
      return BehaviorStatus.Success;
    })));
    system.enabled = false;
    system.tick(1 / 60, {} as any, {} as any);
    assert.ok(!executed);
  });

  test("resetAll resets all trees", () => {
    const system = new BehaviorTreeSystem();
    system.registerAgent("a1", new BehaviorTree(new WaitNode(2)));
    system.tick(1 / 60, {} as any, {} as any);
    system.resetAll();
    const tree = system.getTree("a1")!;
    assert.equal(tree.tick(agent), BehaviorStatus.Running);
  });
});

describe("Complex behavior tree", () => {
  test("patrol behavior: check condition -> wait -> action", () => {
    const bb = new Blackboard();
    bb.set("energy", 100);
    let rested = false;

    const tree = new BehaviorTree(
      new Sequence()
        .addChild(new ConditionNode("has energy", (_a, b) => (b.get("energy") as number) > 20))
        .addChild(new ActionNode("patrol", (_a, b) => {
          b.set("energy", (b.get("energy") as number) - 30);
          return BehaviorStatus.Success;
        }))
        .addChild(new Inverter(new ConditionNode("low energy", (_a, b) => (b.get("energy") as number) > 30)))
        .addChild(new ActionNode("rest", () => {
          rested = true;
          return BehaviorStatus.Success;
        })),
      bb,
    );

    // Tick 1: energy 100 -> has energy(>20) -> patrol -> energy 70 -> low energy(70>30) -> inverter fails -> sequence fails
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);
    assert.ok(!rested);

    // Tick 2: energy 70 -> has energy -> patrol -> energy 40 -> low energy(40>30) -> inverter fails
    assert.equal(tree.tick(agent), BehaviorStatus.Failure);

    // Tick 3: energy 40 -> has energy -> patrol -> energy 10 -> low energy(10>30=false) -> inverter succeeds -> rest
    assert.equal(tree.tick(agent), BehaviorStatus.Success);
    assert.ok(rested);
  });
});

