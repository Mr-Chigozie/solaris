'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProductForm, type ProductFormValue } from '@/features/business/product-form';
import { useWorkspace } from '@/features/business/workspace-context';
import { api, ApiError } from '@/lib/api';

export default function EditProductPage() {
  const { ws } = useWorkspace();
  const { productId } = useParams<{ productId: string }>();
  const [initial, setInitial] = useState<ProductFormValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProductFormValue & { brand: string | null; model: string | null; sku: string | null; description: string | null }>(`/organizations/${ws.organization.id}/products/${productId}`)
      .then((r) => setInitial({ ...r.data, brand: r.data.brand ?? '', model: r.data.model ?? '', sku: r.data.sku ?? '', description: r.data.description ?? '', status: r.data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' }))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load product'));
  }, [ws.organization.id, productId]);

  return (
    <div>
      <Link href={`/business/${ws.organization.id}/products`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Products</Link>
      <h2 className="mb-6 text-xl font-bold text-white">Edit product</h2>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {!initial && !error && <Loader2 className="h-5 w-5 animate-spin text-ink-400" />}
      {initial && <ProductForm initial={initial} />}
    </div>
  );
}
