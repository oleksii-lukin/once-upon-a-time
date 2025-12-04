'use client';

import { useEffect, useState } from 'react';
import { Database } from '@/supabase/types';
import { createClient } from '@/utils/supabase/client';
import PlayerHand from './PlayerHand';
import TableArea from './TableArea';
import GameSidebar from './GameSidebar';

type Lobby = Database['public']['Tables']['lobbies']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string };

interface GameViewProps {
    lobby: Lobby;
    players: Player[];
    currentUserId: string | null;
    currentGuestId: string | undefined;
}

export default function GameView({ lobby, players, currentUserId, currentGuestId }: GameViewProps) {
    const [hand, setHand] = useState<CardData[]>([]);
    const [playedCards, setPlayedCards] = useState<CardData[]>([]);
    const supabase = createClient();

    // Fetch game session and player hand
    useEffect(() => {
        const fetchGameState = async () => {
            // Get game session for this lobby
            const { data: gameSession } = await supabase
                .from('game_sessions')
                .select('*')
                .eq('lobby_id', lobby.id)
                .single();

            if (!gameSession) {
                console.error('No game session found');
                return;
            }

            // Find current player
            const currentPlayer = players.find(p =>
                (currentUserId && p.user_id === currentUserId) ||
                (currentGuestId && p.guest_id === currentGuestId)
            );

            if (!currentPlayer) {
                console.error('Current player not found');
                return;
            }

            // Fetch player's hand with card details
            const { data: handData } = await supabase
                .from('player_hands')
                .select(`
                    *,
                    cards (*)
                `)
                .eq('game_session_id', gameSession.id)
                .eq('player_id', currentPlayer.id)
                .order('position');

            if (handData) {
                const cardsWithType = handData.map((item: any) => ({
                    ...item.cards,
                    type: item.cards.category || 'Card' // Use category from database
                }));
                setHand(cardsWithType);
            }

            // Fetch played cards
            const { data: playedData } = await supabase
                .from('played_cards')
                .select(`
                    *,
                    cards (*)
                `)
                .eq('game_session_id', gameSession.id)
                .order('played_at');

            if (playedData) {
                const playedCardsWithType = playedData.map((item: any) => ({
                    ...item.cards,
                    type: item.cards.category || 'Card'
                }));
                setPlayedCards(playedCardsWithType);
            }
        };

        fetchGameState();
    }, [supabase, lobby.id, players, currentUserId, currentGuestId]);

    const handlePlayCard = (card: CardData) => {
        setHand(prev => prev.filter(c => c.id !== card.id));
        setPlayedCards(prev => [...prev, card]);
    };

    // Determine current player ID (user or guest)
    const currentPlayerId = currentUserId || currentGuestId || null;

    // Mock storyteller for now
    const storyteller = {
        name: 'Finn',
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
                <TableArea playedCards={playedCards} storyteller={storyteller} />
                <PlayerHand cards={hand} onPlayCard={handlePlayCard} />
            </main>

            <GameSidebar
                players={players}
                currentPlayerId={currentPlayerId}
                currentTurnPlayerId="mock-id" // Placeholder
            />
        </div>
    );
}
