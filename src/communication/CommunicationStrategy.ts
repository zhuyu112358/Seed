// CommunicationStrategy: the pluggable medium interface. Each medium (acoustic,
// network, world-resonance) decides how a message reaches listeners.

import type { GameObject } from '../entity/Entity.js';
import type { Message, ReceivedMessage } from './Message.js';

/** A world handle passed to strategies so they can query listener positions. */
export interface WorldView {
  entities: Iterable<GameObject>;
  byId(id: string): GameObject | undefined;
}

export interface CommunicationStrategy {
  readonly medium: string;
  /**
   * Transmit `message` through this medium. Returns every listener that actually
   * received it, together with the attenuated intensity.
   */
  transmit(message: Message, source: GameObject, world: WorldView): ReceivedMessage[];
}
