'use client'

import { useState, useEffect, useCallback } from 'react'
import { Info as InfoIcon, Check as CheckIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { PlayerAvatar, getPlayerDisplayName } from './PlayerDisplay'
import { useParams } from 'next/navigation'
import { getTranslation } from '@/app/i18n/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import CopyButton from '@/components/common/CopyButton'

type Lobby = Database['public']['Tables']['lobbies']['Row']
type Player = Database['public']['Tables']['players']['Row']
type Deck = Database['public']['Tables']['decks']['Row']

interface UserLobbyViewProps {
  lobby: Lobby
  initialPlayers: Player[]
}

export default function UserLobbyView({ lobby, initialPlayers }: UserLobbyViewProps) {
  const { user } = useUser()
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [currentLobby, setCurrentLobby] = useState<Lobby>(lobby)
  const [selectedRole, setSelectedRole] = useState('Storyteller')
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const supabase = createClient()
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')

  // Default settings
  const defaultSettings = {
    allowHotJoin: true,
    publicGame: true,
    allowSpectators: true,
    allowInterrupts: true,
    timerPerTurn: false,
    happyEnding: false,
    enableVideoChat: true,
  }

  const settings = currentLobby.settings && typeof currentLobby.settings === 'object'
    ? { ...defaultSettings, ...(currentLobby.settings as any) }
    : defaultSettings

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
          const lobbySelectedDecks = (currentLobby.settings as any).selectedDecks
          if (lobbySelectedDecks && Array.isArray(lobbySelectedDecks)) {
            setSelectedDeckIds(lobbySelectedDecks)
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
        (payload) => {
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
        (payload) => {
          if (payload.new) {
            const updatedLobby = payload.new as Lobby
            setCurrentLobby(updatedLobby)
            // Update selected decks when host changes them
            if (updatedLobby.settings && typeof updatedLobby.settings === 'object') {
              const lobbySelectedDecks = (updatedLobby.settings as any).selectedDecks
              if (lobbySelectedDecks && Array.isArray(lobbySelectedDecks)) {
                setSelectedDeckIds(lobbySelectedDecks)
              }
            }
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
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)

  // 1. Setup channel (run once)
  useEffect(() => {
    const newChannel = supabase.channel(`lobby:${lobby.id}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = newChannel.presenceState()
        const onlineIds = new Set<string>()
        for (const key in newState) {
          newState[key].forEach((presence: any) => {
            if (presence.player_id) onlineIds.add(presence.player_id)
          })
        }
        setOnlineUsers(onlineIds)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          newPresences.forEach((p: any) => {
            if (p.player_id) next.add(p.player_id)
          })
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          leftPresences.forEach((p: any) => {
            if (p.player_id) next.delete(p.player_id)
          })
          return next
        })
      })
      .subscribe()

    setChannel(newChannel)

    return () => {
      supabase.removeChannel(newChannel)
    }
  }, [lobby.id, supabase])

  // 2. Track presence when player ID is available
  useEffect(() => {
    if (!channel) return

    const guestId = !user ? getGuestId() : undefined
    const currentPlayer = players.find(p =>
      (user && p.user_id === user.id)
      || (!user && p.guest_id === guestId),
    )
    const playerId = currentPlayer?.id

    if (playerId) {
      channel.track({
        player_id: playerId,
        user_id: user?.id,
        guest_id: guestId,
      })
    }
  }, [channel, user, players])

  // Filter players to only show online ones (plus self)
  const displayedPlayers = players.filter((p) => {
    const isSelf = (user && p.user_id === user.id) || (!user && p.guest_id === getGuestId())
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
                          <div className="flex items-center justify-between py-2">
                            <Label className="text-foreground text-base font-medium leading-normal" htmlFor="allow-hot-join">{t('allow_hot_join')}</Label>
                            <Switch checked={settings.allowHotJoin} disabled id="allow-hot-join" />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <Label className="text-foreground text-base font-medium leading-normal" htmlFor="game-visibility">{t('public_game')}</Label>
                            <Switch checked={settings.publicGame} disabled id="game-visibility" />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <Label className="text-foreground text-base font-medium leading-normal" htmlFor="allow-spectators">{t('allow_spectators')}</Label>
                            <Switch checked={settings.allowSpectators} disabled id="allow-spectators" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1"></div>
                    </div>
                  </div>
                  <div className="bg-card p-6 rounded-xl opacity-70">
                    <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3">{t('game_rules')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-foreground text-base font-medium leading-normal" htmlFor="allow-interrupts">{t('allow_interrupts')}</Label>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground transition-colors"><InfoIcon className="w-4 h-4" /></Button>
                        </div>
                        <Switch checked={settings.allowInterrupts} disabled id="allow-interrupts" />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <Label className="text-foreground text-base font-medium leading-normal" htmlFor="timer-per-turn">{t('timer_per_turn')}</Label>
                        <Switch checked={settings.timerPerTurn} disabled id="timer-per-turn" />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <Label className="text-foreground text-base font-medium leading-normal" htmlFor="happy-ending">{t('happy_ending_variant')}</Label>
                        <Switch checked={settings.happyEnding} disabled id="happy-ending" />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <Label className="text-foreground text-base font-medium leading-normal" htmlFor="enable-video-chat">{t('enable_video_chat')}</Label>
                        <Switch checked={settings.enableVideoChat} disabled id="enable-video-chat" />
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
                          <Button className="px-4 py-2 text-sm font-bold">{t('player')}</Button>
                          <Button variant="ghost" className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted/70">{t('spectator')}</Button>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button className="min-w-[84px] w-full h-14 px-4 text-primary-foreground text-lg font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 gap-2">
                          <CheckIcon className="w-5 h-5" />
                          <span className="truncate">{t('ready')}</span>
                        </Button>
                        <Button variant="ghost" className="min-w-[84px] h-14 px-4 bg-muted/50 text-muted-foreground text-base font-bold leading-normal tracking-[0.015em] hover:bg-muted/70">
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
