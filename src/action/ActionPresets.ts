// ActionPresets: configurable preset action definitions for common action types.
//
// These presets provide reasonable defaults for attack/defend/interact/harvest/build
// actions. Application layer can override any property or create custom definitions.
// Seed does NOT hardcode world-specific values — these are framework defaults that
// can be configured per entity type.

import type { ActionDefinition } from "./ActionTypes.js";

/** Preset action definition factory options. */
export interface PresetOptions {
  castTime?: number;
  duration?: number;
  cooldown?: number;
  range?: number;
  cancellable?: boolean;
  animationEvent?: string;
  metadata?: Record<string, unknown>;
}

/** Create an attack action definition. */
export function createAttackPreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "attack",
    name: options.metadata?.name as string ?? "Attack",
    category: "attack",
    castTime: options.castTime ?? 3,
    duration: options.duration ?? 5,
    cooldown: options.cooldown ?? 10,
    range: options.range ?? 3,
    cancellable: options.cancellable ?? true,
    animationEvent: options.animationEvent ?? "attack",
    metadata: options.metadata,
  };
}

/** Create a defend/guard action definition. */
export function createDefendPreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "defend",
    name: options.metadata?.name as string ?? "Defend",
    category: "defend",
    castTime: options.castTime ?? 1,
    duration: options.duration ?? 30,
    cooldown: options.cooldown ?? 5,
    range: options.range ?? 0,
    cancellable: options.cancellable ?? true,
    animationEvent: options.animationEvent ?? "defend",
    metadata: options.metadata,
  };
}

/** Create an interact action definition. */
export function createInteractPreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "interact",
    name: options.metadata?.name as string ?? "Interact",
    category: "interact",
    castTime: options.castTime ?? 2,
    duration: options.duration ?? 3,
    cooldown: options.cooldown ?? 2,
    range: options.range ?? 2,
    cancellable: options.cancellable ?? true,
    animationEvent: options.animationEvent ?? "interact",
    metadata: options.metadata,
  };
}

/** Create a harvest action definition. */
export function createHarvestPreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "harvest",
    name: options.metadata?.name as string ?? "Harvest",
    category: "harvest",
    castTime: options.castTime ?? 5,
    duration: options.duration ?? 10,
    cooldown: options.cooldown ?? 3,
    range: options.range ?? 2,
    cancellable: options.cancellable ?? true,
    animationEvent: options.animationEvent ?? "harvest",
    metadata: options.metadata,
  };
}

/** Create a build action definition. */
export function createBuildPreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "build",
    name: options.metadata?.name as string ?? "Build",
    category: "build",
    castTime: options.castTime ?? 10,
    duration: options.duration ?? 20,
    cooldown: options.cooldown ?? 5,
    range: options.range ?? 3,
    cancellable: options.cancellable ?? false,
    animationEvent: options.animationEvent ?? "build",
    metadata: options.metadata,
  };
}

/** Create a move action definition. */
export function createMovePreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "move",
    name: options.metadata?.name as string ?? "Move",
    category: "move",
    castTime: options.castTime ?? 0,
    duration: options.duration ?? 0,
    cooldown: options.cooldown ?? 0,
    range: options.range ?? 0,
    cancellable: options.cancellable ?? true,
    animationEvent: options.animationEvent ?? "move",
    metadata: options.metadata,
  };
}

/** Create a communicate action definition. */
export function createCommunicatePreset(options: PresetOptions = {}): ActionDefinition {
  return {
    type: options.metadata?.type as string ?? "communicate",
    name: options.metadata?.name as string ?? "Communicate",
    category: "communicate",
    castTime: options.castTime ?? 1,
    duration: options.duration ?? 2,
    cooldown: options.cooldown ?? 1,
    range: options.range ?? 10,
    cancellable: options.cancellable ?? true,
    animationEvent: options.animationEvent ?? "speak",
    metadata: options.metadata,
  };
}

/** Get all standard preset definitions. */
export function getAllPresets(): ActionDefinition[] {
  return [
    createAttackPreset(),
    createDefendPreset(),
    createInteractPreset(),
    createHarvestPreset(),
    createBuildPreset(),
    createMovePreset(),
    createCommunicatePreset(),
  ];
}
