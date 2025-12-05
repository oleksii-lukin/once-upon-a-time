'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Hook to send periodic heartbeat updates to the server.
 * This updates the player's `last_seen_at` field, which is used by
 * the server-side cleanup jobs to determine if a player is still active.
 * 
 * The heartbeat is sent every 30 seconds while the player is in an active lobby/game.
 * This allows the server to detect inactive players and mark lobbies as finished
 * when all players have been inactive for a configurable threshold (default 5 minutes).
 * 
 * @param playerId - The UUID of the player record (from the players table, not user_id)
 * @param enabled - Whether the heartbeat should be active (default: true)
 */
export default function usePlayerHeartbeat(
    playerId: string | null | undefined,
    enabled: boolean = true
) {
    const supabase = createClient();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateRef = useRef<number>(0);

    const sendHeartbeat = useCallback(async () => {
        if (!playerId) return;

        // Throttle updates to prevent rapid successive calls
        const now = Date.now();
        if (now - lastUpdateRef.current < 5000) return; // Min 5s between updates
        lastUpdateRef.current = now;

        try {
            const { error } = await supabase
                .from('players')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', playerId);

            if (error) {
                console.warn('[Heartbeat] Failed to update last_seen_at:', error.message);
            }
        } catch (err) {
            console.warn('[Heartbeat] Error sending heartbeat:', err);
        }
    }, [playerId, supabase]);

    useEffect(() => {
        if (!playerId || !enabled) {
            // Clear any existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Send initial heartbeat immediately
        sendHeartbeat();

        // Set up periodic heartbeat (every 30 seconds)
        intervalRef.current = setInterval(sendHeartbeat, 30000);

        // Also send heartbeat on visibility change (when user returns to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendHeartbeat();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Send heartbeat on beforeunload to update final state
        const handleBeforeUnload = () => {
            // Use synchronous approach for beforeunload
            if (playerId) {
                navigator.sendBeacon(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/players?id=eq.${playerId}`,
                    JSON.stringify({ last_seen_at: new Date().toISOString() })
                );
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [playerId, enabled, sendHeartbeat]);

    // Expose manual trigger for immediate updates (e.g., on user actions)
    return { sendHeartbeat };
}
