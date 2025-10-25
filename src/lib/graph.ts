export interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Edge {
  source: string;
  target: string;
  weight: number; // distance
  capacity: number; // packages per unit time
}

const locations: Omit<Node, 'name'>[] = [
  // Warehouses
  { id: 'warehouse-a', x: 50, y: 175 }, // Central Depot
  { id: 'warehouse-b', x: 280, y: 40 },
  { id: 'warehouse-c', x: 450, y: 250 },
  { id: 'warehouse-d', x: 120, y: 320 },
  { id: 'warehouse-e', x: 480, y: 50 },
  
  // Locations
  { id: 'loc1', x: 120, y: 50 },
  { id: 'loc2', x: 100, y: 150 },
  { id: 'loc3', x: 130, y: 250 },
  { id: 'loc4', x: 210, y: 320 },
  { id: 'loc5', x: 200, y: 80 },
  { id: 'loc6', x: 180, y: 180 },
  { id: 'loc7', x: 220, y: 280 },
  { id: 'loc8', x: 210, y: 20 },
  { id: 'loc9', x: 280, y: 130 },
  { id: 'loc10', x: 300, y: 220 },
  { id: 'loc11', x: 290, y: 330 },
  { id: 'loc12', x: 350, y: 60 },
  { id: 'loc13', x: 330, y: 175 },
  { id: 'loc14', x: 360, y: 280 },
  { id: 'loc15', x: 450, y: 130 },
  { id: 'loc16', x: 420, y: 180 },
  { id: 'loc17', x: 430, y: 210 },
  { id: 'loc18', x: 460, y: 310 },
  { id: 'loc19', x: 480, y: 175 },
  { id: 'loc20', x: 190, y: 220 },
];

export const nodes: Node[] = locations.map(loc => {
  if (loc.id === 'warehouse-a') return { ...loc, name: 'Depot A' };
  if (loc.id === 'warehouse-b') return { ...loc, name: 'Warehouse B' };
  if (loc.id === 'warehouse-c') return { ...loc, name: 'Warehouse C' };
  if (loc.id === 'warehouse-d') return { ...loc, name: 'Warehouse D' };
  if (loc.id === 'warehouse-e') return { ...loc, name: 'Warehouse E' };
  return { ...loc, name: `Loc ${loc.id.replace('loc', '')}` };
});

const connections: [string, string][] = [
  // Connections from warehouses
  ['warehouse-a', 'loc2'], ['warehouse-a', 'loc3'],
  ['warehouse-b', 'loc5'], ['warehouse-b', 'loc8'], ['warehouse-b', 'loc9'], ['warehouse-b', 'loc12'],
  ['warehouse-c', 'loc14'], ['warehouse-c', 'loc17'], ['warehouse-c', 'loc18'],
  ['warehouse-d', 'loc3'], ['warehouse-d', 'loc4'], ['warehouse-d', 'loc7'],
  ['warehouse-e', 'loc12'], ['warehouse-e', 'loc15'], ['warehouse-e', 'loc19'],

  // Connections between locations
  ['loc1', 'loc2'], ['loc1', 'loc5'], ['loc1', 'loc8'],
  ['loc2', 'loc3'], ['loc2', 'loc6'],
  ['loc3', 'loc4'], ['loc3', 'loc7'],
  ['loc4', 'loc7'],['loc4', 'loc11'],
  ['loc5', 'loc6'], ['loc5', 'loc8'], ['loc5', 'loc9'],
  ['loc6', 'loc9'], ['loc6', 'loc20'],
  ['loc7', 'loc10'], ['loc7', 'loc11'],
  ['loc8', 'loc12'],
  ['loc9', 'loc12'], ['loc9', 'loc13'], ['loc9', 'loc20'],
  ['loc10', 'loc13'], ['loc10', 'loc14'], ['loc10', 'loc20'],
  ['loc11', 'loc14'],
  ['loc12', 'loc15'], ['loc12', 'loc13'],
  ['loc13', 'loc16'], ['loc13', 'loc17'],
  ['loc14', 'loc17'], ['loc14', 'loc18'],
  ['loc15', 'loc16'], ['loc15', 'loc19'],
  ['loc16', 'loc17'], ['loc16', 'loc19'],
  ['loc17', 'loc18'], ['loc17', 'loc19'],
  ['loc18', 'loc19'],
  ['loc20', 'loc10'], ['loc20', 'loc13']
];

const nodeMap = new Map(nodes.map(n => [n.id, n]));

export const edges: Edge[] = connections.map(([source, target]) => {
  const sourceNode = nodeMap.get(source)!;
  const targetNode = nodeMap.get(target)!;
  const distance = Math.sqrt(
    Math.pow(sourceNode.x - targetNode.x, 2) + Math.pow(sourceNode.y - targetNode.y, 2)
  );
  return {
    source,
    target,
    weight: Math.round(distance),
    capacity: Math.floor(Math.random() * 11) + 5, // Random capacity between 5 and 15
  };
});
