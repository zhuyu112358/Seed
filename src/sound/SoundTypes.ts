// Sound perception system types.
// Seed provides the sound propagation and audibility calculation framework;
// application layer configures sources/listeners and decides responses.
// Ember (soul engine) handles cognitive processing of auditory information.

/** Type of sound source. */
export type SoundType = "speech" | "noise" | "music" | "footstep" | "impact" | "alert" | "custom";

/** A sound source emitting sound into the world. */
export interface SoundSource {
  id: string;
  /** Type of sound. */
  type: SoundType;
  /** Position of the sound source. */
  position: { x: number; z: number };
  /** Source intensity (0-1, 1 = loudest). */
  intensity: number;
  /** Frequency in Hz (for directional/filtering use, optional). */
  frequency?: number;
  /** Duration in ticks (0 = persistent/looping). */
  duration: number;
  /** Tick when sound was created. */
  createdTick: number;
  /** Whether this sound source is active. */
  active: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A listener that can perceive sounds. */
export interface SoundListener {
  id: string;
  /** Position of the listener. */
  position: { x: number; z: number };
  /** Minimum intensity required to hear a sound (0-1). Default 0.05. */
  hearingThreshold: number;
  /** Whether this listener is active. */
  active: boolean;
}

/** A sound perceived by a listener. */
export interface HeardSound {
  /** ID of the sound source. */
  sourceId: string;
  /** Type of sound. */
  type: SoundType;
  /** Position of the sound source. */
  sourcePosition: { x: number; z: number };
  /** Received intensity at listener position (0-1). */
  receivedIntensity: number;
  /** Distance from listener to source. */
  distance: number;
  /** Direction angle from listener to source in degrees (0 = +x, counterclockwise). */
  directionAngle: number;
  /** Whether the sound is audible (intensity > threshold). */
  audible: boolean;
}

/** Configuration for sound perception. */
export interface SoundConfig {
  /** Attenuation coefficient (inverse-square term). Default 0.02. */
  attenuation: number;
  /** Linear absorption per metre. Default 0.01. */
  absorption: number;
  /** Maximum propagation radius. Default 50. */
  maxRadius: number;
  /** Default minimum audible intensity. Default 0.05. */
  minAudible: number;
}

/** Default sound configuration. */
export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  attenuation: 0.02,
  absorption: 0.01,
  maxRadius: 50,
  minAudible: 0.05,
};

/** Result of a sound operation. */
export interface SoundResult {
  success: boolean;
  sourceId?: string;
  listenerId?: string;
  error?: string;
}
