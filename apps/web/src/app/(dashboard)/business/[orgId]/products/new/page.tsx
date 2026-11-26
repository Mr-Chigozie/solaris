'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { EMPTY_PRODUCT, ProductForm } from '@/features/business/product-form';
import { useWorkspace } from '@/features/business/workspace-context';

export default function NewProductPage() {
  const { ws } = useWorkspace();
  return (
    <div>
      <Link href={`/business/${ws.organization.id}/products`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Products</Link>
      <h2 className="mb-6 text-xl font-bold text-white">New product</h2>
      <ProductForm initial={EMPTY_PRODUCT} />
    </div>
  );
}
