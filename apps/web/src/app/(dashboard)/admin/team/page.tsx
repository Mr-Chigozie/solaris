'use client';

import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ADMIN_ROLE_LABEL, type AdminRole } from '@/features/admin/use-admin';
import { useAuth } from '@/features/auth/auth-context';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/format';

interface Member { id: string; email: string; firstName: string; lastName: string; adminRoles: AdminRole[]; lastLoginAt: string | null }

const ROLES = Object.keys(ADMIN_ROLE_LABEL) as AdminRole[];

export default function AdminTeamPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [newRoles, setNewRoles] = useState<AdminRole[]>(['CONTENT_EDITOR']);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Member[]>('/admin/team').then((r) => setTeam(r.data)).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load team'));
  }, []);
  useEffect(load, [load]);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const toggle = (roles: AdminRole[], r: AdminRole) => (roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Add an admin</h2>
        <p className="mt-1 text-sm text-ink-400">The person must already have a SOLARIS account. Give them only the roles they need.</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <input className="field" type="email" placeholder="colleague@company.ng" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!email || newRoles.length === 0 || busy !== null}
            onClick={() => run('invite', () => api('/admin/team', { method: 'POST', body: { email, adminRoles: newRoles } }).then(() => setEmail('')))}
          >
            {busy === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Grant access
          </button>
        </div>
        <RolePicker roles={newRoles} onToggle={(r) => setNewRoles((x) => toggle(x, r))} />
        {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Admin team</h2>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {team === null && <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-400" /></div>}
          {team?.map((m) => (
            <div key={m.id} className="py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-white">
                    {m.firstName} {m.lastName} {m.id === user?.id && <span className="text-xs font-medium text-ink-400">(you)</span>}
                  </p>
                  <p className="text-xs text-ink-400">{m.email} · last sign-in {m.lastLoginAt ? formatDate(m.lastLoginAt) : 'never'}</p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => window.confirm(`Revoke all admin access for ${m.email}?`) && run(m.id, () => api(`/admin/team/${m.id}`, { method: 'DELETE' }))}
                  className="btn btn-ghost self-start px-3 py-1.5 text-xs text-red-300"
                >
                  <UserMinus className="h-4 w-4" /> Revoke
                </button>
              </div>
              <RolePicker
                roles={m.adminRoles}
                disabled={busy !== null}
                onToggle={(r) => {
                  const next = toggle(m.adminRoles, r);
                  if (next.length === 0) return setError('An admin needs at least one role. Use Revoke to remove access.');
                  void run(m.id, () => api(`/admin/team/${m.id}`, { method: 'PATCH', body: { adminRoles: next } }));
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RolePicker({ roles, onToggle, disabled }: { roles: AdminRole[]; onToggle: (r: AdminRole) => void; disabled?: boolean }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(r)}
          aria-pressed={roles.includes(r)}
          className={cn(
            'rounded-xl border p-3 text-left transition',
            roles.includes(r) ? 'border-sun-400/50 bg-sun-400/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20',
          )}
        >
          <div className="text-sm font-bold text-white">{ADMIN_ROLE_LABEL[r].label}</div>
          <div className="text-xs text-ink-400">{ADMIN_ROLE_LABEL[r].description}</div>
        </button>
      ))}
    </div>
  );
}
