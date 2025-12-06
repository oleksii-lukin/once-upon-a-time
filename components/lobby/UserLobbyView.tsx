'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/supabase/types';
import { useUser, UserButton } from '@clerk/nextjs';
import { getGuestId } from '@/lib/auth/guest';
import { PlayerAvatar, getPlayerDisplayName } from './PlayerDisplay';

type Lobby = Database['public']['Tables']['lobbies']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Deck = Database['public']['Tables']['decks']['Row'];

interface UserLobbyViewProps {
    lobby: Lobby;
    initialPlayers: Player[];
}

export default function UserLobbyView({ lobby, initialPlayers }: UserLobbyViewProps) {
    const { user } = useUser();
    const [players, setPlayers] = useState<Player[]>(initialPlayers);
    const [currentLobby, setCurrentLobby] = useState<Lobby>(lobby);
    const [selectedRole, setSelectedRole] = useState('Storyteller');
    const [decks, setDecks] = useState<Deck[]>([]);
    const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
    const supabase = createClient();

    // Default settings
    const defaultSettings = {
        allowHotJoin: true,
        publicGame: true,
        allowSpectators: true,
        allowInterrupts: true,
        timerPerTurn: false,
        happyEnding: false,
        enableVideoChat: true,
    };

    const settings = currentLobby.settings && typeof currentLobby.settings === 'object'
        ? { ...defaultSettings, ...(currentLobby.settings as any) }
        : defaultSettings;

    // Fetch decks on mount
    useEffect(() => {
        const fetchDecks = async () => {
            const { data } = await supabase
                .from('decks')
                .select('*')
                .eq('is_active', true);
            if (data) {
                setDecks(data);
                // Get selected decks from lobby settings
                if (currentLobby.settings && typeof currentLobby.settings === 'object') {
                    const lobbySelectedDecks = (currentLobby.settings as any).selectedDecks;
                    if (lobbySelectedDecks && Array.isArray(lobbySelectedDecks)) {
                        setSelectedDeckIds(lobbySelectedDecks);
                    }
                }
            }
        };
        fetchDecks();
    }, [supabase, currentLobby.settings]);

    useEffect(() => {
        // Subscribe to player changes
        const playersChannel = supabase
            .channel(`lobby:${lobby.id}:players`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'players', filter: `lobby_id=eq.${lobby.id}` },
                (payload) => {
                    fetchPlayers();
                }
            )
            .subscribe();

        // Subscribe to lobby changes
        const lobbyChannel = supabase
            .channel(`lobby:${lobby.id}:settings`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobby.id}` },
                (payload) => {
                    if (payload.new) {
                        const updatedLobby = payload.new as Lobby;
                        setCurrentLobby(updatedLobby);
                        // Update selected decks when host changes them
                        if (updatedLobby.settings && typeof updatedLobby.settings === 'object') {
                            const lobbySelectedDecks = (updatedLobby.settings as any).selectedDecks;
                            if (lobbySelectedDecks && Array.isArray(lobbySelectedDecks)) {
                                setSelectedDeckIds(lobbySelectedDecks);
                            }
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(playersChannel);
            supabase.removeChannel(lobbyChannel);
        };
    }, [lobby.id, supabase]);

    const fetchPlayers = async () => {
        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('lobby_id', lobby.id)
            .order('joined_at', { ascending: true });
        if (data) setPlayers(data);
    };

    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

    // 1. Setup channel (run once)
    useEffect(() => {
        const newChannel = supabase.channel(`lobby:${lobby.id}`)
            .on('presence', { event: 'sync' }, () => {
                const newState = newChannel.presenceState();
                const onlineIds = new Set<string>();
                for (const key in newState) {
                    newState[key].forEach((presence: any) => {
                        if (presence.player_id) onlineIds.add(presence.player_id);
                    });
                }
                setOnlineUsers(onlineIds);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    newPresences.forEach((p: any) => {
                        if (p.player_id) next.add(p.player_id);
                    });
                    return next;
                });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    leftPresences.forEach((p: any) => {
                        if (p.player_id) next.delete(p.player_id);
                    });
                    return next;
                });
            })
            .subscribe();

        setChannel(newChannel);

        return () => {
            supabase.removeChannel(newChannel);
        };
    }, [lobby.id, supabase]);

    // 2. Track presence when player ID is available
    useEffect(() => {
        if (!channel) return;

        const guestId = !user ? getGuestId() : undefined;
        const currentPlayer = players.find(p =>
            (user && p.user_id === user.id) ||
            (!user && p.guest_id === guestId)
        );
        const playerId = currentPlayer?.id;

        if (playerId) {
            channel.track({
                player_id: playerId,
                user_id: user?.id,
                guest_id: guestId
            });
        }
    }, [channel, user, players]);

    // Filter players to only show online ones (plus self)
    const displayedPlayers = players.filter(p => {
        const isSelf = (user && p.user_id === user.id) || (!user && p.guest_id === getGuestId());
        return onlineUsers.has(p.id) || isSelf;
    });
    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-40 flex flex-1 justify-center py-5">
                    <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
                        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-white/10 px-4 sm:px-6 md:px-10 py-3">
                            <div className="flex items-center gap-4 text-white">
                                <div className="size-6 text-primary">
                                    <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                        <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd"></path>
                                    </svg>
                                </div>
                                <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Once Upon a Time</h1>
                            </div>
                            <div className="flex flex-1 justify-end items-center gap-4">
                                <span className="truncate text-sm font-bold leading-normal tracking-[0.015em] text-white/80 hidden sm:block">
                                    {players.find(p => (user && p.user_id === user.id) || (!user && p.guest_id === getGuestId()))?.display_name || user?.fullName || user?.username || 'Guest'}
                                </span>
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        </header>
                        <main className="flex-1 mt-8">
                            <div className="flex flex-wrap justify-between items-center gap-3 p-4">
                                <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Game Lobby</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-white/70">Room Code:</span>
                                    <span className="text-white font-bold text-lg tracking-widest">{currentLobby.code}</span>
                                    <button className="flex items-center justify-center size-9 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                                        <span className="material-symbols-outlined text-xl">content_copy</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white/5 p-6 rounded-xl opacity-70">
                                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">Game Settings</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="flex flex-col gap-6">
                                                <div className="flex flex-col">
                                                    <label className="flex flex-col min-w-40 flex-1">
                                                        <p className="text-white text-base font-medium leading-normal pb-2">Room Name</p>
                                                        <input className="form-input flex w-full min-w-0 flex-1 rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-white/10 bg-[#211c27] h-11 placeholder:text-white/40 p-[15px] text-base font-normal leading-normal disabled:opacity-50" disabled readOnly value={currentLobby.name} />
                                                    </label>
                                                </div>
                                                <div className="flex flex-col gap-2 p-4 border border-white/10 rounded-lg">
                                                    <div className="flex items-center justify-between py-2">
                                                        <label className="text-white text-base font-medium leading-normal" htmlFor="allow-hot-join">Allow Hot Join</label>
                                                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                            <input className="peer sr-only" disabled id="allow-hot-join" type="checkbox" checked={settings.allowHotJoin} />
                                                            <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2">
                                                        <label className="text-white text-base font-medium leading-normal" htmlFor="game-visibility">Public Game</label>
                                                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                            <input className="peer sr-only" disabled id="game-visibility" type="checkbox" checked={settings.publicGame} />
                                                            <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2">
                                                        <label className="text-white text-base font-medium leading-normal" htmlFor="allow-spectators">Allow Spectators</label>
                                                        <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                            <input className="peer sr-only" disabled id="allow-spectators" type="checkbox" checked={settings.allowSpectators} />
                                                            <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-1"></div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-xl opacity-70">
                                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3">Game Rules</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                            <div className="flex items-center justify-between py-2">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-white text-base font-medium leading-normal" htmlFor="allow-interrupts">Allow Interrupts</label>
                                                    <button className="text-white/50 hover:text-white transition-colors"><span className="material-symbols-outlined text-base">info</span></button>
                                                </div>
                                                <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                    <input className="peer sr-only" disabled id="allow-interrupts" type="checkbox" checked={settings.allowInterrupts} />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <label className="text-white text-base font-medium leading-normal" htmlFor="timer-per-turn">Timer per Turn</label>
                                                <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                    <input className="peer sr-only" disabled id="timer-per-turn" type="checkbox" checked={settings.timerPerTurn} />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <label className="text-white text-base font-medium leading-normal" htmlFor="happy-ending">Happy Ending Variant</label>
                                                <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                    <input className="peer sr-only" disabled id="happy-ending" type="checkbox" checked={settings.happyEnding} />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <label className="text-white text-base font-medium leading-normal" htmlFor="enable-video-chat">Enable Video Chat</label>
                                                <label className="relative inline-flex items-center opacity-50 pointer-events-none">
                                                    <input className="peer sr-only" disabled id="enable-video-chat" type="checkbox" checked={settings.enableVideoChat} />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-xl opacity-70">
                                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">Card Decks</h2>
                                        <div className="flex flex-col">
                                            <p className="text-white text-base font-medium leading-normal pb-2">Selected Decks</p>
                                            <div className="space-y-2">
                                                {decks.map((deck) => (
                                                    <label
                                                        key={deck.id}
                                                        className={`flex items-center gap-3 p-3 rounded-lg border pointer-events-none ${selectedDeckIds.includes(deck.id)
                                                            ? 'bg-primary/20 border-primary'
                                                            : 'border-transparent'
                                                            }`}
                                                    >
                                                        <input
                                                            className="form-checkbox rounded text-primary bg-transparent border-white/30 focus:ring-primary/50 focus:ring-offset-background-dark disabled:opacity-50"
                                                            disabled
                                                            type="checkbox"
                                                            checked={selectedDeckIds.includes(deck.id)}
                                                        />
                                                        <span className="text-white font-medium">{deck.name}</span>
                                                    </label>
                                                ))}
                                                {decks.length === 0 && (
                                                    <p className="text-white/40 text-sm italic">No decks selected yet.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="lg:col-span-1 flex flex-col gap-6">
                                    <div className="bg-white/5 p-6 rounded-xl flex-1 flex flex-col">
                                        <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-4">Players ({displayedPlayers.filter(p => p.role !== 'spectator').length})</h2>
                                        <div className="flex-1 space-y-3 overflow-y-auto">
                                            {displayedPlayers.filter(p => p.role !== 'spectator').map((player) => (
                                                <div key={player.id} className={`flex items-center gap-3 p-3 rounded-lg ${player.role === 'host' ? 'bg-primary/20 border border-primary' : 'bg-white/10'}`}>
                                                    <PlayerAvatar player={player} />
                                                    <div className="flex flex-col">
                                                        <p className="text-white font-bold truncate">{getPlayerDisplayName(player)}</p>
                                                        <p className={`text-xs font-semibold ${player.role === 'host' ? 'text-primary' : player.status === 'ready' ? 'text-green-400' : 'text-white/50'}`}>
                                                            {player.role === 'host' ? 'Host' : player.status === 'ready' ? 'Ready' : 'Not Ready'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {displayedPlayers.filter(p => p.role !== 'spectator').length === 0 && (
                                                <p className="text-white/40 text-sm">No players yet.</p>
                                            )}
                                        </div>
                                        <div className="mt-4">
                                            <h3 className="text-white/70 text-sm font-bold leading-tight tracking-[-0.015em] pb-2 pt-4 border-t border-white/10">
                                                Spectators ({displayedPlayers.filter(p => p.role === 'spectator').length})
                                            </h3>
                                            <div className="space-y-3">
                                                {displayedPlayers.filter(p => p.role === 'spectator').map((player) => (
                                                    <div key={player.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                                        <PlayerAvatar player={player} />
                                                        <p className="text-white/80 font-medium truncate">{getPlayerDisplayName(player)}</p>
                                                    </div>
                                                ))}
                                                {displayedPlayers.filter(p => p.role === 'spectator').length === 0 && (
                                                    <p className="text-white/40 text-sm">No spectators.</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-auto pt-6 space-y-4">
                                            <div>
                                                <p className="text-white/80 text-sm font-medium leading-normal pb-2 text-center">Choose your role</p>
                                                <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-black/20">
                                                    <button className="px-4 py-2 text-sm font-bold rounded-md bg-primary text-white">Player</button>
                                                    <button className="px-4 py-2 text-sm font-bold rounded-md text-white/70 hover:bg-white/10">Spectator</button>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-4 bg-primary text-white text-lg font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors gap-2">
                                                    <span className="material-symbols-outlined">check</span>
                                                    <span className="truncate">Ready</span>
                                                </button>
                                                <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-4 bg-white/10 text-white/80 text-base font-bold leading-normal tracking-[0.015em] hover:bg-white/20 transition-colors">
                                                    <span className="truncate">Leave</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}
