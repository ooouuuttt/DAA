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
import { Route, Truck, Zap, Combine, Warehouse, Info } from 'lucide-react';
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
  deliveryAddresses: string[];
};

export default function CheckoutPage() {
  const { items: mainUserCart, clearCart: clearMainUserCart } = useCart();
  
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
    const tspResult = solveTsp(allNodes, allEdges, 'warehouse-a', Array.from(allRequiredWarehouses), Array.from(allDeliveryAddresses));

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
      deliveryAddresses: Array.from(allDeliveryAddresses),
    });
  };

  const resetSimulation = () => {
    clearMainUserCart();
    setOtherOrders([]);
    setCombinedResult(null);
  };
  
  const mapPath = combinedResult?.tspResult?.path || [];

  const mapHighlights = useMemo(() => {
    if (combinedResult) {
      const nodes = new Set([
        ...combinedResult.requiredWarehouses,
        ...combinedResult.deliveryAddresses,
        'warehouse-a'
      ]);
      return Array.from(nodes);
    }
    return [];
  }, [combinedResult]);

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
                    <CardDescription>Visual representation of warehouses (blue), delivery locations (yellow), and the optimized route.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DummyMap nodes={allNodes} edges={allEdges} highlightedPath={mapPath} highlightedNodes={mapHighlights} />
                </CardContent>
            </Card>
            {combinedResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Optimization Results Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 text-sm">
                        
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Truck size={16}/> Batched Delivery Route (TSP)</h4>
                            <p className="text-xs text-muted-foreground mb-2">A single truck serves all orders. It starts at the central depot (Depot A), visits the necessary warehouses to collect all items, delivers to all customers, then returns to the depot.</p>
                            
                            <p className="mb-2"><strong className="flex items-center gap-2"><Warehouse size={16}/> Warehouses to Visit:</strong> The truck must visit <span className="font-code">{combinedResult.requiredWarehouses.map(id => nodeMap.get(id)?.name).join(', ') || 'None'}</span> because they contain items for this batch of orders.</p>
                            
                            {combinedResult.tspResult ? (
                                <>
                                    <p><strong>Total Distance:</strong> {combinedResult.tspResult.distance.toFixed(2)} km</p>
                                    <p><strong>Optimized Route:</strong> <span className="font-code">{combinedResult.tspResult.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                                </>
                            ) : <p>Not enough stops for a TSP route.</p>}
                        </div>

                         <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Info size={16}/> Standalone Analyses (For Your Order Only)</h4>
                            <p className="text-xs text-muted-foreground mb-4">These are separate calculations for comparison, focusing only on your order, not the entire batch.</p>
                            <div className="space-y-4">
                                <div >
                                    <h5 className="font-semibold flex items-center gap-2"><Route size={16}/> Your Priority Path (Dijkstra)</h5>
                                    {combinedResult.shortestPathToFirstCustomer ? (
                                        <>
                                            <p>For comparison, if we only shipped your order, the fastest path from the nearest warehouse would be:</p>
                                            <p><strong>Distance:</strong> {combinedResult.shortestPathToFirstCustomer.distance.toFixed(2)} km</p>
                                            <p><strong>Path:</strong> <span className="font-code">{combinedResult.shortestPathToFirstCustomer.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                                        </>
                                    ) : <p>Your cart is empty. No direct path to calculate.</p>}
                                </div>

                                <Separator />

                                <div >
                                    <h5 className="font-semibold flex items-center gap-2"><Zap size={16}/> Your Delivery Capacity (Max-Flow)</h5>
                                    {combinedResult.maxFlowToFirstCustomer !== null ? (
                                        <>
                                            <p>This is a theoretical analysis of the road network itself. It shows the maximum number of packages that could possibly be moved between the closest warehouse and your address per hour, assuming all roads are used optimally. It helps identify potential network bottlenecks.</p>
                                            <p><strong>Max Capacity:</strong> {combinedResult.maxFlowToFirstCustomer} packages/hour</p>
                                        </>
                                    ) : <p>Your cart is empty. No capacity to calculate.</p>}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
