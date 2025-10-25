import type { Node, Edge } from '../graph';

function bfs(capacity: number[][], adj: number[][], source: number, sink: number, parent: number[]) {
  const visited = new Array(parent.length).fill(false);
  const queue: number[] = [];
  queue.push(source);
  visited[source] = true;
  parent[source] = -1;

  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const v of adj[u]) {
      if (!visited[v] && capacity[u][v] > 0) {
        queue.push(v);
        visited[v] = true;
        parent[v] = u;
        if (v === sink) {
          return true;
        }
      }
    }
  }
  return false;
}

export function edmondsKarp(nodes: Node[], edges: Edge[], sourceId: string, sinkId: string) {
  const n = nodes.length;
  const nodeIndexMap = new Map(nodes.map((node, i) => [node.id, i]));
  const source = nodeIndexMap.get(sourceId)!;
  const sink = nodeIndexMap.get(sinkId)!;

  const capacity = Array.from({ length: n }, () => new Array(n).fill(0));
  const adj = Array.from({ length: n }, () => new Array<number>());

  for (const edge of edges) {
    const u = nodeIndexMap.get(edge.source)!;
    const v = nodeIndexMap.get(edge.target)!;
    capacity[u][v] = edge.capacity;
    capacity[v][u] = edge.capacity; // Assuming undirected capacity
    adj[u].push(v);
    adj[v].push(u);
  }

  const parent = new Array(n).fill(0);
  let maxFlow = 0;

  while (bfs(capacity, adj, source, sink, parent)) {
    let pathFlow = Infinity;
    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      pathFlow = Math.min(pathFlow, capacity[u][v]);
    }

    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      capacity[u][v] -= pathFlow;
      capacity[v][u] += pathFlow;
    }

    maxFlow += pathFlow;
  }

  return maxFlow;
}
