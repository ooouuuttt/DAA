'use server';
/**
 * @fileOverview AI flows for logistics and supply chain optimization.
 *
 * - forecastDemand - Predicts future product demand and suggests stock rebalancing.
 * - predictDeliveryTimes - Estimates delivery durations for routes.
 * - proposeOptimizedRoute - Creates a novel, cost-effective delivery plan from scratch.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Edge, Node } from '@/lib/graph';

// Schema for a single order used as input for the AI
const OrderSchema = z.object({
  orderId: z.string(),
  customerLocationId: z.string().describe('The ID of the customer location node.'),
  products: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    warehouseId: z.string(),
  })),
  timeWindow: z.enum(['any', 'morning', 'afternoon']),
});

// Schema for warehouse information
const WarehouseSchema = z.object({
  warehouseId: z.string(),
  name: z.string(),
});

// Input schema for the demand forecasting flow
const ForecastDemandInputSchema = z.object({
  orders: z.array(OrderSchema).describe('A list of recent or current orders.'),
  warehouses: z.array(WarehouseSchema).describe('A list of all available warehouses.'),
});

// Output schema for a single stock rebalancing suggestion
const StockRebalanceSchema = z.object({
  productName: z.string().describe('The name of the product to be moved.'),
  fromWarehouseId: z.string().describe('The ID of the warehouse to move stock from.'),
  toWarehouseId: z.string().describe('The ID of the warehouse to move stock to.'),
  reason: z.string().describe('A brief explanation for why this stock movement is recommended.'),
});

// The main function to call for demand forecasting
export async function forecastDemand(input: z.infer<typeof ForecastDemandInputSchema>): Promise<z.infer<typeof StockRebalanceSchema>[]> {
  const simplifiedOrders = input.orders.map(o => ({
      orderId: o.orderId,
      customerLocationId: o.customerLocationId,
      products: o.products.map(p => ({ productId: p.productId, name: p.name }))
  }));

  return await forecastDemandFlow({ orders: simplifiedOrders, warehouses: input.warehouses });
}

// The Genkit prompt for demand forecasting
const forecastDemandPrompt = ai.definePrompt({
    name: 'forecastDemandPrompt',
    input: { schema: z.object({
        orders: z.array(z.object({
            orderId: z.string(),
            customerLocationId: z.string(),
            products: z.array(z.object({ productId: z.string(), name: z.string()})),
        })),
        warehouses: z.array(WarehouseSchema),
    })},
    output: { schema: z.array(StockRebalanceSchema) },
    prompt: `You are a logistics and supply chain expert AI. Your task is to analyze a batch of recent orders to identify demand trends and recommend proactive stock rebalancing between warehouses.

Analyze the provided list of orders. Identify products that are frequently ordered in specific regions (customer locations).

Based on this analysis, generate a list of recommendations to move stock from a warehouse that is far from a demand hotspot to one that is closer. Provide a clear, concise reason for each recommendation, for example: "High demand for 'Product X' observed near 'Location Y', moving stock to 'Warehouse Z' for faster future deliveries."

Do not recommend moving stock from the central depot ('warehouse-a') unless it's the only source. Prioritize movements between regional warehouses if possible. Generate between 2 and 4 realistic recommendations.

Orders:
{{{json orders}}}

Warehouses:
{{{json warehouses}}}
`,
});

// The Genkit flow that orchestrates the demand forecasting
const forecastDemandFlow = ai.defineFlow(
  {
    name: 'forecastDemandFlow',
    inputSchema: z.object({
        orders: z.array(z.object({
            orderId: z.string(),
            customerLocationId: z.string(),
            products: z.array(z.object({ productId: z.string(), name: z.string()})),
        })),
        warehouses: z.array(WarehouseSchema),
    }),
    outputSchema: z.array(StockRebalanceSchema),
  },
  async (input) => {
    const { output } = await forecastDemandPrompt(input);
    return output ?? [];
  }
);


// == Delivery Time Prediction Flow ==

// Input schema for a single route to be predicted
const RoutePredictionInputSchema = z.object({
    strategyId: z.string().describe("A unique identifier for the delivery strategy or route, e.g., 'Strategy 2' or 'Strategy 3: Warehouse B Truck 1'"),
    distance: z.number().describe('Total distance of the route in kilometers.'),
    stops: z.number().describe('Number of delivery stops on the route.'),
    trafficScore: z.number().describe('A score from 0 (no traffic) to 100 (heavy traffic).'),
});

// Input schema for the delivery prediction flow
const PredictDeliveryTimesInputSchema = z.object({
  routes: z.array(RoutePredictionInputSchema),
});

// Output schema for a single delivery time prediction
const DeliveryPredictionSchema = z.object({
  strategyId: z.string(),
  predictedTime: z.number().describe('The AI-predicted delivery time in hours, considering all factors.'),
  simpleTime: z.number().describe('A simple time calculation based only on distance (distance / 50 kph).'),
});

// The main function to call for delivery time prediction
export async function predictDeliveryTimes(input: z.infer<typeof PredictDeliveryTimesInputSchema>): Promise<z.infer<typeof DeliveryPredictionSchema>[]> {
  return await predictDeliveryTimesFlow(input);
}

// The Genkit prompt for delivery time prediction
const predictDeliveryTimesPrompt = ai.definePrompt({
    name: 'predictDeliveryTimesPrompt',
    input: { schema: PredictDeliveryTimesInputSchema },
    output: { schema: z.array(DeliveryPredictionSchema) },
    prompt: `You are a logistics operations AI that predicts delivery times. For each route provided, you will calculate two values:
1.  **simpleTime**: A naive calculation assuming an average speed of 50 km/h. The formula is (distance / 50).
2.  **predictedTime**: A more realistic prediction in hours. Start with the simpleTime, then add extra time based on the number of stops (assume 10 minutes per stop) and the traffic score (a higher score means more delay; add approximately (trafficScore / 100) * simpleTime).

Return a list of predictions for all routes provided.

Routes:
{{{json routes}}}
`,
});

// The Genkit flow for delivery time prediction
const predictDeliveryTimesFlow = ai.defineFlow(
  {
    name: 'predictDeliveryTimesFlow',
    inputSchema: PredictDeliveryTimesInputSchema,
    outputSchema: z.array(DeliveryPredictionSchema),
  },
  async (input) => {
    const { output } = await predictDeliveryTimesPrompt(input);
    return output ?? [];
  }
);


// == AI-Optimized Route Proposal Flow ==

const NodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
});

const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  weight: z.number().describe('Distance or cost of traversing the edge. Higher is worse.'),
});

const ProposeOptimizedRouteInputSchema = z.object({
  orders: z.array(OrderSchema).describe('The full list of orders that need to be delivered.'),
  warehouses: z.array(NodeSchema).describe('A list of all available warehouses.'),
  nodes: z.array(NodeSchema).describe('A list of all nodes in the graph (warehouses and locations).'),
  edges: z.array(EdgeSchema).describe('A list of all edges (roads) in the graph, with current weights reflecting traffic.'),
  truckCapacity: z.number().describe('The maximum number of items a single truck can carry.'),
});

const ProposedTruckRouteSchema = z.object({
    truckId: z.string().describe("A unique name for this truck, e.g., 'Truck 1' or 'WH-B Truck'"),
    startWarehouseId: z.string().describe("The warehouse where this truck begins its journey."),
    pickupWarehouseIds: z.array(z.string()).describe("A list of *other* warehouses this truck must visit to pick up items before starting deliveries."),
    deliveryCustomerIds: z.array(z.string()).describe("A list of customer location IDs this truck will deliver to."),
});

const ProposeOptimizedRouteOutputSchema = z.object({
    commentary: z.string().describe("Your expert analysis and reasoning for the proposed plan. Explain why it's efficient."),
    truckRoutes: z.array(ProposedTruckRouteSchema),
});

export async function proposeOptimizedRoute(input: z.infer<typeof ProposeOptimizedRouteInputSchema>): Promise<z.infer<typeof ProposeOptimizedRouteOutputSchema>> {
  return await proposeOptimizedRouteFlow(input);
}

const proposeOptimizedRoutePrompt = ai.definePrompt({
    name: 'proposeOptimizedRoutePrompt',
    input: { schema: ProposeOptimizedRouteInputSchema },
    output: { schema: ProposeOptimizedRouteOutputSchema },
    prompt: `You are an elite AI logistics coordinator. Your task is to create the most cost-effective and efficient delivery plan for a given set of orders. You must consider truck capacity, warehouse locations, customer locations, and road traffic (represented by edge weights).

Analyze the orders to see which items are stored in which warehouses.
Your goal is to dispatch the minimum number of trucks and create routes that are as short as possible.

Here are some strategies to consider:
- **Consolidated Pickups:** Can one truck start at its home warehouse and swing by another nearby warehouse to pick up more items before starting its delivery route? This can save dispatching a whole other truck.
- **Geographic Clustering:** Group customer deliveries that are close to each other into a single truck route.
- **Time Windows:** Prioritize customers with 'morning' delivery windows.
- **Truck Capacity:** Do not assign more items to a truck than its capacity allows.

Based on your analysis, define a set of truck routes. For each route, specify where it starts, any other warehouses it needs to visit for pickups, and the list of customers it will serve.

Finally, provide a brief commentary explaining the logic behind your plan. For example, "I've dispatched one truck from Warehouse B and had it pick up items from Warehouse E, as they are close. This single truck can then serve all northern customers, which is more efficient than dispatching two separate trucks."

Return the plan as a list of truck routes and your commentary.

## Input Data

### Truck Capacity:
{{truckCapacity}} items per truck.

### Orders:
{{{json orders}}}

### Warehouses:
{{{json warehouses}}}

### Full Map (Nodes and Edges with current traffic weights):
Nodes: {{{json nodes}}}
Edges: {{{json edges}}}
`,
});

const proposeOptimizedRouteFlow = ai.defineFlow(
  {
    name: 'proposeOptimizedRouteFlow',
    inputSchema: ProposeOptimizedRouteInputSchema,
    outputSchema: ProposeOptimizedRouteOutputSchema,
  },
  async (input) => {
    const { output } = await proposeOptimizedRoutePrompt(input);
    if (!output) {
      throw new Error("AI failed to generate a route plan.");
    }
    return output;
  }
);
