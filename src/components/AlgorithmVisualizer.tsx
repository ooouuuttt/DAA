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
import { nodes as allNodes, edges as allEdges, nodeMap } from '@/lib/graph';
import DummyMap from './DummyMap';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { solveTsp } from '@/lib/algorithms/tsp';
import { edmondsKarp } from '@/lib/algorithms/max-flow';
import { useCart } from '@/context/CartContext';
import { Route, Truck, Zap, Combine, MapPin, Users, Warehouse } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { products } from '@/lib/products';

type DijkstraResult = { path: string[]; distance: number } | null;
type TspResult = { path: string[]; distance: number } | null;
type MaxFlowResult = number | null;
type CombinedResult = {
  tspResult: TspResult;
  shortestPath: DijkstraResult;
  maxFlow: MaxFlowResult;
  requiredWarehouses: string[];
  allStops: string[];
};

const otherDeliveries = [
  { id: 'user2', address: 'loc15', items: [products[1], products[4]] }, // Headphones (C), Coffee Maker (A)
  { id: 'user3', address: 'loc4', items: [products[5]] }, // Chair (B)
];


export default function AlgorithmVisualizer() {
  const { items: cartItems } = useCart();
  const [activeTab, setActiveTab] = useState('combined');

  // State for all tabs
  const [startNode, setStartNode] = useState<string>('warehouse-a');
  const [endNode, setEndNode] = useState<string>('loc5');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('loc10');
  const [includeOtherDeliveries, setIncludeOtherDeliveries] = useState(true);

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

  const runDijkstra = () => {
    const result = dijkstra(allNodes, allEdges, startNode, endNode);
    setDijkstraResult(result);
    setCombinedResult(null);
    setTspResult(null);
  };

  const runTsp = () => {
    if (cartItems.length > 0) {
      // For this tab, we only consider the user's cart items
      const userWarehouses = Array.from(new Set(cartItems.map(item => item.warehouseId)));
      const userStops = [...userWarehouses, deliveryAddress];
      const result = solveTsp(allNodes, allEdges, 'warehouse-a', userStops);
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
    const currentUserOrder = {
        id: 'main-user',
        address: deliveryAddress,
        items: cartItems
    };

    let allOrders = [currentUserOrder];
    if (includeOtherDeliveries) {
        allOrders = [...allOrders, ...otherDeliveries];
    }
    
    if (allOrders.every(o => o.items.length === 0)) {
        setCombinedResult(null);
        return;
    }

    const allRequiredWarehouses = new Set<string>();
    allOrders.forEach(order => {
        order.items.forEach(item => {
            allRequiredWarehouses.add(item.warehouseId);
        });
    });

    const allDeliveryAddresses = new Set<string>(allOrders.filter(o => o.items.length > 0).map(o => o.address));
    
    // 1. TSP from a central depot to all required warehouses then to all customers.
    const tspStops = [...allRequiredWarehouses, ...allDeliveryAddresses];
    const tspResult = solveTsp(allNodes, allEdges, 'warehouse-a', tspStops);

    // 2. Simple shortest path for *your* delivery from the nearest warehouse.
    let nearestWarehouse = '';
    let minDistance = Infinity;
    let shortestPath: DijkstraResult = null;

    const userWarehouses = new Set(cartItems.map(item => item.warehouseId));
    if (userWarehouses.size > 0) {
        userWarehouses.forEach(wh => {
            const path = dijkstra(allNodes, allEdges, wh, deliveryAddress);
            if (path && path.distance < minDistance) {
                minDistance = path.distance;
                nearestWarehouse = wh;
                shortestPath = path;
            }
        });
    }

    // 3. Max flow from the nearest warehouse to *your* location.
    const maxFlow = nearestWarehouse ? edmondsKarp(allNodes, allEdges, nearestWarehouse, deliveryAddress) : null;

    setCombinedResult({ tspResult, shortestPath, maxFlow, requiredWarehouses: Array.from(allRequiredWarehouses), allStops: tspStops });
    setDijkstraResult(null);
    setTspResult(null);
  };

  const mapPath = useMemo(() => {
    if (activeTab === 'dijkstra' && dijkstraResult) return dijkstraResult.path;
    if (activeTab === 'tsp' && tspResult) return tspResult.path;
    if (activeTab === 'combined' && combinedResult?.tspResult) return combinedResult.tspResult.path;
    return [];
  }, [activeTab, dijkstraResult, tspResult, combinedResult]);

  const mapHighlights = useMemo(() => {
    if (activeTab === 'combined' && combinedResult) {
      const nodes = new Set([...combinedResult.requiredWarehouses, deliveryAddress, 'warehouse-a', ...combinedResult.allStops]);
       if(includeOtherDeliveries) {
        otherDeliveries.forEach(d => nodes.add(d.address));
      }
      return Array.from(nodes);
    }
    if (activeTab === 'tsp' && tspResult) {
       const userWarehouses = Array.from(new Set(cartItems.map(item => item.warehouseId)));
       return [...userWarehouses, deliveryAddress, 'warehouse-a'];
    }
    return [];
  }, [activeTab, combinedResult, tspResult, includeOtherDeliveries, deliveryAddress, cartItems]);

  return (
    <Card>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="grid grid-cols-1 md:grid-cols-3">
          <div className="p-6 border-b md:border-b-0 md:border-r">
            <TabsList className="grid grid-cols-1 h-auto">
               <TabsTrigger value="combined" className="py-3 justify-start gap-3">
                <Combine /> Full Logistics Demo
              </TabsTrigger>
              <TabsTrigger value="tsp" className="py-3 justify-start gap-3">
                <Truck /> Your Route (TSP)
              </TabsTrigger>
              <TabsTrigger value="dijkstra" className="py-3 justify-start gap-3">
                <Route /> Shortest Path (Dijkstra)
              </TabsTrigger>
              <TabsTrigger value="max-flow" className="py-3 justify-start gap-3">
                <Zap /> Network Capacity
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="md:col-span-2 p-6">
            <TabsContent value="combined" className="mt-0 space-y-6">
              <div>
                <CardTitle>Full Logistics Simulation (like Amazon)</CardTitle>
                <CardDescription className="mt-1">
                  This simulates a full delivery batch. A truck starts at a central depot, visits all necessary warehouses to collect items for multiple customers, delivers all packages, and returns.
                </CardDescription>
              </div>

               <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-bold">How to Use This Demo:</h4>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    <li>Go to the <a href="/" className="text-primary underline">Products page</a> and add items to your cart. Notice they ship from different warehouses.</li>
                    <li>Come back here. Select your delivery address from the dropdown.</li>
                    <li>Use the checkbox to include or exclude other simulated customer orders in the batch.</li>
                    <li>Click the "Optimize Full Delivery Batch" button to see the magic happen!</li>
                  </ol>
               </div>

              <Separator />

              <div>
                <Label htmlFor="delivery-address" className="font-medium">1. Your Delivery Details</Label>
                <div id="delivery-address" className="flex items-center gap-2 mt-2">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
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
                <div className="mt-2 text-sm text-muted-foreground">You have {cartItems.length} item(s) in your cart.</div>
              </div>


              <div>
                  <Label className="font-medium">2. Simulate Other Customers</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox id="include-others" checked={includeOtherDeliveries} onCheckedChange={(checked) => setIncludeOtherDeliveries(Boolean(checked))} />
                    <Label htmlFor="include-others" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Include other users' deliveries in the same batch
                    </Label>
                  </div>
                  {includeOtherDeliveries && (
                    <div className="mt-4 space-y-2 text-sm p-3 bg-muted/50 rounded-lg">
                       <h5 className="font-semibold flex items-center gap-2"><Users size={16}/> Today's Other Deliveries:</h5>
                       {otherDeliveries.map(order => (
                         <div key={order.id}>
                           - <strong>{order.id}</strong> is ordering {order.items.length} item(s) to <strong>{nodeMap.get(order.address)?.name}</strong>.
                         </div>
                       ))}
                    </div>
                  )}
              </div>

               <div>
                <Label className="font-medium">3. Run Simulation</Label>
                 <div className="mt-2">
                    <Button onClick={runCombined} disabled={cartItems.length === 0 && !includeOtherDeliveries}>Optimize Full Delivery Batch</Button>
                    {(cartItems.length === 0 && !includeOtherDeliveries) && <p className="text-sm text-muted-foreground mt-2">Add items to your cart or include other deliveries to run a simulation.</p>}
                 </div>
               </div>
               
               {combinedResult && (
                <div className="space-y-4 text-sm pt-4 border-t">
                    <h4 className="font-bold">Optimization Results:</h4>
                    <p><strong className="flex items-center gap-2"><Warehouse size={16}/> Warehouses to Visit:</strong> The truck must visit <span className="font-code">{combinedResult.requiredWarehouses.map(id => nodeMap.get(id)?.name).join(', ') || 'None'}</span> to pick up all items for this batch.</p>
                    <Separator />
                    
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Truck size={16}/> Batched Delivery Route (TSP)</h4>
                        {combinedResult.tspResult ? (
                            <>
                                <p>A single truck serves all orders. It starts at Depot A, visits required warehouses, delivers to all customers, then returns.</p>
                                <p><strong>Total Distance:</strong> {combinedResult.tspResult.distance.toFixed(2)} km</p>
                                <p><strong>Optimized Route:</strong> <span className="font-code">{combinedResult.tspResult.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                            </>
                        ) : <p>Not enough stops for a TSP route.</p>}
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Route size={16}/> Your Quickest Path (Dijkstra)</h4>
                        {combinedResult.shortestPath ? (
                            <>
                                <p>If we only shipped your order as a priority, the fastest single delivery would be from the nearest warehouse.</p>
                                <p><strong>Distance:</strong> {combinedResult.shortestPath.distance.toFixed(2)} km</p>
                                <p><strong>Path:</strong> <span className="font-code">{combinedResult.shortestPath.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                            </>
                        ) : <p>Your cart is empty. No direct path to calculate.</p>}
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><Zap size={16}/> Your Delivery Capacity (Max-Flow)</h4>
                         {combinedResult.maxFlow !== null ? (
                            <>
                                <p>Maximum package throughput to your location from the nearest relevant warehouse.</p>
                                <p><strong>Max Packages:</strong> {combinedResult.maxFlow} units</p>
                            </>
                        ) : <p>Your cart is empty. No capacity to calculate.</p>}
                    </div>
                </div>
               )}

            </TabsContent>
             <TabsContent value="tsp" className="mt-0">
              <CardTitle>Your Optimized Multi-Item Route</CardTitle>
              <CardDescription className="mt-1 mb-4">Calculates the most efficient route for a truck to pick up all items *in your cart* from different warehouses and deliver them to you.</CardDescription>
               <div className="flex gap-2 mb-4 items-center">
                 <Select value={startNode} onValueChange={(val) => setStartNode(val)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select start" />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.filter(n => n.id.includes('warehouse')).map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <span className="text-muted-foreground">to your address at</span>
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
               <Button onClick={runTsp} disabled={cartItems.length === 0}>Optimize My Cart Delivery</Button>
              {cartItems.length === 0 && <p className="text-sm text-muted-foreground mt-2">Add items from different warehouses to your cart to plan a delivery route.</p>}
              {tspResult && (
                <div className="text-sm mt-4 space-y-2">
                  <p><strong>Required Warehouses:</strong> {Array.from(new Set(cartItems.map(item => item.warehouseId))).map(id => nodeMap.get(id)?.name).join(', ')}</p>
                  <p><strong>Total Distance:</strong> {tspResult.distance.toFixed(2)} km</p>
                  <p><strong>Route:</strong> <span className="font-code">{tspResult.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="dijkstra" className="mt-0">
              <CardTitle>Shortest Delivery Path</CardTitle>
              <CardDescription className="mt-1 mb-4">Find the single fastest route from a start point to a destination using Dijkstra's algorithm. This is ideal for one package from one location.</CardDescription>
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
                <div className="text-sm space-y-2">
                  <p><strong>Distance:</strong> {dijkstraResult.distance.toFixed(2)} km</p>
                  <p><strong>Path:</strong> <span className="font-code">{dijkstraResult.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="max-flow" className="mt-0">
              <CardTitle>Maximum Delivery Capacity</CardTitle>
              <CardDescription className="mt-1 mb-4">Determine the maximum number of packages (throughput) that can be moved between any two points in the network, using the Edmonds-Karp algorithm.</CardDescription>
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
                  <p><strong>Max Package Flow:</strong> {maxFlowResult} units</p>
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
