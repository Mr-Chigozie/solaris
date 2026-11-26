'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

export interface WorkspaceOrg {
  id: string;
  name: string;
  slug: string;
  types: Array<'VENDOR' | 'INSTALLER' | 'ENERGY_COMPANY'>;
  verification: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verificationNote: string | null;
  isPlatformOwned: boolean;
  hiddenAt: string | null;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  serviceStates: string[];
  yearsInBusiness: number | null;
  cacNumber: string | null;
}

export interface Workspace {
  organization: WorkspaceOrg;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  can: Record<'MANAGE_PROFILE' | 'MANAGE_PRODUCTS' | 'MANAGE_INVENTORY' | 'MANAGE_SERVICES' | 'MESSAGE_CUSTOMERS', boolean>;
  publiclyVisible: boolean;
  counts: { productsPublished: number; productsDraft: number; servicesPublished: number; servicesDraft: number; conversations: number };
}

const Ctx = createContext<{ ws: Workspace; reload: () => void } | null>(null);

export function WorkspaceProvider({ orgId, children }: { orgId: string; children: React.ReactNode }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api<Workspace>(`/organizations/${orgId}/workspace`)
      .then((r) => setWs(r.data))
      .catch((e) => setError(e instanceof ApiError && e.status === 403 ? 'You are not a member of this business.' : 'Could not load this business.'));
  }, [orgId]);

  useEffect(reload, [reload]);

  if (error) return <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
  if (!ws) return <div className="grid h-64 place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-sun-400" /></div>;
  return <Ctx.Provider value={{ ws, reload }}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return v;
}
