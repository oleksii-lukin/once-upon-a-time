import Card from './Card';
import { Database } from '@/supabase/types';

type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string; played_by?: string };
type Player = Database['public']['Tables']['players']['Row'];

interface TableAreaProps {
    playedCards: CardData[]; // Cards played in the current story line
    storyteller: { name: string; avatar: string };
    players: Player[];
}

export default function TableArea({ playedCards, storyteller, players }: TableAreaProps) {
    return (
        <div className="flex-grow flex items-start justify-center p-6 overflow-auto">
            <div className="flex flex-col gap-6 w-full max-w-7xl">
                {/* Storyteller Info & Last Played Card */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 flex flex-col items-center gap-2 w-24 text-center pt-2">
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14 border-2 border-primary"
                            style={{ backgroundImage: `url("${storyteller.avatar}")` }}
                        ></div>
                        <p className="font-bold text-white text-sm">{storyteller.name}</p>
                        <p className="text-xs text-white/70">Storyteller</p>
                    </div>

                    <div className="flex gap-2 p-2 rounded-lg bg-black/10 flex-wrap items-end">
                        {playedCards.map((card) => {
                            const playedByPlayer = players.find(p => p.id === card.played_by);
                            const playerName = playedByPlayer?.user_id || 'Unknown';

                            return (
                                <div key={card.id} className="w-32 flex flex-col gap-1 group relative">
                                    <Card card={card} />
                                    {/* Tooltip-like indicator for who played the card */}
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-20">
                                        Played by {playerName}
                                    </div>
                                    {/* Small avatar indicator if it's not the current storyteller (optional, but good for clarity) */}
                                    {playedByPlayer && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-600 border border-white flex items-center justify-center text-[10px] font-bold text-white overflow-hidden" title={`Played by ${playerName}`}>
                                            {playerName.substring(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {playedCards.length === 0 && (
                            <div className="text-white/40 p-4 italic">No cards played yet...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
