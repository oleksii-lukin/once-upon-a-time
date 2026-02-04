'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check as CheckIcon } from 'lucide-react'
import { type RealtimePostgresUpdatePayload } from '@supabase/supabase-js'

import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { PlayerAvatar, getPlayerDisplayName } from './PlayerDisplay'
import { useParams } from 'next/navigation'
import { getTranslation } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import CopyButton from '@/components/common/CopyButton'
import { LobbySettingsSchema, defaultLobbySettings } from '@/types/model'
import LobbySettingToggle from './LobbySettingToggle'
import GameModeTabs from './GameModeTabs'

type Lobby = Database['public']['Tables']['lobbies']['Row']
type Player = Database['public']['Tables']['players']['Row']
type Deck = Database['public']['Tables']['decks']['Row']

type LobbyPresence = {
  player_id?: string
  user_id?: string | null
  guest_id?: string
  presence_ref: string
}

interface UserLobbyViewProps {
  lobby: Lobby
  initialPlayers: Player[]
  userId: string | null
  guestId: string | undefined
}

export default function UserLobbyView({
  lobby,
  initialPlayers,
  userId,
  guestId,
}: UserLobbyViewProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [currentLobby, setCurrentLobby] = useState<Lobby>(lobby)
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const supabase = createClient()
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')

  const settings = (currentLobby.settings && typeof currentLobby.settings === 'object')
    ? (LobbySettingsSchema.safeParse(currentLobby.settings).success ? LobbySettingsSchema.parse(currentLobby.settings) : defaultLobbySettings)
    : defaultLobbySettings

  // Fetch decks on mount
  useEffect(() => {
    const fetchDecks = async () => {
      const { data } = await supabase
        .from('decks')
        .select('*')
        .eq('is_active', true)
      if (data) {
        setDecks(data)
        // Get selected decks from lobby settings
        if (currentLobby.settings && typeof currentLobby.settings === 'object') {
          const parsed = LobbySettingsSchema.safeParse(currentLobby.settings)
          if (parsed.success) {
            setSelectedDeckIds(parsed.data.selectedDecks)
          }
        }
      }
    }
    fetchDecks()
  }, [supabase, currentLobby.settings])

  // Fetch players (hoisted to avoid use-before-declare) and memoized for deps
  const fetchPlayers = useCallback(async () => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('lobby_id', lobby.id)
      .order('joined_at', { ascending: true })
    if (data) setPlayers(data)
  }, [supabase, lobby.id])

  useEffect(() => {
    // Subscribe to player changes
    const playersChannel = supabase
      .channel(`lobby:${lobby.id}:players`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `lobby_id=eq.${lobby.id}` },
        () => {
          fetchPlayers()
        },
      )
      .subscribe()

    // Subscribe to lobby changes
    const lobbyChannel = supabase
      .channel(`lobby:${lobby.id}:settings`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobby.id}` },
        (payload: RealtimePostgresUpdatePayload<Lobby>) => {
          if (payload.new) {
            const updatedLobby = payload.new as Lobby
            setCurrentLobby((prev) => {
              // Merge the update with previous state to preserve fields not included in payload
              const mergedLobby = { ...prev, ...updatedLobby }

              // Update selected decks when host changes them
              if (mergedLobby.settings && typeof mergedLobby.settings === 'object') {
                const parsed = LobbySettingsSchema.safeParse(mergedLobby.settings)
                if (parsed.success) {
                  setSelectedDeckIds(parsed.data.selectedDecks)
                }
              }

              return mergedLobby
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(lobbyChannel)
    }
  }, [lobby.id, supabase, fetchPlayers])

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // 1. Setup channel (run once)
  useEffect(() => {
    const newChannel = supabase.channel(`lobby:${lobby.id}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = newChannel.presenceState()
        const onlineIds = new Set<string>()
        for (const key in newState) {
          newState[key].forEach((presence: LobbyPresence) => {
            if (presence.player_id) onlineIds.add(presence.player_id)
          })
        }
        setOnlineUsers(onlineIds)
      })
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: LobbyPresence[] }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          newPresences.forEach((p) => {
            if (p.player_id) next.add(p.player_id)
          })
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: LobbyPresence[] }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          leftPresences.forEach((p) => {
            if (p.player_id) next.delete(p.player_id)
          })
          return next
        })
      })
      .subscribe()

    channelRef.current = newChannel

    return () => {
      supabase.removeChannel(newChannel)
    }
  }, [lobby.id, supabase])

  // 2. Track presence when player ID is available
  useEffect(() => {
    if (!channelRef.current) return

    const currentPlayer = players.find(p =>
      (userId && p.user_id === userId)
      || (guestId && p.guest_id === guestId),
    )
    const playerId = currentPlayer?.id

    if (playerId) {
      channelRef.current.track({
        player_id: playerId,
        user_id: userId,
        guest_id: guestId,
      })
    }
  }, [userId, guestId, players])

  // Handle role change
  const handleRoleChange = async (newRole: 'player' | 'spectator') => {
    const currentPlayer = players.find(p =>
      (userId && p.user_id === userId)
      || (guestId && p.guest_id === guestId),
    )

    if (!currentPlayer) return

    const { error } = await supabase
      .from('players')
      .update({ role: newRole })
      .eq('id', currentPlayer.id)

    if (error) {
      console.error('Error updating role:', error)
    }
  }

  // Handle ready toggle
  const handleReadyToggle = async () => {
    const currentPlayer = players.find(p =>
      (userId && p.user_id === userId)
      || (guestId && p.guest_id === guestId),
    )

    if (!currentPlayer) return

    const newStatus = currentPlayer.status === 'ready' ? 'not_ready' : 'ready'
    const { error } = await supabase
      .from('players')
      .update({ status: newStatus })
      .eq('id', currentPlayer.id)

    if (error) {
      console.error('Error updating status:', error)
    }
  }

  // Handle leave lobby
  const handleLeave = async () => {
    const currentPlayer = players.find(p =>
      (userId && p.user_id === userId)
      || (guestId && p.guest_id === guestId),
    )

    if (!currentPlayer) return

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', currentPlayer.id)

    if (error) {
      console.error('Error leaving lobby:', error)
      return
    }

    window.location.href = `/${lng}`
  }

  // Effect to force player role if allowSpectators is disabled
  useEffect(() => {
    if (!settings.allowSpectators) {
      const currentPlayer = players.find(p =>
        (userId && p.user_id === userId)
        || (guestId && p.guest_id === guestId),
      )

      if (currentPlayer?.role === 'spectator') {
        handleRoleChange('player')
      }
    }
  }, [settings.allowSpectators]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to handle Solo Mode - switch players to spectators
  useEffect(() => {
    if (settings.gameMode === 'solo') {
      const currentPlayer = players.find(p =>
        (userId && p.user_id === userId)
        || (guestId && p.guest_id === guestId),
      )

      // If current user is a player (not host) and solo mode is enabled, switch to spectator
      if (currentPlayer && currentPlayer.role !== 'host' && currentPlayer.role !== 'spectator') {
        handleRoleChange('spectator')
      }
    }
  }, [settings.gameMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to disconnect users when Solo Mode enabled and spectators not allowed
  useEffect(() => {
    if (settings.gameMode === 'solo' && !settings.allowSpectators) {
      const currentPlayer = players.find(p =>
        (userId && p.user_id === userId)
        || (guestId && p.guest_id === guestId),
      )

      // If current user is not the host and spectators are not allowed, disconnect them
      if (currentPlayer && currentPlayer.role !== 'host') {
        handleLeave()
      }
    }
  }, [settings.gameMode, settings.allowSpectators]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentPlayer = players.find(p =>
    (userId && p.user_id === userId)
    || (guestId && p.guest_id === guestId),
  )

  // Filter players to only show online ones (plus self)
  const displayedPlayers = players.filter((p) => {
    const isSelf = (userId && p.user_id === userId) || (guestId && p.guest_id === guestId)
    return onlineUsers.has(p.id) || isSelf
  })

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
            <main className="flex-1">
              <div className="flex flex-wrap justify-between items-center gap-3 p-4">
                <p className="text-foreground text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">{t('game_lobby')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {t('room_code')}
                    :
                  </span>
                  <span className="text-foreground font-bold text-lg tracking-widest">{currentLobby.code}</span>
                  <CopyButton
                    value={currentLobby.code || ''}
                    label={t('copied')}
                    className="size-9 shrink-0 rounded-lg text-foreground bg-muted/50 hover:bg-muted/70 transition-colors"
                    variant="ghost"
                    size="icon"
                    side="top"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card p-6 rounded-xl opacity-70">
                    <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">{t('game_settings')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col">
                          <Label className="flex flex-col min-w-40 flex-1">
                            <p className="text-foreground text-base font-medium leading-normal pb-2">{t('room_name')}</p>
                            <Input className="flex w-full min-w-0 flex-1 rounded-lg text-foreground focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border bg-background h-11 placeholder:text-muted-foreground p-[15px] text-base font-normal leading-normal disabled:opacity-50" disabled readOnly value={currentLobby.name} />
                          </Label>
                        </div>
                        <div className="flex flex-col gap-2 p-4 border border-border rounded-lg">
                          <LobbySettingToggle
                            label={t('allow_hot_join')}
                            checked={settings.allowHotJoin}
                            disabled
                            htmlFor="allow-hot-join"
                          />
                          <LobbySettingToggle
                            label={t('public_game')}
                            checked={settings.publicGame}
                            disabled
                            htmlFor="game-visibility"
                          />
                          <LobbySettingToggle
                            label={t('allow_spectators')}
                            checked={settings.allowSpectators}
                            disabled
                            htmlFor="allow-spectators"
                          />
                        </div>
                      </div>
                      <div className="flex-1"></div>
                    </div>
                  </div>
                  <div className="bg-card p-6 rounded-xl opacity-70">
                    <GameModeTabs
                      settings={settings}
                      lng={lng}
                      readOnly
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <LobbySettingToggle
                        label={t('allow_interrupts')}
                        checked={settings.allowInterrupts}
                        disabled
                        infoText="When enabled, players can interrupt and play cards out of turn. This is disabled in fast mode."
                        htmlFor="allow-interrupts"
                      />
                      <LobbySettingToggle
                        label={t('timer_per_turn')}
                        checked={settings.timerPerTurn}
                        disabled
                        htmlFor="timer-per-turn"
                      />
                      <LobbySettingToggle
                        label={t('happy_ending_variant')}
                        checked={settings.happyEnding}
                        disabled
                        htmlFor="happy-ending"
                      />
                      <LobbySettingToggle
                        label={t('enable_video_chat')}
                        checked={settings.enableVideoChat}
                        disabled
                        htmlFor="enable-video-chat"
                      />

                      <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <LobbySettingToggle
                            label={t('enable_pacing_delay')}
                            checked={settings.enablePacingDelay}
                            disabled
                            htmlFor="enable-pacing-delay"
                            infoText={t('pacing_delay_tooltip')}
                          />
                          {settings.enablePacingDelay && (
                            <span className="text-sm font-bold text-foreground opacity-70 min-w-12 text-right">
                              {settings.pacingDelayDuration}
                              {t('seconds_abbrev')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card p-6 rounded-xl opacity-70">
                    <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">{t('decks')}</h2>
                    <div className="flex flex-col">
                      <p className="text-foreground text-base font-medium leading-normal pb-2">{t('selected_decks')}</p>
                      <div className="space-y-2">
                        {decks.map(deck => (
                          <label
                            key={deck.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border pointer-events-none ${selectedDeckIds.includes(deck.id)
                              ? 'bg-primary/20 border-primary'
                              : 'border-transparent'
                            }`}
                          >
                            <Checkbox disabled checked={selectedDeckIds.includes(deck.id)} />
                            <span className="text-foreground font-medium">{deck.name}</span>
                          </label>
                        ))}
                        {decks.length === 0 && (
                          <p className="text-muted-foreground text-sm italic">{t('no_decks_selected')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <div className="bg-card p-6 rounded-xl flex-1 flex flex-col">
                    <h2 className="text-foreground text-lg font-bold leading-tight tracking-[-0.015em] pb-4">
                      {t('players')}
                      {' '}
                      (
                      {displayedPlayers.filter(p => p.role !== 'spectator').length}
                      )
                    </h2>
                    <div className="flex-1 space-y-3 overflow-y-auto">
                      {displayedPlayers.filter(p => p.role !== 'spectator').map(player => (
                        <div key={player.id} className={`flex items-center gap-3 p-3 rounded-lg ${player.role === 'host' ? 'bg-primary/20 border border-primary' : 'bg-muted/50'}`}>
                          <PlayerAvatar player={player} />
                          <div className="flex flex-col">
                            <p className="text-foreground font-bold truncate">{getPlayerDisplayName(player)}</p>
                            <p className={`text-xs font-semibold ${player.role === 'host' ? 'text-primary' : player.status === 'ready' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {player.role === 'host' ? t('host') : player.status === 'ready' ? t('ready') : t('not_ready')}
                            </p>
                          </div>
                        </div>
                      ))}
                      {displayedPlayers.filter(p => p.role !== 'spectator').length === 0 && (
                        <p className="text-muted-foreground text-sm">{t('no_players_yet')}</p>
                      )}
                    </div>
                    <div className="mt-4">
                      <h3 className="text-muted-foreground text-sm font-bold leading-tight tracking-[-0.015em] pb-2 pt-4 border-t border-border">
                        {t('spectators')}
                        {' '}
                        (
                        {displayedPlayers.filter(p => p.role === 'spectator').length}
                        )
                      </h3>
                      <div className="space-y-3">
                        {displayedPlayers.filter(p => p.role === 'spectator').map(player => (
                          <div key={player.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                            <PlayerAvatar player={player} />
                            <p className="text-muted-foreground font-medium truncate">{getPlayerDisplayName(player)}</p>
                          </div>
                        ))}
                        {displayedPlayers.filter(p => p.role === 'spectator').length === 0 && (
                          <p className="text-muted-foreground text-sm">{t('no_spectators')}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto pt-6 space-y-4">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium leading-normal pb-2 text-center">{t('choose_your_role')}</p>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
                          <Button
                            onClick={() => handleRoleChange('player')}
                            disabled={settings.gameMode === 'solo'}
                            className={`px-4 py-2 text-sm font-bold ${currentPlayer?.role !== 'spectator' ? '' : 'bg-transparent text-muted-foreground hover:bg-muted/70'}`}
                            variant={currentPlayer?.role !== 'spectator' ? 'default' : 'ghost'}
                          >
                            {t('player')}
                          </Button>
                          <Button
                            onClick={() => handleRoleChange('spectator')}
                            disabled={!settings.allowSpectators}
                            className={`px-4 py-2 text-sm font-bold ${currentPlayer?.role === 'spectator' ? '' : 'bg-transparent text-muted-foreground hover:bg-muted/70'}`}
                            variant={currentPlayer?.role === 'spectator' ? 'default' : 'ghost'}
                          >
                            {t('spectator')}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col xl:flex-row gap-3">
                        <Button
                          onClick={handleReadyToggle}
                          disabled={currentPlayer?.role === 'spectator'}
                          className={`min-w-[84px] w-full xl:flex-1 h-14 px-4 text-primary-foreground text-lg font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 gap-2 ${currentPlayer?.status === 'ready' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        >
                          <CheckIcon className="w-5 h-5" />
                          <span className="truncate">{currentPlayer?.status === 'ready' ? t('ready') : t('not_ready')}</span>
                        </Button>
                        <Button
                          onClick={handleLeave}
                          variant="ghost"
                          className="min-w-[84px] w-full xl:flex-1 h-14 px-4 bg-muted/50 text-muted-foreground text-base font-bold leading-normal tracking-[0.015em] hover:bg-muted/70"
                        >
                          <span className="truncate">{t('leave')}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
