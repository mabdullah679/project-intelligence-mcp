/**
 * Generator version tags. These are embedded in derived artifacts and the
 * manifest so `intel.status` can detect when an artifact was produced by an
 * older generator and is therefore stale even if the repo hasn't changed.
 * Bump the relevant tag whenever a generator's output format or logic changes.
 */
export const GENERATORS = {
  scan: "scan/1",
  dependencyGraph: "depgraph/1",
  architecture: "arch/1",
  componentCatalog: "catalog/1",
  context: "context/1",
} as const;

export const SCHEMA_VERSION = "1";
