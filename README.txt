PROJECT INTELLIGENCE MCP (plain-language version of README.md)

WHAT IT IS
A helper program for AI coding assistants. You point it at a code project and it works out what is in it: which files exist, what languages, which parts depend on which, and how the project is organised. It also keeps a notebook inside the project (a folder called .pi) for decisions, rules that must not break, and results of test runs. It never talks to an AI service itself, and it needs no internet or paid account.

It can be used two ways: as an MCP server (the standard plug-in format AI assistants use) or from the command line.

WHAT YOU NEED
Node.js version 20 or newer and npm. Nothing else. No compiler, no keys, no accounts. The grammar files used to read many programming languages are copied in automatically when you install.

HOW TO RUN IT
1. Run: npm ci
2. Run: npm run build
3. Try it from the command line, for example:
   node dist/cli/main.js intel_init --repo /path/to/project
   node dist/cli/main.js repo_scan --repo /path/to/project
4. To use it from an AI assistant, register this as a stdio server: node /full/path/to/dist/server/main.js

If a language is not read well: the grammar files live in a folder called grammars, which is created at install time and not stored in git. Run node scripts/copy-grammars.mjs to recreate them. Languages with no grammar are still analysed, only less precisely, and the scan tells you how many files were handled that way.

WHAT IT CAN DO (14 tools)
Set up the notebook folder (intel_init). Check whether it is up to date (intel_status). Rebuild the generated parts (intel_regenerate). Scan the project for files, languages and symbols (repo_scan). Build a dependency graph (graph_dependencies) and an architecture view (graph_architecture). List the components (discover_components). Pick the most relevant files for a task within a size limit (context_compile). Run the project's own test/lint/build commands and save the results (validate_run). Capture a git diff (evidence_diff). Save a decision, a rule, or a session note (decision_record, invariant_record, memory_session_append). Save a milestone checkpoint that computes what changed since the last one (sprint_checkpoint). The command line and the server offer exactly the same tools.

TESTS
npm run typecheck checks types.
npm test runs 21 tests in 7 files. They check scanning, graphs, task-context selection, that results are identical run to run, the tool workflow, and a fix for a past command-injection bug. They run offline on sample projects in test/fixtures.
npm run build then npm run test:staging runs 3 more tests that start the real built server and talk to it the way an AI assistant would: list the tools, run a scan, and reject bad input. Offline too.
The CI workflow in .github/workflows/ci.yml runs all of that plus a secret scan.
Not covered: apart from repo_scan, the tools are not tested through the real server; no Windows run.

SECURITY WARNING (checked 2026-11-18, not fixed in this pass)
1. validate_run runs shell commands written in the target project's own .pi/config.json. A hostile project could run code on your computer. This was reproduced.
2. The folder-name option of intel_init and the project path of every tool are not restricted. A name like ../x creates a folder outside the project. This was reproduced.
3. evidence_diff is protected against injection and has a test.
4. The code contains no network calls, so there is no way to make it fetch outside addresses. The tool descriptions are fixed text. But the results contain text from the project being scanned, which an AI could read as instructions.
Only point this at projects you trust.

WHERE THINGS ARE
src/tools holds the tool definitions and registry.ts is the one list. src/server is the MCP server. src/cli is the command line. src/core is the analysis logic. src/store is how the .pi folder is laid out and saved. src/config is the config format. test holds the tests and test/staging holds the real-server tests. .pi is this project's own notebook. scripts/copy-grammars.mjs copies the grammar files.

WHY IT IS BUILT THIS WAY
One shared list of tools feeds both the server and the command line so they cannot drift apart. Language parsing uses WebAssembly grammars instead of native code so no compiler is needed. The notebook is split into hand-written, generated, and history parts so regenerating can never overwrite human notes.

LICENSE
MIT, as stated in package.json. There is no separate LICENSE file yet.
