# Project Intelligence MCP — Design & Build Brief

## Role

You are the lead architect designing and building a **reusable Project Intelligence MCP** from scratch (greenfield). This is not a Cloudify-specific tool. Cloudify is only the first project that will consume it. The MCP must be completely project-agnostic — installable into any repository and immediately useful.

## Mission

Build an MCP server that can be pointed at **any** repository and become that repository's **deterministic engineering assistant**. It owns everything mechanical about working in a codebase — repository intelligence, project memory, context compilation, validation, and evidence generation — so that any host LLM using it spends its reasoning budget on the creative work, not on rediscovering facts.

**Core boundary (non-negotiable):**
- **Everything deterministic becomes software** (owned by the MCP).
- **Everything creative stays with the host LLM.**
- The MCP is **pure deterministic tooling. It never calls an LLM itself.** It exposes tools/resources that a host model (Claude, GPT, Qwen, DeepSeek, Gemini, local models, etc.) invokes. Model-agnosticism therefore comes for free: the MCP has no model-specific code paths. Any per-model behavior lives in configuration, not architecture.

## Three inputs the MCP accepts

1. **A repository path** — e.g. `/Users/me/projects/local-cloudify`.
2. **A project intelligence directory** inside that repo (see below) — the single source of deterministic project knowledge.
3. **Configuration** — including host-model hints (context-window size, token budget, preferred output style). The MCP adapts context-compilation *sizing* to these; it does not change behavior per vendor.

## Project intelligence directory

Propose a well-designed default layout and **justify it** — do not just copy the sketch below. Decide, with reasons: which artifacts are human-authored vs. MCP-generated, which are append-only (decisions/ADRs) vs. regenerated each run (graphs/indexes), and how generated files stay diffable and reviewable in git.

Starting sketch to improve on (choose the directory name too — e.g. `.project-intelligence/`, `.ai/`, or a better one):

```
.project-intelligence/
  architecture/        requirements/     standards/      policies/
  workflows/           roadmap/          knowledge/      decisions/   (ADRs)
  glossary/            ownership/        testing/        security/
  deployment/          milestones/       context/        sessions/    reviews/
  architecture-index.md   dependency-map.md    repository-summary.md
  component-catalog.md    known-invariants.md  current-sprint.md
```

Clearly separate **derived/regenerable** artifacts (graphs, indexes, catalogs — the MCP can rebuild them from the repo at any time) from **authored/durable** artifacts (decisions, invariants, policies — lost if not persisted).

## Responsibilities (the tool surface)

Deliver these as explicit, typed MCP tools with clear input/output contracts. The MCP automatically:

- Maps repository structure; builds dependency and architecture graphs.
- Discovers services, modules, tests, documentation, ownership, and architecture boundaries.
- Identifies files relevant to a task and **compiles the smallest complete context** for it.
- Validates results and generates **evidence** (test output, diffs, checks) after approved work.
- Updates the project intelligence directory as knowledge changes.

### Context compilation
Given a task, assemble only what's necessary — relevant code, architecture, ADRs, tests, ownership, policies, roadmap/sprint context, and known constraints/invariants/risks — instead of dumping files. Output must fit the host model's configured context budget, and must report what it included and why (so the host can trust it's complete).

### Sprint / milestone memory
At the end of each meaningful sprint or milestone, the MCP updates project intelligence so a future model never re-derives solved information: architecture changes, added/removed modules, dependency changes, ADR-style decision records, technical debt, remaining vs. completed roadmap, current architecture summary, component catalog, risks, assumptions, migrations, releases, new tests/invariants, updated graphs, and updated glossary/terminology.

## Constraints

- **Zero-cost / fully offline.** No paid APIs, hosted infrastructure, cloud dependency, subscriptions, or required telemetry. Everything runs locally. (This follows naturally from the MCP never calling an LLM.)
- **Language-agnostic targets.** The MCP analyzes repositories in any language; do not hard-code assumptions about the target repo's stack.
- **Engineering quality.** Favor determinism, clarity, strong typing, explicit contracts, modularity, testability, minimal duplication, high observability, and clean architecture with excellent documentation.

## Recommended implementation stack

Recommend and justify a stack in the plan (greenfield, so you choose). Default recommendation unless you argue otherwise: **TypeScript on Node with the official MCP SDK** — strong typing, first-class MCP support, and a large ecosystem of language-agnostic static-analysis tooling. State the trade-offs of your choice.

## Process — plan first, then build

1. **Discovery & plan (required before any code).** Produce an architecture plan covering: chosen stack and why; the directory layout and derived-vs-authored split with rationale; the full tool surface with I/O contracts; how graphs/discovery are built (which parsers/analyzers, and the fallback for unsupported languages); how context compilation selects and bounds content; how sprint memory is triggered and written; and the major architectural decisions as ADRs. **Wait for approval before implementing.**
2. **Build incrementally** against the approved plan, documenting every significant decision as an ADR in the repo.
3. **Testing discipline.** During development, run only targeted tests for modified components. Reserve the full suite for genuine milestone completion.

## Acceptance criteria (definition of done)

- Point the MCP at a repository + its project intelligence directory and it immediately serves accurate repository maps, dependency/architecture graphs, and discovery results.
- A context-compilation request returns a bounded, task-scoped context with a manifest of what was included and why.
- Completing a milestone updates the project intelligence directory automatically, in reviewable git diffs.
- Swapping the host model requires only a configuration change — no code change.
- The entire system runs offline with no paid or hosted dependency.
- **Cloudify is the first proof the architecture works**, but nothing in the codebase is Cloudify-specific.

## Guiding standard

Optimize for something that still feels elegant, maintainable, and valuable in five years — a reusable "development operating system," not a one-off script that merely works today.
