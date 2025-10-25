"use client";

import React from 'react';
import type { Product } from '@/lib/products';
import { products } from '@/lib/products';
import type { Node } from '@/lib/graph';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, UserPlus } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from './ui/label';

export interface SimulatedOrder {
  id: string;
  address: string;
  items: Product[];
  timeWindow: 'any' | 'morning' | 'afternoon';
}

interface OrderCreatorProps {
  mainUserOrder: SimulatedOrder;
  onUpdateMainUserOrder: (order: SimulatedOrder) => void;
  otherOrders: SimulatedOrder[];
  onUpdateOtherOrders: (orders: SimulatedOrder[]) => void;
  allNodes: Node[];
}

export function OrderCreator({
  mainUserOrder,
  onUpdateMainUserOrder,
  otherOrders,
  onUpdateOtherOrders,
  allNodes,
}: OrderCreatorProps) {
  const addOtherUser = () => {
    const newUser: SimulatedOrder = {
      id: `user-${otherOrders.length + 2}`,
      address: 'loc15',
      items: [],
      timeWindow: 'any',
    };
    onUpdateOtherOrders([...otherOrders, newUser]);
  };

  const removeOtherUser = (userId: string) => {
    onUpdateOtherOrders(otherOrders.filter(order => order.id !== userId));
  };
  
  const updateOrder = (
    userId: string,
    updateFn: (order: SimulatedOrder) => SimulatedOrder
  ) => {
    if (userId === mainUserOrder.id) {
        onUpdateMainUserOrder(updateFn(mainUserOrder));
    } else {
        const updatedOrders = otherOrders.map(order =>
            order.id === userId ? updateFn(order) : order
        );
        onUpdateOtherOrders(updatedOrders);
    }
  };

  const addProductToOrder = (userId: string, productId: string) => {
    const productToAdd = products.find(p => p.id === productId);
    if (!productToAdd) return;
    
    updateOrder(userId, (order) => {
        const newItems = [...order.items, productToAdd];
        return {...order, items: newItems};
    });
  };

  const removeProductFromOrder = (userId: string, itemIndex: number) => {
     updateOrder(userId, (order) => {
        const newItems = [...order.items];
        newItems.splice(itemIndex, 1);
        return {...order, items: newItems};
    });
  };

  const setOrderAddress = (userId: string, address: string) => {
    updateOrder(userId, (order) => ({...order, address}));
  };
  
  const setTimeWindow = (userId: string, timeWindow: SimulatedOrder['timeWindow']) => {
    updateOrder(userId, (order) => ({...order, timeWindow}));
  }

  const locationNodes = allNodes.filter(n => !n.id.includes('warehouse'));
  
  const renderOrderEditor = (order: SimulatedOrder) => {
    const isMainUser = order.id === 'you';
    return (
        <Card key={order.id} className="bg-muted/50">
          <CardHeader className="flex-row items-center justify-between p-4">
            <div className="space-y-1">
                <CardTitle className="text-base font-bold">{isMainUser ? 'Your Order' : `Order: ${order.id}`}</CardTitle>
                <CardDescription className="text-xs">{order.items.length} item(s)</CardDescription>
            </div>
            {!isMainUser && (
                <Button variant="ghost" size="icon" className="text-muted-foreground w-8 h-8" onClick={() => removeOtherUser(order.id)}>
                    <Trash2 className="w-4 h-4"/>
                </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <Label className="text-xs font-medium">Delivery Address</Label>
                 <Select value={order.address} onValueChange={(val) => setOrderAddress(order.id, val)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select address" />
                    </SelectTrigger>
                    <SelectContent>
                        {locationNodes.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
             
             <div className="col-span-2">
                <Label className="text-xs font-medium">Delivery Time Window</Label>
                 <Select value={order.timeWindow} onValueChange={(val: SimulatedOrder['timeWindow']) => setTimeWindow(order.id, val)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select time window" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Any Time</SelectItem>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                    </SelectContent>
                </Select>
             </div>

             <div className="col-span-2">
                <Label className="text-xs font-medium">Items</Label>
                <div className="space-y-1">
                    {order.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between bg-background p-1.5 rounded-md text-xs">
                           <span>{item.name}</span>
                            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => removeProductFromOrder(order.id, index)}>
                                <Trash2 className="w-3 h-3"/>
                            </Button>
                        </div>
                    ))}
                     {order.items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No items in this order.</p>}
                </div>
             </div>
             <div className="col-span-2">
                <Select onValueChange={(prodId) => addProductToOrder(order.id, prodId)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Add an item..."/>
                    </SelectTrigger>
                    <SelectContent>
                        {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} - ${p.price}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
          </CardContent>
        </Card>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Orders</CardTitle>
        <CardDescription>
          Add or remove orders to simulate a delivery batch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-semibold">Your Order</AccordionTrigger>
                <AccordionContent className="pt-2">
                    {renderOrderEditor(mainUserOrder)}
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger className="text-base font-semibold">Other Customer Orders ({otherOrders.length})</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                    {otherOrders.map(order => renderOrderEditor(order))}
                    <Button variant="outline" className="w-full" onClick={addOtherUser}>
                        <UserPlus className="mr-2" /> Add Customer Order
                    </Button>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
