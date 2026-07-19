# Roadmap

Track remaining vs. completed work. Sprint checkpoints reference this file.

## In progress

## Planned

## Known limitations / tech debt

- **`computeLayers` uses recursion** (`src/core/graph/architecture.ts`). Longest-path
  layering over the acyclic module condensation is memoized but recursive; a
  pathologically deep (thousands-long) module chain could overflow the stack.
  Unconfirmed (flagged PLAUSIBLE in the code audit, not reproduced) and unlikely at
  module granularity. Planned hardening: convert to an iterative topological
  longest-path. Left as-is for now.

## Completed
