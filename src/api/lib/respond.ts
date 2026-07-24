/**
 * Shared response-envelope helpers (AD-8).
 *
 * Every API response is wrapped through exactly one of these two helpers so the
 * `{data}` / `{error}` shape is never hand-rolled per route. `error` is always a
 * plain string — this app's scope does not need field-level error detail.
 */

export interface SuccessEnvelope<T> {
  data: T;
}

export interface ErrorEnvelope {
  error: string;
}

/** Wrap a successful payload as `{ data }`. */
export function ok<T>(data: T): SuccessEnvelope<T> {
  return { data };
}

/** Wrap a failure as `{ error }`, where `error` is always a plain string. */
export function fail(error: string): ErrorEnvelope {
  return { error };
}
