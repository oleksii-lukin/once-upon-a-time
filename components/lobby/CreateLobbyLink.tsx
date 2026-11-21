'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { resolvePlayerIdentity } from '@/lib/lobby/identity'
import { createLobby } from '@/app/actions/lobby'
import { getTranslation } from '@/app/i18n/client'

export default function CreateLobbyLink({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')
  const { userId } = useAuth()
  const { user } = useUser()

  const handleCreate = async () => {
    setLoading(true)

    const guestId = getGuestId()
    const identity = resolvePlayerIdentity(user, guestId)

    const result = await createLobby({
      language: lng,
      creator: {
        userId: userId || null,
        guestId,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
      },
    })

    if (result.ok) {
      router.push(`/${lng}/lobbies/${result.data.id}`)
    }
    else {
      console.error('Error creating lobby:', result.error)
      alert(`Failed to create lobby: ${result.error}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className={className}
    >
      {loading ? t('creating') : children}
    </button>
  )
}
