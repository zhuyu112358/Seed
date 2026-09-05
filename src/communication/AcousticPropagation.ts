// AcousticPropagation: sound travels through a medium with distance decay.
//
// Model:
//   receivedIntensity = sourceIntensity
//                       * (1 / (1 + attenuation * distance^2))   [inverse-square-ish]
//                       * (1 - absorption * distance)            [medium absorption]
// A listener receives the message only if receivedIntensity > minAudible
// and distance <= maxRadius.

import type { GameObject } from '../entity/Entity.js';
import type { Message, ReceivedMessage } from './Message.js';
import type { CommunicationStrategy, WorldView } from './CommunicationStrategy.js';

export interface AcousticConfig {
  /** Decay coefficient in the inverse-square term (0 = no decay). */
  attenuation?: number;
  /** Linear absorption per metre, in [0, 1]. */
  absorption?: number;
  /** Hard cap on propagation radius in metres. */
  maxRadius?: number;
  /** Minimum intensity required for a listener to hear the message. */
  minAudible?: number;
}

export class AcousticPropagation implements CommunicationStrategy {
  public readonly medium = 'acoustic';
  private readonly attenuation: number;
  private readonly absorption: number;
  private readonly maxRadius: number;
  private readonly minAudible: number;

  constructor(cfg: AcousticConfig = {}) {
    this.attenuation = cfg.attenuation ?? 0.02;
    this.absorption = cfg.absorption ?? 0.01;
    this.maxRadius = cfg.maxRadius ?? 50;
    this.minAudible = cfg.minAudible ?? 0.05;
  }

  /** Public so tests can probe the attenuation curve without a world. */
  intensityAt(sourceIntensity: number, distance: number): number {
    if (distance > this.maxRadius) return 0;
    const inverseSquare = 1 / (1 + this.attenuation * distance * distance);
    const mediumAbsorption = Math.max(0, 1 - this.absorption * distance);
    return Math.max(0, sourceIntensity * inverseSquare * mediumAbsorption);
  }

  transmit(message: Message, source: GameObject, world: WorldView): ReceivedMessage[] {
    const received: ReceivedMessage[] = [];
    for (const e of world.entities) {
      if (e.id === source.id) continue;
      if (!e.active) continue;
      const d = source.position.distance(e.position);
      const intensity = this.intensityAt(message.intensity, d);
      if (intensity <= this.minAudible) continue;
      received.push({ original: message, receivedIntensity: intensity, distance: d });
    }
    return received;
  }
}
