'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { getGuestIdentity } from '@/lib/auth/guestIdentity'
import { useTranslation } from '@/app/i18n/client'
import { languages } from '@/app/i18n/settings'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CreateLobbyButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const { t } = useTranslation(lng, 'common')
  const { getToken, userId } = useAuth()
  const { user } = useUser()
  const [selectedLanguage, setSelectedLanguage] = useState(lng)

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
        language: selectedLanguage,
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
    <div className="flex gap-2">
      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
        <SelectTrigger>
          <SelectValue placeholder={lng.toUpperCase()} />
        </SelectTrigger>
        <SelectContent>
          {languages.map(l => (
            <SelectItem key={l} value={l}>
              {l.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={handleCreate}
        disabled={loading}
        className="flex min-w-[84px] max-w-[480px] cursor-pointer px-4 text-white"
      >
        <span className="truncate">{loading ? t('creating') : t('create_new_story')}</span>
      </Button>
    </div>
  )
}
