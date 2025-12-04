'use client';

import { Database } from '@/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

interface GameSidebarProps {
    players: Player[];
    currentPlayerId: string | null;
    currentTurnPlayerId: string;
}

export default function GameSidebar({ players, currentPlayerId, currentTurnPlayerId }: GameSidebarProps) {
    return (
        <aside className="w-96 bg-black/20 dark:bg-black/30 backdrop-blur-md border-l border-white/10 flex flex-col p-6 gap-6 h-full overflow-y-auto hidden lg:flex">
            {/* Current Player (You) Status */}
            <div className="relative aspect-video w-full rounded-lg overflow-hidden ring-2 ring-primary shadow-lg flex-shrink-0">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB8QczcDQhnTtN58egOU4F-Mdihf4C_anaRBcx4Ue3QWV088EQclkIUDCxtLZGEQP-IQx0vOSDTPPl6g9fNqqGZh7zXipeuQdkKHYnfDy1NK8Qbd4zw3Wg3yVsNSsr9uZSthIZS10M4jbklaLr5fC1dbJQkMw1AtHtELP94cyLXQpN20pphP4nBvRf0KxrMb22uveZVWd4GRdspqoE1qN9JEEKbWE8cX2p8iDbkXOHTvqlUlgRJyTn3HXf24tIFLtj-J5-ENLbO3ok")' }}></div>
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-white">Aria (You)</p>
                            <p className="text-sm text-primary">Your Turn</p>
                        </div>
                        <div className="flex items-center gap-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                            <span className="material-symbols-outlined text-base">style</span>
                            <span>5</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Other Players Grid */}
            <div className="grid grid-cols-2 gap-4">
                {players.filter(p => p.user_id !== currentPlayerId).map((player) => (
                    <div key={player.id} className="relative aspect-video w-full rounded-lg overflow-hidden">
                        <div className="absolute inset-0 bg-cover bg-center bg-gray-700"></div>
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-white text-sm truncate w-20">{player.user_id || 'Guest'}</p>
                                    {/* <p className="text-xs text-white/70">Storyteller</p> */}
                                </div>
                                <div className="flex items-center gap-1 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
                                    <span className="material-symbols-outlined text-xs">style</span>
                                    <span>4</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Next Player Indicator */}
            <div className="mt-auto text-center p-4 bg-white/5 rounded-lg flex-shrink-0">
                <p className="text-sm text-white/70">Next Player</p>
                <p className="text-lg font-bold text-white">Finn</p>
            </div>
        </aside>
    );
}
