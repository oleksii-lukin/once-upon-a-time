import { auth } from '@clerk/nextjs/server'
import { getServerGuestSecret, hashGuestSecret } from './guest-server'

/**
 * Server-side caller authorization for mutations on guest/user-owned rows.
 *
 * A player row is owned by:
 * - a Clerk user  -> the signed-in session's user id must match user_id
 * - a guest       -> the ouat_guest_secret cookie must hash to
 *                    guest_secret_hash (only the holder's browser has it;
 *                    the public guestId is NOT sufficient)
 *
 * Rows with guest_secret_hash = NULL (created before Phase 2) fail closed.
 */

export interface IdentityRow {
  user_id: string | null
  guest_id: string | null
  guest_secret_hash?: string | null
}

export async function verifyPlayerOwnership(row: IdentityRow): Promise<boolean> {
  if (row.user_id) {
    const { userId } = await auth()
    const ok = Boolean(userId) && userId === row.user_id
    if (!ok) console.warn(`[authz] user mismatch: session=${userId} row=${row.user_id}`)
    return ok
  }
  if (row.guest_id && row.guest_secret_hash) {
    const secret = await getServerGuestSecret()
    const computed = hashGuestSecret(secret)
    const ok = computed === row.guest_secret_hash
    if (!ok) {
      console.warn(
        `[authz] guest secret mismatch guest=${row.guest_id} computed=${computed.slice(0, 12)} stored=${row.guest_secret_hash.slice(0, 12)}`,
      )
    }
    return ok
  }
  if (row.guest_id) {
    console.warn(`[authz] legacy guest row without secret hash: guest=${row.guest_id}`)
    return false
  }
  console.warn('[authz] row has neither user_id nor guest_id')
  return false
}
