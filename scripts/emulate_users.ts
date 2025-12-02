import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LOBBY_NAMES = [
    "The Dragon's Lair",
    "Elara's Grand Tale",
    "The Forgotten Kingdom",
    "Sir Reginald's Quest",
    "Mystery of the Woods",
    "Ocean's Whisper"
];

const USER_NAMES = [
    "AlexDoe", "JaneSmith", "MikeP", "StoryMaster", "BardOfAvon", "GrimmReaper"
];

async function main() {
    console.log('Starting user emulation...');

    // Create a few lobbies
    for (const name of LOBBY_NAMES) {
        const hostId = uuidv4(); // Simulate a user ID (or guest ID used as user ID for now since we relaxed constraints)
        // Actually, our schema now allows user_id to be text.

        console.log(`Creating lobby: ${name}`);

        const { data: lobby, error: lobbyError } = await supabase
            .from('lobbies')
            .insert({
                code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                name: name,
                created_by: hostId,
                status: Math.random() > 0.7 ? 'playing' : 'waiting'
            })
            .select()
            .single();

        if (lobbyError) {
            console.error(`Error creating lobby ${name}:`, lobbyError);
            continue;
        }

        // Add host as player
        await supabase.from('players').insert({
            lobby_id: lobby.id,
            user_id: hostId,
            role: 'host',
            status: 'ready'
        });

        // Add some random players
        const numPlayers = Math.floor(Math.random() * 4);
        for (let i = 0; i < numPlayers; i++) {
            const guestId = uuidv4();
            const randomUser = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];

            await supabase.from('players').insert({
                lobby_id: lobby.id,
                guest_id: guestId,
                role: 'player',
                status: Math.random() > 0.5 ? 'ready' : 'not_ready'
            });
        }
    }

    console.log('Emulation complete.');
}

main().catch(console.error);
