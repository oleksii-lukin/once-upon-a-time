/**
 * Game-domain service types.
 *
 * ActionResult (the shared service contract) lives in @/types/service.
 */

/** Payload returned by the syncTimer server action on success. */
export type TimerSyncResult = {
  success: boolean
  timerStartedAt?: string
  timerExpiresAt?: string
}
