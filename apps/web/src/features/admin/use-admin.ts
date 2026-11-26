'use client';

import { useAuth } from '@/features/auth/auth-context';
import type { CurrentUser } from '@/lib/api';

export type AdminRole = CurrentUser['adminRoles'][number];

export const ADMIN_ROLE_LABEL: Record<AdminRole, { label: string; description: string }> = {
  SUPER_ADMIN: { label: 'Super admin', description: 'Everything, including feature toggles and the admin team' },
  CONTENT_EDITOR: { label: 'Content editor', description: 'Site content, announcements, branding and SEO' },
  OPERATIONS: { label: 'Operations', description: 'Business verification and the audit log' },
  MARKETPLACE_CURATOR: { label: 'Marketplace curator', description: 'Featured/hidden listings, appliance catalogue, reference prices' },
};

/** Client-side mirror of the API's admin role check (the API remains the authority). */
export function useAdminAccess() {
  const { user } = useAuth();
  const roles = (user?.roles.includes('ADMIN') ? user.adminRoles : []) ?? [];
  const can = (...allowed: AdminRole[]) => roles.includes('SUPER_ADMIN') || allowed.length === 0 || allowed.some((r) => roles.includes(r));
  return { isAdmin: Boolean(user?.roles.includes('ADMIN')), roles, can };
}
