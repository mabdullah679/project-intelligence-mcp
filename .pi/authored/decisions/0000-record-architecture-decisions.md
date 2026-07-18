# ADR-0000: Record architecture decisions

## Status
Accepted

## Context
We want a durable, reviewable record of significant technical decisions so a
future contributor (human or model) never has to re-derive why something is the
way it is.

## Decision
Record each significant decision as a numbered Markdown file in this directory
(`NNNN-title.md`), created via the MCP `decision.record` tool. ADRs are
append-only and immutable once accepted; supersede rather than edit.

## Consequences
- Decisions are diffable and travel with the code.
- The context compiler can surface relevant ADRs alongside code for a task.
