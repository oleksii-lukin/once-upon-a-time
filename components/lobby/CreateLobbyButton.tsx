'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getGuestId } from '@/lib/auth/guest';

export default function CreateLobbyButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { getToken } = useAuth();

    const handleCreate = async () => {
        setLoading(true);

        // Try to get auth token, but allow guest access
        const token = await getToken({ template: 'supabase' }).catch(() => null);
        const supabase = createClient(token || undefined);
        const guestId = getGuestId();

        // Create lobby
        const { data: lobby, error: lobbyError } = await supabase
            .from('lobbies')
            .insert({
                name: `Story ${Math.floor(Math.random() * 1000)}`, // Random name for now
                code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                created_by: guestId, // Using guest ID as creator for now
                status: 'waiting'
            })
            .select()
            .single();

        if (lobbyError) {
            console.error('Error creating lobby:', lobbyError);
            alert(`Failed to create lobby: ${lobbyError.message}`);
            setLoading(false);
            return;
        }

        // Add creator as host
        const { error: playerError } = await supabase
            .from('players')
            .insert({
                lobby_id: lobby.id,
                guest_id: guestId,
                role: 'host',
                status: 'ready'
            });

        if (playerError) {
            console.error('Error joining as host:', playerError);
        } else {
            router.push(`/lobbies/${lobby.id}`);
        }
        setLoading(false);
    };

    return (
        <button
            onClick={handleCreate}
            disabled={loading}
            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-70"
        >
            <span className="truncate">{loading ? 'Creating...' : 'Create New Story'}</span>
        </button>
    );
}
