"use client";

import Image from 'next/image';
import type { Product } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlusCircle, Warehouse } from 'lucide-react';
import { nodeMap } from '@/lib/graph';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const warehouseName = nodeMap.get(product.warehouseId)?.name || 'Unknown Warehouse';

  return (
    <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="aspect-square w-full relative">
          <Image
            src={product.image.src}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            data-ai-hint={product.image.hint}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-headline mb-1">{product.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </CardDescription>
      </CardContent>
      <CardFooter className="p-4 flex flex-col items-start gap-4">
        <div className="flex justify-between items-center w-full">
            <p className="text-lg font-bold text-primary">
            ${product.price.toFixed(2)}
            </p>
            <Button size="sm" onClick={() => addItem(product)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add to Cart
            </Button>
        </div>
         <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Warehouse className="w-3.5 h-3.5" />
            Ships from {warehouseName}
        </div>
      </CardFooter>
    </Card>
  );
}
