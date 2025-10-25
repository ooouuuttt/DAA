import Link from 'next/link';
import { Package } from 'lucide-react';

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary">
      <Package className="h-7 w-7" />
      <span className="text-xl font-bold font-headline">SwiftRoute</span>
    </Link>
  );
}
