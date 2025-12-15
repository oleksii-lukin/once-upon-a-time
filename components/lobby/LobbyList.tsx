'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { useRouter, useParams } from 'next/navigation'
import { getGuestId } from '@/lib/auth/guest'
import { useTranslation } from '@/app/i18n/client'

type Lobby = Database['public']['Tables']['lobbies']['Row'] & {
  players: { count: number }[]
}

import { useUser } from '@clerk/nextjs'
import { getGuestIdentity } from '@/lib/auth/guestIdentity'

export default function LobbyList({ initialLobbies }: { initialLobbies: Lobby[] }) {
  const [lobbies, setLobbies] = useState<Lobby[]>(initialLobbies)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const { t } = useTranslation(lng, 'common')
  const { user } = useUser()

  const fetchLobbies = async () => {
    const { data } = await supabase
      .from('lobbies')
      .select('*, players(count)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (data) {
      setLobbies(data as unknown as Lobby[])
    }
  }

  useEffect(() => {
    fetchLobbies()

    const channel = supabase
      .channel('public:lobbies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
        },
        () => {
          fetchLobbies()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async (lobbyId: string) => {
    const guestId = getGuestId()

    // Check if already in lobby
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('lobby_id', lobbyId)
      .or(user ? `user_id.eq.${user.id},guest_id.eq.${guestId}` : `guest_id.eq.${guestId}`)
      .maybeSingle()

    if (!existingPlayer) {
      // Determine display info
      let displayName: string
      let avatarUrl: string | null = null

      if (user) {
        // Logged-in user - use Clerk info as fallback (DB trigger will override if profile exists)
        displayName = user.fullName || user.username || 'Player'
        avatarUrl = user.imageUrl || null
      }
      else {
        // Guest - generate fun identity
        const identity = getGuestIdentity(guestId)
        displayName = identity.name
        avatarUrl = `emoji:${identity.emoji}:${identity.color}`
      }

      const { error } = await supabase.from('players').insert({
        lobby_id: lobbyId,
        user_id: user?.id || null,
        guest_id: user ? null : guestId,
        role: 'player', // Default to player
        status: 'not_ready',
        display_name: displayName,
        avatar_url: avatarUrl,
      })

      if (error) {
        console.error('Error joining lobby:', error)
        return
      }
    }

    router.push(`/${lng}/lobbies/${lobbyId}?view=user`)
  }

  return (
    <div className="flex overflow-hidden rounded-xl border border-gray-200/20 dark:border-white/20 bg-gray-50/50 dark:bg-white/5">
      <table className="flex-1">
        <thead>
          <tr className="bg-gray-100/50 dark:bg-white/10">
            <th className="px-4 py-3 text-left text-gray-700 dark:text-white w-[40%] text-sm font-medium leading-normal">{t('room_name')}</th>
            <th className="px-4 py-3 text-left text-gray-700 dark:text-white w-[20%] text-sm font-medium leading-normal">{t('players')}</th>
            <th className="px-4 py-3 text-left text-gray-700 dark:text-white w-[20%] text-sm font-medium leading-normal">{t('status')}</th>
            <th className="px-4 py-3 text-left text-gray-500 dark:text-gray-400 w-[20%] text-sm font-medium leading-normal">{t('action')}</th>
          </tr>
        </thead>
        <tbody>
          {lobbies.map(lobby => (
            <tr key={lobby.id} className="border-t border-t-gray-200/20 dark:border-t-white/20 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              <td className="h-[72px] px-4 py-2 text-gray-800 dark:text-white text-sm font-normal leading-normal">{lobby.name}</td>
              <td className="h-[72px] px-4 py-2 text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal">
                {lobby.players?.[0]?.count || 0}
                {' '}
                {t('players')}
              </td>
              <td className="h-[72px] px-4 py-2 text-sm font-normal leading-normal">
                <div className={`flex items-center gap-2 ${lobby.status === 'playing' ? 'text-green-500' : 'text-yellow-500'}`}>
                  <span className="material-symbols-outlined text-base">
                    {lobby.status === 'playing' ? 'swords' : 'hourglass_top'}
                  </span>
                  <span className="capitalize">{t(lobby.status as 'waiting' | 'playing' | 'finished')}</span>
                </div>
              </td>
              <td className="h-[72px] px-4 py-2">
                <button
                  onClick={() => handleJoin(lobby.id)}
                  className="flex w-full min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-primary/20 text-primary text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/30 transition-colors"
                >
                  {lobby.status === 'playing' ? t('spectate') : t('join')}
                </button>
              </td>
            </tr>
          ))}
          {lobbies.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                {t('no_active_lobbies')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
