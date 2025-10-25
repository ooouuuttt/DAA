import { PlaceHolderImages } from './placeholder-images';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: {
    src: string;
    hint: string;
  };
  deliveryLocationId: string;
}

const productImages = PlaceHolderImages.reduce((acc, img) => {
  acc[img.id] = { src: img.imageUrl, hint: img.imageHint };
  return acc;
}, {} as Record<string, { src: string; hint: string }>);

// Assign products to delivery locations from 1 to 20
const deliveryLocations = Array.from({ length: 20 }, (_, i) => `loc${i + 1}`);

export const products: Product[] = [
  {
    id: 'prod_1',
    name: 'Modern Smartphone',
    description: 'A modern smartphone with a sleek design and a powerful camera.',
    price: 699.99,
    image: productImages['product-1'],
    deliveryLocationId: deliveryLocations[0],
  },
  {
    id: 'prod_2',
    name: 'Noise-Cancelling Headphones',
    description: 'Immerse yourself in music with these wireless noise-cancelling headphones.',
    price: 249.99,
    image: productImages['product-2'],
    deliveryLocationId: deliveryLocations[1],
  },
  {
    id: 'prod_3',
    name: 'Durable Backpack',
    description: 'A stylish and durable backpack perfect for work, travel, and daily use.',
    price: 89.99,
    image: productImages['product-3'],
    deliveryLocationId: deliveryLocations[2],
  },
  {
    id: 'prod_4',
    name: 'Fitness Smart Watch',
    description: 'Track your fitness goals with this advanced smart watch.',
    price: 199.99,
    image: productImages['product-4'],
    deliveryLocationId: deliveryLocations[3],
  },
  {
    id: 'prod_5',
    name: 'Pro Coffee Maker',
    description: 'Brew professional-grade coffee at home with this premium machine.',
    price: 149.99,
    image: productImages['product-5'],
    deliveryLocationId: deliveryLocations[4],
  },
  {
    id: 'prod_6',
    name: 'Ergonomic Office Chair',
    description: 'Stay comfortable during long work hours with this ergonomic chair.',
    price: 349.99,
    image: productImages['product-6'],
    deliveryLocationId: deliveryLocations[5],
  },
  {
    id: 'prod_7',
    name: 'Gaming Laptop',
    description: 'Experience high-performance gaming on the go with this powerful laptop.',
    price: 1499.99,
    image: productImages['product-7'],
    deliveryLocationId: deliveryLocations[6],
  },
  {
    id: 'prod_8',
    name: 'Portable Bluetooth Speaker',
    description: 'Take your music anywhere with this compact and powerful speaker.',
    price: 79.99,
    image: productImages['product-8'],
    deliveryLocationId: deliveryLocations[7],
  },
];
