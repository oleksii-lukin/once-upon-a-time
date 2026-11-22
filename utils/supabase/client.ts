import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/supabase/types'

let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null
let currentToken: string | undefined = undefined

export function createClient(supabaseAccessToken?: string) {
  // Return existing client if token hasn't changed
  if (supabaseClient && currentToken === supabaseAccessToken) {
    return supabaseClient
  }

  // Cleanup previous client if it exists
  if (supabaseClient) {
    try {
      supabaseClient.removeAllChannels()
    }
    catch (error) {
      console.warn('Error cleaning up previous Supabase client:', error)
    }
  }

  // Create new client if token changed or no client exists
  if (supabaseAccessToken) console.log('🔌 createClient initialized with token:', supabaseAccessToken.substring(0, 10) + '...')
  else console.log('🔌 createClient initialized without token')

  supabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr caches the FIRST client it creates and ignores later
      // options — which silently defeated per-call tokens (every createClient
      // call after the initial anon one returned the anon client). This
      // module already implements its own token-aware singleton below.
      isSingleton: false,
      ...(supabaseAccessToken
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${supabaseAccessToken}`,
              },
            },
          }
        : {}),
    },
  )

  currentToken = supabaseAccessToken
  return supabaseClient
}
