# Project Intelligence (`.pi/`)

This directory is the deterministic knowledge base for this repository, maintained
by the Project Intelligence MCP. It is split by **durability**:

- `authored/` — durable, human/host-authored knowledge. **Append-only**; the MCP
  never overwrites it. ADRs, invariants, policies, requirements, roadmap, glossary,
  ownership.
- `derived/` — MCP-generated artifacts (repository summary, indexes, dependency &
  architecture graphs, component catalog). **Fully regenerable** from the repo;
  safe to delete. Each artifact is written as canonical JSON (source of truth) and
  rendered Markdown (for review).
- `memory/` — append-only history: sessions, sprint checkpoints, and graph
  snapshots used to compute sprint deltas.

Regeneration only ever writes inside `derived/` and `memory/snapshots/`, so your
authored knowledge is never at risk.
