'use client'

import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from '@/app/i18n/client'

export default function NewDeckButton() {
  const router = useRouter()
  const params = useParams()
  const lng = params.lng as string
  const { t } = useTranslation(lng, 'common')
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const token = await getToken({ template: 'supabase' })

      if (!token) {
        alert('Authentication required. Please sign in again.')
        setLoading(false)
        return
      }

      const supabase = createClient(token)

      // Debug: Log auth state
      await supabase.rpc('log_current_auth_state')

      const { data, error } = await supabase
        .from('decks')
        .insert({
          name: t('new_draft_deck'),
          description: t('deck_description'),
          is_active: false,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating deck:', error)
        alert(`Failed to create deck: ${error.message}`)
        setLoading(false)
      }
      else if (data) {
        router.push(`/${lng}/admin/decks/${data.id}`)
      }
    }
    catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="flex items-center justify-center h-9 px-4 rounded-lg bg-[#302839] hover:bg-[#3d3247] text-white text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading ? t('creating_deck') : t('new_deck')}
    </button>
  )
}
