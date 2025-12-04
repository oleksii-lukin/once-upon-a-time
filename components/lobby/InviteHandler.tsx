'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getGuestId } from '@/lib/auth/guest';
import { useTranslation } from '@/app/i18n/client';

interface InviteHandlerProps {
    code: string;
    lng: string;
}

export default function InviteHandler({ code, lng }: InviteHandlerProps) {
    const [status, setStatus] = useState<'loading' | 'error' | 'joining'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const router = useRouter();
    const { getToken, userId } = useAuth();
    const { t } = useTranslation(lng, 'common');

    useEffect(() => {
        const joinLobby = async () => {
            try {
                const token = await getToken({ template: 'supabase' }).catch(() => null);
                const supabase = createClient(token || undefined);
                const guestId = getGuestId();

                console.log('Searching for lobby with code:', code);

                // 1. Find lobby by code (case-insensitive)
                const { data: lobby, error: lobbyError } = await supabase
                    .from('lobbies')
                    .select('id')
                    .ilike('code', code) // Case-insensitive search
                    .single();

                console.log('Lobby search result:', { lobby, lobbyError });

                if (lobbyError || !lobby) {
                    setStatus('error');
                    setErrorMessage(t('lobby_not_found', 'Lobby not found'));
                    return;
                }

                setStatus('joining');

                // 2. Check if already a player
                const { data: existingPlayer } = await supabase
                    .from('players')
                    .select('id')
                    .eq('lobby_id', lobby.id)
                    .or(`user_id.eq.${userId || 'non_existent'},guest_id.eq.${guestId}`)
                    .maybeSingle();

                if (existingPlayer) {
                    router.push(`/${lng}/lobbies/${lobby.id}`);
                    return;
                }

                // 3. Join lobby
                const { error: joinError } = await supabase
                    .from('players')
                    .insert({
                        lobby_id: lobby.id,
                        user_id: userId || null,
                        guest_id: userId ? null : guestId, // Only use guest_id if not logged in
                        role: 'player', // Default role
                        status: 'not_ready'
                    });

                if (joinError) {
                    console.error('Error joining lobby:', joinError);
                    setStatus('error');
                    setErrorMessage(t('failed_to_join', 'Failed to join lobby'));
                    return;
                }

                router.push(`/${lng}/lobbies/${lobby.id}`);

            } catch (error) {
                console.error('Unexpected error:', error);
                setStatus('error');
                setErrorMessage(t('unexpected_error', 'An unexpected error occurred'));
            }
        };

        joinLobby();
    }, [code, lng, getToken, userId, router, t]);

    if (status === 'error') {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#141118] text-white p-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 max-w-md w-full text-center">
                    <span className="material-symbols-outlined text-4xl text-red-500 mb-4">error</span>
                    <h1 className="text-xl font-bold mb-2">{t('error', 'Error')}</h1>
                    <p className="text-white/70 mb-6">{errorMessage}</p>
                    <button
                        onClick={() => router.push(`/${lng}`)}
                        className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors"
                    >
                        {t('back_to_home', 'Back to Home')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#141118] text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-lg font-medium animate-pulse">
                    {status === 'joining' ? t('joining_lobby', 'Joining lobby...') : t('finding_lobby', 'Finding lobby...')}
                </p>
            </div>
        </div>
    );
}
