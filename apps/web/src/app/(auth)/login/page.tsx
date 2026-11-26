'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { safeNext } from '@/features/auth/safe-next';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push(safeNext(params.get('next')));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome back</h1>
      <p className="mt-2 text-ink-300">Sign in to your SOLARIS account.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{error}</p>}
        <button type="submit" disabled={busy || !email || !password} className="btn btn-primary w-full py-3">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-400">
        New to SOLARIS?{' '}
        <Link href={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-sun-300 hover:text-sun-200">
          Create an account
        </Link>
      </p>
    </>
  );
}
