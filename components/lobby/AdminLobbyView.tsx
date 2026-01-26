'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'

import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { initializeGame } from '@/app/actions/game'
import { getTranslation } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import CopyButton from '@/components/common/CopyButton'
import { LobbySettingsSchema, defaultLobbySettings } from '@/types/lobby'
import type { LobbySettings } from '@/types/lobby'
import LobbySettingToggle from './LobbySettingToggle'

import { PlayerAvatar, getPlayerDisplayName } from './PlayerDisplay'
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

interface AdminLobbyViewProps {
  lobby: Lobby
  initialPlayers: Player[]
  userId: string | null
  guestId: string | undefined
}

export default function AdminLobbyView({
  lobby,
  initialPlayers,
  userId,
  guestId,
}: AdminLobbyViewProps) {
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')

  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [currentLobby] = useState<Lobby>(lobby)
  const supabase = useMemo(() => createClient(), [])
  const [roomName, setRoomName] = useState(lobby.name)
  const [decks, setDecks] = useState<Deck[]>([])

  // Initialize settings from lobby data or defaults
  const [settings, setSettings] = useState<LobbySettings>(() => {
    if (lobby.settings && typeof lobby.settings === 'object') {
      const parsed = LobbySettingsSchema.safeParse(lobby.settings)
      return parsed.success ? parsed.data : defaultLobbySettings
    }
    return defaultLobbySettings
  })

  // Generate invite link based on current URL
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/${lng}/invite/${currentLobby.code}`
    : ''

  // Copy handled by CopyButton

  // Update lobby name in database
  const updateLobbyName = async (newName: string) => {
    const { error } = await supabase
      .from('lobbies')
      .update({ name: newName })
      .eq('id', lobby.id)

    if (error) {
      console.error('Error updating lobby name:', error)
    }
  }

  // Update settings in database
  const updateSettings = async (newSettings: Partial<LobbySettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)

    const { error } = await supabase
      .from('lobbies')
      .update({
        settings: updated,
        ...(newSettings.gameMode ? { game_mode: newSettings.gameMode } : {}),
      })
      .eq('id', lobby.id)

    if (error) {
      console.error('Error updating settings:', error)
    }
  }

  const [isStarting, setIsStarting] = useState(false)
  const [selectedDecks, setSelectedDecks] = useState<string[]>(() => {
    if (lobby.settings && typeof lobby.settings === 'object') {
      const parsed = LobbySettingsSchema.safeParse(lobby.settings)
      return parsed.success ? parsed.data.selectedDecks : []
    }
    return []
  })

  // Update selected decks in settings
  const updateSelectedDecks = async (newSelectedDecks: string[]) => {
    setSelectedDecks(newSelectedDecks)
    await updateSettings({ selectedDecks: newSelectedDecks })
  }

  // Fetch available decks
  useEffect(() => {
    const fetchDecks = async () => {
      const { data } = await supabase
        .from('decks')
        .select('*')
        .eq('is_active', true)
      if (data) setDecks(data)
    }
    fetchDecks()
  }, [supabase])

  // Subscribe to lobby and player changes
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('lobby_id', lobby.id)
        .order('joined_at', { ascending: true })
      if (data) setPlayers(data)
    }

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

    // Initial fetch
    fetchPlayers()

    return () => {
      supabase.removeChannel(playersChannel)
    }
  }, [lobby.id, supabase])

  const startGame = async () => {
    if (selectedDecks.length === 0) {
      alert(t('no_decks_selected'))
      return
    }

    setIsStarting(true)

    // Combine all selected decks into one for the game
    // For now, we'll use the first selected deck as the primary deck
    const primaryDeckId = selectedDecks[0]

    // Update lobby with primary deck
    await supabase
      .from('lobbies')
      .update({ deck_id: primaryDeckId })
      .eq('id', lobby.id)

    // Initialize game state (create session, deal cards, etc.)
    const result = await initializeGame(lobby.id)

    if (result.error) {
      alert(t('failed_to_start_game', { error: result.error }))
      setIsStarting(false)
      return
    }

    // LobbyManager will handle navigation based on lobby status
    setIsStarting(false)
  }

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
      .on('presence', { event: 'join' }, (presence: { key: string, newPresences: LobbyPresence[] }) => {
        const { newPresences } = presence
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          newPresences.forEach((p: LobbyPresence) => {
            if (p.player_id) next.add(p.player_id)
          })
          return next
        })
      })
      .on('presence', { event: 'leave' }, (presence: { key: string, leftPresences: LobbyPresence[] }) => {
        const { leftPresences } = presence
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          leftPresences.forEach((p: LobbyPresence) => {
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
  }, [userId, guestId, players, lobby.id])

  // Handle role change for host
  const handleRoleChange = async (newRole: 'host' | 'spectator') => {
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
      console.error('Error updating host role:', error)
    }
  }

  const currentPlayer = players.find(p =>
    (userId && p.user_id === userId)
    || (guestId && p.guest_id === guestId),
  )

  // Filter players to only show online ones (plus self if not yet synced)
  const displayedPlayers = players.filter((p) => {
    const isSelf = (userId && p.user_id === userId) || (guestId && p.guest_id === guestId)
    return onlineUsers.has(p.id) || isSelf // Always show self
  })

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
            <main className="flex-1">
              <div className="flex flex-wrap justify-between gap-3 p-4">
                <p className="text-foreground text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">{t('game_lobby')}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card p-6 rounded-xl">
                    <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">{t('game_settings')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col">
                          <label className="flex flex-col min-w-40 flex-1">
                            <p className="text-foreground text-base font-medium leading-normal pb-2">{t('room_name')}</p>
                            <input
                              className="form-input flex w-full min-w-0 flex-1 rounded-lg text-foreground focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border bg-background h-11 placeholder:text-muted-foreground p-[15px] text-base font-normal leading-normal"
                              value={roomName}
                              onChange={e => setRoomName(e.target.value)}
                              onBlur={() => updateLobbyName(roomName)}
                            />
                          </label>
                        </div>
                        <div className="flex flex-col gap-2 p-4 border border-border rounded-lg">
                          <LobbySettingToggle
                            label={t('allow_hot_join')}
                            checked={settings.allowHotJoin}
                            onCheckedChange={() => updateSettings({ allowHotJoin: !settings.allowHotJoin })}
                            htmlFor="allow-hot-join"
                          />
                          <LobbySettingToggle
                            label={t('public_game')}
                            checked={settings.publicGame}
                            onCheckedChange={() => updateSettings({ publicGame: !settings.publicGame })}
                            htmlFor="game-visibility"
                          />
                          <LobbySettingToggle
                            label={t('allow_spectators')}
                            checked={settings.allowSpectators}
                            onCheckedChange={() => updateSettings({ allowSpectators: !settings.allowSpectators })}
                            htmlFor="allow-spectators"
                          />
                        </div>
                      </div>
                      <div className="bg-card p-6 rounded-xl">
                        <h2 className="text-foreground text-lg font-bold leading-tight tracking-[-0.015em] pb-4">{t('invite_friends')}</h2>
                        <div className="space-y-4">
                          <div>
                            <p className="text-muted-foreground text-sm font-medium leading-normal pb-2">{t('share_invite_link')}</p>
                            <div className="flex items-center gap-2">
                              <Input
                                className="text-sm w-full rounded-lg text-foreground border border-border bg-background h-11 px-3 placeholder:text-muted-foreground"
                                readOnly
                                type="text"
                                value={inviteLink}
                              />
                              <CopyButton
                                value={inviteLink}
                                label={t('copied')}
                                className="size-11 shrink-0 rounded-lg bg-muted/50 hover:bg-muted/70 text-foreground transition-colors"
                                variant="ghost"
                                size="icon"
                                side="top"
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm font-medium leading-normal pb-2">{t('or_use_room_code')}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-full rounded-lg border-2 border-dashed border-border h-11">
                                <p className="text-foreground font-bold text-lg tracking-widest">{currentLobby.code}</p>
                              </div>
                              <CopyButton
                                value={currentLobby.code || ''}
                                label={t('copied')}
                                className="size-11 shrink-0 rounded-lg bg-muted/50 hover:bg-muted/70 text-foreground transition-colors"
                                variant="ghost"
                                size="icon"
                                side="top"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card p-6 rounded-xl">
                    <GameModeTabs
                      settings={settings}
                      updateSettings={updateSettings}
                      lng={lng}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <LobbySettingToggle
                        label={t('allow_interrupts')}
                        checked={settings.allowInterrupts}
                        onCheckedChange={() => updateSettings({ allowInterrupts: !settings.allowInterrupts })}
                        disabled={settings.gameMode === 'fast' || settings.gameMode === 'solo'}
                        infoText="When enabled, players can interrupt and play cards out of turn. This is disabled in fast mode."
                        htmlFor="allow_interrupts"
                      />
                      <LobbySettingToggle
                        label={t('timer_per_turn')}
                        checked={settings.timerPerTurn}
                        onCheckedChange={() => updateSettings({ timerPerTurn: !settings.timerPerTurn })}
                        htmlFor="timer-per-turn"
                      />
                      <LobbySettingToggle
                        label={t('happy_ending_variant')}
                        checked={settings.happyEnding}
                        onCheckedChange={() => updateSettings({ happyEnding: !settings.happyEnding })}
                        htmlFor="happy-ending"
                      />
                      <LobbySettingToggle
                        label={t('enable_video_chat')}
                        checked={settings.enableVideoChat}
                        onCheckedChange={() => updateSettings({ enableVideoChat: !settings.enableVideoChat })}
                        htmlFor="enable-video-chat"
                      />

                      <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <LobbySettingToggle
                            label={t('enable_pacing_delay')}
                            checked={settings.enablePacingDelay}
                            onCheckedChange={() => updateSettings({ enablePacingDelay: !settings.enablePacingDelay })}
                            htmlFor="enable-pacing-delay"
                            infoText={t('pacing_delay_tooltip')}
                          />
                          {settings.enablePacingDelay && (
                            <span className="text-sm font-bold text-primary min-w-12 text-right">
                              {settings.pacingDelayDuration}
                              {t('seconds_abbrev')}
                            </span>
                          )}
                        </div>

                        {settings.enablePacingDelay && (
                          <div className="px-2 pb-2">
                            <Slider
                              defaultValue={[settings.pacingDelayDuration]}
                              max={30}
                              min={3}
                              step={1}
                              onValueChange={(vals: number[]) => updateSettings({ pacingDelayDuration: vals[0] })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-card p-6 rounded-xl">
                    <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">{t('decks')}</h2>
                    <div className="flex flex-col">
                      <p className="text-foreground text-base font-medium leading-normal pb-2">{t('select_decks_to_include')}</p>
                      <div className="space-y-2">
                        {decks.map(deck => (
                          <label
                            key={deck.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedDecks.includes(deck.id) ? 'bg-primary/20 border-primary' : 'hover:bg-muted/50 border-transparent'}`}
                          >
                            <Switch
                              checked={selectedDecks.includes(deck.id)}
                              onCheckedChange={() => {
                                if (!selectedDecks.includes(deck.id)) {
                                  updateSelectedDecks([...selectedDecks, deck.id])
                                }
                                else {
                                  updateSelectedDecks(selectedDecks.filter(id => id !== deck.id))
                                }
                              }}
                            />
                            <span className={`font-medium transition-colors ${selectedDecks.includes(deck.id) ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {deck.name}
                            </span>
                          </label>
                        ))}
                        {decks.length === 0 && (
                          <p className="text-muted-foreground text-sm italic">{t('no_decks_available')}</p>
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
                    <div className="mt-6 space-y-4">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium leading-normal pb-2 text-center">{t('choose_your_role')}</p>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
                          <Button
                            onClick={() => handleRoleChange('host')}
                            className={`px-4 py-2 text-sm font-bold ${currentPlayer?.role === 'host' ? '' : 'bg-transparent text-muted-foreground hover:bg-muted/70'}`}
                            variant={currentPlayer?.role === 'host' ? 'default' : 'ghost'}
                          >
                            {t('player')}
                          </Button>
                          <Button
                            onClick={() => handleRoleChange('spectator')}
                            className={`px-4 py-2 text-sm font-bold ${currentPlayer?.role === 'spectator' ? '' : 'bg-transparent text-muted-foreground hover:bg-muted/70'}`}
                            variant={currentPlayer?.role === 'spectator' ? 'default' : 'ghost'}
                          >
                            {t('spectator')}
                          </Button>
                        </div>
                      </div>
                      <button
                        onClick={startGame}
                        disabled={isStarting}
                        className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-4 bg-primary text-primary-foreground text-lg font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="truncate">{isStarting ? t('starting') : t('start_game')}</span>
                      </button>
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
