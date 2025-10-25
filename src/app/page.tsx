"use client";

import type { Product } from '@/lib/products';
import { products } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  return (
    <div>
      <h1 className="text-4xl font-headline font-bold mb-8">
        Explore Our Products
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {products.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
