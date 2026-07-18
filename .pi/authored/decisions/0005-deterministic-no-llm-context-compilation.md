# ADR-0005: Deterministic, no-LLM context compilation

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.714Z

## Context

The MCP must compile the smallest complete context for a task, but the core boundary forbids it from ever calling an LLM.

## Decision

Rank purely lexically and structurally: seed from stemmed symbol/path matches, expand across the dependency graph, score with documented weights (lexical relevance dominates centrality), then bound greedily to the token budget with signature-level progressive disclosure. Emit a manifest of what was included, why, and what was excluded.

## Consequences

Fully reproducible, offline, model-agnostic context selection with an auditable score breakdown. Ranking quality depends on identifier naming rather than semantics.
