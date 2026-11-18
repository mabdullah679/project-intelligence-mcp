# Project Intelligence MCP

A deterministic [Model Context Protocol](https://modelcontextprotocol.io) server and CLI that maps any repository (files, symbols, dependency and architecture graphs, components) and keeps durable project memory (decisions, invariants, sprint checkpoints, validation evidence) in a `.pi/` directory. It never calls an LLM.

Design brief it implements: [project-intelligence-mcp-brief.md](project-intelligence-mcp-brief.md).

```
MCP host (Claude, etc.) ──stdio JSON-RPC──▶ pi-mcp ─┐
shell ─────────────────────────────────────▶ pi-cli ─┴─▶ tool registry ─▶ target repo
                                                         (src/tools)        └─ .pi/{authored,derived,memory}
```

Not local to this repo: the MCP host that launches `pi-mcp` and the repository you point it at. Both are supplied by you.

## Prerequisites

- Node.js >= 20 (developed on Node 26; CI uses 22) and npm.
- No native toolchain: language parsing uses bundled tree-sitter WASM grammars copied in by `postinstall`.
- No network, API keys, or accounts at runtime.

## Run it

1. `npm ci`
2. `npm run build`
3. Try the CLI against a repo: `node dist/cli/main.js intel_init --repo /path/to/repo`, then `node dist/cli/main.js repo_scan --repo /path/to/repo`.
4. To use it from an MCP host, register `node /absolute/path/to/dist/server/main.js` as a stdio server.

Without building: `npm run cli -- <tool> --repo <path>` (uses `tsx`) and `npm run dev:server`.

If a language is not analyzed well: grammars live in `grammars/` (git-ignored, created by `postinstall`). Re-run `node scripts/copy-grammars.mjs`; unsupported languages fall back to heuristic analysis and `repo_scan` reports how many files were analyzed that way.

## What it does

| You ask for | Tool | Result |
|---|---|---|
| Set up `.pi/` | `intel_init` | Scaffolds authored/derived/memory dirs and seed files (idempotent) |
| Is the knowledge base current? | `intel_status` | Fresh/stale, by scan fingerprint and generator version |
| Rebuild derived data | `intel_regenerate` | Rewrites only `derived/` |
| Map the repo | `repo_scan` | Files, languages, symbols, imports, content hashes |
| Dependency graph | `graph_dependencies` | Internal edges, external deps, cycles |
| Architecture view | `graph_architecture` | Module-level graph |
| Component catalog | `discover_components` | Components discovered from the graph |
| Task context | `context_compile` | Token-bounded, scored file selection plus relevant authored knowledge |
| Run checks | `validate_run` | Runs commands from `.pi/config.json`, stores evidence |
| Diff evidence | `evidence_diff` | `git diff` plus stats (shell-free) |
| Record knowledge | `decision_record`, `invariant_record`, `memory_session_append` | Append-only files under `.pi/` |
| Milestone memory | `sprint_checkpoint` | Computed delta vs last snapshot plus your narrative |

All 14 tools are registered once in [src/tools/registry.ts](src/tools/registry.ts) and are served identically by the MCP server and the CLI (`pi-cli list`).

## Tests

- `npm run typecheck`
- `npm test` — 21 tests in 7 files: scanning, graphs, context compilation, determinism (byte-identical output), tool lifecycle, regression for a past command-injection fix. Fully offline, runs against fixtures in `test/fixtures/`.
- `npm run build && npm run test:staging` — 3 tests that launch the built `dist/server/main.js` over stdio like a real host: tool list, a real `repo_scan`, rejection of invalid input. Also offline.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs typecheck, tests, build, the staging test, and a gitleaks scan.

Not covered: tools other than `repo_scan` are tested at source level only, not over stdio; no Windows run; the MCP spec is exercised only via the official SDK client.

## Layout

| Path | Role |
|---|---|
| [src/tools/](src/tools/) | Tool definitions; [registry.ts](src/tools/registry.ts) is the single list |
| [src/server/](src/server/) | MCP stdio server ([server.ts](src/server/server.ts)) |
| [src/cli/main.ts](src/cli/main.ts) | CLI over the same registry |
| [src/core/](src/core/) | Scan, analyze, graph, context, evidence, memory logic |
| [src/store/](src/store/) | `.pi/` layout and persistence ([layout.ts](src/store/layout.ts)) |
| [src/config/config.ts](src/config/config.ts) | `.pi/config.json` schema |
| [test/](test/) | Unit/integration tests; [staging/](test/staging/) tests the built server |
| [.pi/](.pi/README.md) | This repo's own project-intelligence directory (dogfooding) |
| [scripts/copy-grammars.mjs](scripts/copy-grammars.mjs) | Postinstall: copies WASM grammars |

## Security notes

Read before pointing the server at anything you do not own. Audited 2026-11-18 (read-only; not fixed here):

- `validate_run` runs shell commands taken from the target repo's `.pi/config.json` ([src/core/evidence/validate.ts](src/core/evidence/validate.ts), `runCommand` with `shell: true`). A malicious repo can execute code on your machine when a host calls this tool. Reproduced.
- `intel_init`'s `dirName` and every tool's `repoPath` are unconfined: `dirName: "../x"` creates a directory outside the repo (reproduced). There is no allow-list of roots.
- `evidence_diff` is hardened (no shell, ref charset check, `--` before paths) and has a regression test.
- No network code exists in `src/`, so there is no SSRF surface. Tool descriptions are static strings with no embedded instructions; but tool *results* (file contents, symbols, ADRs) are repository text a host model will read, so prompt injection via repo content is possible.

## Design decisions

- **Registry shared by server and CLI**, instead of per-transport tools: one schema, no drift, CLI doubles as the test harness.
- **WASM tree-sitter**, instead of native bindings: no compiler needed on install; trade-off is a postinstall copy step.
- **`.pi/` split by durability** (authored / derived / memory): regeneration can never overwrite human knowledge. Decisions are recorded in [.pi/authored/decisions/](.pi/authored/decisions/).

## License

MIT (see `package.json`; the repo has no separate LICENSE file yet).
