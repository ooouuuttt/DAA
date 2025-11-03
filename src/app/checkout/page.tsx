"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { nodes as allNodes, edges as initialEdges, nodeMap } from '@/lib/graph';
import DummyMap from '@/components/DummyMap';
import { dijkstra } from '@/lib/algorithms/dijkstra';
import { solveTsp } from '@/lib/algorithms/tsp';
import { edmondsKarp } from '@/lib/algorithms/max-flow';
import { useCart } from '@/context/CartContext';
import { Route, Truck, Zap, Combine, Warehouse, Info, Package, Split, User, Eye, RefreshCw, AlertTriangle, BrainCircuit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { Product } from '@/lib/products';
import { OrderCreator, type SimulatedOrder } from '@/components/OrderCreator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { forecastDemand, predictDeliveryTimes, proposeOptimizedRoute } from '@/ai/flows/logistics-flow';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { z } from 'zod';


// AI-related schemas, moved from the flow file
export const StockRebalanceSchema = z.object({
  productName: z.string().describe('The name of the product to be moved.'),
  fromWarehouseId: z.string().describe('The ID of the warehouse to move stock from.'),
  toWarehouseId: z.string().describe('The ID of the warehouse to move stock to.'),
  reason: z.string().describe('A brief explanation for why this stock movement is recommended.'),
});
export type StockRebalance = z.infer<typeof StockRebalanceSchema>;

export const DeliveryPredictionSchema = z.object({
  strategyId: z.string(),
  predictedTime: z.number().describe('The AI-predicted delivery time in hours, considering all factors.'),
  simpleTime: z.number().describe('A simple time calculation based only on distance (distance / 50 kph).'),
});
export type DeliveryPrediction = z.infer<typeof DeliveryPredictionSchema>;

const ProposedTruckRouteSchema = z.object({
    truckId: z.string(),
    startWarehouseId: z.string(),
    pickupWarehouseIds: z.array(z.string()),
    deliveryCustomerIds: z.array(z.string()),
});
const ProposeOptimizedRouteOutputSchema = z.object({
    commentary: z.string(),
    truckRoutes: z.array(ProposedTruckRouteSchema),
});
export type AIProposedRouteResult = z.infer<typeof ProposeOptimizedRouteOutputSchema>;

type AIOptimizedRoute = {
    commentary: string;
    totalCost: number;
    trucks: {
        id: string;
        route: TspResult;
        cost: number;
    }[];
};


const COST_PER_KM = 1.5; // $1.50 per kilometer
const COST_PER_TRUCK = 50; // $50 fixed cost per truck dispatched
const TRUCK_CAPACITY = 10; // Max 10 items per truck

type DijkstraResult = { path: string[]; distance: number } | null;
type TspResult = { path:string[]; distance: number } | null;
type MaxFlowResult = number | null;

type SplitShipment = {
    warehouseId: string;
    warehouseName: string;
    path: DijkstraResult;
    items: Product[];
    cost: number;
}

type OrderShipments = {
  orderId: string;
  address: string;
  shipments: SplitShipment[];
  totalCost: number;
}

type WarehouseBatchResult = {
    warehouseId: string;
    warehouseName: string;
    routes: {
        truck: number;
        route: TspResult;
        customers: string[];
        items: { productName: string; orderId: string; customerAddress: string; }[];
        cost: number;
    }[];
    totalCost: number;
};

type ConsolidatedTspResult = {
    route: TspResult;
    cost: number;
}

type CombinedResult = {
  // Strategy 1
  allOrderShipments: OrderShipments[];
  totalCostStrategy1: number;
  // Strategy 2
  consolidatedTspResult: ConsolidatedTspResult | null;
  requiredWarehousesForTsp: string[];
  deliveryAddressesForTsp: { address: string, timeWindow: SimulatedOrder['timeWindow'] }[];
  warehouseManifest: Record<string, {productName: string, orderId: string}[]>;
  // Strategy 3
  warehouseBatchResults: WarehouseBatchResult[];
  totalCostStrategy3: number;
  // Standalone Analysis
  maxFlowToFirstCustomer: MaxFlowResult;
};

export default function CheckoutPage() {
  const { items: mainUserCart, clearCart: clearMainUserCart } = useCart();
  
  const [mainUserOrder, setMainUserOrder] = useState<SimulatedOrder>({
    id: 'you',
    address: 'loc10',
    items: mainUserCart,
    timeWindow: 'any',
  });

  const [otherOrders, setOtherOrders] = useState<SimulatedOrder[]>([]);
  const [combinedResult, setCombinedResult] = useState<CombinedResult | null>(null);
  const [activeMap, setActiveMap] = useState<{ id: string } | null>(null);
  const [currentEdges, setCurrentEdges] = useState(initialEdges);
  const [isTrafficSimulated, setIsTrafficSimulated] = useState(false);

  const [stockRebalance, setStockRebalance] = useState<StockRebalance[] | null>(null);
  const [deliveryPredictions, setDeliveryPredictions] = useState<DeliveryPrediction[] | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  const [aiOptimizedRoute, setAiOptimizedRoute] = useState<AIOptimizedRoute | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);


  // Update main user's order when their cart changes
  useEffect(() => {
    setMainUserOrder(prev => ({...prev, items: mainUserCart}));
  }, [mainUserCart]);

  const allSimulatedOrders = useMemo(() => [mainUserOrder, ...otherOrders], [mainUserOrder, otherOrders]);

  const simulateTraffic = () => {
    const newEdges = initialEdges.map(edge => {
        // Randomly select ~30% of edges to apply traffic to
        if (Math.random() < 0.3) {
            return { ...edge, weight: edge.weight * (1.5 + Math.random() * 2) }; // Increase weight by 50% to 250%
        }
        return edge;
    });
    setCurrentEdges(newEdges);
    setIsTrafficSimulated(true);
  };

  const resetTraffic = () => {
    setCurrentEdges(initialEdges);
    setIsTrafficSimulated(false);
  };

  const runCombinedOptimization = () => {
    if (allSimulatedOrders.every(o => o.items.length === 0)) {
      setCombinedResult(null);
      return;
    }
    
    const activeOrders = allSimulatedOrders.filter(order => order.items.length > 0);

    // --- Strategy 1: Prioritize Speed (The Amazon Model) ---
    let totalCostStrategy1 = 0;
    const allOrderShipments: OrderShipments[] = activeOrders.map(order => {
        const itemsByWarehouse: Record<string, Product[]> = {};
        order.items.forEach(item => {
            if (!itemsByWarehouse[item.warehouseId]) itemsByWarehouse[item.warehouseId] = [];
            itemsByWarehouse[item.warehouseId].push(item);
        });

        const shipments: SplitShipment[] = Object.entries(itemsByWarehouse).map(([warehouseId, items]) => {
            const path = dijkstra(allNodes, currentEdges, warehouseId, order.address);
            const cost = path ? (path.distance * COST_PER_KM) + COST_PER_TRUCK : 0;
            return {
                warehouseId,
                warehouseName: nodeMap.get(warehouseId)?.name || 'Unknown Warehouse',
                path,
                items,
                cost
            };
        });
        const totalCost = shipments.reduce((acc, s) => acc + s.cost, 0);
        totalCostStrategy1 += totalCost;
        return { orderId: order.id, address: order.address, shipments, totalCost };
    });

    // --- Strategy 2: Prioritize Efficiency (The Local Delivery Model) ---
    const allRequiredWarehousesForTsp = new Set<string>();
    const warehouseManifest: CombinedResult['warehouseManifest'] = {};

    activeOrders.forEach(order => {
      order.items.forEach(item => {
        allRequiredWarehousesForTsp.add(item.warehouseId);
        if (!warehouseManifest[item.warehouseId]) warehouseManifest[item.warehouseId] = [];
        warehouseManifest[item.warehouseId].push({ productName: item.name, orderId: order.id });
      });
    });

    const allDeliveryAddressesForTsp = activeOrders.map(o => ({ address: o.address, timeWindow: o.timeWindow }));
    const consolidatedTspRoute = solveTsp(allNodes, currentEdges, 'warehouse-a', Array.from(allRequiredWarehousesForTsp), allDeliveryAddressesForTsp);
    const consolidatedTspResult: ConsolidatedTspResult | null = consolidatedTspRoute ? {
        route: consolidatedTspRoute,
        cost: (consolidatedTspRoute.distance * COST_PER_KM) + COST_PER_TRUCK,
    } : null;
    
    // --- Strategy 3: Warehouse-Based Batching ---
    let totalCostStrategy3 = 0;
    const itemsByWarehouseForBatching: Record<string, { product: Product; order: SimulatedOrder }[]> = {};
    activeOrders.forEach(order => {
        order.items.forEach(item => {
            if (!itemsByWarehouseForBatching[item.warehouseId]) itemsByWarehouseForBatching[item.warehouseId] = [];
            itemsByWarehouseForBatching[item.warehouseId].push({ product: item, order: order });
        });
    });

    const warehouseBatchResults: WarehouseBatchResult[] = Object.entries(itemsByWarehouseForBatching).map(([warehouseId, ordersAndItems]) => {
        const totalItems = ordersAndItems.length;
        const numTrucks = Math.ceil(totalItems / TRUCK_CAPACITY);
        const routes = [];
        let itemsForTrucks = [...ordersAndItems];
        let truckTotalCost = 0;

        for (let i = 0; i < numTrucks; i++) {
            const truckItems = itemsForTrucks.splice(0, TRUCK_CAPACITY);
            const customerDestinations = [...new Set(truckItems.map(oi => oi.order.address))].map(address => {
                const order = truckItems.find(oi => oi.order.address === address)!.order;
                return { address, timeWindow: order.timeWindow };
            });

            const route = solveTsp(allNodes, currentEdges, warehouseId, [], customerDestinations);
            const cost = route ? (route.distance * COST_PER_KM) + COST_PER_TRUCK : 0;
            truckTotalCost += cost;

            routes.push({
                truck: i + 1,
                route,
                customers: customerDestinations.map(c => c.address),
                items: truckItems.map(oi => ({
                    productName: oi.product.name,
                    orderId: oi.order.id,
                    customerAddress: oi.order.address,
                })),
                cost,
            });
        }
        totalCostStrategy3 += truckTotalCost;
        return {
            warehouseId,
            warehouseName: nodeMap.get(warehouseId)?.name || 'Unknown Warehouse',
            routes,
            totalCost: truckTotalCost,
        };
    });


    // --- Standalone Analysis (Max-Flow for the main user only) ---
    let nearestWarehouseForMaxFlow = '';
    let minDistance = Infinity;
    const userWarehouses = new Set(mainUserOrder.items.map(item => item.warehouseId));
    if (userWarehouses.size > 0) {
        userWarehouses.forEach(wh => {
            const path = dijkstra(allNodes, currentEdges, wh, mainUserOrder.address);
            if (path && path.distance < minDistance) {
                minDistance = path.distance;
                nearestWarehouseForMaxFlow = wh;
            }
        });
    }
    const maxFlowToFirstCustomer = nearestWarehouseForMaxFlow ? edmondsKarp(allNodes, currentEdges, nearestWarehouseForMaxFlow, mainUserOrder.address) : null;
    
    setCombinedResult({
      allOrderShipments,
      totalCostStrategy1,
      consolidatedTspResult,
      requiredWarehousesForTsp: Array.from(allRequiredWarehousesForTsp),
      deliveryAddressesForTsp: allDeliveryAddressesForTsp,
      warehouseManifest,
      warehouseBatchResults,
      totalCostStrategy3,
      maxFlowToFirstCustomer,
    });
    // Default map view
    if (consolidatedTspResult?.route) {
        setActiveMap({ id: 'strategy-2' });
    } else if (warehouseBatchResults[0]?.routes[0]?.route) {
        const batch = warehouseBatchResults[0];
        const truckRoute = batch.routes[0];
        setActiveMap({id: `strategy-3-${batch.warehouseId}-${truckRoute.truck}`})
    }
  };
  
  // Re-run simulation if traffic changes
  useEffect(() => {
    if (combinedResult) {
      runCombinedOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEdges]);

  const resetSimulation = () => {
    clearMainUserCart();
    setOtherOrders([]);
    setCombinedResult(null);
    resetTraffic();
    setStockRebalance(null);
    setDeliveryPredictions(null);
    setAiOptimizedRoute(null);
  };
  
  const handleForecastDemand = async () => {
    setIsForecasting(true);
    setStockRebalance(null);
    try {
        const ordersForAI = allSimulatedOrders
          .filter(o => o.items.length > 0)
          .map(o => ({
            orderId: o.id,
            customerLocationId: o.address,
            products: o.items.map(i => ({ productId: i.id, name: i.name, warehouseId: i.warehouseId })),
            timeWindow: o.timeWindow
        }));
        const warehouseInfo = allNodes.filter(n => n.id.startsWith('warehouse')).map(w => ({
            warehouseId: w.id,
            name: w.name
        }));
        const result = await forecastDemand({ orders: ordersForAI, warehouses: warehouseInfo });
        setStockRebalance(result);
    } catch (e) {
        console.error("Error forecasting demand:", e);
    } finally {
        setIsForecasting(false);
    }
  };

  const handlePredictDeliveryTimes = async () => {
      if (!combinedResult) return;
      setIsPredicting(true);
      setDeliveryPredictions(null);
      try {
          const predictionInputs = [];
          
          if (combinedResult.consolidatedTspResult?.route) {
              predictionInputs.push({
                  strategyId: 'Strategy 2',
                  distance: combinedResult.consolidatedTspResult.route.distance,
                  stops: combinedResult.deliveryAddressesForTsp.length,
                  trafficScore: isTrafficSimulated ? Math.random() * 50 + 50 : Math.random() * 50,
              });
          }

          combinedResult.warehouseBatchResults.forEach(batch => {
              batch.routes.forEach(truckRoute => {
                  if (truckRoute.route) {
                      predictionInputs.push({
                          strategyId: `Strategy 3: ${batch.warehouseName} Truck ${truckRoute.truck}`,
                          distance: truckRoute.route.distance,
                          stops: truckRoute.customers.length,
                          trafficScore: isTrafficSimulated ? Math.random() * 50 + 50 : Math.random() * 50,
                      });
                  }
              });
          });
          
          const result = await predictDeliveryTimes({ routes: predictionInputs });
          setDeliveryPredictions(result);

      } catch (e) {
          console.error("Error predicting delivery times:", e);
      } finally {
          setIsPredicting(false);
      }
  };

  const handleGenerateAiRoute = async () => {
    if (allSimulatedOrders.every(o => o.items.length === 0)) return;
    setIsOptimizing(true);
    setAiOptimizedRoute(null);
    try {
        const activeOrders = allSimulatedOrders
          .filter(o => o.items.length > 0)
          .map(o => ({
            orderId: o.id,
            customerLocationId: o.address,
            products: o.items.map(i => ({ productId: i.id, name: i.name, warehouseId: i.warehouseId })),
            timeWindow: o.timeWindow
        }));

        const warehouseNodes = allNodes.filter(n => n.id.startsWith('warehouse'));

        const aiResult = await proposeOptimizedRoute({
            orders: activeOrders,
            warehouses: warehouseNodes,
            nodes: allNodes,
            edges: currentEdges,
            truckCapacity: TRUCK_CAPACITY,
        });

        // Post-process the AI's proposal to calculate paths and costs
        let totalCost = 0;
        const processedTrucks = aiResult.truckRoutes.map(truckPlan => {
            const route = solveTsp(
                allNodes, 
                currentEdges, 
                truckPlan.startWarehouseId, 
                truckPlan.pickupWarehouseIds, 
                truckPlan.deliveryCustomerIds.map(id => ({ address: id, timeWindow: 'any' }))
            );
            const cost = route ? (route.distance * COST_PER_KM) + COST_PER_TRUCK : 0;
            totalCost += cost;
            return {
                id: truckPlan.truckId,
                route,
                cost,
            };
        });
        
        setAiOptimizedRoute({
            commentary: aiResult.commentary,
            trucks: processedTrucks,
            totalCost: totalCost,
        });

    } catch (e) {
        console.error("Error generating AI-optimized route:", e);
    } finally {
        setIsOptimizing(false);
    }
  };


  const { mapPath, mapHighlights } = useMemo(() => {
    if (!activeMap) return { mapPath: [], mapHighlights: [] };

    const { id } = activeMap;
    
    if (id === 'strategy-2' && combinedResult?.consolidatedTspResult?.route) {
        const depot = { id: 'warehouse-a', type: 'depot' as const };
        const warehouses = combinedResult.requiredWarehousesForTsp.map(wId => ({ id: wId, type: 'warehouse' as const }));
        const customers = combinedResult.deliveryAddressesForTsp.map(c => ({ id: c.address, type: 'customer' as const }));
        return {
            mapPath: combinedResult.consolidatedTspResult.route.path || [],
            mapHighlights: [depot, ...warehouses, ...customers]
        };
    }

    if (id.startsWith('strategy-3-') && combinedResult) {
        const [_, __, warehouseId, truckNum] = id.split('-');
        const batch = combinedResult.warehouseBatchResults.find(b => b.warehouseId === warehouseId);
        const truckRoute = batch?.routes.find(r => r.truck === parseInt(truckNum));
        
        if (truckRoute && truckRoute.route) {
            const warehouse = { id: batch.warehouseId, type: 'warehouse' as const };
            const customers = truckRoute.customers.map(cId => ({ id: cId, type: 'customer' as const }));
            return {
                mapPath: truckRoute.route.path,
                mapHighlights: [warehouse, ...customers]
            };
        }
    }

    if (id.startsWith('strategy-4-') && aiOptimizedRoute) {
        const truckId = id.substring('strategy-4-'.length);
        const truck = aiOptimizedRoute.trucks.find(t => t.id === truckId);
        if (truck?.route) {
            const startWH = { id: truck.route.path[0], type: 'warehouse' as const };
            const customers = truck.route.path.filter(p => p.startsWith('loc')).map(cId => ({ id: cId, type: 'customer' as const }));
            const pickups = truck.route.path.filter((p, i) => i > 0 && p.startsWith('warehouse')).map(wId => ({ id: wId, type: 'warehouse' as const }));
            return {
                mapPath: truck.route.path,
                mapHighlights: [startWH, ...pickups, ...customers]
            }
        }
    }
    
    return { mapPath: [], mapHighlights: [] };

  }, [combinedResult, activeMap, aiOptimizedRoute]);

  const renderPath = (path: string[], customerLocations: string[] = []) => {
    return (
      <span className="font-code text-xs">
        {path.map((id, index) => {
            const name = nodeMap.get(id)?.name || id;
            const isCustomer = customerLocations.includes(id);
            const isWarehouse = id.startsWith('warehouse');

            let nameEl;
            if (isCustomer) {
                nameEl = <span className="text-green-600 font-bold">{name}</span>;
            } else if (isWarehouse) {
                nameEl = <span className="font-medium">{name}</span>;
            } else {
                nameEl = <span className="text-muted-foreground">{name}</span>;
            }

            return <React.Fragment key={index}>{nameEl}{index < path.length - 1 ? <span className="text-muted-foreground/50"> -> </span> : ''}</React.Fragment>;
        })}
      </span>
    );
  };

  const deliveryPredictionChartData = useMemo(() => {
    if (!deliveryPredictions) return [];
    return deliveryPredictions.map(p => ({
      name: p.strategyId,
      'Predicted Time (AI)': p.predictedTime,
      'Simple Time (Distance-based)': p.simpleTime,
    }));
  }, [deliveryPredictions]);

  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-4xl font-bold font-headline">Logistics Control Panel</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Simulate delivery strategies and generate AI-powered predictive insights.
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
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={runCombinedOptimization} className="w-full" disabled={allSimulatedOrders.every(o => o.items.length === 0)}>
                <Combine className="mr-2"/> Run Simulation
              </Button>
               <Button onClick={resetSimulation} variant="outline" className="w-full">
                Reset All
              </Button>
               <Button onClick={simulateTraffic} variant="secondary" className="w-full" disabled={isTrafficSimulated}>
                <AlertTriangle className="mr-2"/> Simulate Traffic
              </Button>
               <Button onClick={resetTraffic} variant="destructive" className="w-full" disabled={!isTrafficSimulated}>
                <RefreshCw className="mr-2"/> Reset Traffic
              </Button>
            </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Simulation Map</CardTitle>
                    <CardDescription>Visual representation of delivery routes. Select a strategy below to see its path on the map.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DummyMap nodes={allNodes} edges={currentEdges} highlightedPath={mapPath} highlightedNodes={mapHighlights} />
                </CardContent>
            </Card>
            {combinedResult && (
                <Tabs defaultValue="strategies" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="strategies">Strategies Comparison</TabsTrigger>
                        <TabsTrigger value="ai">
                            <BrainCircuit className="mr-2" /> AI Insights
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="strategies">
                      <Card>
                          <CardHeader>
                              <CardTitle>Optimization Results: A Tale of Strategies</CardTitle>
                              <CardDescription>Costs are based on ${COST_PER_KM.toFixed(2)}/km and a ${COST_PER_TRUCK.toFixed(2)} fixed cost per truck.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6 text-sm">
                              <RadioGroup value={activeMap?.id} onValueChange={(id) => setActiveMap({ id })} className="gap-6">
                                  <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <h4 className="font-bold mb-2 flex items-center gap-2 text-blue-800"><Split size={16}/> Strategy 1: Prioritize Speed</h4>
                                              <p className="text-xs text-muted-foreground mb-3 pr-4">
                                                  Each customer's order is split into multiple shipments to get items to them as fast as possible. This is expensive but offers maximum speed.
                                              </p>
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                              <p className="font-bold text-lg text-blue-900">${combinedResult.totalCostStrategy1.toFixed(2)}</p>
                                              <p className="text-xs text-muted-foreground">Total Cost</p>
                                          </div>
                                      </div>
                                      
                                      {combinedResult.allOrderShipments.length > 0 ? (
                                          combinedResult.allOrderShipments.map((order, orderIndex) => (
                                              <div key={orderIndex} className="p-3 bg-white rounded-md border mb-3">
                                                  <p className="font-bold text-primary flex items-center gap-2 mb-2"><User size={14}/> Order for <span className="text-blue-800">{order.id}</span> to <span className="text-blue-800">{nodeMap.get(order.address)?.name}</span></p>
                                                  {order.shipments.map((shipment, index) => (
                                                      <div key={index} className="pl-4 border-l-2 ml-2 mb-3 space-y-1 border-blue-300">
                                                          <div className="flex justify-between items-center">
                                                              <p className="font-medium text-primary">Shipment from {shipment.warehouseName}</p>
                                                              <p className="font-semibold text-xs">${shipment.cost.toFixed(2)}</p>
                                                          </div>
                                                          <ul className="text-xs list-disc pl-5 text-muted-foreground">
                                                              {shipment.items.map((item, itemIndex) => (
                                                                  <li key={itemIndex}>{item.name}</li>
                                                              ))}
                                                          </ul>
                                                          {shipment.path ? (
                                                              <>
                                                                  <p><strong>Direct Distance:</strong> {shipment.path.distance.toFixed(2)} km</p>
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
                                      <div className="flex items-center justify-between mb-2">
                                          <h4 className="font-bold flex items-center gap-2"><Truck size={16}/> Strategy 2: Max Efficiency</h4>
                                          <div className="flex items-center space-x-2">
                                              <RadioGroupItem value="strategy-2" id="map-strat-2" />
                                              <Label htmlFor="map-strat-2" className="text-xs flex items-center gap-1.5 cursor-pointer"><Eye size={14}/> View on Map</Label>
                                          </div>
                                      </div>
                                      <div className="flex justify-between items-start">
                                          <p className="text-xs text-muted-foreground mb-3 pr-4">A single truck serves all orders. It starts at the central depot, visits warehouses to pick up everything, then delivers to all customers.</p>
                                          <div className="text-right flex-shrink-0">
                                              <p className="font-bold text-lg">${combinedResult.consolidatedTspResult?.cost.toFixed(2) ?? '0.00'}</p>
                                              <p className="text-xs text-muted-foreground">Total Cost</p>
                                          </div>
                                      </div>
                                      
                                      <Separator className="my-4"/>

                                      {combinedResult.consolidatedTspResult?.route ? (
                                          <div className="space-y-2">
                                              <p><strong>Total Consolidated Distance:</strong> {combinedResult.consolidatedTspResult.route.distance.toFixed(2)} km</p>
                                              <p><strong>Optimized Route for One Truck:</strong> {renderPath(combinedResult.consolidatedTspResult.route.path, combinedResult.deliveryAddressesForTsp.map(c=>c.address))}</p>
                                          </div>
                                      ) : <p>Not enough stops for a TSP route.</p>}
                                  </div>

                                  <div className="p-4 bg-green-50/50 rounded-lg border border-green-200">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <h4 className="font-bold mb-2 flex items-center gap-2 text-green-800"><Package size={16}/> Strategy 3: Hybrid Batching</h4>
                                              <p className="text-xs text-muted-foreground mb-3 pr-4">
                                                  A separate truck is dispatched from each required warehouse. Each truck runs an optimized mini-route for its assigned customers. A great balance of speed and cost.
                                              </p>
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                              <p className="font-bold text-lg text-green-900">${combinedResult.totalCostStrategy3.toFixed(2)}</p>
                                              <p className="text-xs text-muted-foreground">Total Cost</p>
                                          </div>
                                      </div>

                                      {combinedResult.warehouseBatchResults.map((batch, index) => (
                                          <div key={index} className="p-3 bg-white rounded-md border mb-3">
                                              <div className="flex items-start justify-between mb-2">
                                                  <p className="font-bold text-primary flex items-center gap-2"><Warehouse size={14}/> Batch from <span className="text-green-800">{batch.warehouseName}</span></p>
                                                  <div className="text-right">
                                                      <p className="font-semibold text-xs">${batch.totalCost.toFixed(2)}</p>
                                                      <p className="text-xs text-muted-foreground">{batch.routes.length} truck(s)</p>
                                                  </div>
                                              </div>
                                              {batch.routes.map((truckRoute, truckIndex) => (
                                              <div key={truckIndex} className="pl-4 border-l-2 ml-2 mb-3 space-y-1 border-green-300">
                                                  <div className="flex items-center justify-between mb-2">
                                                      <p className="font-semibold text-primary/90 flex items-center gap-2"><Truck size={14}/> Truck {truckRoute.truck} Route</p>
                                                      <div className="flex items-center space-x-2">
                                                          <RadioGroupItem value={`strategy-3-${batch.warehouseId}-${truckRoute.truck}`} id={`map-strat-3-${batch.warehouseId}-${truckRoute.truck}`} />
                                                          <Label htmlFor={`map-strat-3-${batch.warehouseId}-${truckRoute.truck}`} className="text-xs flex items-center gap-1.5 cursor-pointer"><Eye size={14}/> View on Map</Label>
                                                      </div>
                                                  </div>
                                                  
                                                  {truckRoute.route ? (
                                                      <div className="pt-2">
                                                          <p><strong>Route Distance:</strong> {truckRoute.route.distance.toFixed(2)} km</p>
                                                          <p><strong>Route Path:</strong> {renderPath(truckRoute.route.path, truckRoute.customers)}</p>
                                                      </div>
                                                  ) : <p className="text-destructive-foreground">Not enough stops for a route.</p>}
                                              </div>
                                              ))}
                                          </div>
                                      ))}
                                  </div>

                                  <div className="p-4 bg-purple-50/50 rounded-lg border border-purple-200">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold mb-2 flex items-center gap-2 text-purple-800"><BrainCircuit size={16}/> Strategy 4: AI Optimized Route</h4>
                                                <p className="text-xs text-muted-foreground mb-3 pr-4">
                                                    Let a generative AI create a custom, cost-effective delivery plan from scratch, potentially finding novel efficiencies.
                                                </p>
                                            </div>
                                            {aiOptimizedRoute && (
                                                <div className="text-right flex-shrink-0">
                                                    <p className="font-bold text-lg text-purple-900">${aiOptimizedRoute.totalCost.toFixed(2)}</p>
                                                    <p className="text-xs text-muted-foreground">Total Cost</p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {!aiOptimizedRoute ? (
                                            <Button onClick={handleGenerateAiRoute} disabled={isOptimizing} size="sm">
                                                {isOptimizing ? 'Optimizing...' : 'Generate AI Optimized Route'}
                                            </Button>
                                        ) : (
                                            <div>
                                                <p className="text-xs italic text-purple-900/80 p-3 bg-purple-100 rounded-md">"{aiOptimizedRoute.commentary}"</p>
                                                {aiOptimizedRoute.trucks.map(truck => (
                                                    <div key={truck.id} className="p-3 bg-white rounded-md border mt-3">
                                                         <div className="flex items-center justify-between mb-2">
                                                            <p className="font-semibold text-primary/90 flex items-center gap-2"><Truck size={14}/> {truck.id} Route</p>
                                                            <div className="flex items-center space-x-2">
                                                                <RadioGroupItem value={`strategy-4-${truck.id}`} id={`map-strat-4-${truck.id}`} />
                                                                <Label htmlFor={`map-strat-4-${truck.id}`} className="text-xs flex items-center gap-1.5 cursor-pointer"><Eye size={14}/> View on Map</Label>
                                                            </div>
                                                        </div>
                                                        {truck.route ? (
                                                            <div className="pt-2 pl-6">
                                                                <p><strong>Route Distance:</strong> {truck.route.distance.toFixed(2)} km</p>
                                                                <p><strong>Route Path:</strong> {renderPath(truck.route.path, truck.route.path.filter(p => p.startsWith('loc')))}</p>
                                                            </div>
                                                        ) : <p className="text-destructive-foreground pl-6">AI could not form a valid route.</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                  </div>

                              </RadioGroup>

                              <div className="p-4 bg-muted/50 rounded-lg border">
                                  <h4 className="font-bold mb-2 flex items-center gap-2"><Info size={16}/> Standalone Network Analysis</h4>
                                  <p className="text-xs text-muted-foreground mb-4">A theoretical calculation for network planning, focusing only on the roads for *your* order. It helps find bottlenecks.</p>
                                  <div >
                                      <h5 className="font-semibold flex items-center gap-2"><Zap size={16}/> Your Delivery Capacity (Max-Flow)</h5>
                                      {combinedResult.maxFlowToFirstCustomer !== null ? (
                                          <>
                                              <p>The shows the maximum number of packages that could be moved between the closest warehouse and your address per hour, if all roads were used optimally.</p>
                                              <p><strong>Max Capacity:</strong> {combinedResult.maxFlowToFirstCustomer} packages/hour</p>
                                          </>
                                      ) : <p>Your cart is empty. No capacity to calculate.</p>}
                                  </div>
                              </div>
                          </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="ai">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BrainCircuit /> AI Predictive Insights</CardTitle>
                                <CardDescription>Use generative AI to forecast future demand and predict delivery outcomes based on the current simulation state.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold">Demand Forecasting & Stock Rebalancing</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Analyze the current order batch to predict future product demand in different regions. The AI will recommend moving stock to warehouses closer to predicted demand hotspots to improve future efficiency.
                                    </p>
                                    <Button onClick={handleForecastDemand} disabled={isForecasting || allSimulatedOrders.every(o => o.items.length === 0)}>
                                        {isForecasting ? 'Forecasting...' : 'Generate Demand Forecast'}
                                    </Button>
                                    {stockRebalance && (
                                      <div className="mt-4">
                                        <h4 className="font-medium mb-2">Recommended Stock Movements:</h4>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Product</TableHead>
                                              <TableHead>Move From</TableHead>
                                              <TableHead>Move To</TableHead>
                                              <TableHead>Reason</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {stockRebalance.map((item, index) => (
                                              <TableRow key={index}>
                                                <TableCell className="font-medium">{item.productName}</TableCell>
                                                <TableCell>{nodeMap.get(item.fromWarehouseId)?.name}</TableCell>
                                                <TableCell>{nodeMap.get(item.toWarehouseId)?.name}</TableCell>
                                                <TableCell className="text-xs">{item.reason}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                </div>

                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold">Predictive Delivery Time Estimation</h3>
                                    <p className="text-sm text-muted-foreground">
                                       Let the AI estimate the delivery duration for complex routes, considering factors like distance, number of stops, and simulated traffic.
                                    </p>
                                    <Button onClick={handlePredictDeliveryTimes} disabled={isPredicting || !combinedResult}>
                                        {isPredicting ? 'Predicting...' : 'Predict Delivery Times'}
                                    </Button>

                                    {deliveryPredictions && (
                                        <div className="mt-4 h-[250px]">
                                          <h4 className="font-medium mb-2">Delivery Time Predictions (Hours):</h4>
                                           <ResponsiveContainer width="100%" height="100%">
                                             <BarChart data={deliveryPredictionChartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" fontSize={10} interval={0} angle={-40} textAnchor="end" height={60} />
                                                <YAxis />
                                                <RechartsTooltip contentStyle={{ fontSize: '12px', borderRadius: '0.5rem' }}/>
                                                <Legend wrapperStyle={{ fontSize: '12px' }}/>
                                                <Bar dataKey="Predicted Time (AI)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="Simple Time (Distance-based)" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
      </div>
    </div>
  );
}
