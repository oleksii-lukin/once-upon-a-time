import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function readLogs() {
  console.log('🔍 Reading debug logs...')
  const { data, error } = await supabase
    .from('debug_auth_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ Error reading logs:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('⚠️ No logs found. Try creating a deck first.')
    return
  }

  console.log('\n--- Auth Debug Logs ---')
  data.forEach((log) => {
    console.log(`Time: ${log.timestamp}`)
    console.log(`Role: ${log.auth_role}`)
    console.log(`UID:  ${log.auth_uid}`)
    console.log(`JWT:  ${JSON.stringify(log.jwt_claims, null, 2)}`)
    console.log('-----------------------')
  })
}

readLogs()
