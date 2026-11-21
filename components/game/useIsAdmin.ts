'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

/**
 * Whether the signed-in user has the admin flag in their profile row.
 * False while loading or for guests without a profile.
 */
export function useIsAdmin(userId: string | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const fetchAdminStatus = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', userId)
        .single()
      if (!cancelled && data) setIsAdmin(data.is_admin)
    }
    fetchAdminStatus()

    return () => {
      cancelled = true
    }
  }, [userId, supabase])

  return isAdmin
}
