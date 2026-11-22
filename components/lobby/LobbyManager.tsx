'use client'

import { useState, useEffect } from 'react'
import { type RealtimePostgresUpdatePayload } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { type Lobby, type Player } from '@/types/model'
import AdminLobbyView from './AdminLobbyView'
import UserLobbyView from './UserLobbyView'
import GameView from '../game/GameView'
import usePlayerHeartbeat from '../game/usePlayerHeartbeat'

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
  const [prevInitialLobby, setPrevInitialLobby] = useState(initialLobby)
  const [isMounted, setIsMounted] = useState(false)
  const supabase = createClient()

  // Pick up server-side state after a router.refresh() (e.g. when the host
  // starts a game): apply the new props ONLY when they represent an actual
  // id/status change versus the previous props. Gating on "props differ
  // from state" would revert a realtime status update whenever any RSC
  // re-commit delivers props that are stale relative to it — stranding the
  // guest in the lobby view after the host starts the game.
  if (prevInitialLobby !== initialLobby) {
    const statusOrIdChanged = initialLobby.status !== prevInitialLobby.status
      || initialLobby.id !== prevInitialLobby.id
    setPrevInitialLobby(initialLobby)
    if (statusOrIdChanged) {
      setLobby(initialLobby)
    }
  }

  // Prevent performance measurement issues by ensuring component is fully mounted
  useEffect(() => {
    // Add a small delay to ensure proper mounting before any operations
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Find current player's record for heartbeat
  const currentPlayer = players.find(p =>
    (userId && p.user_id === userId)
    || (guestId && p.guest_id === guestId),
  )

  // Send periodic heartbeats to track player activity
  // This is used by server-side cleanup to detect inactive lobbies
  usePlayerHeartbeat(currentPlayer?.id, isMounted)

  useEffect(() => {
    if (!isMounted) return

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
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // postgres_changes only delivers live events: a status change that
        // lands between page render and this subscription would be lost and
        // strand the client in the lobby view. Refetch once on subscribe.
        supabase
          .from('lobbies')
          .select('*')
          .eq('id', lobby.id)
          .single()
          .then(({ data }) => {
            if (data) setLobby(data as Lobby)
          })
      })

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
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // An INSERT that lands before this subscription is established is
        // never replayed — refetch once so a player who joined during the
        // window is not missing from the list.
        supabase
          .from('players')
          .select('*')
          .eq('lobby_id', lobby.id)
          .order('turn_order', { ascending: true })
          .order('joined_at', { ascending: true })
          .then(({ data }) => {
            if (data) setPlayers(data as Player[])
          }, () => {})
      })

    return () => {
      supabase.removeChannel(lobbyChannel)
      supabase.removeChannel(playersChannel)
    }
  }, [lobby.id, supabase, isMounted])

  // Realtime safety net: postgres_changes only delivers live events, so a
  // status change can be lost (subscription not yet established, dropped
  // websocket — nothing replays it) and strand the client in the lobby view.
  // While still waiting, poll as a fallback; realtime usually wins, the
  // poll makes the flip eventual.
  useEffect(() => {
    if (!isMounted || lobby.status !== 'waiting') return
    const interval = setInterval(() => {
      supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobby.id)
        .single()
        .then(({ data }) => {
          if (data && data.status !== lobby.status) {
            setLobby(data as Lobby)
          }
        }, () => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [isMounted, lobby.status, lobby.id, supabase])

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
    return (
      <AdminLobbyView
        lobby={lobby}
        initialPlayers={players}
        userId={userId}
        guestId={guestId}
      />
    )
  }

  return (
    <UserLobbyView
      lobby={lobby}
      initialPlayers={players}
      userId={userId}
      guestId={guestId}
    />
  )
}
