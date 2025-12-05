'use client';

import { useState } from 'react';
import { Database } from '@/supabase/types';
import { getPlayerDisplayName } from '../lobby/PlayerDisplay';
import useWebRTC from './useWebRTC';
import VideoPlayer from './VideoPlayer';

type Player = Database['public']['Tables']['players']['Row'];

interface GameSidebarProps {
    players: Player[];
    currentPlayerId: string | null;
    currentTurnPlayerId: string;
    lobbyId: string;
}

export default function GameSidebar({ players, currentPlayerId, currentTurnPlayerId, lobbyId }: GameSidebarProps) {
    const { localStream, remoteStreams, toggleAudio, toggleVideo } = useWebRTC(lobbyId, currentPlayerId, players);

    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);

    const handleToggleAudio = () => {
        const newState = !audioEnabled;
        setAudioEnabled(newState);
        toggleAudio(newState);
    };

    const handleToggleVideo = () => {
        const newState = !videoEnabled;
        setVideoEnabled(newState);
        toggleVideo(newState);
    };

    const me = players.find(p => p.user_id === currentPlayerId || p.guest_id === currentPlayerId);

    // Determine the "Active Player" (Storyteller) to show at the top
    const activePlayer = players.find(p => p.id === currentTurnPlayerId) || players[0];

    // Everyone goes in the grid
    const gridPlayers = players;

    // Helper to render controls for me
    const Controls = () => (
        <div className="absolute top-2 right-2 flex gap-2">
            <button
                onClick={handleToggleAudio}
                className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-colors ${audioEnabled ? 'bg-black/50 hover:bg-black/70' : 'bg-red-500 hover:bg-red-600'}`}
            >
                <span className="material-symbols-outlined text-lg">{audioEnabled ? 'mic' : 'mic_off'}</span>
            </button>
            <button
                onClick={handleToggleVideo}
                className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-colors ${videoEnabled ? 'bg-black/50 hover:bg-black/70' : 'bg-red-500 hover:bg-red-600'}`}
            >
                <span className="material-symbols-outlined text-lg">{videoEnabled ? 'videocam' : 'videocam_off'}</span>
            </button>
        </div>
    );

    return (
        <aside className="w-96 bg-black/20 dark:bg-black/30 backdrop-blur-md border-l border-white/10 flex flex-col p-6 gap-6 h-full overflow-y-auto flex-shrink-0">
            {/* Active Player (Storyteller) */}
            {activePlayer && (
                <div className="relative aspect-video w-full rounded-lg overflow-hidden ring-2 shadow-lg ring-primary shadow-primary/20">
                    <VideoPlayer
                        stream={activePlayer.id === me?.id ? localStream : (remoteStreams[activePlayer.id] || null)}
                        player={activePlayer}
                        isLocal={activePlayer.id === me?.id}
                        styleCount={5}
                        isTurn={true}
                    />
                    {activePlayer.id === me?.id && <Controls />}
                </div>
            )}

            {/* All Players Grid */}
            <div className="flex-1 overflow-y-auto p-1">
                <div className="grid grid-cols-2 gap-4">
                    {gridPlayers.map((player) => {
                        const isActive = player.id === activePlayer?.id;
                        return (
                            <div
                                key={player.id}
                                className={`relative aspect-video w-full rounded-lg ${isActive ? 'outline outline-2 outline-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.6)]' : ''}`}
                            >
                                <div className="absolute inset-0 rounded-lg overflow-hidden">
                                    <VideoPlayer
                                        // If active, show avatar (stream=null). Else show video.
                                        stream={isActive ? null : (player.id === me?.id ? localStream : (remoteStreams[player.id] || null))}
                                        player={player}
                                        isLocal={player.id === me?.id}
                                        styleCount={4} // Placeholder
                                        isTurn={isActive}
                                    />
                                </div>
                                {/* Show controls if it's me AND I'm not the active player (controls already at top) */}
                                {player.id === me?.id && !isActive && <Controls />}
                            </div>
                        );
                    })}

                </div>
                {gridPlayers.length === 0 && (
                    <div className="text-center p-8 border-2 border-dashed border-white/10 rounded-xl">
                        <p className="text-white/40 text-sm italic">Waiting for other players...</p>
                    </div>
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
