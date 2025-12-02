import { createBrowserClient } from '@supabase/ssr';

export function createClient(supabaseAccessToken?: string) {
    if (supabaseAccessToken) console.log('🔌 createClient initialized with token:', supabaseAccessToken.substring(0, 10) + '...');
    else console.log('🔌 createClient initialized without token');

    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        supabaseAccessToken ? {
            global: {
                headers: {
                    Authorization: `Bearer ${supabaseAccessToken}`,
                },
            },
        } : undefined
    );
}
