import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * RLS integration suite — runs against the LOCAL Supabase PostgREST
 * (needs `supabase start`), so it is kept out of the default unit gate.
 * Run with: pnpm test:rls
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 90_000,
    // RLS probes mutate shared local state — run files serially
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
