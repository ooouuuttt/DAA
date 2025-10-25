"use client";

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { nodes as allNodes, edges as allEdges } from '@/lib/graph';
import DummyMap from './DummyMap';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { solveTsp } from '@/lib/algorithms/tsp';
import { edmondsKarp } from '@/lib/algorithms/max-flow';
import { useCart } from '@/context/CartContext';
import { Route, Truck, Zap, Combine, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type DijkstraResult = { path: string[]; distance: number } | null;
type TspResult = { path: string[]; distance: number } | null;
type MaxFlowResult = number | null;
type CombinedResult = {
  tspResult: TspResult;
  shortestPath: DijkstraResult;
  maxFlow: MaxFlowResult;
  requiredWarehouses: string[];
};

export default function AlgorithmVisualizer() {
  const { items: cartItems } = useCart();
  const [activeTab, setActiveTab] = useState('combined');

  // State for all tabs
  const [startNode, setStartNode] = useState<string>('warehouse-a');
  const [endNode, setEndNode] = useState<string>('loc5');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('loc10');

  // Result states
  const [dijkstraResult, setDijkstraResult] = useState<DijkstraResult>(null);
  const [tspResult, setTspResult] = useState<TspResult>(null);
  const [maxFlowResult, setMaxFlowResult] = useState<MaxFlowResult>(null);
  const [combinedResult, setCombinedResult] = useState<CombinedResult | null>(null);
  
  // Memoized calculations
  const deliveryLocations = useMemo(() => {
    const locations = new Set(cartItems.map(item => item.deliveryLocationId));
    return Array.from(locations);
  }, [cartItems]);

  const requiredWarehouses = useMemo(() => {
    const warehouseIds = new Set(cartItems.map(item => item.warehouseId));
    return Array.from(warehouseIds);
  }, [cartItems]);

  const runDijkstra = () => {
    const result = dijkstra(allNodes, allEdges, startNode, endNode);
    setDijkstraResult(result);
    setCombinedResult(null);
    setTspResult(null);
  };

  const runTsp = () => {
    if (deliveryLocations.length > 0) {
      const result = solveTsp(allNodes, allEdges, startNode, deliveryLocations);
      setTspResult(result);
      setDijkstraResult(null);
      setCombinedResult(null);
    } else {
       setTspResult(null);
    }
  };

  const runMaxFlow = () => {
    const result = edmondsKarp(allNodes, allEdges, startNode, endNode);
    setMaxFlowResult(result);
  };
  
  const runCombined = () => {
    if (requiredWarehouses.length === 0) {
      setCombinedResult(null);
      return;
    }
    // 1. TSP from a central depot to all required warehouses then to the customer
    const tspStops = [...requiredWarehouses, deliveryAddress];
    const tspResult = solveTsp(allNodes, allEdges, 'warehouse-a', tspStops);

    // 2. Simple shortest path from the nearest warehouse to the customer
    let nearestWarehouse = '';
    let minDistance = Infinity;
    let shortestPath: DijkstraResult = null;

    requiredWarehouses.forEach(wh => {
        const path = dijkstra(allNodes, allEdges, wh, deliveryAddress);
        if (path && path.distance < minDistance) {
            minDistance = path.distance;
            nearestWarehouse = wh;
            shortestPath = path;
        }
    });

    // 3. Max flow from the nearest warehouse to the customer
    const maxFlow = edmondsKarp(allNodes, allEdges, nearestWarehouse, deliveryAddress);

    setCombinedResult({ tspResult, shortestPath, maxFlow, requiredWarehouses });
    setDijkstraResult(null);
    setTspResult(null);
  }

  const mapPath = useMemo(() => {
    if (activeTab === 'dijkstra' && dijkstraResult) return dijkstraResult.path;
    if (activeTab === 'tsp' && tspResult) return tspResult.path;
    if (activeTab === 'combined' && combinedResult?.tspResult) return combinedResult.tspResult.path;
    return [];
  }, [activeTab, dijkstraResult, tspResult, combinedResult]);

  const mapHighlights = useMemo(() => {
    if (activeTab === 'combined' && combinedResult) {
      const nodes = new Set([...combinedResult.requiredWarehouses, deliveryAddress, 'warehouse-a']);
      if(combinedResult.shortestPath) {
        combinedResult.shortestPath.path.forEach(n => nodes.add(n));
      }
       return Array.from(nodes);
    }
    return [];
  }, [activeTab, combinedResult]);

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="grid grid-cols-1 md:grid-cols-3">
          <div className="p-6 border-b md:border-b-0 md:border-r">
            <TabsList className="grid grid-cols-1 h-auto">
               <TabsTrigger value="combined" className="py-3 justify-start gap-3">
                <Combine /> Combined Optimization
              </TabsTrigger>
              <TabsTrigger value="dijkstra" className="py-3 justify-start gap-3">
                <Route /> Dijkstra's Shortest Path
              </TabsTrigger>
              <TabsTrigger value="tsp" className="py-3 justify-start gap-3">
                <Truck /> TSP Route Optimization
              </TabsTrigger>
              <TabsTrigger value="max-flow" className="py-3 justify-start gap-3">
                <Zap /> Max-Flow Capacity
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="md:col-span-2 p-6">
            <TabsContent value="combined" className="mt-0 space-y-4">
              <CardTitle>Combined Delivery Optimization</CardTitle>
              <CardDescription className="mt-1 mb-4">
                This simulation shows a complete logistics plan. It finds the optimal route for a truck to pick up all your items from different warehouses and deliver them to your address.
              </CardDescription>
               <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Delivery Address:</span>
                 <Select value={deliveryAddress} onValueChange={setDeliveryAddress}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select address" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.filter(n => !n.id.includes('warehouse')).map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runCombined} disabled={cartItems.length === 0}>Optimize Full Delivery</Button>
               {cartItems.length === 0 && <p className="text-sm text-muted-foreground mt-2">Add items to your cart to run a combined optimization.</p>}
               
               {combinedResult && (
                <div className="space-y-4 text-sm">
                    <p><strong>Required Warehouses:</strong> <span className="font-code">{combinedResult.requiredWarehouses.join(', ') || 'None'}</span></p>
                    <Separator />
                    
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Truck size={16}/> Full Tour (TSP)</h4>
                        {combinedResult.tspResult ? (
                            <>
                                <p>A truck starting at warehouse-a will visit all required warehouses and then your location.</p>
                                <p><strong>Total Distance:</strong> {combinedResult.tspResult.distance.toFixed(2)} km</p>
                                <p><strong>Route:</strong> <span className="font-code">{combinedResult.tspResult.path.join(' -> ')}</span></p>
                            </>
                        ) : <p>Not enough stops for a TSP route.</p>}
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Route size={16}/> Direct Path (Dijkstra)</h4>
                        {combinedResult.shortestPath ? (
                            <>
                                <p>The fastest single-package delivery would be from the nearest warehouse.</p>
                                <p><strong>Distance:</strong> {combinedResult.shortestPath.distance.toFixed(2)} km</p>
                                <p><strong>Path:</strong> <span className="font-code">{combinedResult.shortestPath.path.join(' -> ')}</span></p>
                            </>
                        ) : <p>Could not calculate a direct path.</p>}
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Zap size={16}/> Network Capacity (Max-Flow)</h4>
                         {combinedResult.maxFlow !== null ? (
                            <>
                                <p>Maximum package throughput to your location from the nearest warehouse.</p>
                                <p><strong>Max Packages:</strong> {combinedResult.maxFlow} units</p>
                            </>
                        ) : <p>Could not calculate max-flow.</p>}
                    </div>
                </div>
               )}

            </TabsContent>
            <TabsContent value="dijkstra" className="mt-0">
              <CardTitle>Shortest Delivery Path</CardTitle>
              <CardDescription className="mt-1 mb-4">Find the single fastest route from a start point to a destination using Dijkstra's algorithm.</CardDescription>
              <div className="flex gap-2 mb-4 items-center">
                <Select value={startNode} onValueChange={setStartNode}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select start" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>to</span>
                <Select value={endNode} onValueChange={setEndNode}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={runDijkstra}>Find Path</Button>
              </div>
              {dijkstraResult && (
                <div className="text-sm">
                  <p><strong>Distance:</strong> {dijkstraResult.distance.toFixed(2)} km</p>
                  <p><strong>Path:</strong> <span className="font-code">{dijkstraResult.path.join(' -> ')}</span></p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="tsp" className="mt-0">
              <CardTitle>Optimized Multi-Stop Route</CardTitle>
              <CardDescription className="mt-1 mb-4">Calculate the most efficient route to deliver all items in your cart from a warehouse using a Traveling Salesman Problem (TSP) heuristic.</CardDescription>
               <div className="flex gap-2 mb-4 items-center">
                 <Select value={startNode} onValueChange={setStartNode}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select start" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.filter(n => n.id.includes('warehouse')).map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={runTsp} disabled={deliveryLocations.length === 0}>Optimize Cart Delivery</Button>
              </div>
              {deliveryLocations.length === 0 && <p className="text-sm text-muted-foreground mt-2">Add items to your cart to plan a delivery route.</p>}
              {tspResult && (
                <div className="text-sm mt-4">
                  <p><strong>Total Distance:</strong> {tspResult.distance.toFixed(2)} km</p>
                  <p><strong>Route:</strong> <span className="font-code">{tspResult.path.join(' -> ')}</span></p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="max-flow" className="mt-0">
              <CardTitle>Maximum Delivery Capacity</CardTitle>
              <CardDescription className="mt-1 mb-4">Determine the maximum number of packages we can move from a source to a sink location using the Max-Flow algorithm.</CardDescription>
              <div className="flex gap-2 mb-4 items-center">
                 <Select value={startNode} onValueChange={setStartNode}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <span>to</span>
                <Select value={endNode} onValueChange={setEndNode}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select sink" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={runMaxFlow}>Analyze Capacity</Button>
              </div>
               {maxFlowResult !== null && (
                <div className="text-sm">
                  <p><strong>Max Packages:</strong> {maxFlowResult} units</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
        <div className="bg-muted/50 p-4 border-t">
            <DummyMap nodes={allNodes} edges={allEdges} highlightedPath={mapPath} highlightedNodes={mapHighlights} />
        </div>
      </CardContent>
    </Card>
  );
}
