/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
export function safeNext(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
