import Card from './Card';
import { Database } from '@/supabase/types';
import { PlayerAvatar, getPlayerDisplayName } from '../lobby/PlayerDisplay';
import { useTranslation } from 'react-i18next';

type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string; played_by?: string };
type Player = Database['public']['Tables']['players']['Row'];

interface TableAreaProps {
    playedCards: CardData[]; // Cards played in the current story line
    storytellerPlayer: Player | undefined;
    players: Player[];
}

export default function TableArea({ playedCards, storytellerPlayer, players }: TableAreaProps) {
    const { t } = useTranslation();
    return (
        <div className="flex-grow flex items-start justify-center p-6 overflow-auto">
            <div className="flex flex-col gap-6 w-full max-w-7xl">
                {/* Storyteller Info & Last Played Card */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 flex flex-col items-center gap-2 w-24 text-center pt-2">
                        {storytellerPlayer ? (
                            <>
                                <div className="border-2 border-primary rounded-full">
                                    <PlayerAvatar player={storytellerPlayer} size="lg" />
                                </div>
                                <p className="font-bold text-white text-sm">{getPlayerDisplayName(storytellerPlayer)}</p>
                            </>
                        ) : (
                            <>
                                <div className="bg-gray-600 rounded-full h-14 w-14"></div>
                                <p className="font-bold text-white text-sm">{t('game.unknown_player')}</p>
                            </>
                        )}
                        <p className="text-xs text-white/70">{t('game.storyteller_label')}</p>
                    </div>

                    <div className="flex gap-2 p-2 rounded-lg bg-black/10 flex-wrap items-end">
                        {playedCards.map((card) => {
                            const playedByPlayer = players.find(p => p.id === card.played_by);
                            const playerName = playedByPlayer ? getPlayerDisplayName(playedByPlayer) : t('game.unknown_player');

                            return (
                                <div key={card.id} className="w-32 flex flex-col gap-1 group relative">
                                    <Card card={card} />
                                    {/* Tooltip-like indicator for who played the card */}
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-20">
                                        {t('game.played_by', { name: playerName })}
                                    </div>
                                    {/* Small avatar indicator */}
                                    {playedByPlayer && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full overflow-hidden border border-white" title={t('game.played_by', { name: playerName })}>
                                            <PlayerAvatar player={playedByPlayer} size="sm" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {playedCards.length === 0 && (
                            <div className="text-white/40 p-4 italic">{t('game.no_cards_played')}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
