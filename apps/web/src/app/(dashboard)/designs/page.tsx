'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DesignCard } from '@/features/designs/design-card';
import type { DesignSummary } from '@/features/designs/types';
import { api, ApiError } from '@/lib/api';

export default function DesignsPage() {
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DesignSummary[]>('/solar/designs?pageSize=50')
      .then((r) => setDesigns(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load designs'));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">My solar designs</h1>
          <p className="mt-1 text-ink-400">Saved estimates with every assumption frozen, so you can always reproduce them.</p>
        </div>
        <Link href="/calculator" className="btn btn-primary self-start">
          <Plus className="h-4 w-4" /> New design
        </Link>
      </header>

      {error && <p className="mt-8 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {designs === null && !error && Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-56 animate-pulse" />)}
        {designs?.map((d) => <DesignCard key={d.id} d={d} />)}
      </div>
      {designs?.length === 0 && (
        <div className="card mt-2 p-10 text-center">
          <p className="text-ink-300">You haven&apos;t saved any designs yet.</p>
          <Link href="/calculator" className="btn btn-primary mt-6">Open the calculator</Link>
        </div>
      )}
    </div>
  );
}
