/**
 * Minimal typed client for the SOLARIS API.
 * - The access token lives only in memory (never localStorage) to limit XSS impact.
 * - The refresh token is an httpOnly cookie the browser sends to /auth/* automatically.
 * - A 401 on an authenticated call triggers one silent refresh and a retry.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues: ApiIssue[] = [],
  ) {
    super(message);
  }
  /** Map field issues to `{ fieldPath: message }` for forms. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.issues.map((i) => [i.path, i.message]));
  }
}

let accessToken: string | null = null;
let refreshing: Promise<SessionPayload | null> | null = null;
const listeners = new Set<(session: SessionPayload | null) => void>();

export interface SessionPayload {
  user: CurrentUser;
  accessToken: string;
  expiresIn: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  state: string | null;
  roles: Array<'CONSUMER' | 'INSTALLER' | 'VENDOR' | 'ADMIN'>;
  adminRoles: Array<'SUPER_ADMIN' | 'CONTENT_EDITOR' | 'OPERATIONS' | 'MARKETPLACE_CURATOR'>;
  memberships: Array<{
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    organization: { id: string; name: string; slug: string; types: Array<'INSTALLER' | 'VENDOR' | 'ENERGY_COMPANY'>; isPlatformOwned: boolean; verification: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' };
  }>;
}

export function setSession(session: SessionPayload | null) {
  accessToken = session?.accessToken ?? null;
  listeners.forEach((l) => l(session));
}

export function onSessionChange(listener: (session: SessionPayload | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Internal: whether a 401 may trigger refresh + retry. */
  retry?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function raw<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      signal: opts.signal,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach SOLARIS right now. Check your connection and try again.');
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'HTTP_ERROR', e.message ?? `Request failed (${res.status})`, e.issues ?? []);
  }
  return { data: json.data as T, meta: json.meta };
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  try {
    return await raw<T>(path, opts);
  } catch (err) {
    const canRetry = opts.retry !== false && err instanceof ApiError && err.status === 401 && accessToken !== null && !path.startsWith('/auth/');
    if (!canRetry) throw err;
    const session = await refreshSession();
    if (!session) throw err;
    return raw<T>(path, { ...opts, retry: false });
  }
}

/** Upload an image (JPEG/PNG/WebP ≤ 5 MB). Returns its public URL. */
export async function uploadImage(file: File, retry = true): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/uploads/images`, {
    method: 'POST',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  });
  if (res.status === 401 && retry && (await refreshSession())) return uploadImage(file, false);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new ApiError(res.status, json?.error?.code ?? 'UPLOAD_FAILED', json?.error?.message ?? 'Upload failed');
  return json.data.url as string;
}

/** Exchange the refresh cookie for a new session. Concurrent callers share one request. */
export function refreshSession(): Promise<SessionPayload | null> {
  refreshing ??= raw<SessionPayload>('/auth/refresh', { method: 'POST' })
    // Another tab rotated the cookie a moment ago — the browser now holds the new one.
    .catch((err) => {
      if (err instanceof ApiError && err.code === 'REFRESH_RACE') return raw<SessionPayload>('/auth/refresh', { method: 'POST' });
      throw err;
    })
    .then((r) => {
      setSession(r.data);
      return r.data;
    })
    .catch(() => {
      setSession(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
