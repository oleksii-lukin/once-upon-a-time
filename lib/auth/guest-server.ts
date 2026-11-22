import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { createHash, randomBytes } from 'node:crypto'

const GUEST_ID_COOKIE = 'ouat_guest_id'
const GUEST_SECRET_COOKIE = 'ouat_guest_secret'

/**
 * Server-side guest identity.
 *
 * The secret is generated here (server side), stored as a cookie, and only
 * its SHA-256 hash is persisted (players.guest_secret_hash) — so knowing a
 * guest's public guestId is not enough to act as them: mutations made by a
 * guest are only accepted when this cookie's hash matches the player row.
 * The client never needs the value; it rides along with every server
 * action POST automatically.
 */
export async function getServerGuestId(): Promise<string> {
  const cookieStore = await cookies()
  let guestId = cookieStore.get(GUEST_ID_COOKIE)?.value

  if (!guestId) {
    guestId = uuidv4()
    cookieStore.set(GUEST_ID_COOKIE, guestId, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  return guestId
}

export async function getServerGuestSecret(): Promise<string> {
  const cookieStore = await cookies()
  let secret = cookieStore.get(GUEST_SECRET_COOKIE)?.value

  if (!secret) {
    // Fallback for callers that never ran the client-side seeder
    // (lib/auth/guest.ts getGuestId). Browser flows should not hit this.
    console.warn('[guest-secret] SERVER GENERATED a secret (request had no cookie)')
    secret = randomBytes(32).toString('hex')
    cookieStore.set(GUEST_SECRET_COOKIE, secret, {
      httpOnly: true, // Only ever read server-side
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  return secret
}

export function hashGuestSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}
