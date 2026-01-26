'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { getGuestIdentity } from '@/lib/auth/guestIdentity'
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
  const { getToken, userId } = useAuth()
  const { user } = useUser()

  const handleCreate = async () => {
    setLoading(true)

    // Try to get auth token, but allow guest access
    const token = await getToken({ template: 'supabase' }).catch(() => null)
    const supabase = createClient(token || undefined)
    const guestId = getGuestId()

    // Determine display info
    let displayName: string
    let avatarUrl: string | null = null

    if (user) {
      // Logged-in user - use Clerk info
      displayName = user.fullName || user.username || 'Player'
      avatarUrl = user.imageUrl || null
    }
    else {
      // Guest - generate fun identity
      const identity = getGuestIdentity(guestId)
      displayName = identity.name
      // For guests, we'll use emoji as avatar (stored as special prefix)
      avatarUrl = `emoji:${identity.emoji}:${identity.color}`
    }

    // Create lobby
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .insert({
        name: `Story ${Math.floor(Math.random() * 1000)}`, // Random name for now
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_by: userId || guestId,
        status: 'waiting',
        language: lng,
      })
      .select()
      .single()

    if (lobbyError) {
      console.error('Error creating lobby:', lobbyError)
      alert(`Failed to create lobby: ${lobbyError.message}`)
      setLoading(false)
      return
    }

    // Add creator as host
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        lobby_id: lobby.id,
        user_id: userId || null,
        guest_id: userId ? null : guestId,
        role: 'host',
        status: 'ready',
        display_name: displayName,
        avatar_url: avatarUrl,
      })

    if (playerError) {
      console.error('Error joining as host:', playerError)
    }
    else {
      router.push(`/${lng}/lobbies/${lobby.id}`)
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
