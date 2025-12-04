'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/supabase/types';
import AdminLobbyView from './AdminLobbyView';
import UserLobbyView from './UserLobbyView';
import GameView from '../game/GameView';

type Lobby = Database['public']['Tables']['lobbies']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

interface LobbyManagerProps {
    initialLobby: Lobby;
    initialPlayers: Player[];
    isHost: boolean;
    userId: string | null;
    guestId: string | undefined;
}

export default function LobbyManager({
    initialLobby,
    initialPlayers,
    isHost,
    userId,
    guestId
}: LobbyManagerProps) {
    const [lobby, setLobby] = useState<Lobby>(initialLobby);
    const [players, setPlayers] = useState<Player[]>(initialPlayers);
    const supabase = createClient();

    useEffect(() => {
        // Subscribe to lobby changes (e.g., status change to 'in_game')
        const lobbyChannel = supabase
            .channel(`lobby:${lobby.id}:manager`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobby.id}` },
                (payload) => {
                    if (payload.new) {
                        setLobby(payload.new as Lobby);
                    }
                }
            )
            .subscribe();

        // Subscribe to player changes
        const playersChannel = supabase
            .channel(`lobby:${lobby.id}:players_manager`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'players', filter: `lobby_id=eq.${lobby.id}` },
                async () => {
                    const { data } = await supabase
                        .from('players')
                        .select('*')
                        .eq('lobby_id', lobby.id);
                    if (data) setPlayers(data);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(lobbyChannel);
            supabase.removeChannel(playersChannel);
        };
    }, [lobby.id, supabase]);

    if (lobby.status === 'playing') {
        return <GameView lobby={lobby} players={players} currentUserId={userId} currentGuestId={guestId} />;
    }

    if (isHost) {
        return <AdminLobbyView lobby={lobby} initialPlayers={players} />;
    }

    return <UserLobbyView lobby={lobby} initialPlayers={players} />;
}
