'use client';

import Card from './Card';
import { Database } from '@/supabase/types';

// Mock card type for now until we have the full schema
type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string };

interface PlayerHandProps {
    cards: CardData[];
    onPlayCard: (card: CardData) => void;
    onPassTurn: () => void;
    isMyTurn: boolean;
}

export default function PlayerHand({ cards, onPlayCard, onPassTurn, isMyTurn }: PlayerHandProps) {
    return (
        <div className="relative w-full bg-black/20 dark:bg-black/30 backdrop-blur-md border-t border-white/10 pt-4 pb-6">
            <div className="player-hand flex justify-center items-end h-72 gap-4 px-4 overflow-x-auto">
                {cards.map((card) => (
                    <div key={card.id} className="w-48 flex-shrink-0">
                        <Card
                            card={card}
                            isHoverable={isMyTurn}
                            onClick={() => isMyTurn && onPlayCard(card)}
                            className={!isMyTurn ? 'opacity-70 grayscale' : ''}
                        />
                    </div>
                ))}
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
                <button
                    onClick={onPassTurn}
                    disabled={!isMyTurn}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined">skip_next</span> Pass Turn
                </button>
                {/* Play Card button is redundant if clicking the card plays it, but keeping it for now as per design */}
                <button
                    disabled={!isMyTurn}
                    className="bg-primary hover:bg-primary/80 text-white font-bold py-3 px-6 rounded-lg backdrop-blur-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined">play_arrow</span> Play Card
                </button>
            </div>
        </div>
    );
}
