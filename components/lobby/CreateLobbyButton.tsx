'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { getGuestId } from '@/lib/auth/guest'
import { resolvePlayerIdentity } from '@/lib/lobby/identity'
import { createLobby } from '@/app/actions/lobby'
import { getTranslation } from '@/app/i18n/client'
import { languages } from '@/app/i18n/settings'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CreateLobbyButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')
  const { userId } = useAuth()
  const { user } = useUser()
  const [selectedLanguage, setSelectedLanguage] = useState(lng)

  const handleCreate = async () => {
    setLoading(true)

    const guestId = getGuestId()
    const identity = resolvePlayerIdentity(user, guestId)

    const result = await createLobby({
      language: selectedLanguage,
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
