'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/supabase/types';
import { useParams } from 'next/navigation';
import { initializeGame } from '@/app/actions/game';
import { useUser, UserButton } from '@clerk/nextjs';
import { PlayerAvatar, getPlayerDisplayName } from './PlayerDisplay';

type Lobby = Database['public']['Tables']['lobbies']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Deck = Database['public']['Tables']['decks']['Row'];

interface AdminLobbyViewProps {
    lobby: Lobby;
    initialPlayers: Player[];
}

export default function AdminLobbyView({ lobby, initialPlayers }: AdminLobbyViewProps) {
    const { user } = useUser();
    const [players, setPlayers] = useState<Player[]>(initialPlayers);
    const [currentLobby, setCurrentLobby] = useState<Lobby>(lobby);
    const supabase = createClient();
    const params = useParams();
    const lng = params.lng as string;

    const [roomName, setRoomName] = useState(lobby.name);
    const [decks, setDecks] = useState<Deck[]>([]);

    // Default settings
    const defaultSettings = {
        allowHotJoin: true,
        publicGame: true,
        allowSpectators: true,
        allowInterrupts: true,
        timerPerTurn: false,
        happyEnding: false,
        selectedDecks: [] as string[],
    };

    // Initialize settings from lobby data or defaults
    const [settings, setSettings] = useState(() => {
        if (lobby.settings && typeof lobby.settings === 'object') {
            return { ...defaultSettings, ...(lobby.settings as any) };
        }
        return defaultSettings;
    });

    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Generate invite link based on current URL
    const inviteLink = typeof window !== 'undefined'
        ? `${window.location.origin}/${lng}/invite/${currentLobby.code}`
        : '';

    const copyToClipboard = async (text: string, type: 'link' | 'code') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'link') {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            } else {
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Update lobby name in database
    const updateLobbyName = async (newName: string) => {
        const { error } = await supabase
            .from('lobbies')
            .update({ name: newName })
            .eq('id', lobby.id);

        if (error) {
            console.error('Error updating lobby name:', error);
        }
    };

    // Update settings in database
    const updateSettings = async (newSettings: Partial<typeof defaultSettings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);

        const { error } = await supabase
            .from('lobbies')
            .update({ settings: updated as any })
            .eq('id', lobby.id);

        if (error) {
            console.error('Error updating settings:', error);
        }
    };

    const [isStarting, setIsStarting] = useState(false);
    const [selectedDecks, setSelectedDecks] = useState<string[]>(
        (lobby.settings && typeof lobby.settings === 'object' && (lobby.settings as any).selectedDecks) || []
    );

    // Update selected decks in settings
    const updateSelectedDecks = async (newSelectedDecks: string[]) => {
        setSelectedDecks(newSelectedDecks);
        await updateSettings({ selectedDecks: newSelectedDecks });
    };

    const startGame = async () => {
        if (selectedDecks.length === 0) {
            alert('Please select at least one deck before starting the game');
            return;
        }

        setIsStarting(true);

        // Combine all selected decks into one for the game
        // For now, we'll use the first selected deck as the primary deck
        const primaryDeckId = selectedDecks[0];

        // Update lobby with primary deck
        await supabase
            .from('lobbies')
            .update({ deck_id: primaryDeckId })
            .eq('id', lobby.id);

        // Initialize game state (create session, deal cards, etc.)
        const result = await initializeGame(lobby.id);

        if (result.error) {
            alert(`Failed to start game: ${result.error}`);
            setIsStarting(false);
            return;
        }

        // Update lobby status to playing
        const { error } = await supabase
            .from('lobbies')
            .update({ status: 'playing' })
            .eq('id', lobby.id);

        if (error) {
            console.error('Error starting game:', error);
            setIsStarting(false);
        }
    };

    // Fetch available decks
    useEffect(() => {
        const fetchDecks = async () => {
            const { data } = await supabase
                .from('decks')
                .select('*')
                .eq('is_active', true);
            if (data) setDecks(data);
        };
        fetchDecks();
    }, [supabase]);

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
                        setRoomName(updatedLobby.name);
                        if (updatedLobby.settings && typeof updatedLobby.settings === 'object') {
                            const newSettings = { ...defaultSettings, ...(updatedLobby.settings as any) };
                            setSettings(newSettings);
                            // Sync selected decks
                            if ((updatedLobby.settings as any).selectedDecks) {
                                setSelectedDecks((updatedLobby.settings as any).selectedDecks);
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
        if (!channel || !user) return;

        const currentPlayer = players.find(p => p.user_id === user.id);
        const playerId = currentPlayer?.id;

        if (playerId) {
            channel.track({ player_id: playerId, user_id: user.id });
        }
    }, [channel, user, players]);

    const fetchPlayers = async () => {
        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('lobby_id', lobby.id);
        if (data) setPlayers(data);
    };

    // Filter players to only show online ones (plus self if not yet synced)
    const displayedPlayers = players.filter(p =>
        onlineUsers.has(p.id) || p.user_id === user?.id // Always show self
    );

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
                                    {user?.fullName || user?.username || 'Host'}
                                </span>
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        </header>
                        <main className="flex-1 mt-8">
                            <div className="flex flex-wrap justify-between gap-3 p-4">
                                <p className="text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Game Setup Lobby</p>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white/5 p-6 rounded-xl">
                                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">Game Settings</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="flex flex-col gap-6">
                                                <div className="flex flex-col">
                                                    <label className="flex flex-col min-w-40 flex-1">
                                                        <p className="text-white text-base font-medium leading-normal pb-2">Room Name</p>
                                                        <input
                                                            className="form-input flex w-full min-w-0 flex-1 rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-white/10 bg-[#211c27] h-11 placeholder:text-white/40 p-[15px] text-base font-normal leading-normal"
                                                            value={roomName}
                                                            onChange={(e) => setRoomName(e.target.value)}
                                                            onBlur={() => updateLobbyName(roomName)}
                                                        />
                                                    </label>
                                                </div>
                                                <div className="flex flex-col gap-2 p-4 border border-white/10 rounded-lg">
                                                    <div className="flex items-center justify-between py-2">
                                                        <label className={`text-base font-medium leading-normal transition-colors ${settings.allowHotJoin ? 'text-white' : 'text-white/40'}`} htmlFor="allow-hot-join">Allow Hot Join</label>
                                                        <label className="relative inline-flex cursor-pointer items-center">
                                                            <input
                                                                className="peer sr-only"
                                                                id="allow-hot-join"
                                                                type="checkbox"
                                                                checked={settings.allowHotJoin}
                                                                onChange={(e) => updateSettings({ allowHotJoin: e.target.checked })}
                                                            />
                                                            <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2">
                                                        <label className={`text-base font-medium leading-normal transition-colors ${settings.publicGame ? 'text-white' : 'text-white/40'}`} htmlFor="game-visibility">Public Game</label>
                                                        <label className="relative inline-flex cursor-pointer items-center">
                                                            <input
                                                                className="peer sr-only"
                                                                id="game-visibility"
                                                                type="checkbox"
                                                                checked={settings.publicGame}
                                                                onChange={(e) => updateSettings({ publicGame: e.target.checked })}
                                                            />
                                                            <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2">
                                                        <label className={`text-base font-medium leading-normal transition-colors ${settings.allowSpectators ? 'text-white' : 'text-white/40'}`} htmlFor="allow-spectators">Allow Spectators</label>
                                                        <label className="relative inline-flex cursor-pointer items-center">
                                                            <input
                                                                className="peer sr-only"
                                                                id="allow-spectators"
                                                                type="checkbox"
                                                                checked={settings.allowSpectators}
                                                                onChange={(e) => updateSettings({ allowSpectators: e.target.checked })}
                                                            />
                                                            <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-6 rounded-xl">
                                                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] pb-4">Invite Friends</h2>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-white/70 text-sm font-medium leading-normal pb-2">Share Invite Link</p>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                className="form-input text-sm w-full rounded-lg text-white/90 border border-white/10 bg-[#211c27] h-11 px-3"
                                                                readOnly
                                                                type="text"
                                                                value={inviteLink}
                                                            />
                                                            <button
                                                                onClick={() => copyToClipboard(inviteLink, 'link')}
                                                                className="flex items-center justify-center size-11 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors relative"
                                                                title="Copy invite link"
                                                            >
                                                                {copiedLink ? (
                                                                    <span className="material-symbols-outlined text-xl text-green-400">check</span>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-xl">content_copy</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-white/70 text-sm font-medium leading-normal pb-2">Or use Room Code</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center justify-center w-full rounded-lg border-2 border-dashed border-white/20 h-11">
                                                                <p className="text-white font-bold text-lg tracking-widest">{currentLobby.code}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => copyToClipboard(currentLobby.code || '', 'code')}
                                                                className="flex items-center justify-center size-11 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                                                title="Copy room code"
                                                            >
                                                                {copiedCode ? (
                                                                    <span className="material-symbols-outlined text-xl text-green-400">check</span>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-xl">content_copy</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-xl">
                                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3">Game Rules</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                            <div className="flex items-center justify-between py-2">
                                                <div className="flex items-center gap-2">
                                                    <label className={`text-base font-medium leading-normal transition-colors ${settings.allowInterrupts ? 'text-white' : 'text-white/40'}`} htmlFor="allow-interrupts">Allow Interrupts</label>
                                                    <button className="text-white/50 hover:text-white transition-colors"><span className="material-symbols-outlined text-base">info</span></button>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input
                                                        className="peer sr-only"
                                                        id="allow-interrupts"
                                                        type="checkbox"
                                                        checked={settings.allowInterrupts}
                                                        onChange={(e) => updateSettings({ allowInterrupts: e.target.checked })}
                                                    />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <label className={`text-base font-medium leading-normal transition-colors ${settings.timerPerTurn ? 'text-white' : 'text-white/40'}`} htmlFor="timer-per-turn">Timer per Turn</label>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input
                                                        className="peer sr-only"
                                                        id="timer-per-turn"
                                                        type="checkbox"
                                                        checked={settings.timerPerTurn}
                                                        onChange={(e) => updateSettings({ timerPerTurn: e.target.checked })}
                                                    />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <label className={`text-base font-medium leading-normal transition-colors ${settings.happyEnding ? 'text-white' : 'text-white/40'}`} htmlFor="happy-ending">Happy Ending Variant</label>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input
                                                        className="peer sr-only"
                                                        id="happy-ending"
                                                        type="checkbox"
                                                        checked={settings.happyEnding}
                                                        onChange={(e) => updateSettings({ happyEnding: e.target.checked })}
                                                    />
                                                    <div className="peer h-6 w-11 rounded-full bg-white/20 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-6 rounded-xl">
                                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5">Card Decks</h2>
                                        <div className="flex flex-col">
                                            <p className="text-white text-base font-medium leading-normal pb-2">Select Decks to Include</p>
                                            <div className="space-y-2">
                                                {decks.map((deck) => (
                                                    <label
                                                        key={deck.id}
                                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedDecks.includes(deck.id) ? 'bg-primary/20 border-primary' : 'hover:bg-white/10 border-transparent'}`}
                                                    >
                                                        <input
                                                            className="form-checkbox rounded text-primary bg-transparent border-white/30 focus:ring-primary/50 focus:ring-offset-background-dark"
                                                            type="checkbox"
                                                            checked={selectedDecks.includes(deck.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    updateSelectedDecks([...selectedDecks, deck.id]);
                                                                } else {
                                                                    updateSelectedDecks(selectedDecks.filter(id => id !== deck.id));
                                                                }
                                                            }}
                                                        />
                                                        <span className={`font-medium transition-colors ${selectedDecks.includes(deck.id) ? 'text-white' : 'text-white/60'}`}>
                                                            {deck.name}
                                                        </span>
                                                    </label>
                                                ))}
                                                {decks.length === 0 && (
                                                    <p className="text-white/40 text-sm italic">No decks available. Create a deck in the admin panel first.</p>
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
                                        <div className="mt-6">
                                            <button
                                                onClick={startGame}
                                                disabled={isStarting}
                                                className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-14 px-4 bg-primary text-white text-lg font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="truncate">{isStarting ? 'Starting...' : 'Start Game'}</span>
                                            </button>
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
