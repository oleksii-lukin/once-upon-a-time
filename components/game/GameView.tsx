'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database } from '@/supabase/types';
import { createClient } from '@/utils/supabase/client';
import PlayerHand from './PlayerHand';
import TableArea from './TableArea';
import GameSidebar from './GameSidebar';

type Lobby = Database['public']['Tables']['lobbies']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string; played_by?: string };
type GameSession = Database['public']['Tables']['game_sessions']['Row'];

interface GameViewProps {
    lobby: Lobby;
    players: Player[];
    currentUserId: string | null;
    currentGuestId: string | undefined;
}

export default function GameView({ lobby, players, currentUserId, currentGuestId }: GameViewProps) {
    const [gameSession, setGameSession] = useState<GameSession | null>(null);
    const [hand, setHand] = useState<CardData[]>([]);
    const [playedCards, setPlayedCards] = useState<CardData[]>([]);
    const supabase = createClient();

    // Determine current player ID (user or guest)
    const currentPlayerId = currentUserId || currentGuestId || null;
    const currentPlayer = players.find(p =>
        (currentUserId && p.user_id === currentUserId) ||
        (currentGuestId && p.guest_id === currentGuestId)
    );

    const fetchGameState = useCallback(async () => {
        // Get game session for this lobby
        const { data: session } = await supabase
            .from('game_sessions')
            .select('*')
            .eq('lobby_id', lobby.id)
            .single();

        if (session) {
            setGameSession(session);

            // Fetch played cards
            const { data: playedData } = await supabase
                .from('played_cards')
                .select(`
                    *,
                    cards (*)
                `)
                .eq('game_session_id', session.id)
                .order('played_at');

            if (playedData) {
                const playedCardsWithType = playedData.map((item: any) => ({
                    ...item.cards,
                    type: item.cards.category || 'Card',
                    played_by: item.player_id
                }));
                setPlayedCards(playedCardsWithType);
            }

            // Fetch player's hand if we found the current player
            if (currentPlayer) {
                const { data: handData } = await supabase
                    .from('player_hands')
                    .select(`
                        *,
                        cards (*)
                    `)
                    .eq('game_session_id', session.id)
                    .eq('player_id', currentPlayer.id)
                    .order('position');

                if (handData) {
                    const cardsWithType = handData.map((item: any) => ({
                        ...item.cards,
                        type: item.cards.category || 'Card'
                    }));
                    setHand(cardsWithType);
                }
            }
        }
    }, [supabase, lobby.id, currentPlayer]);

    // Initial fetch and subscriptions
    useEffect(() => {
        fetchGameState();

        const channel = supabase
            .channel(`game:${lobby.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'game_sessions', filter: `lobby_id=eq.${lobby.id}` },
                (payload) => {
                    if (payload.new) setGameSession(payload.new as GameSession);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'played_cards' },
                () => {
                    fetchGameState();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'player_hands' },
                () => {
                    fetchGameState();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, lobby.id, fetchGameState]);

    const handlePlayCard = async (card: CardData) => {
        if (!gameSession || !currentPlayer) return;

        // Optimistic update
        setHand(prev => prev.filter(c => c.id !== card.id));
        setPlayedCards(prev => [...prev, { ...card, played_by: currentPlayer.id }]);

        // 1. Remove from hand
        const { error: removeError } = await supabase
            .from('player_hands')
            .delete()
            .eq('game_session_id', gameSession.id)
            .eq('player_id', currentPlayer.id)
            .eq('card_id', card.id);

        if (removeError) {
            console.error('Error removing card from hand:', removeError);
            fetchGameState();
            return;
        }

        // 2. Add to played cards
        const { error: playError } = await supabase
            .from('played_cards')
            .insert({
                game_session_id: gameSession.id,
                player_id: currentPlayer.id,
                card_id: card.id,
                position: playedCards.length
            });

        if (playError) {
            console.error('Error playing card:', playError);
            fetchGameState();
        }
    };

    const handlePassTurn = async () => {
        if (!gameSession || !currentPlayer) return;

        // Sort players to ensure consistent order
        const sortedPlayers = [...players].sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
        const currentIndex = sortedPlayers.findIndex(p => p.id === currentPlayer.id);

        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % sortedPlayers.length;
        const nextPlayer = sortedPlayers[nextIndex];

        // Update game session
        const { error } = await supabase
            .from('game_sessions')
            .update({
                current_turn_player_id: nextPlayer.id,
                storyteller_id: nextPlayer.id // Passing turn passes storyteller role
            })
            .eq('id', gameSession.id);

        if (error) {
            console.error('Error passing turn:', error);
        }
    };

    // Derive storyteller info
    const storytellerPlayer = players.find(p => p.id === gameSession?.storyteller_id);
    const storyteller = {
        name: storytellerPlayer?.user_id || 'Unknown',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2kM4V9bGS-2Dg2TcCrOb1xrXHTpki0HFxceUe9rRUH_KaPjQoQN0jbVpQBa2TqwdSV6mLT7goB_ZbKcYdE6HhVLSZsN0vUX6TpnJB76NgakSFqG5GPRpJfTZutG1R4MZFq1tS4aLI30MXOnXwRNwfKPVi63SRkGypJCterAJp-9W9tUENfo_WoQl8qqxnbhBBCjNdZ8_aH3QWvhQpEDB30HdC0nTZ1-goYnn0fnbZNvY8TMelwbPtjboFMgS-PPv_iCKzUJkMDPQ'
    };

    return (
        <div className="relative flex h-screen w-full overflow-hidden bg-background-dark text-white font-display">
            {/* Background */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAcH00pKK2AxXMqHsTx4miiahShYfItJyRTa5n9HZSy_NfBIUIjJskQWLoLdEPNWqahz6STV7TNRURrekmNyEm86n7xfYHlDTcC4e5sDy-NKJdLWGPSA_o27Aw5uQDhye24irWMHFdDf9DJ4AdmG7AgkYGu2zx1j0NN0Dsu_IpKvv3WeMqZX2Sq0SNUF1qwp-BQtUXNsNd5AKKuAvvy9Uuu2b_45DkEiAUlVWy-97XvQ6sr8zYxK25Wts7TpJ4ulmvq-9Ag9XAhfys')" }}
            ></div>

            <main className="flex-1 flex flex-col justify-between overflow-hidden relative z-10">
                <TableArea playedCards={playedCards} storytellerPlayer={storytellerPlayer} players={players} />
                <PlayerHand cards={hand} onPlayCard={handlePlayCard} onPassTurn={handlePassTurn} isMyTurn={gameSession?.current_turn_player_id === currentPlayer?.id} />
            </main>

            <GameSidebar
                players={players}
                currentPlayerId={currentPlayerId}
                currentTurnPlayerId={gameSession?.current_turn_player_id || ''}
            />
        </div>
    );
}
