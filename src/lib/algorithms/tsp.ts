import type { Node, Edge } from '../graph';
import type { SimulatedOrder } from '@/components/OrderCreator';

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

  if (fromNodeId in pq) {
    distances[fromNodeId] = 0;
    pq[fromNodeId] = 0;
  } else {
    return { distance: Infinity, path: [] };
  }


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
export function solveTsp(
    nodes: Node[], 
    edges: Edge[], 
    startDepot: string, 
    warehousesToVisit: string[], 
    customersToVisit: { address: string; timeWindow: 'any' | 'morning' | 'afternoon'}[],
) {
    if (warehousesToVisit.length === 0 && customersToVisit.length === 0) {
        return { path: [startDepot, startDepot], distance: 0 };
    }

    const deliveryAddresses = customersToVisit.map(c => c.address);

    const adj: { [key: string]: { [key: string]: number } } = {};
    nodes.forEach(node => adj[node.id] = {});
    edges.forEach(edge => {
        adj[edge.source][edge.target] = edge.weight;
        adj[edge.target][edge.source] = edge.weight;
    });

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
  
    const finalPath: string[] = [startDepot];
    let totalDistance = 0;
    let currentLoc = startDepot;

    // Phase 1: Pickups from warehouses (using nearest neighbor heuristic)
    let unvisitedWarehouses = new Set(warehousesToVisit);
    while (unvisitedWarehouses.size > 0) {
        let nearest: string | null = null;
        let minDistance = Infinity;
        
        unvisitedWarehouses.forEach(wh => {
            const leg = distMatrix[currentLoc][wh];
            if (leg.distance < minDistance) {
                minDistance = leg.distance;
                nearest = wh;
            }
        });
        
        if (nearest) {
            const segmentPath = distMatrix[currentLoc][nearest].path;
            totalDistance += minDistance;
            finalPath.push(...segmentPath.slice(1));
            currentLoc = nearest;
            unvisitedWarehouses.delete(currentLoc);
        } else {
            break; 
        }
    }

    // Phase 2: Deliveries to customers (nearest neighbor with time windows)
    let unvisitedCustomers = new Set(customersToVisit.map(c => c.address));
    let morningDeliveries = new Set(customersToVisit.filter(c => c.timeWindow === 'morning').map(c => c.address));
    let afternoonDeliveries = new Set(customersToVisit.filter(c => c.timeWindow === 'afternoon').map(c => c.address));
    let anyTimeDeliveries = new Set(customersToVisit.filter(c => c.timeWindow === 'any').map(c => c.address));

    // Complete morning deliveries first
    while (morningDeliveries.size > 0) {
        let nearest: string | null = null;
        let minDistance = Infinity;

        morningDeliveries.forEach(cust => {
            const leg = distMatrix[currentLoc][cust];
            if (leg.distance < minDistance) {
                minDistance = leg.distance;
                nearest = cust;
            }
        });

        if (nearest) {
            const segmentPath = distMatrix[currentLoc][nearest].path;
            totalDistance += minDistance;
            finalPath.push(...segmentPath.slice(1));
            currentLoc = nearest;
            morningDeliveries.delete(currentLoc);
            unvisitedCustomers.delete(currentLoc);
        } else {
            break;
        }
    }
    
    // Deliver afternoon and "any" time deliveries together
    const remainingDeliveries = new Set([...afternoonDeliveries, ...anyTimeDeliveries]);
    while (remainingDeliveries.size > 0) {
        let nearest: string | null = null;
        let minDistance = Infinity;

        remainingDeliveries.forEach(cust => {
            const leg = distMatrix[currentLoc][cust];
            if (leg.distance < minDistance) {
                minDistance = leg.distance;
                nearest = cust;
            }
        });

        if (nearest) {
            const segmentPath = distMatrix[currentLoc][nearest].path;
            totalDistance += minDistance;
            finalPath.push(...segmentPath.slice(1));
            currentLoc = nearest;
            remainingDeliveries.delete(currentLoc);
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
    
    return { path: finalPath, distance: totalDistance };
}
