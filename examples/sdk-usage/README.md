# Seed SDK Usage Examples

This directory contains runnable examples demonstrating how to use the Seed virtual world engine SDK.

## Prerequisites

- Node.js 18+
- TypeScript 5+
- Seed SDK v1.0.0 (`seed-system` package)

## Running Examples

All examples can be run directly with tsx:

```bash
npx tsx examples/sdk-usage/<example-name>.ts
```

## Examples

### 1. Basic World (`basic-world.ts`)

Demonstrates the fundamentals:
- Creating a world with `WorldBuilder`
- Adding static and dynamic entities
- Enabling physics simulation
- Listening for collision events
- Running the simulation loop

**Key APIs:** `WorldBuilder`, `PhysicsSystem`, `PhysicsConfig`, `GameObject`, `EventSystem`, `Logger`

### 2. Pathfinding (`pathfinding.ts`)

Demonstrates navigation around obstacles:
- Creating obstacle courses with walls
- Building a navigation grid (`PathfinderSystem`)
- Finding paths with A* algorithm
- Smoothing paths with string-pulling (`PathSmoother`)
- Following paths with dynamic aiming (`PathFollowerSystem`)
- Arrival detection (`MovementController`)

**Key APIs:** `PathfinderSystem`, `PathSmoother`, `PathFollowerSystem`, `MovementController`, `GridMap`, `AStarPathfinder`

### 3. Soul Interaction (`soul-interaction.ts`)

Demonstrates the complete perceive→decide→act loop:
- Setting up environment systems (weather, light, thermal)
- Generating perception frames (`SoulPerceptionSystem`)
- Bridging to SoulArena (`SoulBridgeAdapter`, `SoulClient`)
- Executing soul actions (`SoulActionSystem`)
- Acoustic communication (`AcousticPropagation`)
- Mock adapter pattern for testing without SoulArena

**Key APIs:** `SoulPerceptionSystem`, `SoulActionSystem`, `SoulBridgeAdapter`, `SoulClient`, `PerceptionFrame`, `ActionRequest`, `ActionResult`

**Note:** This example requires a running SoulArena server. Set the `SOUL_ARENA_URL` environment variable to point to your SoulArena instance. For testing without SoulArena, see the mock adapter pattern at the bottom of the file.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        World (tick loop)                     │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   Physics    │  Pathfinding │   Soul       │  Environment  │
│   System     │   System     │   Bridge     │   Systems     │
│              │              │              │               │
│  - gravity   │  - GridMap   │  - Perceive  │  - Weather    │
│  - friction  │  - A*        │  - Decide    │  - Light      │
│  - collision │  - Smoothing │  - Act       │  - Thermal    │
│  - velocity  │  - Following │  - Feedback  │  - Wind       │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

## System Order Recommendation

When adding systems to a world, use this order for correct behavior:

1. `PhysicsSystem` — Integrates velocity, moves entities
2. `PathfinderSystem` — Rebuilds navigation grid if dirty
3. `SoulActionSystem` — Processes queued actions
4. `MovementController` — Detects arrival, controls velocity
5. `PathFollowerSystem` — Advances path index, sets new targets
6. `SoulPerceptionSystem` — Generates perception frames
7. `SoulBridgeAdapter` — Sends perception to SoulArena, receives actions
8. Environment systems (WeatherSimulator, LightSystem, ThermalSystem)

## Configuration Reference

See [`docs/SDK_API.md`](../../docs/SDK_API.md) for complete API documentation and configuration reference.

## Further Reading

- [SDK API Reference](../../docs/SDK_API.md) — Complete API documentation
- [CHANGELOG.md](../../CHANGELOG.md) — Version history and breaking changes
- [DEVLOG.md](../../docs/DEVLOG.md) — Development log with implementation details
- [Architecture Constraints](../../../ai-soul-project-mgmt/docs/ARCHITECTURE_CONSTRAINTS_Seed.md) — Architecture design constraints
- [Interface Specification](../../../ai-soul-project-mgmt/docs/interface_spec.md) — SoulArena↔Seed interface protocol
