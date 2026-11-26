import { describe, expect, it } from 'vitest';
import { memberHasPermission } from '../src/middleware/auth';

describe('organisation staff permissions', () => {
  it('owners and admins hold every permission', () => {
    expect(memberHasPermission({ role: 'OWNER', permissions: [] }, 'MANAGE_BILLING')).toBe(true);
    expect(memberHasPermission({ role: 'ADMIN', permissions: [] }, 'MANAGE_MEMBERS')).toBe(true);
  });

  it('members hold only what they were granted', () => {
    const sales = { role: 'MEMBER' as const, permissions: ['MANAGE_PRODUCTS' as const, 'MESSAGE_CUSTOMERS' as const] };
    expect(memberHasPermission(sales, 'MANAGE_PRODUCTS')).toBe(true);
    expect(memberHasPermission(sales, 'MESSAGE_CUSTOMERS')).toBe(true);
    expect(memberHasPermission(sales, 'MANAGE_QUOTATIONS')).toBe(false);
    expect(memberHasPermission(sales, 'MANAGE_MEMBERS')).toBe(false);
  });
});
