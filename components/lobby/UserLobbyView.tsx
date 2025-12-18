'use client'

import { useState, useEffect } from 'react'
import { Copy as CopyIcon, Info as InfoIcon, Check as CheckIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { PlayerAvatar, getPlayerDisplayName } from './PlayerDisplay'
import { useParams } from 'next/navigation'
import { useTranslation } from '@/app/i18n/client'

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
  const { t } = useTranslation(lng, 'common')

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
  }, [lobby.id, supabase])

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('lobby_id', lobby.id)
      .order('joined_at', { ascending: true })
    if (data) setPlayers(data)
  }

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
                <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">{t('game_lobby')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-white/70">
                    {t('room_code')}
                    :
                  </span>
                  <span className="text-white font-bold text-lg tracking-widest">{currentLobby.code}</span>
                  <button className="flex items-center justify-center size-9 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                    <CopyIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white/5 p-6 rounded-xl opacity-70">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">{t('game_settings')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col">
                          <label className="flex flex-col min-w-40 flex-1">
                            <p className="text-white text-base font-medium leading-normal pb-2">{t('room_name')}</p>
                            <input className="form-input flex w-full min-w-0 flex-1 rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-white/10 bg-[#211c27] h-11 placeholder:text-white/40 p-[15px] text-base font-normal leading-normal disabled:opacity-50" disabled readOnly value={currentLobby.name} />
                          </label>
                        </div>
                        <div className="flex flex-col gap-2 p-4 border border-white/10 rounded-lg">
                          <div className="flex items-center justify-between py-2">
                            <label className="text-white text-base font-medium leading-normal" htmlFor="allow-hot-join">{t('allow_hot_join')}</label>
                            <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                              <input className="peer sr-only" disabled id="allow-hot-join" type="checkbox" checked={settings.allowHotJoin} />
                              <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                            </label>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <label className="text-white text-base font-medium leading-normal" htmlFor="game-visibility">{t('public_game')}</label>
                            <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                              <input className="peer sr-only" disabled id="game-visibility" type="checkbox" checked={settings.publicGame} />
                              <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                            </label>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <label className="text-white text-base font-medium leading-normal" htmlFor="allow-spectators">{t('allow_spectators')}</label>
                            <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                              <input className="peer sr-only" disabled id="allow-spectators" type="checkbox" checked={settings.allowSpectators} />
                              <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1"></div>
                    </div>
                  </div>
                  <div className="bg-white/5 p-6 rounded-xl opacity-70">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3">{t('game_rules')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <label className="text-white text-base font-medium leading-normal" htmlFor="allow-interrupts">{t('allow_interrupts')}</label>
                          <button className="text-white/50 hover:text-white transition-colors"><InfoIcon className="w-4 h-4" /></button>
                        </div>
                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                          <input className="peer sr-only" disabled id="allow-interrupts" type="checkbox" checked={settings.allowInterrupts} />
                          <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <label className="text-white text-base font-medium leading-normal" htmlFor="timer-per-turn">{t('timer_per_turn')}</label>
                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                          <input className="peer sr-only" disabled id="timer-per-turn" type="checkbox" checked={settings.timerPerTurn} />
                          <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <label className="text-white text-base font-medium leading-normal" htmlFor="happy-ending">{t('happy_ending_variant')}</label>
                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                          <input className="peer sr-only" disabled id="happy-ending" type="checkbox" checked={settings.happyEnding} />
                          <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <label className="text-white text-base font-medium leading-normal" htmlFor="enable-video-chat">{t('enable_video_chat')}</label>
                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                          <input className="peer sr-only" disabled id="enable-video-chat" type="checkbox" checked={settings.enableVideoChat} />
                          <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 p-6 rounded-xl opacity-70">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">{t('decks')}</h2>
                    <div className="flex flex-col">
                      <p className="text-white text-base font-medium leading-normal pb-2">{t('selected_decks')}</p>
                      <div className="space-y-2">
                        {decks.map(deck => (
                          <label
                            key={deck.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border pointer-events-none ${selectedDeckIds.includes(deck.id)
                              ? 'bg-primary/20 border-primary'
                              : 'border-transparent'
                            }`}
                          >
                            <input
                              className="form-checkbox rounded text-primary bg-transparent border-white/30 focus:ring-primary/50 focus:ring-offset-background-dark disabled:opacity-50"
                              disabled
                              type="checkbox"
                              checked={selectedDeckIds.includes(deck.id)}
                            />
                            <span className="text-white font-medium">{deck.name}</span>
                          </label>
                        ))}
                        {decks.length === 0 && (
                          <p className="text-white/40 text-sm italic">{t('no_decks_selected')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <div className="bg-white/5 p-6 rounded-xl flex-1 flex flex-col">
                    <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-4">
                      {t('players')}
                      {' '}
                      (
                      {displayedPlayers.filter(p => p.role !== 'spectator').length}
                      )
                    </h2>
                    <div className="flex-1 space-y-3 overflow-y-auto">
                      {displayedPlayers.filter(p => p.role !== 'spectator').map(player => (
                        <div key={player.id} className={`flex items-center gap-3 p-3 rounded-lg ${player.role === 'host' ? 'bg-primary/20 border border-primary' : 'bg-white/10'}`}>
                          <PlayerAvatar player={player} />
                          <div className="flex flex-col">
                            <p className="text-white font-bold truncate">{getPlayerDisplayName(player)}</p>
                            <p className={`text-xs font-semibold ${player.role === 'host' ? 'text-primary' : player.status === 'ready' ? 'text-green-400' : 'text-white/50'}`}>
                              {player.role === 'host' ? t('host') : player.status === 'ready' ? t('ready') : t('not_ready')}
                            </p>
                          </div>
                        </div>
                      ))}
                      {displayedPlayers.filter(p => p.role !== 'spectator').length === 0 && (
                        <p className="text-white/40 text-sm">{t('no_players_yet')}</p>
                      )}
                    </div>
                    <div className="mt-4">
                      <h3 className="text-white/70 text-sm font-bold leading-tight tracking-[-0.015em] pb-2 pt-4 border-t border-white/10">
                        {t('spectators')}
                        {' '}
                        (
                        {displayedPlayers.filter(p => p.role === 'spectator').length}
                        )
                      </h3>
                      <div className="space-y-3">
                        {displayedPlayers.filter(p => p.role === 'spectator').map(player => (
                          <div key={player.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                            <PlayerAvatar player={player} />
                            <p className="text-white/80 font-medium truncate">{getPlayerDisplayName(player)}</p>
                          </div>
                        ))}
                        {displayedPlayers.filter(p => p.role === 'spectator').length === 0 && (
                          <p className="text-white/40 text-sm">{t('no_spectators')}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto pt-6 space-y-4">
                      <div>
                        <p className="text-white/80 text-sm font-medium leading-normal pb-2 text-center">{t('choose_your_role')}</p>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-black/20">
                          <button className="px-4 py-2 text-sm font-bold rounded-md bg-primary text-white">{t('player')}</button>
                          <button className="px-4 py-2 text-sm font-bold rounded-md text-white/70 hover:bg-white/10">{t('spectator')}</button>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-4 bg-primary text-white text-lg font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors gap-2">
                          <CheckIcon className="w-5 h-5" />
                          <span className="truncate">{t('ready')}</span>
                        </button>
                        <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-4 bg-white/10 text-white/80 text-base font-bold leading-normal tracking-[0.015em] hover:bg-white/20 transition-colors">
                          <span className="truncate">{t('leave')}</span>
                        </button>
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
