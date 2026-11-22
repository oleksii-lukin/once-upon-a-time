import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types'

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * Used by the game/lobby server actions after Phase 2 dropped the public
 * write policies: the actions are the only write path, and they authorize
 * the caller (Clerk session or guest secret cookie) before touching the
 * DB. Never import this from client components — the key must never reach
 * the browser.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set (add the local value from `supabase status` to .env.local)',
    )
  }
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
