// NetworkPacket: stub for a future distributed/socket-based communication medium.
// It implements the interface so the SDK can wire it up today, but the actual
// mesh/routing logic lands in a later iteration (see docs/ROADMAP.md).

import type { GameObject } from '../entity/Entity.js';
import type { Message, ReceivedMessage } from './Message.js';
import type { CommunicationStrategy, WorldView } from './CommunicationStrategy.js';

export class NetworkPacket implements CommunicationStrategy {
  public readonly medium = 'network';

  /**
   * STUB: today this broadcasts to every active entity with no distance decay.
   * The real implementation will route over WebSocket nodes and respect link
   * latency / bandwidth budgets.
   */
  transmit(message: Message, source: GameObject, world: WorldView): ReceivedMessage[] {
    const received: ReceivedMessage[] = [];
    for (const e of world.entities) {
      if (e.id === source.id || !e.active) continue;
      // Stub: full intensity regardless of distance (TODO: real routing).
      received.push({ original: message, receivedIntensity: message.intensity, distance: 0 });
    }
    return received;
  }
}
