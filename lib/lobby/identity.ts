import { getGuestIdentity } from '@/lib/auth/guestIdentity'

/**
 * Client-safe resolution of a lobby member's display identity.
 *
 * Single home for the "Clerk user vs guest identity" decision that used
 * to be copy-pasted into CreateLobbyButton, CreateLobbyLink, LobbyList
 * and InviteHandler. Runs on the client (guest identity derives from
 * browser storage); callers pass the resulting plain strings to server
 * actions.
 */

/** Structural subset of a Clerk user this resolver needs. */
export interface DisplayUser {
  fullName?: string | null
  username?: string | null
  imageUrl?: string | null
}

export interface PlayerIdentity {
  displayName: string
  /** Stored as a URL, or `emoji:<name>:<color>` for guests (DB trigger may override). */
  avatarUrl: string | null
}

export function resolvePlayerIdentity(
  user: DisplayUser | null | undefined,
  guestId: string,
): PlayerIdentity {
  if (user) {
    return {
      displayName: user.fullName || user.username || 'Player',
      avatarUrl: user.imageUrl || null,
    }
  }

  const identity = getGuestIdentity(guestId)
  return {
    displayName: identity.name,
    avatarUrl: `emoji:${identity.emoji}:${identity.color}`,
  }
}
