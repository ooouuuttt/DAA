
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
import { Route, Truck, Zap, Combine, Warehouse, Info, Package, Split, User } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { Product } from '@/lib/products';
import { OrderCreator, type SimulatedOrder } from '@/components/OrderCreator';


type DijkstraResult = { path: string[]; distance: number } | null;
type TspResult = { path: string[]; distance: number } | null;
type MaxFlowResult = number | null;

type SplitShipment = {
    warehouseId: string;
    warehouseName: string;
    path: DijkstraResult;
    items: Product[];
}

type OrderShipments = {
  orderId: string;
  address: string;
  shipments: SplitShipment[];
}

type WarehouseBatchResult = {
    warehouseId: string;
    warehouseName: string;
    route: TspResult;
    customers: string[];
    items: { productName: string; orderId: string; customerAddress: string; }[];
};

type CombinedResult = {
  // Strategy 1
  allOrderShipments: OrderShipments[];
  // Strategy 2
  consolidatedTspResult: TspResult;
  requiredWarehouses: string[];
  deliveryAddresses: string[];
  warehouseManifest: Record<string, {productName: string, orderId: string}[]>;
  // Strategy 3
  warehouseBatchResults: WarehouseBatchResult[];
  // Standalone Analysis
  maxFlowToFirstCustomer: MaxFlowResult;
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
  useMemo(() => {
    setMainUserOrder(prev => ({...prev, items: mainUserCart}));
  }, [mainUserCart]);

  const allSimulatedOrders = useMemo(() => [mainUserOrder, ...otherOrders], [mainUserOrder, otherOrders]);

  const runCombinedOptimization = () => {
    if (allSimulatedOrders.every(o => o.items.length === 0)) {
      setCombinedResult(null);
      return;
    }
    
    const activeOrders = allSimulatedOrders.filter(order => order.items.length > 0);

    // --- Strategy 1: Prioritize Speed (The Amazon Model) ---
    const allOrderShipments: OrderShipments[] = activeOrders.map(order => {
        const itemsByWarehouse: Record<string, Product[]> = {};
        order.items.forEach(item => {
            if (!itemsByWarehouse[item.warehouseId]) itemsByWarehouse[item.warehouseId] = [];
            itemsByWarehouse[item.warehouseId].push(item);
        });

        const shipments: SplitShipment[] = Object.entries(itemsByWarehouse).map(([warehouseId, items]) => {
            const path = dijkstra(allNodes, allEdges, warehouseId, order.address);
            return {
                warehouseId,
                warehouseName: nodeMap.get(warehouseId)?.name || 'Unknown Warehouse',
                path,
                items,
            };
        });
        
        return { orderId: order.id, address: order.address, shipments };
    });

    // --- Strategy 2: Prioritize Efficiency (The Local Delivery Model) ---
    const allRequiredWarehouses = new Set<string>();
    const warehouseManifest: CombinedResult['warehouseManifest'] = {};

    activeOrders.forEach(order => {
      order.items.forEach(item => {
        allRequiredWarehouses.add(item.warehouseId);
        if (!warehouseManifest[item.warehouseId]) warehouseManifest[item.warehouseId] = [];
        warehouseManifest[item.warehouseId].push({ productName: item.name, orderId: order.id });
      });
    });

    const allDeliveryAddresses = new Set<string>(activeOrders.map(o => o.address));
    const consolidatedTspResult = solveTsp(allNodes, allEdges, 'warehouse-a', Array.from(allRequiredWarehouses), Array.from(allDeliveryAddresses));
    
    // --- Strategy 3: Warehouse-Based Batching ---
    const itemsByWarehouseForBatching: Record<string, { product: Product; order: SimulatedOrder }[]> = {};
    activeOrders.forEach(order => {
        order.items.forEach(item => {
            if (!itemsByWarehouseForBatching[item.warehouseId]) itemsByWarehouseForBatching[item.warehouseId] = [];
            itemsByWarehouseForBatching[item.warehouseId].push({ product: item, order: order });
        });
    });

    const warehouseBatchResults: WarehouseBatchResult[] = Object.entries(itemsByWarehouseForBatching).map(([warehouseId, ordersAndItems]) => {
        const customerAddresses = new Set(ordersAndItems.map(oi => oi.order.address));
        const route = solveTsp(allNodes, allEdges, warehouseId, [], Array.from(customerAddresses)); // TSP from this warehouse to its customers
        const items = ordersAndItems.map(oi => ({
            productName: oi.product.name,
            orderId: oi.order.id,
            customerAddress: oi.order.address,
        }));
        return {
            warehouseId,
            warehouseName: nodeMap.get(warehouseId)?.name || 'Unknown Warehouse',
            route,
            customers: Array.from(customerAddresses),
            items,
        };
    });


    // --- Standalone Analysis (Max-Flow for the main user only) ---
    let nearestWarehouseForMaxFlow = '';
    let minDistance = Infinity;
    const userWarehouses = new Set(mainUserOrder.items.map(item => item.warehouseId));
    if (userWarehouses.size > 0) {
        userWarehouses.forEach(wh => {
            const path = dijkstra(allNodes, allEdges, wh, mainUserOrder.address);
            if (path && path.distance < minDistance) {
                minDistance = path.distance;
                nearestWarehouseForMaxFlow = wh;
            }
        });
    }
    const maxFlowToFirstCustomer = nearestWarehouseForMaxFlow ? edmondsKarp(allNodes, allEdges, nearestWarehouseForMaxFlow, mainUserOrder.address) : null;

    setCombinedResult({
      allOrderShipments,
      consolidatedTspResult,
      requiredWarehouses: Array.from(allRequiredWarehouses),
      deliveryAddresses: Array.from(allDeliveryAddresses),
      warehouseManifest,
      warehouseBatchResults,
      maxFlowToFirstCustomer,
    });
  };

  const resetSimulation = () => {
    clearMainUserCart();
    setOtherOrders([]);
    setCombinedResult(null);
  };
  
  const mapPath = combinedResult?.consolidatedTspResult?.path || [];

  const mapHighlights = useMemo(() => {
    if (combinedResult) {
        const depot = { id: 'warehouse-a', type: 'depot' as const };
        const warehouses = combinedResult.requiredWarehouses.map(id => ({ id, type: 'warehouse' as const }));
        const customers = combinedResult.deliveryAddresses.map(id => ({ id, type: 'customer' as const }));
        return [depot, ...warehouses, ...customers];
    }
    return [];
  }, [combinedResult]);

  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-4xl font-bold font-headline">Logistics Control Panel</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Simulate and compare real-world delivery backend strategies.
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
                <Combine className="mr-2"/> Run Logistics Simulation
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
                    <CardDescription>Visual representation of the depot (purple), warehouses (blue), delivery locations (yellow), and the consolidated truck route (Strategy 2).</CardDescription>
                </CardHeader>
                <CardContent>
                    <DummyMap nodes={allNodes} edges={allEdges} highlightedPath={mapPath} highlightedNodes={mapHighlights} />
                </CardContent>
            </Card>
            {combinedResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Optimization Results: A Tale of Three Strategies</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 text-sm">

                        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200">
                             <h4 className="font-bold mb-2 flex items-center gap-2 text-blue-800"><Split size={16}/> Strategy 1: Prioritize Speed (The Amazon Model)</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                              This model's goal is to get every item to its customer as fast as possible, ignoring truck efficiency. Each part of an order ships separately and directly from its warehouse. Notice how if two users order from the same warehouse, the system calculates two separate, independent trips.
                            </p>
                             {combinedResult.allOrderShipments.length > 0 ? (
                                combinedResult.allOrderShipments.map((order, orderIndex) => (
                                     <div key={orderIndex} className="p-3 bg-white rounded-md border mb-3">
                                        <p className="font-bold text-primary flex items-center gap-2 mb-2"><User size={14}/> Order for <span className="text-blue-800">{order.id}</span> to <span className="text-blue-800">{nodeMap.get(order.address)?.name}</span></p>
                                        {order.shipments.map((shipment, index) => (
                                            <div key={index} className="pl-4 border-l-2 ml-2 mb-3 space-y-1 border-blue-300">
                                                <p className="font-medium text-primary">Shipment {index + 1} from {shipment.warehouseName}</p>
                                                <ul className="text-xs list-disc pl-5 text-muted-foreground">
                                                    {shipment.items.map((item, itemIndex) => (
                                                        <li key={itemIndex}>{item.name}</li>
                                                    ))}
                                                </ul>
                                                {shipment.path ? (
                                                    <>
                                                        <p><strong>Direct Distance:</strong> {shipment.path.distance.toFixed(2)} km</p>
                                                        <p><strong>Direct Path:</strong> <span className="font-code text-xs">{shipment.path.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                                                    </>
                                                ) : <p className="text-destructive-foreground">No path found.</p>}
                                            </div>
                                        ))}
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-muted-foreground pl-4">No orders with items to ship.</p>
                            )}
                        </div>
                        
                        <div className="p-4 bg-muted/50 rounded-lg border">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Truck size={16}/> Strategy 2: Prioritize Efficiency (The Local Delivery Model)</h4>
                            <p className="text-xs text-muted-foreground mb-3">This model's goal is to use as few trucks as possible. A single truck serves all orders. It starts at the central depot, visits warehouses to pick up everything for everyone, delivers to all customers on an optimized route, and finally returns to the depot.
                            </p>
                            
                            <div className="space-y-3">
                                <h5 className="font-semibold flex items-center gap-2"><Warehouse size={16}/> Central Pickup Manifest:</h5>
                                {Object.keys(combinedResult.warehouseManifest).length > 0 ? (
                                    Object.entries(combinedResult.warehouseManifest).map(([whId, items]) => (
                                        <div key={whId} className="pl-4 border-l-2 ml-2">
                                            <p className="font-medium text-primary">{nodeMap.get(whId)?.name}</p>
                                            <ul className="text-xs list-disc pl-5 text-muted-foreground">
                                                {items.map((item, index) => (
                                                    <li key={index}>
                                                        Pick up <span className="font-semibold">{item.productName}</span> for order <span className="font-semibold text-primary/80">{item.orderId}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground pl-4">No warehouses to visit for this batch.</p>
                                )}
                            </div>
                            
                            <Separator className="my-4"/>

                            {combinedResult.consolidatedTspResult ? (
                                <div className="space-y-2">
                                    <p><strong>Total Consolidated Distance:</strong> {combinedResult.consolidatedTspResult.distance.toFixed(2)} km</p>
                                    <p><strong>Optimized Route for One Truck:</strong> <span className="font-code">{combinedResult.consolidatedTspResult.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                                </div>
                            ) : <p>Not enough stops for a TSP route.</p>}
                        </div>

                         <div className="p-4 bg-green-50/50 rounded-lg border border-green-200">
                            <h4 className="font-bold mb-2 flex items-center gap-2 text-green-800"><Package size={16}/> Strategy 3: Hybrid Batching by Warehouse</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                                This hybrid model dispatches a separate truck from each required warehouse. Each truck picks up all items from its home base and runs an optimized mini-route to deliver only to its assigned customers before returning.
                            </p>
                            {combinedResult.warehouseBatchResults.map((batch, index) => (
                                <div key={index} className="p-3 bg-white rounded-md border mb-3">
                                    <p className="font-bold text-primary flex items-center gap-2 mb-2"><Warehouse size={14}/> Batch from <span className="text-green-800">{batch.warehouseName}</span></p>
                                     <div className="pl-4 border-l-2 ml-2 mb-3 space-y-1 border-green-300">
                                         <h5 className="font-semibold">Pickup Manifest:</h5>
                                         <ul className="text-xs list-disc pl-5 text-muted-foreground">
                                            {batch.items.map((item, itemIndex) => (
                                                <li key={itemIndex}>
                                                    <span className="font-semibold">{item.productName}</span> for <span className="font-semibold text-primary/80">{item.orderId}</span> (to {nodeMap.get(item.customerAddress)?.name})
                                                </li>
                                            ))}
                                        </ul>
                                        {batch.route ? (
                                             <div className="pt-2">
                                                <p><strong>Mini-Route Distance:</strong> {batch.route.distance.toFixed(2)} km</p>
                                                <p><strong>Mini-Route Path:</strong> <span className="font-code text-xs">{batch.route.path.map(id => nodeMap.get(id)?.name).join(' -> ')}</span></p>
                                            </div>
                                        ) : <p className="text-destructive-foreground">Not enough stops for a route.</p>}
                                    </div>
                                </div>
                            ))}
                        </div>


                         <div className="p-4 bg-muted/50 rounded-lg border">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Info size={16}/> Standalone Network Analysis</h4>
                            <p className="text-xs text-muted-foreground mb-4">This is a separate, theoretical calculation for network planning, focusing only on the roads connected to your main order. It helps find bottlenecks.</p>
                            <div >
                                <h5 className="font-semibold flex items-center gap-2"><Zap size={16}/> Your Delivery Capacity (Max-Flow)</h5>
                                {combinedResult.maxFlowToFirstCustomer !== null ? (
                                    <>
                                        <p>This shows the maximum number of packages that could possibly be moved between the closest warehouse and your address per hour, if all roads were used optimally.</p>
                                        <p><strong>Max Capacity:</strong> {combinedResult.maxFlowToFirstCustomer} packages/hour</p>
                                    </>
                                ) : <p>Your cart is empty. No capacity to calculate.</p>}
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

    