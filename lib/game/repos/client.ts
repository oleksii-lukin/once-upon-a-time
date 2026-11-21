import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/types'

/**
 * Data-access layer for game tables.
 *
 * Every repository function takes the Supabase client as its first
 * parameter — no module-level client, no side effects at import time.
 * Repositories contain query logic only: no game rules, no orchestration
 * (that lives in server actions under app/actions) and no UI concerns.
 *
 * Functions return raw Supabase result objects (`{ data, error }`) so
 * callers keep control over error handling and retries.
 */
export type GameClient = SupabaseClient<Database>

export type { Database }
