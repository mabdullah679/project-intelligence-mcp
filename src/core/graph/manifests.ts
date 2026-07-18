import { join } from "node:path";
import { readTextIfExists } from "../../util/fsx.js";
import type { z } from "zod";
import type { ExternalDepSchema } from "../../domain/schemas.js";

type ExternalDep = z.infer<typeof ExternalDepSchema>;

/**
 * Best-effort external-dependency discovery across common package manifests.
 * Every parser is defensive: a malformed manifest yields no deps rather than an
 * error, because dependency discovery must never fail a graph build.
 */
export async function collectExternalDeps(repoPath: string): Promise<ExternalDep[]> {
  const deps: ExternalDep[] = [];
  const seen = new Set<string>();
  const add = (name: string, source: string, version: string | null) => {
    const key = `${source}:${name}`;
    if (!name || seen.has(key)) return;
    seen.add(key);
    deps.push({ name, source, version });
  };

  await parsePackageJson(repoPath, add);
  await parseRequirementsTxt(repoPath, add);
  await parsePyproject(repoPath, add);
  await parseGoMod(repoPath, add);
  await parseCargoToml(repoPath, add);
  await parseGemfile(repoPath, add);

  deps.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.source < b.source ? -1 : 1));
  return deps;
}

type Add = (name: string, source: string, version: string | null) => void;

async function parsePackageJson(repo: string, add: Add): Promise<void> {
  const raw = await readTextIfExists(join(repo, "package.json"));
  if (!raw) return;
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const obj = pkg[field];
      if (obj && typeof obj === "object") {
        for (const [name, version] of Object.entries(obj as Record<string, string>)) {
          add(name, "package.json", typeof version === "string" ? version : null);
        }
      }
    }
  } catch {
    /* ignore malformed */
  }
}

async function parseRequirementsTxt(repo: string, add: Add): Promise<void> {
  const raw = await readTextIfExists(join(repo, "requirements.txt"));
  if (!raw) return;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const m = /^([A-Za-z0-9_.\-]+)\s*([<>=!~]+.*)?$/.exec(trimmed);
    if (m?.[1]) add(m[1], "requirements.txt", m[2]?.trim() ?? null);
  }
}

async function parsePyproject(repo: string, add: Add): Promise<void> {
  const raw = await readTextIfExists(join(repo, "pyproject.toml"));
  if (!raw) return;
  // Grab names from a [tool.poetry.dependencies] / [project] dependencies block.
  const depLines = raw.match(/^\s*([A-Za-z0-9_.\-]+)\s*=\s*["'][^"']+["']/gm) ?? [];
  for (const line of depLines) {
    const m = /^\s*([A-Za-z0-9_.\-]+)\s*=/.exec(line);
    if (m?.[1] && m[1].toLowerCase() !== "python") add(m[1], "pyproject.toml", null);
  }
}

async function parseGoMod(repo: string, add: Add): Promise<void> {
  const raw = await readTextIfExists(join(repo, "go.mod"));
  if (!raw) return;
  const requireBlock = /require\s*\(([\s\S]*?)\)/g;
  let m: RegExpExecArray | null;
  while ((m = requireBlock.exec(raw)) !== null) {
    for (const line of m[1]!.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] && !parts[0].startsWith("//")) add(parts[0], "go.mod", parts[1] ?? null);
    }
  }
  for (const line of raw.split("\n")) {
    const single = /^require\s+(\S+)\s+(\S+)/.exec(line.trim());
    if (single?.[1]) add(single[1], "go.mod", single[2] ?? null);
  }
}

async function parseCargoToml(repo: string, add: Add): Promise<void> {
  const raw = await readTextIfExists(join(repo, "Cargo.toml"));
  if (!raw) return;
  const section = /\[dependencies\]([\s\S]*?)(\n\[|$)/.exec(raw);
  if (!section) return;
  for (const line of section[1]!.split("\n")) {
    const m = /^\s*([A-Za-z0-9_\-]+)\s*=/.exec(line);
    if (m?.[1]) add(m[1], "Cargo.toml", null);
  }
}

async function parseGemfile(repo: string, add: Add): Promise<void> {
  const raw = await readTextIfExists(join(repo, "Gemfile"));
  if (!raw) return;
  const re = /^\s*gem\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) if (m[1]) add(m[1], "Gemfile", null);
}
