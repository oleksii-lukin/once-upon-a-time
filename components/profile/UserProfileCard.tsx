'use client'

import { useState, useEffect } from 'react'
import { User as UserIcon, Edit as EditIcon } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/supabase/types'
import { getTranslation } from '@/app/i18n/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface UserProfileCardProps {
  compact?: boolean
}

export default function UserProfileCard({ compact = false }: UserProfileCardProps) {
  const { user, isLoaded } = useUser()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const params = useParams()
  const lng = params.lng as string
  const { t } = getTranslation(lng, 'common')

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
      }

      if (data) {
        setProfile(data)
      }
      setLoading(false)
    }

    if (isLoaded) {
      fetchProfile()
    }
  }, [user, isLoaded, supabase])

  // Show loading state
  if (!isLoaded || loading) {
    return (
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200/20 dark:border-white/20 rounded-xl p-6 flex flex-col items-center text-center animate-pulse">
        <div className="bg-gray-200 dark:bg-white/10 rounded-full size-24 mb-4" />
        <div className="h-6 w-24 bg-gray-200 dark:bg-white/10 rounded mb-2" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
    )
  }

  // Guest user (not signed in)
  if (!user) {
    return (
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200/20 dark:border-white/20 rounded-xl p-6 flex flex-col items-center text-center">
        <div className="bg-gray-200 dark:bg-white/20 rounded-full size-24 mb-4 flex items-center justify-center">
          <UserIcon className="w-10 h-10 text-gray-400 dark:text-white/40" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('guest_user')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('sign_in_to_track')}</p>
      </div>
    )
  }

  // Get display values (profile data takes precedence over Clerk data)
  const displayName = profile?.display_name || user.fullName || user.username || 'Player'
  const avatarUrl = profile?.avatar_url || user.imageUrl
  const bio = profile?.bio || t('storyteller_extraordinaire')
  const gamesPlayed = profile?.total_games_played || 0
  const gamesWon = profile?.total_games_won || 0
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0

  return (
    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200/20 dark:border-white/20 rounded-xl p-6 flex flex-col items-center text-center">
      <div
        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-24 mb-4 ring-2 ring-primary/30"
        style={{ backgroundImage: `url("${avatarUrl}")` }}
      />
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{bio}</p>

      <div className="w-full h-px bg-gray-200/20 dark:bg-white/20 my-4" />

      <div className="grid grid-cols-3 gap-4 w-full">
        <div className="flex flex-col">
          <span className="text-lg font-bold text-primary">{gamesPlayed}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('games_played')}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold text-primary">{gamesWon}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('games_won')}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold text-primary">
            {winRate}
            %
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('win_rate')}</span>
        </div>
      </div>

      {!compact && (
        <Link
          href={`/${lng}/profile`}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-gray-700 dark:text-white text-sm font-medium transition-colors"
        >
          <EditIcon className="w-4 h-4" />
          {t('edit_profile')}
        </Link>
      )}
    </div>
  )
}
