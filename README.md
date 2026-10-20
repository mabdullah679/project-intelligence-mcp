# Project Intelligence MCP — Repository Understanding Assistant

## Recruiter-friendly overview
Project Intelligence MCP is a reusable assistant that helps people understand unfamiliar software projects. Point it at a repository and it maps the files, dependencies, architecture, components, decisions, and testing evidence into a durable knowledge base. Because the core analysis is deterministic and works offline, it produces repeatable results without sending code to a paid service. The project demonstrates developer tooling, software architecture, static analysis, documentation, automation, and thoughtful AI integration.

## Project description
An offline Model Context Protocol server and command-line tool that turns any code repository into a searchable, structured project knowledge base with dependency graphs, architecture analysis, task-focused context, validation evidence, and durable engineering memory.

---

# Project Intelligence MCP

A **reusable, deterministic engineering assistant** for any repository, delivered as a [Model Context Protocol](https://modelcontextprotocol.io) server. Point it at a repo and it owns everything *m[...]

## Core boundary (non‑negotiable)

- **Everything deterministic is software** (owned by this MCP).
- **Everything creative stays with the host LLM.**
- **The MCP never calls an LLM.** It exposes typed tools a host model invokes. Model‑agnosticism is therefore structural — there are no per‑vendor code paths; all host‑model behavior lives [...]
- **Offline & zero‑cost.** No paid APIs, no network at runtime, no native build step. Language analysis uses bundled tree‑sitter WASM grammars.

Nothing in the codebase is specific to any one project.

## Install & run

```bash
npm install
npm run build
```

Run the MCP server or CLI as described in the existing tool-surface, architecture, development, and licensing sections below.
