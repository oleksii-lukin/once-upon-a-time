'use client'

import { useEffect, useRef, useCallback } from 'react'
import { touchPlayer } from '@/app/actions/players'

/**
 * Hook to send periodic heartbeat updates to the server.
 * This updates the player's `last_seen_at` field, which is used by
 * the server-side cleanup jobs to determine if a player is still active.
 *
 * The heartbeat is sent every 30 seconds while the player is in an active lobby/game.
 * This allows the server to detect inactive players and mark lobbies as finished
 * when all players have been inactive for a configurable threshold (default 5 minutes).
 *
 * Phase 2: heartbeats go through the touchPlayer server action (the
 * player's row is no longer directly writable from the browser). The
 * old beforeunload beacon used a raw PostgREST PATCH with the anon key
 * and can no longer write — closing the tab simply stops the heartbeat,
 * and the reaper marks the player idle after the threshold as it would
 * for any other departure.
 *
 * @param playerId - The UUID of the player record (from the players table, not user_id)
 * @param enabled - Whether the heartbeat should be active (default: true)
 */
export default function usePlayerHeartbeat(
  playerId: string | null | undefined,
  enabled: boolean = true,
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)

  const sendHeartbeat = useCallback(async () => {
    if (!playerId) return

    // Throttle updates to prevent rapid successive calls
    const now = Date.now()
    if (now - lastUpdateRef.current < 5000) return // Min 5s between updates
    lastUpdateRef.current = now

    try {
      const result = await touchPlayer({ playerId })
      if (!result.ok) {
        console.warn('[Heartbeat] Failed to update last_seen_at:', result.error)
      }
    }
    catch (err) {
      console.warn('[Heartbeat] Error sending heartbeat:', err)
    }
  }, [playerId])

  useEffect(() => {
    if (!playerId || !enabled) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Set up periodic heartbeat (every 30 seconds)
    intervalRef.current = setInterval(sendHeartbeat, 30000)

    // Also send heartbeat on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [playerId, enabled, sendHeartbeat])

  // Expose manual trigger for immediate updates (e.g., on user actions)
  return { sendHeartbeat }
}
