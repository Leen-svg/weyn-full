import { supabase } from './supabase';

/**
 * The mobile app does not talk to Postgres directly. It calls the same
 * Next.js route handlers the web app calls, so validation, rate limits,
 * the points ledger and the anti-farming caps stay in exactly one place.
 *
 * lib/supabase/server.js on the web already accepts `Authorization: Bearer`
 * and builds an RLS-scoped client from it — that is the seam this uses.
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_WEYN_API_URL?.replace(/\/$/, '') ?? 'https://goweyn.com';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header. Guest voting and public boards need this. */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!anonymous) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A route that fell over returns an HTML error page, not JSON. Do not
      // surface that markup to the user.
      payload = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(payload?.error ?? `Request failed (${res.status})`, res.status);
  }
  return payload as T;
}
