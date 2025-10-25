"use client";

import AlgorithmVisualizer from '@/components/AlgorithmVisualizer';

export default function CheckoutPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold font-headline">Delivery Optimization</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          See how we use advanced algorithms to find the best delivery routes for your order.
        </p>
      </div>
      <AlgorithmVisualizer />
    </div>
  );
}
