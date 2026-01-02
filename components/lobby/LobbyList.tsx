'use client'

import { useState, useEffect } from 'react'
import { Sword as SwordIcon, Hourglass as HourglassIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { useRouter, useParams } from 'next/navigation'
import { getGuestId } from '@/lib/auth/guest'
import { getTranslation } from '@/app/i18n/client'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'

export type Lobby = Database['public']['Tables']['lobbies']['Row'] & {
  players: { count: number }[]
}

import { useUser } from '@clerk/nextjs'
import { getGuestIdentity } from '@/lib/auth/guestIdentity'
import { Button } from '@/components/ui/button'

export default function LobbyList({ initialLobbies }: { initialLobbies: Lobby[] }) {
  const [lobbies, setLobbies] = useState<Lobby[]>(initialLobbies)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')
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
    <div className="flex overflow-hidden rounded-xl border border-border bg-card">
      <Table className="flex-1">
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="px-4 py-3 w-[40%] text-sm font-medium leading-normal text-muted-foreground">{t('room_name')}</TableHead>
            <TableHead className="px-4 py-3 w-[20%] text-sm font-medium leading-normal text-muted-foreground">{t('players')}</TableHead>
            <TableHead className="px-4 py-3 w-[20%] text-sm font-medium leading-normal text-muted-foreground">{t('status')}</TableHead>
            <TableHead className="px-4 py-3 w-[20%] text-sm font-medium leading-normal text-muted-foreground">{t('action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lobbies.map(lobby => (
            <TableRow key={lobby.id} className="transition-colors">
              <TableCell className="h-[72px] px-4 py-2 text-sm font-normal leading-normal text-foreground">{lobby.name}</TableCell>
              <TableCell className="h-[72px] px-4 py-2 text-sm font-normal leading-normal text-muted-foreground">
                {lobby.players?.[0]?.count || 0}
                {' '}
                {t('players')}
              </TableCell>
              <TableCell className="h-[72px] px-4 py-2 text-sm font-normal leading-normal">
                <div className={`flex items-center gap-2 ${lobby.status === 'playing' ? 'text-green-500' : 'text-yellow-500'}`}>
                  {lobby.status === 'playing'
                    ? (
                        <SwordIcon className="w-4 h-4" />
                      )
                    : (
                        <HourglassIcon className="w-4 h-4" />
                      )}
                  <span className="capitalize">{t(lobby.status as 'waiting' | 'playing' | 'finished')}</span>
                </div>
              </TableCell>
              <TableCell className="h-[72px] px-4 py-2">
                <Button
                  onClick={() => handleJoin(lobby.id)}
                  className="w-full min-w-[84px] max-w-[480px] h-9 px-4 text-primary text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/30 transition-colors"
                  variant="outline"
                >
                  {lobby.status === 'playing' ? t('spectate') : t('join')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {lobbies.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                {t('no_active_lobbies')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
