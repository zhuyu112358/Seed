import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ObjectPool } from "../src/utils/ObjectPool.js";

interface TestObj {
  id: number;
  value: string;
  active: boolean;
}

let nextId = 0;
function makeObj(): TestObj {
  return { id: nextId++, value: "", active: false };
}

function resetObj(obj: TestObj): void {
  obj.value = "";
  obj.active = false;
}

describe("ObjectPool", () => {
  it("initializes with pre-allocated objects", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 10 });
    assert.equal(pool.size, 10);
    assert.equal(pool.getStats().createdCount, 10);
  });

  it("acquires an object from the pool without creating new one", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 5 });
    const createdBefore = pool.getStats().createdCount;
    const obj = pool.acquire();
    assert.ok(obj);
    assert.equal(pool.getStats().createdCount, createdBefore);
    assert.equal(pool.activeCount, 1);
    assert.equal(pool.size, 4);
  });

  it("creates a new object when pool is empty", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 0 });
    assert.equal(pool.size, 0);
    const obj = pool.acquire();
    assert.ok(obj);
    assert.equal(pool.getStats().createdCount, 1);
    assert.equal(pool.activeCount, 1);
  });

  it("releases an object back to the pool and reuses it", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, reset: resetObj, initialSize: 0 });
    const obj1 = pool.acquire();
    obj1.value = "hello";
    obj1.active = true;
    const id1 = obj1.id;
    pool.release(obj1);
    assert.equal(pool.activeCount, 0);
    assert.equal(pool.size, 1);

    const obj2 = pool.acquire();
    assert.equal(obj2.id, id1);
    assert.equal(obj2.value, "");
    assert.equal(obj2.active, false);
    assert.equal(pool.getStats().createdCount, 1);
  });

  it("ignores double-release of the same object", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 0 });
    const obj = pool.acquire();
    pool.release(obj);
    const releasedBefore = pool.getStats().releasedCount;
    pool.release(obj); // double release
    assert.equal(pool.getStats().releasedCount, releasedBefore);
    assert.equal(pool.size, 1);
  });

  it("respects maxSize by discarding excess released objects", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, maxSize: 3, initialSize: 0 });
    const objs: TestObj[] = [];
    for (let i = 0; i < 5; i++) {
      objs.push(pool.acquire());
    }
    assert.equal(pool.getStats().createdCount, 5);
    for (const obj of objs) {
      pool.release(obj);
    }
    assert.equal(pool.size, 3);
    assert.equal(pool.activeCount, 0);
  });

  it("preallocates objects up to target count", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 2 });
    pool.preallocate(10);
    assert.equal(pool.size, 10);
    assert.equal(pool.getStats().createdCount, 10);
  });

  it("does not preallocate beyond maxSize", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, maxSize: 5, initialSize: 0 });
    pool.preallocate(100);
    assert.equal(pool.size, 5);
  });

  it("clears all idle objects from the pool", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 10 });
    const obj = pool.acquire();
    pool.clear();
    assert.equal(pool.size, 0);
    assert.equal(pool.activeCount, 1);
    pool.release(obj);
    assert.equal(pool.size, 1);
  });

  it("tracks statistics accurately", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, reset: resetObj, initialSize: 3 });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    const c = pool.acquire();
    const stats = pool.getStats();
    assert.equal(stats.createdCount, 3);
    assert.equal(stats.acquiredCount, 3);
    assert.equal(stats.releasedCount, 1);
    assert.equal(stats.activeCount, 2);
    assert.equal(stats.poolSize, 1);
  });

  it("validates objects on acquire and discards invalid ones", () => {
    nextId = 0;
    let valid = true;
    const pool = new ObjectPool({
      factory: makeObj,
      validate: () => valid,
      initialSize: 1,
    });
    const obj1 = pool.acquire();
    pool.release(obj1);
    valid = false; // next acquire will find the pooled object invalid
    const createdBefore = pool.getStats().createdCount;
    const obj2 = pool.acquire();
    assert.notEqual(obj2.id, obj1.id);
    assert.equal(pool.getStats().createdCount, createdBefore + 1);
  });

  it("works without reset function", () => {
    nextId = 0;
    const pool = new ObjectPool({ factory: makeObj, initialSize: 0 });
    const obj = pool.acquire();
    obj.value = "persists";
    pool.release(obj);
    const obj2 = pool.acquire();
    assert.equal(obj2.value, "persists");
  });
});
