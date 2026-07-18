# ADR-0006: Model-agnosticism via configuration, not code

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.715Z

## Context

Swapping the host model (Claude/GPT/Qwen/local) must not require code changes.

## Decision

Confine all host-model behavior to config.host: context window, token budget, chars-per-token ratio, and an advisory output-style hint. Token estimation uses the configured ratio; there are no per-vendor code paths.

## Consequences

Changing models is a one-line config edit. Token estimates are approximate (no bundled tokenizer), which is acceptable for budgeting.
