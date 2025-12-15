'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { useTranslation } from '@/app/i18n/client'
import { useParams } from 'next/navigation'
import AvatarUpload from './AvatarUpload'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface ProfileEditorProps {
  onSave?: () => void
}

export default function ProfileEditor({ onSave }: ProfileEditorProps) {
  const { user, isLoaded } = useUser()
  const [profile, setProfile] = useState<Partial<UserProfile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const params = useParams()
  const lng = params.lng as string
  const { t } = useTranslation(lng, 'common')

  // Form fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setDisplayName(data.display_name || '')
        setBio(data.bio || '')
        setAvatarUrl(data.avatar_url || '')
      }
      else {
        // Initialize with Clerk data for new profiles
        setDisplayName(user.fullName || user.username || '')
        setAvatarUrl(user.imageUrl || '')
      }
      setLoading(false)
    }

    if (isLoaded) {
      fetchProfile()
    }
  }, [user, isLoaded, supabase])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    setSaved(false)

    const profileData = {
      user_id: user.id,
      display_name: displayName || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert(profileData, { onConflict: 'user_id' })

    setSaving(false)

    if (error) {
      console.error('Error saving profile:', error)
      alert(t('save_error'))
    }
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSave?.()
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="bg-white/5 rounded-xl p-8 animate-pulse">
        <div className="flex flex-col items-center gap-6">
          <div className="size-32 rounded-full bg-white/10" />
          <div className="w-full max-w-md space-y-4">
            <div className="h-12 bg-white/10 rounded-lg" />
            <div className="h-24 bg-white/10 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-white/5 rounded-xl p-8 text-center">
        <p className="text-white/60">{t('sign_in_to_edit')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-xl p-8">
      <div className="flex flex-col items-center gap-8">
        <AvatarUpload
          value={avatarUrl}
          onChange={setAvatarUrl}
        />

        <div className="w-full max-w-md space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              {t('display_name')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={user.fullName || user.username || t('enter_name')}
              className="w-full h-12 px-4 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              {t('bio')}
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder={t('bio_placeholder')}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? (
                  <span>{t('saving')}</span>
                )
              : saved
                ? (
                    <>
                      <span className="material-symbols-outlined text-lg">check</span>
                      <span>{t('saved')}</span>
                    </>
                  )
                : (
                    <span>{t('save_profile')}</span>
                  )}
          </button>
        </div>
      </div>
    </div>
  )
}
