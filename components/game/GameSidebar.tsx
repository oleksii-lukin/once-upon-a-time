'use client';

import { Database } from '@/supabase/types';
import { PlayerAvatar, getPlayerDisplayName } from '../lobby/PlayerDisplay';

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
                <div className={`relative w-full rounded-lg overflow-hidden ring-2 shadow-lg flex-shrink-0 p-4 ${currentPlayer.id === currentTurnPlayerId ? 'ring-primary bg-primary/10' : 'ring-white/10 bg-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <PlayerAvatar player={currentPlayer} size="lg" />
                        <div className="flex-1">
                            <p className="font-bold text-white text-lg">{getPlayerDisplayName(currentPlayer)}</p>
                            <p className={`text-sm ${currentPlayer.id === currentTurnPlayerId ? 'text-primary' : 'text-white/50'}`}>
                                {currentPlayer.id === currentTurnPlayerId ? '🎭 Your Turn' : 'Waiting...'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                            <span className="material-symbols-outlined text-base">style</span>
                            <span>?</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Other Players List */}
            <div className="flex-1 space-y-3 overflow-y-auto">
                <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider">Other Players</h3>
                {otherPlayers.map((player) => (
                    <div
                        key={player.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${player.id === currentTurnPlayerId ? 'bg-primary/20 ring-1 ring-primary' : 'bg-white/5'}`}
                    >
                        <PlayerAvatar player={player} size="md" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{getPlayerDisplayName(player)}</p>
                            {player.id === currentTurnPlayerId && (
                                <p className="text-xs text-primary">🎭 Current Turn</p>
                            )}
                        </div>
                        <div className="flex items-center gap-1 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
                            <span className="material-symbols-outlined text-xs">style</span>
                            <span>?</span>
                        </div>
                    </div>
                ))}
                {otherPlayers.length === 0 && (
                    <p className="text-white/40 text-sm italic">No other players</p>
                )}
            </div>

            {/* Current Turn Indicator */}
            <div className="mt-auto text-center p-4 bg-white/5 rounded-lg flex-shrink-0">
                <p className="text-sm text-white/70">Current Storyteller</p>
                <p className="text-lg font-bold text-white">
                    {getPlayerDisplayName(players.find(p => p.id === currentTurnPlayerId) || players[0])}
                </p>
            </div>
        </aside>
    );
}
