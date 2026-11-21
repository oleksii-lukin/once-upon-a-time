'use client'

import { useEffect, useState, useRef } from 'react'
import { AlertCircle as AlertCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { resolvePlayerIdentity } from '@/lib/lobby/identity'
import { joinLobby } from '@/app/actions/lobby'
import { getTranslation } from '@/app/i18n/client'

interface InviteHandlerProps {
  code: string
  lng: string
}

export default function InviteHandler({ code, lng }: InviteHandlerProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'joining'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()
  const { userId, isLoaded: isAuthLoaded } = useAuth()
  const { user, isLoaded: isUserLoaded } = useUser()
  const { t } = getTranslation(lng, 'common')
  const joiningRef = useRef(false)

  useEffect(() => {
    // Wait for Clerk to finish loading before attempting to join
    if (!isAuthLoaded || !isUserLoaded) {
      return
    }

    const joinByCode = async () => {
      if (joiningRef.current) return
      joiningRef.current = true

      try {
        const guestId = getGuestId()
        const identity = resolvePlayerIdentity(user, guestId)

        setStatus('joining')

        const result = await joinLobby({
          code,
          joiner: {
            userId: userId || null,
            guestId,
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
          },
        })

        if (!result.ok) {
          setStatus('error')
          setErrorMessage(
            result.code === 'lobby_not_found'
              ? t('lobby_not_found', 'Lobby not found')
              : t('failed_to_join', 'Failed to join lobby'),
          )
          joiningRef.current = false
          return
        }

        router.push(`/${lng}/lobbies/${result.data.lobbyId}`)
      }
      catch (error) {
        console.error('Unexpected error:', error)
        setStatus('error')
        setErrorMessage(t('unexpected_error', 'An unexpected error occurred'))
        joiningRef.current = false
      }
    }

    joinByCode()
  }, [code, lng, userId, user, router, t, isAuthLoaded, isUserLoaded])

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-white p-4">
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-lg font-medium animate-pulse">
          {status === 'joining' ? t('joining_lobby', 'Joining lobby...') : t('finding_lobby', 'Finding lobby...')}
        </p>
      </div>
    </div>
  )
}
