# ADR-0007: Content-hash incremental fingerprints for determinism and freshness

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.715Z

## Context

We need reproducible outputs and a cheap way to know when derived artifacts are stale.

## Decision

Hash file contents (SHA-256) and aggregate into a stable scan fingerprint. The manifest records the fingerprint and generator versions; intel_status compares a fresh scan and current generator versions against them.

## Consequences

Freshness is detectable without re-reading every artifact; identical inputs yield identical fingerprints. Generator-version bumps correctly force staleness even when the repo is unchanged.
