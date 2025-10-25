"use client";

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { nodes as allNodes, edges as allEdges, nodeMap } from '@/lib/graph';
import DummyMap from '@/components/DummyMap';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { solveTsp } from '@/lib/algorithms/tsp';
import { edmondsKarp } from '@/lib/algorithms/max-flow';
import { useCart } from '@/context/CartContext';
import { Route, Truck, Zap, Combine, Warehouse } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { Product } from '@/lib/products';
import { OrderCreator, type SimulatedOrder } from '@/components/OrderCreator';


type DijkstraResult = { path: string[]; distance: number } | null;
type TspResult = { path: string[]; distance: number } | null;
type MaxFlowResult = number | null;
type CombinedResult = {
  tspResult: TspResult;
  shortestPathToFirstCustomer: DijkstraResult;
  maxFlowToFirstCustomer: MaxFlowResult;
  requiredWarehouses: string[];
  allStops: string[];
};

export default function CheckoutPage() {
  const { items: mainUserCart, clearCart: clearMainUserCart } = useCart();
  
  // The main user's order is now just the first in a list of orders.
  const [mainUserOrder, setMainUserOrder] = useState<SimulatedOrder>({
    id: 'you',
    address: 'loc10',
    items: mainUserCart,
  });

  const [otherOrders, setOtherOrders] = useState<SimulatedOrder[]>([]);
  const [combinedResult, setCombinedResult] = useState<CombinedResult | null>(null);

  // Update main user's order when their cart changes
  useState(() => {
    setMainUserOrder(prev => ({...prev, items: mainUserCart}));
  }, [mainUserCart]);

  const allSimulatedOrders = useMemo(() => [mainUserOrder, ...otherOrders], [mainUserOrder, otherOrders]);

  const runCombinedOptimization = () => {
    if (allSimulatedOrders.every(o => o.items.length === 0)) {
      setCombinedResult(null);
      return;
    }

    const allRequiredWarehouses = new Set<string>();
    allSimulatedOrders.forEach(order => {
      order.items.forEach(item => {
        allRequiredWarehouses.add(item.warehouseId);
      });
    });

    const allDeliveryAddresses = new Set<string>(allSimulatedOrders.filter(o => o.items.length > 0).map(o => o.address));
    
    // 1. TSP from a central depot to all required warehouses then to all customers.
    const tspStops = [...allRequiredWarehouses, ...allDeliveryAddresses];
    const tspResult = solveTsp(allNodes, allEdges, 'warehouse-a', tspStops);

    // 2. Simple shortest path for *your* delivery from the nearest warehouse.
    let nearestWarehouse = '';
    let minDistance = Infinity;
    let shortestPathToFirstCustomer: DijkstraResult = null;

    const userWarehouses = new Set(mainUserOrder.items.map(item => item.warehouseId));
    if (userWarehouses.size > 0) {
        userWarehouses.forEach(wh => {
            const path = dijkstra(allNodes, allEdges, wh, mainUserOrder.address);
            if (path && path.distance < minDistance) {
                minDistance = path.distance;
                nearestWarehouse = wh;
                shortestPathToFirstCustomer = path;
            }
        });
    }

    // 3. Max flow from the nearest warehouse to *your* location.
    const maxFlowToFirstCustomer = nearestWarehouse ? edmondsKarp(allNodes, allEdges, nearestWarehouse, mainUserOrder.address) : null;

    setCombinedResult({
      tspResult,
      shortestPathToFirstCustomer,
      maxFlowToFirstCustomer,
      requiredWarehouses: Array.from(allRequiredWarehouses),
      allStops: tspStops
    });
  };

  const resetSimulation = () => {
    clearMainUserCart(); // Clears the main user's cart via CartContext
    setOtherOrders([]);
    setCombinedResult(null);
  };
  
  const mapPath = combinedResult?.tspResult?.path || [];

  const mapHighlights = useMemo(() => {
    if (combinedResult) {
      const nodes = new Set([
        ...combinedResult.requiredWarehouses,
        ...allSimulatedOrders.map(o => o.address),
        'warehouse-a'
      ]);
      return Array.from(nodes);
    }
    return [];
  }, [combinedResult, allSimulatedOrders]);

  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-4xl font-bold font-headline">Logistics Control Panel</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Simulate a real-world delivery backend. Create orders for multiple users and find the optimal route for a single truck to deliver them all.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
            <OrderCreator
              mainUserOrder={mainUserOrder}
              onUpdateMainUserOrder={setMainUserOrder}
              otherOrders={otherOrders}
              onUpdateOtherOrders={setOtherOrders}
              allNodes={allNodes}
            />
            <div className="flex gap-4">
              <Button onClick={runCombinedOptimization} className="w-full" disabled={allSimulatedOrders.every(o => o.items.length === 0)}>
                <Combine className="mr-2"/> Optimize All Deliveries
              </Button>
               <Button onClick={resetSimulation} variant="outline" className="w-full">
                Reset
              </Button>
            </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Simulation Map</CardTitle>
                    <CardDescription>Visual representation of warehouses, delivery locations, and the optimized route.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DummyMap nodes={allNodes} edges={allEdges} highlightedPath={mapPath} highlightedNodes={mapHighlights} />
                </CardContent>
            </Card>
            {combinedResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Optimization Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
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
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Route size={16}/> Your Priority Path (Dijkstra)</h4>
                            {combinedResult.shortestPathToFirstCustomer ? (
                                <>
                                    <p>For comparison, if we only shipped your order priority, the fastest path from the nearest warehouse would be:</p>
                                    <p><strong>Distance:</strong> {combinedResult.shortestPathToFirstCustomer.distance.toFixed(2)} km</p>
                                    <p><strong>Path:</strong> <span className="font-code">{combinedResult.shortestPathToFirstCustomer.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                                </>
                            ) : <p>Your cart is empty. No direct path to calculate.</p>}
                        </div>

                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Zap size={16}/> Your Delivery Capacity (Max-Flow)</h4>
                            {combinedResult.maxFlowToFirstCustomer !== null ? (
                                <>
                                    <p>The theoretical maximum number of packages that can be moved from the nearest warehouse to your location.</p>
                                    <p><strong>Max Packages:</strong> {combinedResult.maxFlowToFirstCustomer} units</p>
                                </>
                            ) : <p>Your cart is empty. No capacity to calculate.</p>}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
