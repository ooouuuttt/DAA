import type { Node, Edge } from '../graph';

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

  return distances[toNodeId];
}


// Heuristic solver for a TSP-like problem with separate pickup and delivery phases.
export function solveTsp(nodes: Node[], edges: Edge[], startDepot: string, warehousesToVisit: string[], deliveryAddresses: string[]) {
  if (warehousesToVisit.length === 0 && deliveryAddresses.length === 0) {
    return { path: [startDepot], distance: 0 };
  }
  
  const adj: { [key: string]: { [key: string]: number } } = {};
  nodes.forEach(node => adj[node.id] = {});
  edges.forEach(edge => {
    adj[edge.source][edge.target] = edge.weight;
    adj[edge.target][edge.source] = edge.weight;
  });

  // Create a complete distance matrix for all relevant nodes (depot, warehouses, customers)
  const relevantNodes = [startDepot, ...warehousesToVisit, ...deliveryAddresses];
  const distMatrix: { [key: string]: { [key: string]: number } } = {};

  for (const fromNode of relevantNodes) {
    distMatrix[fromNode] = {};
    for (const toNode of relevantNodes) {
        if (fromNode === toNode) {
            distMatrix[fromNode][toNode] = 0;
        } else {
            distMatrix[fromNode][toNode] = findShortestPath(fromNode, toNode, nodes, adj);
        }
    }
  }
  
  const finalPath = [startDepot];
  let totalDistance = 0;
  let currentLoc = startDepot;

  // Phase 1: Pickups from warehouses
  let unvisitedWarehouses = new Set(warehousesToVisit);
  while (unvisitedWarehouses.size > 0) {
    let nearest: string | null = null;
    let minDistance = Infinity;

    unvisitedWarehouses.forEach(wh => {
      const distance = distMatrix[currentLoc][wh];
      if (distance < minDistance) {
        minDistance = distance;
        nearest = wh;
      }
    });
    
    if (nearest) {
      totalDistance += minDistance;
      currentLoc = nearest;
      finalPath.push(currentLoc);
      unvisitedWarehouses.delete(currentLoc);
    } else {
      break; // Should not happen
    }
  }

  // Phase 2: Deliveries to customers
  let unvisitedCustomers = new Set(deliveryAddresses);
  while (unvisitedCustomers.size > 0) {
    let nearest: string | null = null;
    let minDistance = Infinity;

    unvisitedCustomers.forEach(cust => {
      const distance = distMatrix[currentLoc][cust];
      if (distance < minDistance) {
        minDistance = distance;
        nearest = cust;
      }
    });
    
    if (nearest) {
      totalDistance += minDistance;
      currentLoc = nearest;
      finalPath.push(currentLoc);
      unvisitedCustomers.delete(currentLoc);
    } else {
      break; // Should not happen
    }
  }
  
  // Phase 3: Return to depot
  totalDistance += distMatrix[currentLoc][startDepot];
  finalPath.push(startDepot);

  return { path: finalPath, distance: totalDistance };
}
