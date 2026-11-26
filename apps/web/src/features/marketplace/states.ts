'use client';

import type { SolarResource } from '@solaris/solar-engine';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

let cache: SolarResource[] | null = null;

/** Nigerian states (36 + FCT), fetched once per page load. */
export function useStates() {
  const [states, setStates] = useState<SolarResource[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api<SolarResource[]>('/locations/states')
      .then((r) => {
        cache = r.data;
        setStates(r.data);
      })
      .catch(() => undefined);
  }, []);
  return states;
}

export const stateLabel = (s: string) => (s === 'Federal Capital Territory' ? 'FCT (Abuja)' : s);
