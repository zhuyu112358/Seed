// Message: the unit of in-world communication between souls / entities.

export type Medium = 'acoustic' | 'network' | 'resonance';

export interface MessagePosition {
  x: number;
  y: number;
  z: number;
}

let nextMsgId = 1;

export class Message {
  public readonly id: string;
  public readonly content: string;
  public readonly sourceId: string;
  public readonly position: MessagePosition;
  public readonly medium: Medium;
  public readonly intensity: number;
  public readonly timestamp: number;

  constructor(opts: {
    id?: string;
    content: string;
    sourceId: string;
    position: MessagePosition;
    medium: Medium;
    intensity?: number;
    timestamp?: number;
  }) {
    this.id = opts.id ?? `msg_${Date.now().toString(36)}_${nextMsgId++}`;
    this.content = opts.content;
    this.sourceId = opts.sourceId;
    this.position = opts.position;
    this.medium = opts.medium;
    this.intensity = opts.intensity ?? 1;
    this.timestamp = opts.timestamp ?? Date.now();
  }
}

/** A message as received by a listener, with the attenuated intensity it arrives at. */
export interface ReceivedMessage {
  original: Message;
  receivedIntensity: number;
  distance: number;
}
