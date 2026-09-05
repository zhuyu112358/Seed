import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SeededRandom } from "../src/generation/SeededRandom.js";

describe("SeededRandom", () => {
  test("same seed produces same sequence", () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      assert.equal(rng1.next(), rng2.next());
    }
  });

  test("different seeds produce different sequences", () => {
    const rng1 = new SeededRandom(1);
    const rng2 = new SeededRandom(2);
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1.next() !== rng2.next()) {
        allSame = false;
        break;
      }
    }
    assert.equal(allSame, false);
  });

  test("string seed produces deterministic sequence", () => {
    const rng1 = new SeededRandom("hello-world");
    const rng2 = new SeededRandom("hello-world");
    assert.equal(rng1.next(), rng2.next());
    assert.equal(rng1.nextInt(0, 100), rng2.nextInt(0, 100));
  });

  test("next returns value in [0, 1)", () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
    }
  });

  test("nextInt returns value in [min, max] inclusive", () => {
    const rng = new SeededRandom(456);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(5, 10);
      assert.ok(v >= 5 && v <= 10, `value ${v} out of range [5, 10]`);
      assert.equal(Number.isInteger(v), true);
    }
  });

  test("nextInt with min=max returns that value", () => {
    const rng = new SeededRandom(789);
    for (let i = 0; i < 100; i++) {
      assert.equal(rng.nextInt(7, 7), 7);
    }
  });

  test("nextFloat returns value in [min, max)", () => {
    const rng = new SeededRandom(111);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat(-5, 5);
      assert.ok(v >= -5 && v < 5, `value ${v} out of range [-5, 5)`);
    }
  });

  test("chance returns true with approximate probability", () => {
    const rng = new SeededRandom(222);
    let trueCount = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.5)) trueCount++;
    }
    // Should be roughly 50% (within 5% margin for 10k samples).
    assert.ok(trueCount > n * 0.45 && trueCount < n * 0.55,
      `chance(0.5) gave ${trueCount}/${n} true, expected ~50%`);
  });

  test("chance(0) always false, chance(1) always true", () => {
    const rng = new SeededRandom(333);
    for (let i = 0; i < 100; i++) {
      assert.equal(rng.chance(0), false);
      assert.equal(rng.chance(1), true);
    }
  });

  test("pick returns an element from the array", () => {
    const rng = new SeededRandom(444);
    const arr = ["a", "b", "c", "d", "e"];
    for (let i = 0; i < 100; i++) {
      const picked = rng.pick(arr);
      assert.ok(arr.includes(picked), `picked ${picked} not in array`);
    }
  });

  test("pick from empty array throws", () => {
    const rng = new SeededRandom(555);
    assert.throws(() => rng.pick([]), /empty array/);
  });

  test("sample returns n distinct elements", () => {
    const rng = new SeededRandom(666);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sampled = rng.sample(arr, 5);
    assert.equal(sampled.length, 5);
    // All distinct.
    assert.equal(new Set(sampled).size, 5);
    // All from original array.
    for (const v of sampled) {
      assert.ok(arr.includes(v));
    }
  });

  test("sample with n > length throws", () => {
    const rng = new SeededRandom(777);
    assert.throws(() => rng.sample([1, 2], 5), /Cannot sample/);
  });

  test("shuffle returns all elements in different order", () => {
    const rng = new SeededRandom(888);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle(arr);
    assert.equal(shuffled.length, arr.length);
    assert.deepEqual([...shuffled].sort((a, b) => a - b), arr);
    // Original array unchanged.
    assert.deepEqual(arr, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("getState/setState allows resuming sequence", () => {
    const rng1 = new SeededRandom(999);
    rng1.next();
    rng1.next();
    const state = rng1.getState();

    const rng2 = new SeededRandom(0);
    rng2.setState(state);
    assert.equal(rng1.next(), rng2.next());
    assert.equal(rng1.nextInt(0, 100), rng2.nextInt(0, 100));
  });

  test("fork creates independent sub-generator", () => {
    const rng = new SeededRandom(101);
    const fork1 = rng.fork();
    const fork2 = rng.fork();
    // Forks should be deterministic given the parent state.
    const rng2 = new SeededRandom(101);
    const fork1b = rng2.fork();
    assert.equal(fork1.next(), fork1b.next());
    // Two forks from same parent state should differ (different sub-seeds).
    assert.notEqual(fork1.next(), fork2.next());
  });
});
