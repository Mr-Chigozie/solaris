'use client';

import type { SolarResource } from '@solaris/solar-engine';
import { HardHat, House, Loader2, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { useSiteConfig } from '@/features/site/site-config-context';
import { safeNext } from '@/features/auth/safe-next';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/format';

type AccountType = 'CONSUMER' | 'INSTALLER' | 'VENDOR';

const TYPES: Array<{ value: AccountType; label: string; hint: string; icon: typeof House }> = [
  { value: 'CONSUMER', label: 'Home / business', hint: 'I want solar power', icon: House },
  { value: 'INSTALLER', label: 'Installer', hint: 'I install systems', icon: HardHat },
  { value: 'VENDOR', label: 'Vendor', hint: 'I sell equipment', icon: Store },
];

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { features } = useSiteConfig();
  const openTypes = TYPES.filter(
    (t) => ({ CONSUMER: features.consumerRegistration, INSTALLER: features.installerRegistration, VENDOR: features.vendorRegistration })[t.value],
  );
  const initialType = (openTypes.find((t) => t.value === params.get('type'))?.value ?? openTypes[0]?.value ?? 'CONSUMER') as AccountType;

  const [accountType, setAccountType] = useState<AccountType>(initialType);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', businessName: '', state: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [states, setStates] = useState<SolarResource[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<SolarResource[]>('/locations/states').then((r) => setStates(r.data)).catch(() => undefined);
  }, []);

  const field = (key: keyof typeof form) => ({
    id: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    'aria-invalid': Boolean(errors[key]),
    className: cn('field', errors[key] && 'border-red-400/60'),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await register({
        accountType,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        acceptTerms,
        ...(form.phone.trim() ? { phone: form.phone } : {}),
        ...(form.state ? { state: form.state } : {}),
        ...(accountType !== 'CONSUMER' ? { businessName: form.businessName } : {}),
      });
      router.push(safeNext(params.get('next')));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        setFormError(err.issues.length ? 'Please correct the highlighted fields.' : err.message);
      } else setFormError('Registration failed');
      setBusy(false);
    }
  }

  if (openTypes.length === 0) {
    return (
      <>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Registration is paused</h1>
        <p className="mt-3 text-ink-300">New sign-ups are temporarily closed. Please check back soon.</p>
        <Link href="/login" className="btn btn-secondary mt-8 self-start">Sign in instead</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-white">Create your account</h1>
      <p className="mt-2 text-ink-300">Free for homes and businesses. Installers and vendors are verified before being listed.</p>

      <div className={cn('mt-8 grid gap-2', openTypes.length === 3 ? 'grid-cols-3' : openTypes.length === 2 ? 'grid-cols-2' : 'grid-cols-1')} role="radiogroup" aria-label="Account type">
        {openTypes.map(({ value, label, hint, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={accountType === value}
            onClick={() => setAccountType(value)}
            className={cn(
              'rounded-2xl border p-3 text-left transition',
              accountType === value ? 'border-sun-400/60 bg-sun-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20',
            )}
          >
            <Icon className={cn('h-5 w-5', accountType === value ? 'text-sun-400' : 'text-ink-400')} />
            <div className="mt-2 text-sm font-bold text-white">{label}</div>
            <div className="text-[11px] text-ink-400">{hint}</div>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {accountType !== 'CONSUMER' && (
          <Field label="Business name" error={errors.businessName}>
            <input autoComplete="organization" {...field('businessName')} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName}>
            <input autoComplete="given-name" {...field('firstName')} />
          </Field>
          <Field label="Last name" error={errors.lastName}>
            <input autoComplete="family-name" {...field('lastName')} />
          </Field>
        </div>
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" {...field('email')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone (optional)" error={errors.phone}>
            <input type="tel" autoComplete="tel" placeholder="0803 000 0000" {...field('phone')} />
          </Field>
          <Field label="State" error={errors.state}>
            <select {...field('state')}>
              <option value="">Select…</option>
              {states.map((s) => <option key={s.stateCode} value={s.state}>{s.state === 'Federal Capital Territory' ? 'FCT' : s.state}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Password" error={errors.password} hint="At least 10 characters with a letter and a number.">
          <input type="password" autoComplete="new-password" {...field('password')} />
        </Field>

        <label className="flex items-start gap-3 text-sm text-ink-300">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sun-400" />
          <span>
            I agree to the Terms of Service and Privacy Policy, and consent to SOLARIS processing my data in line with the Nigeria Data Protection Act 2023.
          </span>
        </label>
        {errors.acceptTerms && <p className="text-xs text-red-300">{errors.acceptTerms}</p>}

        {formError && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-200">{formError}</p>}

        <button type="submit" disabled={busy || !acceptTerms} className="btn btn-primary w-full py-3">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-400">
        Already have an account?{' '}
        <Link href={`/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-sun-300 hover:text-sun-200">
          Sign in
        </Link>
      </p>
    </>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}
