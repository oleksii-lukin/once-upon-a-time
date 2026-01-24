'use client'

import { useState, useEffect } from 'react'
import { type RealtimePostgresUpdatePayload } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import AdminLobbyView from './AdminLobbyView'
import UserLobbyView from './UserLobbyView'
import GameView from '../game/GameView'
import usePlayerHeartbeat from '../game/usePlayerHeartbeat'

type Lobby = Database['public']['Tables']['lobbies']['Row']
type Player = Database['public']['Tables']['players']['Row']

interface LobbyManagerProps {
  initialLobby: Lobby
  initialPlayers: Player[]
  isHost: boolean
  userId: string | null
  guestId: string | undefined
}

export default function LobbyManager({
  initialLobby,
  initialPlayers,
  isHost,
  userId,
  guestId,
}: LobbyManagerProps) {
  const [lobby, setLobby] = useState<Lobby>(initialLobby)
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const supabase = createClient()

  // Find current player's record for heartbeat
  const currentPlayer = players.find(p =>
    (userId && p.user_id === userId)
    || (guestId && p.guest_id === guestId),
  )

  // Send periodic heartbeats to track player activity
  // This is used by server-side cleanup to detect inactive lobbies
  usePlayerHeartbeat(currentPlayer?.id)

  useEffect(() => {
    // Subscribe to lobby changes (e.g., status change to 'in_game')
    const lobbyChannel = supabase
      .channel(`lobby:${lobby.id}:manager`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobby.id}` },
        (payload: RealtimePostgresUpdatePayload<Lobby>) => {
          if (payload.new) {
            setLobby(payload.new)
          }
        },
      )
      .subscribe()

    // Subscribe to player changes
    const playersChannel = supabase
      .channel(`lobby:${lobby.id}:players_manager`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `lobby_id=eq.${lobby.id}` },
        async () => {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('lobby_id', lobby.id)
            .order('turn_order', { ascending: true })
            .order('joined_at', { ascending: true })
          if (data) setPlayers(data)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(lobbyChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [lobby.id, supabase])

  // Hide the global header during active gameplay and restore otherwise
  useEffect(() => {
    const header = typeof document !== 'undefined' ? document.getElementById('site-header') : null
    if (!header) return
    if (lobby.status === 'playing' || lobby.status === 'finished') {
      header.style.display = 'none'
    }
    else {
      header.style.display = ''
    }
    return () => {
      if (header) {
        header.style.display = ''
      }
    }
  }, [lobby.status])

  if (lobby.status === 'playing' || lobby.status === 'finished') {
    return <GameView lobby={lobby} players={players} currentUserId={userId} currentGuestId={guestId} />
  }

  if (isHost) {
    return <AdminLobbyView lobby={lobby} initialPlayers={players} />
  }

  return <UserLobbyView lobby={lobby} initialPlayers={players} />
}
