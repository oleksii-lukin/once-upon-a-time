'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getGuestId } from '@/lib/auth/guest';
import { useTranslation } from '@/app/i18n/client';
import { languages } from '@/app/i18n/settings';

export default function CreateLobbyButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const params = useParams();
    const lng = params.lng as string;
    const { t } = useTranslation(lng, 'common');
    const { getToken } = useAuth();
    const [selectedLanguage, setSelectedLanguage] = useState(lng);

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
                status: 'waiting',
                language: selectedLanguage
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
            router.push(`/${lng}/lobbies/${lobby.id}`);
        }
        setLoading(false);
    };

    return (
        <div className="flex gap-2">
            <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="rounded-lg border border-gray-200/20 bg-gray-100 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
                {languages.map((l) => (
                    <option key={l} value={l}>
                        {l.toUpperCase()}
                    </option>
                ))}
            </select>
            <button
                onClick={handleCreate}
                disabled={loading}
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-70"
            >
                <span className="truncate">{loading ? t('creating') : t('create_new_story')}</span>
            </button>
        </div>
    );
}
