# ADR-0002: web-tree-sitter (WASM) for language-agnostic analysis with graceful fallback

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.712Z

## Context

The MCP must analyze repositories in any language, fully offline, with zero native compilation so it installs into any repo/OS.

## Decision

Use web-tree-sitter with prebuilt grammar .wasm files bundled via tree-sitter-wasms. Files with a grammar get AST-based symbol/import extraction (high confidence); files without one fall back to regex heuristics (low confidence). Analysis never throws on a single file.

## Consequences

No native toolchain required; broad language coverage; graceful degradation with explicit confidence. WASM is marginally slower than native bindings, an acceptable trade for portability.
