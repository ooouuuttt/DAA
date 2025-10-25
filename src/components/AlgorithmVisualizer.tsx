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
import { Route, Truck, Zap } from 'lucide-react';

type DijkstraResult = { path: string[]; distance: number } | null;
type TspResult = { path: string[]; distance: number } | null;
type MaxFlowResult = number | null;

export default function AlgorithmVisualizer() {
  const { items: cartItems } = useCart();
  const [activeTab, setActiveTab] = useState('dijkstra');

  // Dijkstra state
  const [dijkstraDest, setDijkstraDest] = useState<string>('loc5');
  const [dijkstraResult, setDijkstraResult] = useState<DijkstraResult>(null);

  // TSP state
  const [tspResult, setTspResult] = useState<TspResult>(null);

  // Max Flow state
  const [maxFlowDest, setMaxFlowDest] = useState<string>('loc15');
  const [maxFlowResult, setMaxFlowResult] = useState<MaxFlowResult>(null);

  const deliveryLocations = useMemo(() => {
    const locations = new Set(cartItems.map(item => item.deliveryLocationId));
    return Array.from(locations);
  }, [cartItems]);

  const runDijkstra = () => {
    const result = dijkstra(allNodes, allEdges, 'warehouse', dijkstraDest);
    setDijkstraResult(result);
  };

  const runTsp = () => {
    if (deliveryLocations.length > 0) {
      const result = solveTsp(allNodes, allEdges, 'warehouse', deliveryLocations);
      setTspResult(result);
    } else {
       setTspResult(null);
    }
  };

  const runMaxFlow = () => {
    const result = edmondsKarp(allNodes, allEdges, 'warehouse', maxFlowDest);
    setMaxFlowResult(result);
  };
  
  const mapPath = useMemo(() => {
    if (activeTab === 'dijkstra' && dijkstraResult) return dijkstraResult.path;
    if (activeTab === 'tsp' && tspResult) return tspResult.path;
    return [];
  }, [activeTab, dijkstraResult, tspResult]);

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="grid grid-cols-1 md:grid-cols-3">
          <div className="p-6 border-b md:border-b-0 md:border-r">
            <TabsList className="grid grid-cols-1 h-auto">
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
            <TabsContent value="dijkstra" className="mt-0">
              <CardTitle>Shortest Delivery Path</CardTitle>
              <CardDescription className="mt-1 mb-4">Find the single fastest route from our warehouse to a destination using Dijkstra's algorithm.</CardDescription>
              <div className="flex gap-2 mb-4">
                <Select value={dijkstraDest} onValueChange={setDijkstraDest}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.filter(n => n.id !== 'warehouse').map(n => (
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
              <CardDescription className="mt-1 mb-4">Calculate the most efficient route to deliver all items in your cart using a Traveling Salesman Problem (TSP) heuristic.</CardDescription>
              <Button onClick={runTsp} disabled={deliveryLocations.length === 0}>Optimize Cart Delivery</Button>
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
              <CardDescription className="mt-1 mb-4">Determine the maximum number of packages we can move from the warehouse to a location in a given time using the Max-Flow algorithm.</CardDescription>
              <div className="flex gap-2 mb-4">
                 <Select value={maxFlowDest} onValueChange={setMaxFlowDest}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.filter(n => n.id !== 'warehouse').map(n => (
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
            <DummyMap nodes={allNodes} edges={allEdges} highlightedPath={mapPath} />
        </div>
      </CardContent>
    </Card>
  );
}
