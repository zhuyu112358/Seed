/**
 * Seed SDK - Event listener helper
 *
 * Typed event emitter with priority ordering, async handlers and error
 * isolation: one throwing handler never prevents the others from running.
 */

import type { WorldEvent } from '../types/index.js';

export type WorldEventListenerType =
  | 'tick' | 'entityCreated' | 'entityRemoved' | 'entityMoved' | 'collision'
  | 'eventTriggered' | 'eventExpired' | 'soulJoined' | 'soulLeft' | 'worldEffect' | 'error';

export type WorldEventHandler = (event: WorldEvent) => void | Promise<void>;

interface Subscription {
  handler: WorldEventHandler;
  priority: number;
  once: boolean;
}

export interface ListenerHandle {
  on(type: string, handler: WorldEventHandler, priority?: number): this;
  off(type: string, handler: WorldEventHandler): this;
  once(type: string, handler: WorldEventHandler, priority?: number): this;
  emit(type: string, event: WorldEvent): Promise<void>;
  removeAll(type?: string): this;
}

/** Create an isolated listener hub. */
export function createListener(): ListenerHandle {
  const subscriptions = new Map<string, Subscription[]>();

  function sorted(type: string): Subscription[] {
    const list = subscriptions.get(type);
    if (!list) return [];
    return [...list].sort((a, b) => b.priority - a.priority);
  }

  return {
    on(type, handler, priority = 0) {
      const list = subscriptions.get(type) ?? [];
      list.push({ handler, priority, once: false });
      subscriptions.set(type, list);
      return this;
    },

    off(type, handler) {
      const list = subscriptions.get(type);
      if (!list) return this;
      const next = list.filter((s) => s.handler !== handler);
      if (next.length === 0) subscriptions.delete(type);
      else subscriptions.set(type, next);
      return this;
    },

    once(type, handler, priority = 0) {
      const wrapper: WorldEventHandler = (event) => {
        this.off(type, wrapper);
        return handler(event);
      };
      return this.on(type, wrapper, priority);
    },

    async emit(type, event) {
      const handlers = sorted(type);
      const pending: Array<Promise<void>> = [];
      for (const sub of handlers) {
        try {
          const result = sub.handler(event);
          if (result instanceof Promise) {
            pending.push(result.catch((err: unknown) => {
              console.error(`[listener] async handler failed for ${type}:`, err);
            }));
          }
        } catch (err) {
          console.error(`[listener] handler failed for ${type}:`, err);
        }
      }
      if (pending.length > 0) await Promise.all(pending);
    },

    removeAll(type) {
      if (type === undefined) subscriptions.clear();
      else subscriptions.delete(type);
      return this;
    },
  };
}
