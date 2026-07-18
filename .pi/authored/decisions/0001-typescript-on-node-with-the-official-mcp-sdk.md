# ADR-0001: TypeScript on Node with the official MCP SDK

- **Status:** Accepted
- **Date:** 2026-07-17T17:48:06.708Z

## Context

We need a greenfield, reusable MCP server that is strongly typed, has first-class MCP support, and can leverage a large ecosystem of language-agnostic static analysis tooling, while installing anywhere with no native build.

## Decision

Implement in TypeScript on Node (>=20) using @modelcontextprotocol/sdk, with Zod as the single source of truth for every tool's input schema (driving both JSON-Schema advertisement and runtime validation).

## Consequences

Strong compile-time contracts and a mature SDK. Node startup cost is amortized by a long-lived server. Rust/Go would be faster but have less mature SDKs and require native builds; Python loses compile-time contract enforcement.
