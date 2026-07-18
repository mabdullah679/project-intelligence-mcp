/**
 * Tarjan's strongly-connected-components algorithm. Returns every SCC that
 * represents a cycle: components with more than one node, plus single nodes that
 * have a self-edge. Output is deterministic — nodes within a component and the
 * components themselves are sorted lexicographically.
 */
export function findCycles(nodes: string[], edges: Array<[string, string]>): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  const selfLoops = new Set<string>();
  for (const [from, to] of edges) {
    if (from === to) {
      selfLoops.add(from);
      continue;
    }
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from)!.push(to);
  }

  let index = 0;
  const indexOf = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  // Iterative DFS to avoid stack overflow on large graphs.
  const allNodes = [...adj.keys()].sort();
  for (const start of allNodes) {
    if (indexOf.has(start)) continue;
    const work: Array<{ node: string; i: number }> = [{ node: start, i: 0 }];
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const { node } = frame;
      if (frame.i === 0) {
        indexOf.set(node, index);
        lowlink.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);
      }
      const neighbors = adj.get(node)!;
      if (frame.i < neighbors.length) {
        const next = neighbors[frame.i]!;
        frame.i++;
        if (!indexOf.has(next)) {
          work.push({ node: next, i: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(node, Math.min(lowlink.get(node)!, indexOf.get(next)!));
        }
      } else {
        if (lowlink.get(node) === indexOf.get(node)) {
          const comp: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            comp.push(w);
          } while (w !== node);
          if (comp.length > 1 || selfLoops.has(node)) components.push(comp.sort());
        }
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1]!.node;
          lowlink.set(parent, Math.min(lowlink.get(parent)!, lowlink.get(node)!));
        }
      }
    }
  }

  return components.sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : 0));
}
