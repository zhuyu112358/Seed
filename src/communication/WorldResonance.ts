// WorldResonance: stub for a future "deep magic" medium that bypasses ordinary
// distance (think: Souls whispering through the world itself). Implemented as a
// skeleton so the SDK has a third medium; actual resonance rules land later.

import type { GameObject } from '../entity/Entity.js';
import type { Message, ReceivedMessage } from './Message.js';
import type { CommunicationStrategy, WorldView } from './CommunicationStrategy.js';

export class WorldResonance implements CommunicationStrategy {
  public readonly medium = 'resonance';

  /**
   * STUB: only soul-proxy entities "hear" resonance, and only at full intensity.
   * TODO: tie resonance to soul element / valueSystem affinity.
   */
  transmit(message: Message, source: GameObject, world: WorldView): ReceivedMessage[] {
    const received: ReceivedMessage[] = [];
    for (const e of world.entities) {
      if (e.id === source.id || !e.active) continue;
      if (e.type !== 'soul-proxy') continue;
      received.push({ original: message, receivedIntensity: message.intensity, distance: 0 });
    }
    return received;
  }
}
