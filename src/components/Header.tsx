"use client";

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import Logo from './Logo';

export default function Header() {
  const { totalItems } = useCart();

  return (
    <header className="bg-card border-b sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Logo />
        <nav>
          <Button asChild variant="ghost" className="relative">
            <Link href="/cart">
              <ShoppingCart className="h-6 w-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {totalItems}
                </span>
              )}
              <span className="sr-only">Shopping Cart</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
