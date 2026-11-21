'use client'

import { useState, useEffect } from 'react'
import { Sword as SwordIcon, Hourglass as HourglassIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { getGuestId } from '@/lib/auth/guest'
import { getTranslation } from '@/app/i18n/client'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { LobbyWithPlayerCount as Lobby, LobbySettingsSchema } from '@/types/model'

import { useUser } from '@clerk/nextjs'
import { resolvePlayerIdentity } from '@/lib/lobby/identity'
import { joinLobby } from '@/app/actions/lobby'
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
      const filtered = (data as unknown as Lobby[]).filter((lobby) => {
        // If not playing, always show
        if (lobby.status !== 'playing') return true

        // If playing, check allowSpectators
        const settingsResult = LobbySettingsSchema.safeParse(lobby.settings)
        const settings = settingsResult.success ? settingsResult.data : LobbySettingsSchema.parse({})
        return settings.allowSpectators !== false
      })
      setLobbies(filtered)
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
    const identity = resolvePlayerIdentity(user, guestId)

    const result = await joinLobby({
      lobbyId,
      joiner: {
        userId: user?.id || null,
        guestId,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
      },
    })

    if (!result.ok) {
      console.error('Error joining lobby:', result.error)
      return
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
