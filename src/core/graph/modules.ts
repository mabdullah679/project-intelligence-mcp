/**
 * Deterministic mapping from a file path to its owning "module". A module is a
 * coarse architectural unit: a top-level directory, or one level deeper under a
 * configured boundary prefix (e.g. `packages/foo`, `services/api`). Files at the
 * repo root belong to the synthetic "(root)" module.
 *
 * Both the dependency graph (node.module) and the architecture graph use this,
 * so module identity is consistent across every derived artifact.
 */
export const ROOT_MODULE = "(root)";

export function moduleIdForPath(path: string, boundaryHints: string[]): string {
  const segments = path.split("/");
  if (segments.length <= 1) return ROOT_MODULE;

  const first = segments[0]!;
  if (boundaryHints.includes(first) && segments.length >= 3) {
    return `${first}/${segments[1]}`;
  }
  return first;
}
