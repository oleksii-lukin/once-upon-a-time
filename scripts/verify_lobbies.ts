import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: lobbies, error } = await supabase
        .from('lobbies')
        .select('*, players(count)');

    if (error) {
        console.error('Error fetching lobbies:', error);
    } else {
        console.log(`Found ${lobbies.length} lobbies:`);
        lobbies.forEach(l => console.log(`- ${l.name} (${l.players[0].count} players)`));
    }
}

main().catch(console.error);
