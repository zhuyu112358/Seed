// EventSystem: a typed in-process event bus with priority and cancellation.

import { Event, type EventPayload } from './Event.js';

type Handler<T extends EventPayload = EventPayload> = (event: Event<T>) => void | Promise<void>;

interface Subscription {
  handler: Handler;
  priority: number; // higher runs first
  once: boolean;
}

export class EventSystem {
  private readonly handlers = new Map<string, Subscription[]>();

  /** Subscribe to an event type. Returns an unsubscribe function. */
  on<T extends EventPayload = EventPayload>(
    type: string,
    handler: Handler<T>,
    priority = 0,
  ): () => void {
    const subs = this.handlers.get(type) ?? [];
    const sub: Subscription = { handler: handler as Handler, priority, once: false };
    subs.push(sub);
    subs.sort((a, b) => b.priority - a.priority);
    this.handlers.set(type, subs);
    return () => this.off(type, handler as Handler);
  }

  /** Subscribe once. */
  once<T extends EventPayload = EventPayload>(type: string, handler: Handler<T>, priority = 0): void {
    const wrapper: Handler<T> = (evt) => {
      this.off(type, wrapper as Handler);
      return handler(evt);
    };
    this.on(type, wrapper, priority);
  }

  off<T extends EventPayload = EventPayload>(type: string, handler: Handler<T>): void {
    const subs = this.handlers.get(type);
    if (!subs) return;
    const next = subs.filter((s) => s.handler !== (handler as Handler));
    if (next.length === 0) this.handlers.delete(type);
    else this.handlers.set(type, next);
  }

  /** Emit an event. Handlers run in priority order; cancellation stops further handlers. */
  emit(event: Event): void {
    const subs = this.handlers.get(event.type);
    if (!subs) return;
    for (const sub of [...subs]) {
      if (event.isCancelled()) break;
      // Synchronous handlers are the common path; async handlers are awaited fire-and-forget.
      try {
        const ret = sub.handler(event);
        if (ret instanceof Promise) {
          ret.catch((err) => {
            // A broken listener must not take down the bus.
            console.error(`[EventSystem] async handler failed for ${event.type}:`, err);
          });
        }
      } catch (err) {
        console.error(`[EventSystem] handler failed for ${event.type}:`, err);
      }
    }
  }

  listenerCount(type: string): number {
    return this.handlers.get(type)?.length ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}
