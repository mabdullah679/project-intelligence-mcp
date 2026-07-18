# Project Intelligence MCP

A **reusable, deterministic engineering assistant** for any repository, delivered as a [Model Context Protocol](https://modelcontextprotocol.io) server. Point it at a repo and it owns everything *mechanical* about working there — repository mapping, dependency & architecture graphs, discovery, bounded context compilation, validation/evidence, and durable project memory — so the host LLM spends its reasoning budget on the creative work, not on rediscovering facts.

## Core boundary (non‑negotiable)

- **Everything deterministic is software** (owned by this MCP).
- **Everything creative stays with the host LLM.**
- **The MCP never calls an LLM.** It exposes typed tools a host model invokes. Model‑agnosticism is therefore structural — there are no per‑vendor code paths; all host‑model behavior lives in configuration.
- **Offline & zero‑cost.** No paid APIs, no network at runtime, no native build step. Language analysis uses bundled tree‑sitter WASM grammars.

Nothing in the codebase is specific to any one project.

## Install & run

```bash
npm install        # installs deps + copies tree-sitter grammars into ./grammars
npm run build      # bundles dist/ (server + cli)
```

Run as an MCP stdio server (what a host like Claude connects to):

```bash
node dist/server/main.js
```

Or exercise any tool offline via the CLI (same registry, no MCP client needed):

```bash
node dist/cli/main.js list
node dist/cli/main.js intel_init      --repo /path/to/repo
node dist/cli/main.js repo_scan       --repo /path/to/repo
node dist/cli/main.js context_compile --repo /path/to/repo --task "add retry to the http client"
```

During development, replace `node dist/...` with `npx tsx src/...`.

### Registering with an MCP host

```json
{
  "mcpServers": {
    "project-intelligence": {
      "command": "node",
      "args": ["/absolute/path/to/dist/server/main.js"]
    }
  }
}
```

## The `.pi/` directory

`intel_init` scaffolds a project‑intelligence directory (default `.pi/`), split **by durability** so regeneration never endangers human knowledge:

```
.pi/
  config.json      host-model hints, validation commands, ignore globs, boundary hints
  manifest.json    schema version, last-scan fingerprint, generator versions, freshness
  authored/        DURABLE, append-only — the MCP never overwrites these
    decisions/       ADRs (numbered, immutable once accepted)
    invariants/      must-not-break constraints
    policies/  requirements/  roadmap/  glossary/  ownership/
  derived/         REGENERABLE — rebuilt from the repo; safe to delete
    repository-summary.{json,md}  file-index.json  language-stats.{json,md}
    dependency-graph.{json,md}    architecture.{json,md}  component-catalog.{json,md}
    invariants-index.json
  memory/          APPEND-ONLY history
    sessions/  sprints/  snapshots/
```

Derived artifacts are written as **canonical JSON** (sorted keys, no timestamps — the source of truth) **plus rendered Markdown** (human git review). Identical repo state ⇒ byte‑identical output ⇒ clean, reviewable diffs. `intel_regenerate` and `sprint_checkpoint` only ever write inside `derived/` and `memory/snapshots/`.

## Tool surface

All inputs/outputs are Zod‑validated; every result carries `{ ok, warnings }`.

| Tool | Purpose |
| --- | --- |
| `intel_init` | Scaffold `.pi/` (idempotent; seeds ownership from CODEOWNERS). |
| `intel_status` | Freshness of derived artifacts vs a fresh scan and generator versions. |
| `intel_regenerate` | Rebuild derived artifacts (`only` to restrict). Never touches `authored/`. |
| `repo_scan` | Walk + language‑detect + tree‑sitter symbol/import extraction + hashing. |
| `graph_dependencies` | Resolve imports → file graph; external deps from manifests; cycle detection. |
| `graph_architecture` | Cluster files into modules; edges, cycles, fan‑in/out/instability, layers. |
| `discover_components` | Services, modules, tests, docs, entrypoints, ownership. |
| `context_compile` | Smallest complete, budget‑bounded, task‑scoped context + manifest. |
| `validate_run` | Run configured test/lint/build commands; capture evidence. |
| `evidence_diff` | Capture a git diff (raw + stats) as evidence. |
| `decision_record` | Append a numbered ADR (durable). |
| `invariant_record` | Persist an invariant; refresh the derived index. |
| `memory_session_append` | Append a session note. |
| `sprint_checkpoint` | Compute a deterministic delta vs last snapshot + persist host narrative. |

### Context compilation

Given a `task`, `context_compile` is fully deterministic (no LLM):

1. **Seed** — stemmed lexical match of task terms against the symbol/path index (plus explicit `hints`).
2. **Expand** — walk the dependency graph N weighted hops from seeds.
3. **Score** — documented weights where lexical relevance (filename, symbols, keyword coverage) dominates graph proximity and centrality.
4. **Attach knowledge** — relevant ADRs/invariants/policies/roadmap/glossary.
5. **Bound** — greedily fill the token budget; oversized files degrade to a signatures‑only view.
6. **Manifest** — reports seeds, per‑item score breakdowns, included tokens, **coverage**, and everything excluded (and why), so the host can trust completeness.

Token sizing comes entirely from `config.host` (`tokenBudget`, `charsPerToken`, `contextWindowTokens`). **Swapping the host model is a config change, not a code change.**

### Language coverage

First‑class (tree‑sitter AST, high confidence): TypeScript/TSX, JavaScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, C/C++, C#, Swift, Scala, and more. Any other language is still scanned, classified, and analyzed heuristically (regex imports/symbols) at **low** confidence — the MCP degrades gracefully and never fails on an unknown stack.

## Configuration (`.pi/config.json`)

```jsonc
{
  "host": {
    "contextWindowTokens": 200000,
    "tokenBudget": 24000,
    "charsPerToken": 3.8,        // model-specific ratio for offline token estimation
    "outputStyle": "concise"
  },
  "scan":     { "ignore": [], "includeHidden": false, "maxFileSizeBytes": 1500000 },
  "analysis": { "boundaryHints": ["packages", "services"] },
  "validation": { "test": "npm test", "lint": "npm run lint", "build": "npm run build" },
  "context":  { "maxHops": 2, "maxItems": 60 }
}
```

## Architecture

```
src/
  domain/   pure types + Zod schemas (the contract layer)
  config/   config schema + loader
  core/
    scan/     filesystem walk, ignore, hashing, language detection
    analyze/  tree-sitter loader, per-language extractors, heuristic fallback
    graph/    dependency + architecture graph builders
    context/  deterministic context compiler
    evidence/ validation runner + git diff capture
    memory/   ADR / invariant / session / sprint writers
    discover/ component catalog
  store/    .pi/ layout, canonical JSON + Markdown renderers, manifest
  tools/    one thin adapter per MCP tool over the shared core
  server/   MCP stdio server        cli/   offline CLI (same registry)
```

`core/*` is pure and transport‑agnostic (unit‑testable without a server); `server/` and `cli/` are interchangeable transports over one tool registry.

The design decisions are recorded as ADRs in [`.pi/authored/decisions/`](.pi/authored/decisions/) — this repo dogfoods its own `.pi/`.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (unit + graph + context + determinism + tool integration)
npm run build       # tsup bundle
```

Determinism is enforced by a test that runs the pipeline twice and asserts byte‑identical canonical output.

## License

MIT
