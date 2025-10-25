import type { Node, Edge } from '../graph';

export function solveTsp(nodes: Node[], edges: Edge[], startId: string, destinations: string[]) {
  if (destinations.length === 0) {
    return { path: [startId], distance: 0 };
  }
  
  const adj: { [key: string]: { [key: string]: number } } = {};
   nodes.forEach(node => adj[node.id] = {});
   edges.forEach(edge => {
     adj[edge.source][edge.target] = edge.weight;
     adj[edge.target][edge.source] = edge.weight;
   });

  // Create a complete graph with shortest path distances for TSP nodes
  const tspNodes = [startId, ...new Set(destinations)];
  const distMatrix: { [key: string]: { [key: string]: number } } = {};

  for (const fromNode of tspNodes) {
    distMatrix[fromNode] = {};
    for (const toNode of tspNodes) {
      if (fromNode === toNode) {
        distMatrix[fromNode][toNode] = 0;
      } else {
        // Simple Dijkstra for all-pairs shortest paths on the main graph
        const distances: { [key: string]: number } = {};
        const pq: { [key: string]: number } = {};
        nodes.forEach(n => {
          distances[n.id] = Infinity;
          pq[n.id] = Infinity;
        });
        distances[fromNode] = 0;
        pq[fromNode] = 0;
        while(Object.keys(pq).length > 0) {
          const u = Object.keys(pq).reduce((a, b) => pq[a] < pq[b] ? a : b);
          delete pq[u];
          if(u === toNode) break;

          Object.keys(adj[u] || {}).forEach(v => {
            const alt = distances[u] + adj[u][v];
            if(alt < distances[v]) {
              distances[v] = alt;
              pq[v] = alt;
            }
          });
        }
        distMatrix[fromNode][toNode] = distances[toNode];
      }
    }
  }
  
  // Nearest neighbor heuristic
  let unvisited = new Set(destinations);
  let current = startId;
  const path = [startId];
  let totalDistance = 0;

  while (unvisited.size > 0) {
    let nearest: string | null = null;
    let minDistance = Infinity;

    unvisited.forEach(node => {
      const distance = distMatrix[current][node];
      if (distance < minDistance) {
        minDistance = distance;
        nearest = node;
      }
    });

    if (nearest) {
      totalDistance += minDistance;
      current = nearest;
      path.push(current);
      unvisited.delete(current);
    } else {
      // Should not happen in a connected graph
      break;
    }
  }

  // Return to warehouse
  totalDistance += distMatrix[current][startId];
  path.push(startId);

  return { path, distance: totalDistance };
}
