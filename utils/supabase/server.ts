import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import type { Database } from '@/supabase/types'

export async function createClient() {
  const cookieStore = await cookies()
  const { getToken } = await auth()
  // Third-party auth (Clerk session token verified by Supabase via Clerk's
  // JWKS). Plain getToken() replaces the deprecated `supabase` JWT template.
  // Note: the `accessToken` client option is NOT usable here — @supabase/ssr
  // calls supabase.auth.onAuthStateChange, which supabase-js forbids when
  // accessToken is configured.
  const token = await getToken()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          }
          catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: token
        ? {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        : undefined,
    },
  )
}
