/**
 * TaskFlow API client (AD-8, AD-10).
 *
 * AD-8: every response is unwrapped through the ONE shared `request` function
 * below — the `{ data }` / `{ error }` envelope is never parsed inline per call.
 * Success returns the unwrapped `data`; any non-2xx throws an `ApiError` carrying
 * the server's `{ error }` string and the HTTP status, so callers handle failures
 * uniformly.
 *
 * AD-10: this module is the SOLE READER of the `taskflow_token` localStorage key.
 * `hooks/useAuth.ts` is the sole writer. Authenticated requests attach
 * `Authorization: Bearer <token>`; `register` itself is public and sends no token,
 * but the reusable pattern is in place for login/tasks in later stories.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

/** AD-10 fixed storage key — read here, written only by `useAuth`. Single source of
 * truth for the literal so the two modules can never drift on the key name. */
export const TOKEN_KEY = 'taskflow_token';

/** Canonical Auth user shape (AD-13) — `password` is never present. */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

/** Canonical Auth response payload (AD-13) — identical for register and login. */
export interface AuthResult {
  token: string;
  user: AuthUser;
}

/** Thrown for any non-2xx response; `message` is the server's `{ error }` string. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When true, attach the stored bearer token (AD-10). */
  auth?: boolean;
}

function extractError(payload: unknown, status: number): string {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return `Request failed with status ${status}`;
}

/**
 * The single shared request/unwrap function (AD-8). Serializes the body, attaches
 * the bearer token when `auth` is set (AD-10), parses the envelope once, and either
 * returns `data` or throws `ApiError`.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Body was empty or not JSON; leave payload as null and let the checks below decide.
  }

  if (!response.ok) {
    throw new ApiError(extractError(payload, response.status), response.status);
  }

  if (payload !== null && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  throw new ApiError('Malformed response: expected a { data } envelope', response.status);
}

/** POST /api/auth/register — returns the canonical `{ token, user }` (AD-13). */
export function register(email: string, password: string, name: string): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
}
