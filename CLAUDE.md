# CLAUDE.md — project-intelligence-mcp

Standing rules for all work live in `~/.claude/CLAUDE.md` (read it; not copied here).
This file holds only what is specific to this repo. Last verified against the tree on 2026-11-18.

## What this is
A deterministic MCP server + CLI (TypeScript, Node >= 20, ESM) that maps a repository and keeps durable project memory in a `.pi/` directory. It never calls an LLM and makes no network calls at runtime (grep of `src/` finds no fetch/http use).

## Commands (all run and passing on 2026-11-18)
- `npm ci` — install; `postinstall` copies tree-sitter WASM grammars into `grammars/` (git-ignored).
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest, 7 files / 21 tests, source-level (`test/*.test.ts`).
- `npm run build` — tsup to `dist/` (`dist/server/main.js` = MCP stdio server, `dist/cli/main.js` = CLI).
- `npm run test:staging` — drives the BUILT `dist/server/main.js` over real stdio JSON-RPC (`test/staging/`). Needs `npm run build` first.
- `npm run cli -- <tool> --repo <path>` — run any tool without an MCP client.

## Layout
- `src/tools/` — one file per tool group; `registry.ts` is the single list used by BOTH the server and the CLI. Add a tool there and nowhere else.
- `src/core/` — the deterministic logic (scan, analyze, graph, context, evidence, memory).
- `src/store/` + `src/store/layout.ts` — `.pi/` on-disk layout (authored / derived / memory).
- `test/fixtures/` — sample repos the tests analyze. Excluded from vitest and from this repo's own `.pi` scan; do not "fix" them.

## Conventions
- Zod input schema in each tool is the single contract (validation + advertised JSON schema).
- Server stdout is the JSON-RPC channel: log to stderr only (`src/util/logger.ts`).
- Shell-free process spawning for anything model-supplied (`runArgv`); `runCommand` (shell) is only for commands from the target repo's own `.pi/config.json`.
- Determinism is tested (`test/determinism.test.ts`); do not introduce clocks/randomness into derived artifacts.

## Do NOT touch
- `.pi/authored/` — append-only knowledge (ADRs etc.). Never rewrite existing entries.
- `.pi/derived/` — generated; regenerate with the tool, don't hand-edit.
- `test/fixtures/**` — tests depend on exact contents.
- `package-lock.json` by hand.

## Known security caveats (see README "Security notes")
`validate_run` executes shell commands from the target repo's `.pi/config.json`; `dirName` and `repoPath` are not confined. Only point this server at repos you trust. Fixing these is a logic change: it needs a failing test first.
