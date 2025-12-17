'use client'

import { useEffect, useState, useRef } from 'react'
import { AlertCircle as AlertCircleIcon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { getGuestIdentity } from '@/lib/auth/guestIdentity'
import { useTranslation } from '@/app/i18n/client'

interface InviteHandlerProps {
  code: string
  lng: string
}

export default function InviteHandler({ code, lng }: InviteHandlerProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'joining'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()
  const { getToken, userId, isLoaded: isAuthLoaded } = useAuth()
  const { user, isLoaded: isUserLoaded } = useUser()
  const { t } = useTranslation(lng, 'common')
  const joiningRef = useRef(false)

  useEffect(() => {
    // Wait for Clerk to finish loading before attempting to join
    if (!isAuthLoaded || !isUserLoaded) {
      return
    }

    const joinLobby = async () => {
      if (joiningRef.current) return
      joiningRef.current = true

      try {
        const token = await getToken({ template: 'supabase' }).catch(() => null)
        const supabase = createClient(token || undefined)
        const guestId = getGuestId()

        console.log('Joining lobby - userId:', userId, 'user:', user?.fullName)

        // 1. Find lobby by code (case-insensitive)
        const { data: lobby, error: lobbyError } = await supabase
          .from('lobbies')
          .select('id')
          .ilike('code', code)
          .single()

        if (lobbyError || !lobby) {
          setStatus('error')
          setErrorMessage(t('lobby_not_found', 'Lobby not found'))
          joiningRef.current = false
          return
        }

        setStatus('joining')

        // 2. Check if already a player
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('lobby_id', lobby.id)
          .or(`user_id.eq.${userId || 'non_existent'},guest_id.eq.${guestId}`)
          .maybeSingle()

        if (existingPlayer) {
          router.push(`/${lng}/lobbies/${lobby.id}`)
          return
        }

        // Determine display info - now Clerk is definitely loaded
        let displayName: string
        let avatarUrl: string | null = null

        if (user) {
          // Logged-in user - use Clerk info
          displayName = user.fullName || user.username || 'Player'
          avatarUrl = user.imageUrl || null
          console.log('Using Clerk user info:', displayName, avatarUrl)
        }
        else {
          // Guest - generate fun identity
          const identity = getGuestIdentity(guestId)
          displayName = identity.name
          avatarUrl = `emoji:${identity.emoji}:${identity.color}`
          console.log('Using guest identity:', displayName)
        }

        // 3. Join lobby
        const { error: joinError } = await supabase
          .from('players')
          .insert({
            lobby_id: lobby.id,
            user_id: userId || null,
            guest_id: userId ? null : guestId,
            role: 'player',
            status: 'not_ready',
            display_name: displayName,
            avatar_url: avatarUrl,
          })

        if (joinError) {
          console.error('Error joining lobby:', joinError)
          setStatus('error')
          setErrorMessage(t('failed_to_join', 'Failed to join lobby'))
          joiningRef.current = false
          return
        }

        router.push(`/${lng}/lobbies/${lobby.id}`)
      }
      catch (error) {
        console.error('Unexpected error:', error)
        setStatus('error')
        setErrorMessage(t('unexpected_error', 'An unexpected error occurred'))
        joiningRef.current = false
      }
    }

    joinLobby()
  }, [code, lng, getToken, userId, user, router, t, isAuthLoaded, isUserLoaded])

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#141118] text-white p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 max-w-md w-full text-center">
          <AlertCircleIcon className="w-10 h-10 text-red-500 mb-4 inline-block" />
          <h1 className="text-xl font-bold mb-2">{t('error', 'Error')}</h1>
          <p className="text-white/70 mb-6">{errorMessage}</p>
          <button
            onClick={() => router.push(`/${lng}`)}
            className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors"
          >
            {t('back_to_home', 'Back to Home')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#141118] text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-lg font-medium animate-pulse">
          {status === 'joining' ? t('joining_lobby', 'Joining lobby...') : t('finding_lobby', 'Finding lobby...')}
        </p>
      </div>
    </div>
  )
}
