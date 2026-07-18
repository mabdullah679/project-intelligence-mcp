# ADR-0003: Project-intelligence directory split by durability (.pi authored/derived/memory)

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.713Z

## Context

Generated artifacts and human-authored knowledge have opposite lifecycles: one is regenerable, the other is lost if not persisted. Mixing them makes regeneration dangerous and git diffs noisy.

## Decision

Adopt a top-level split under .pi/: authored/ (durable, append-only), derived/ (regenerable), memory/ (append-only history + snapshots). Regeneration only ever writes inside derived/ and memory/snapshots/.

## Consequences

Human knowledge is structurally safe from regeneration; derived artifacts are always rebuildable; git diffs are clean and reviewable.
