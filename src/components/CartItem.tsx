"use client";

import Image from 'next/image';
import type { CartItem as CartItemType } from '@/context/CartContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Minus } from 'lucide-react';

interface CartItemProps {
  item: CartItemType;
}

export default function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();

  const handleQuantityChange = (newQuantity: number) => {
    updateQuantity(item.id, newQuantity);
  };

  return (
    <li className="flex items-center p-4">
      <div className="relative h-24 w-24 rounded-md overflow-hidden">
        <Image
          src={item.image.src}
          alt={item.name}
          fill
          className="object-cover"
          sizes="96px"
          data-ai-hint={item.image.hint}
        />
      </div>
      <div className="ml-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold">{item.name}</h3>
          <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
        </div>
        <div className="flex items-center mt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleQuantityChange(item.quantity - 1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            className="h-8 w-14 text-center mx-2"
            value={item.quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 0)}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleQuantityChange(item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="ml-4 flex flex-col items-end justify-between self-stretch">
        <p className="font-bold">${(item.price * item.quantity).toFixed(2)}</p>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => removeItem(item.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
