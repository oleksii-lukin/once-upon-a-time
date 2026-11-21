/**
 * Shared result contract for service operations (server actions).
 *
 * Services never throw across the client boundary (Next.js masks thrown
 * server-action errors in production, which would turn every persistence
 * failure into an opaque message). They return a discriminated result
 * instead; the caller decides how to surface it.
 *
 * `code` is an optional machine-readable failure reason (e.g. domain
 * codes like 'lobby_not_found') so callers can map errors without
 * string matching.
 */
export type ActionResult<T>
  = | { ok: true, data: T }
    | { ok: false, error: string, code?: string }
