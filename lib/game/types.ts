/** Shared result contract for game service operations.
 *
 * Server actions never throw across the client boundary (Next.js masks
 * thrown server-action errors in production, which would turn every
 * persistence failure into an opaque message). They return a discriminated
 * result instead; the xstate actor adapter decides how to surface it.
 */
export type ActionResult<T>
  = | { ok: true, data: T }
    | { ok: false, error: string }

/** Payload returned by the syncTimer server action on success. */
export type TimerSyncResult = {
  success: boolean
  timerStartedAt?: string
  timerExpiresAt?: string
}
