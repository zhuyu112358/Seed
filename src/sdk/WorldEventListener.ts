// WorldEventListener: a typed event hub for SDK consumers.
// Supports priority ordering, async handlers, one-time handlers, and error isolation.

import type { WorldEvent } from '../types/index.js';

type EventHandler = (event: WorldEvent) => void | Promise<void>;

interface HandlerEntry {
  handler: EventHandler;
  priority: number;
  once: boolean;
}

export interface WorldEventHub {
  on(type: string, handler: EventHandler, priority?: number): void;
  off(type: string, handler: EventHandler): void;
  once(type: string, handler: EventHandler, priority?: number): void;
  emit(type: string, event: WorldEvent): Promise<void>;
  removeAll(): void;
}

/**
 * Create a new event listener hub.
 * Handlers with higher priority run first. Async handlers are awaited.
 * A throwing handler does not prevent other handlers from running.
 */
export function createListener(): WorldEventHub {
  const handlers = new Map<string, HandlerEntry[]>();

  function on(type: string, handler: EventHandler, priority = 0): void {
    const list = handlers.get(type) ?? [];
    list.push({ handler, priority, once: false });
    list.sort((a, b) => b.priority - a.priority);
    handlers.set(type, list);
  }

  function off(type: string, handler: EventHandler): void {
    const list = handlers.get(type);
    if (!list) return;
    const idx = list.findIndex((e) => e.handler === handler);
    if (idx >= 0) list.splice(idx, 1);
  }

  function once(type: string, handler: EventHandler, priority = 0): void {
    const list = handlers.get(type) ?? [];
    list.push({ handler, priority, once: true });
    list.sort((a, b) => b.priority - a.priority);
    handlers.set(type, list);
  }

  async function emit(type: string, event: WorldEvent): Promise<void> {
    const list = handlers.get(type);
    if (!list || list.length === 0) return;
    const entries = [...list];
    for (const entry of entries) {
      try {
        await entry.handler(event);
      } catch {
        // Error isolation: one handler's failure does not stop others.
      }
      if (entry.once) {
        off(type, entry.handler);
      }
    }
  }

  function removeAll(): void {
    handlers.clear();
  }

  return { on, off, once, emit, removeAll };
}
