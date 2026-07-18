# ADR-0004: Dual canonical-JSON + rendered-Markdown for derived artifacts

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.713Z

## Context

Derived artifacts must be both a precise machine source of truth and reviewable by humans in git.

## Decision

Write every derived artifact as canonical JSON (recursively sorted keys, no embedded timestamps) plus a rendered Markdown view. Timestamps live only in the manifest and memory records.

## Consequences

Byte-identical output for identical repo state (clean diffs, testable determinism) and human-readable review, at the cost of two files per artifact.
