import type { Node, Edge } from './graph';

// Helper for Dijkstra's algorithm to find shortest paths between any two nodes
function findShortestPath(fromNodeId: string, toNodeId: string, nodes: Node[], adj: { [key: string]: { [key: string]: number } }) {
  const distances: { [key: string]: number } = {};
  const prev: { [key: string]: string | null } = {};
  const pq: { [key: string]: number } = {};

  nodes.forEach(n => {
    distances[n.id] = Infinity;
    prev[n.id] = null;
    pq[n.id] = Infinity;
  });

  distances[fromNodeId] = 0;
  pq[fromNodeId] = 0;

  while(Object.keys(pq).length > 0) {
    const u = Object.keys(pq).reduce((a, b) => pq[a] < pq[b] ? a : b);
    delete pq[u];

    if (u === toNodeId) break;

    Object.keys(adj[u] || {}).forEach(v => {
      const alt = distances[u] + adj[u][v];
      if (alt < distances[v]) {
        distances[v] = alt;
        prev[v] = u;
        pq[v] = alt;
      }
    });
  }
  
  const path: string[] = [];
  let current: string | null = toNodeId;
  while(current) {
      path.unshift(current);
      current = prev[current];
  }

  if (path[0] === fromNodeId) {
      return { distance: distances[toNodeId], path };
  }
  return { distance: Infinity, path: [] };
}


// Heuristic solver for a TSP-like problem with separate pickup and delivery phases.
export function solveTsp(nodes: Node[], edges: Edge[], startDepot: string, warehousesToVisit: string[], deliveryAddresses: string[]) {
  if (warehousesToVisit.length === 0 && deliveryAddresses.length === 0) {
     if (deliveryAddresses.length > 0 || warehousesToVisit.length > 0) {
      return { path: [startDepot, startDepot], distance: 0 };
    }
    return { path: [startDepot], distance: 0 };
  }
  
  const adj: { [key: string]: { [key: string]: number } } = {};
  nodes.forEach(node => adj[node.id] = {});
  edges.forEach(edge => {
    adj[edge.source][edge.target] = edge.weight;
    adj[edge.target][edge.source] = edge.weight;
  });

  // Create a complete distance matrix for all relevant nodes (depot, warehouses, customers)
  const relevantNodes = [...new Set([startDepot, ...warehousesToVisit, ...deliveryAddresses])];
  const distMatrix: { [key: string]: { [key: string]: { distance: number; path: string[] } } } = {};

  for (const fromNode of relevantNodes) {
    distMatrix[fromNode] = {};
    for (const toNode of relevantNodes) {
        if (fromNode === toNode) {
            distMatrix[fromNode][toNode] = { distance: 0, path: [fromNode] };
        } else {
            distMatrix[fromNode][toNode] = findShortestPath(fromNode, toNode, nodes, adj);
        }
    }
  }
  
  const finalPath: string[] = [];
  let totalDistance = 0;
  let currentLoc = startDepot;

  // Phase 1: Pickups from warehouses (using nearest neighbor heuristic)
  let unvisitedWarehouses = new Set(warehousesToVisit);
  while (unvisitedWarehouses.size > 0) {
    let nearest: string | null = null;
    let minDistance = Infinity;
    let segmentPath: string[] = [];

    unvisitedWarehouses.forEach(wh => {
      const leg = distMatrix[currentLoc][wh];
      if (leg.distance < minDistance) {
        minDistance = leg.distance;
        nearest = wh;
        segmentPath = leg.path;
      }
    });
    
    if (nearest) {
      totalDistance += minDistance;
      finalPath.push(...segmentPath.slice(1));
      currentLoc = nearest;
      unvisitedWarehouses.delete(currentLoc);
    } else {
      break; 
    }
  }

  // Phase 2: Deliveries to customers (using nearest neighbor heuristic)
  let unvisitedCustomers = new Set(deliveryAddresses);
  while (unvisitedCustomers.size > 0) {
    let nearest: string | null = null;
    let minDistance = Infinity;
    let segmentPath: string[] = [];

    unvisitedCustomers.forEach(cust => {
      const leg = distMatrix[currentLoc][cust];
      if (leg.distance < minDistance) {
        minDistance = leg.distance;
        nearest = cust;
        segmentPath = leg.path;
      }
    });
    
    if (nearest) {
      totalDistance += minDistance;
      finalPath.push(...segmentPath.slice(1));
      currentLoc = nearest;
      unvisitedCustomers.delete(currentLoc);
    } else {
      break; 
    }
  }
  
  // Phase 3: Return to depot
  const returnLeg = distMatrix[currentLoc] ? distMatrix[currentLoc][startDepot] : undefined;
  if (returnLeg && returnLeg.distance !== Infinity) {
    totalDistance += returnLeg.distance;
    finalPath.push(...returnLeg.path.slice(1));
  }
  
  return { path: [startDepot, ...finalPath], distance: totalDistance };
}
