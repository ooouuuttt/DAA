'use server';
/**
 * @fileOverview AI flows for logistics and supply chain optimization.
 *
 * - forecastDemand - Predicts future product demand and suggests stock rebalancing.
 * - predictDeliveryTimes - Estimates delivery durations for routes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Schema for a single order used as input for the AI
const OrderSchema = z.object({
  orderId: z.string(),
  customerLocationId: z.string().describe('The ID of the customer location node.'),
  products: z.array(z.object({
    productId: z.string(),
    name: z.string(),
  })),
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
  return await forecastDemandFlow(input);
}

// The Genkit prompt for demand forecasting
const forecastDemandPrompt = ai.definePrompt({
    name: 'forecastDemandPrompt',
    input: { schema: ForecastDemandInputSchema },
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
    inputSchema: ForecastDemandInputSchema,
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
