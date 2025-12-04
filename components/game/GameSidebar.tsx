'use client';

import { Database } from '@/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

interface GameSidebarProps {
    players: Player[];
    currentPlayerId: string | null;
    currentTurnPlayerId: string;
}

export default function GameSidebar({ players, currentPlayerId, currentTurnPlayerId }: GameSidebarProps) {
    const currentPlayer = players.find(p => p.user_id === currentPlayerId || p.guest_id === currentPlayerId);
    const otherPlayers = players.filter(p => p.id !== currentPlayer?.id);

    return (
        <aside className="w-96 bg-black/20 dark:bg-black/30 backdrop-blur-md border-l border-white/10 flex flex-col p-6 gap-6 h-full overflow-y-auto hidden lg:flex">
            {/* Current Player (You) Status */}
            {currentPlayer && (
                <div className={`relative aspect-video w-full rounded-lg overflow-hidden ring-2 shadow-lg flex-shrink-0 ${currentPlayer.id === currentTurnPlayerId ? 'ring-primary' : 'ring-white/10'}`}>
                    <div className="absolute inset-0 bg-cover bg-center bg-gray-600"></div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">{currentPlayer.user_id || 'You'}</p>
                                <p className={`text-sm ${currentPlayer.id === currentTurnPlayerId ? 'text-primary' : 'text-white/50'}`}>
                                    {currentPlayer.id === currentTurnPlayerId ? 'Your Turn' : 'Waiting'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                                <span className="material-symbols-outlined text-base">style</span>
                                <span>?</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Other Players Grid */}
            <div className="grid grid-cols-2 gap-4">
                {otherPlayers.map((player) => (
                    <div key={player.id} className={`relative aspect-video w-full rounded-lg overflow-hidden ring-2 ${player.id === currentTurnPlayerId ? 'ring-primary' : 'ring-transparent'}`}>
                        <div className="absolute inset-0 bg-cover bg-center bg-gray-700"></div>
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-white text-sm truncate w-20">{player.user_id || 'Guest'}</p>
                                    {player.id === currentTurnPlayerId && (
                                        <p className="text-xs text-primary">Current Turn</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
                                    <span className="material-symbols-outlined text-xs">style</span>
                                    <span>?</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Next Player Indicator - Placeholder logic for now */}
            <div className="mt-auto text-center p-4 bg-white/5 rounded-lg flex-shrink-0">
                <p className="text-sm text-white/70">Current Player</p>
                <p className="text-lg font-bold text-white">
                    {players.find(p => p.id === currentTurnPlayerId)?.user_id || 'Unknown'}
                </p>
            </div>
        </aside>
    );
}
