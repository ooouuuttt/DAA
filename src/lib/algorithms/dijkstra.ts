import type { Node, Edge } from '../graph';

export function dijkstra(nodes: Node[], edges: Edge[], startId: string, endId: string) {
  const adj: { [key: string]: { node: string; weight: number }[] } = {};
  nodes.forEach(node => adj[node.id] = []);
  edges.forEach(edge => {
    adj[edge.source].push({ node: edge.target, weight: edge.weight });
    adj[edge.target].push({ node: edge.source, weight: edge.weight });
  });

  const distances: { [key: string]: number } = {};
  const prev: { [key: string]: string | null } = {};
  const pq: { [key: string]: number } = {};

  nodes.forEach(node => {
    distances[node.id] = Infinity;
    prev[node.id] = null;
    pq[node.id] = Infinity;
  });

  distances[startId] = 0;
  pq[startId] = 0;

  while (Object.keys(pq).length > 0) {
    const u = Object.keys(pq).reduce((a, b) => pq[a] < pq[b] ? a : b);
    delete pq[u];

    if (u === endId) {
      const path: string[] = [];
      let current: string | null = endId;
      while (current) {
        path.unshift(current);
        current = prev[current];
      }
      if (path[0] === startId) {
        return { path, distance: distances[endId] };
      }
      return null;
    }

    if (distances[u] === Infinity) {
      break;
    }

    adj[u]?.forEach(neighbor => {
      const alt = distances[u] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        prev[neighbor.node] = u;
        pq[neighbor.node] = alt;
      }
    });
  }

  return null;
}
