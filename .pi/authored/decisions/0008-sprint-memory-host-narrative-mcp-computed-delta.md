# ADR-0008: Sprint memory = host narrative + MCP-computed delta

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.716Z

## Context

Milestone memory must capture both objective structural change and subjective judgement, without the MCP overstepping into creative territory.

## Decision

sprint_checkpoint diffs the current graphs against the last snapshot to compute a deterministic delta (modules/files/tests/deps/languages/invariants/edges), while the host supplies the narrative (summary/decisions/debt/roadmap/risks). Provided decisions become ADRs; derived artifacts are regenerated; a new snapshot is stored.

## Consequences

Future models never re-derive solved structural facts; the human/LLM judgement is preserved verbatim; everything lands in reviewable git diffs. Deltas require a prior snapshot (the first checkpoint is marked initial).
