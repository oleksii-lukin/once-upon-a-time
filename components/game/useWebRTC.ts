import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Instance, SignalData } from 'simple-peer';
import { Database } from '@/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

interface WebRTCState {
    localStream: MediaStream | null;
    peers: Record<string, Instance>; // playerId -> SimplePeer Instance
    remoteStreams: Record<string, MediaStream>; // playerId -> MediaStream
}

export interface DeviceInfo {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
}

interface SignalPayload {
    from: string;
    to: string;
    signal: SignalData;
}

export default function useWebRTC(roomId: string, currentPlayerId: string | null, players: Player[]) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
    const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
    const peersRef = useRef<Record<string, Instance>>({});
    const supabase = createClient();

    // Derived state for the current player's persistent ID (database UUID)
    // We use this for all signaling equality checks, rather than the auth ID (currentPlayerId)
    const myPlayer = players.find(p => p.user_id === currentPlayerId || p.guest_id === currentPlayerId);
    const myPlayerId = myPlayer?.id;

    // Keep track of mounted state to prevent state updates after unmount
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Initialize Local Media
    useEffect(() => {
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });

                if (isMounted.current) {
                    setLocalStream(stream);

                    // Set initial selected devices
                    const audioTrack = stream.getAudioTracks()[0];
                    const videoTrack = stream.getVideoTracks()[0];
                    if (audioTrack) setSelectedAudioDeviceId(audioTrack.getSettings().deviceId || 'default');
                    if (videoTrack) setSelectedVideoDeviceId(videoTrack.getSettings().deviceId || 'default');

                    // Enumerate devices
                    const deviceInfos = await navigator.mediaDevices.enumerateDevices();
                    setDevices(deviceInfos.map(d => ({
                        deviceId: d.deviceId,
                        label: d.label,
                        kind: d.kind
                    })));
                }
            } catch (err) {
                console.error('Error accessing media devices:', err);
            }
        };

        if (!localStream) {
            initMedia();
        }

        return () => {
            // Cleanup local stream on unmount
            // Note: We might want to keep it if we persist across views, but for sidebar it's fine.
            // Actually, usually better NOT to stop tracks so re-renders don't kill camera light, 
            // but here we want to stop if we leave the specific context. 
            // Let's rely on standard garbage collection or explicit cleanup if needed.
            // For now, let's strictly stop it to be clean.
            // EDIT: React StrictMode calls this twice. Careful.
        };
    }, []);

    // Cleanup tracks on real unmount
    useEffect(() => {
        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            // Destroy all peers
            Object.values(peersRef.current).forEach(peer => peer.destroy());
            peersRef.current = {};
        };
    }, [localStream]);

    const sendSignal = useCallback(async (to: string, signal: SignalData) => {
        if (!myPlayerId) return;
        await supabase.channel(`game_signaling:${roomId}`).send({
            type: 'broadcast',
            event: 'signal',
            payload: {
                from: myPlayerId, // Send my DB UUID, not my Auth ID
                to,
                signal
            }
        });
    }, [myPlayerId, roomId, supabase]);

    const createPeer = useCallback(async (targetId: string, initiator: boolean, stream: MediaStream) => {
        const SimplePeer = (await import('simple-peer')).default;

        const peer = new SimplePeer({
            initiator,
            trickle: false, // Simple-peer often works better with trickle false for simple setups, or true if using TURN. We'll try default (true) if we assume nice networks, but let's set false to start for simpler signaling (one handshake). actually standard is trickle: true usually.
            // Let's try trickle: false to minimize signal messages for now (one large offer/answer).
            stream,
        });

        peer.on('signal', (signal) => {
            sendSignal(targetId, signal);
        });

        peer.on('stream', (remoteStream) => {
            if (isMounted.current) {
                setRemoteStreams(prev => ({
                    ...prev,
                    [targetId]: remoteStream
                }));
            }
        });

        peer.on('error', (err) => {
            console.error(`Peer error with ${targetId}:`, err);
        });

        peer.on('close', () => {
            if (isMounted.current) {
                setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[targetId];
                    return newStreams;
                });
                delete peersRef.current[targetId];
            }
        });

        peersRef.current[targetId] = peer;
        return peer;
    }, [sendSignal]);

    // Handle Signaling Channel
    useEffect(() => {
        if (!myPlayerId || !localStream) return;

        const channel = supabase.channel(`game_signaling:${roomId}`)
            .on(
                'broadcast',
                { event: 'signal' },
                async ({ payload }: { payload: SignalPayload }) => {
                    // Only handle signals meant for me (checking UUID)
                    if (payload.to !== myPlayerId) return;

                    const senderId = payload.from;
                    // senderId is now guaranteed to be a UUID because we changed sendSignal above

                    let peer = peersRef.current[senderId];

                    if (!peer) {
                        // Received signal from someone we don't have a peer for yet.
                        // This should mean they are the initiator and we are the receiver.
                        // Create non-initiator peer
                        peer = await createPeer(senderId, false, localStream);
                    }

                    peer.signal(payload.signal);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [myPlayerId, roomId, localStream, createPeer, supabase]);

    // Manage Connections based on Players list
    useEffect(() => {
        if (!myPlayerId || !localStream) return;

        const managePeers = async () => {
            for (const player of players) {
                const playerId = player.id; // normalized ID (could be uuid)

                // Skip self
                if (playerId === myPlayerId) continue;

                // Check if we already have a peer
                if (peersRef.current[playerId]) continue;

                // Decide who initiates: simpler ID initiates
                // Using localized UUID comparison for consistent behavior
                if (myPlayerId < playerId) {
                    console.log(`Initiating connection to ${playerId}`);
                    await createPeer(playerId, true, localStream);
                }
            }
        };

        managePeers();

        // Cleanup peers for players who left
        const activePlayerIds = new Set(players.map(p => p.id));
        Object.keys(peersRef.current).forEach(peerId => {
            if (!activePlayerIds.has(peerId)) {
                peersRef.current[peerId].destroy();
                delete peersRef.current[peerId];
                setRemoteStreams(prev => {
                    const next = { ...prev };
                    delete next[peerId];
                    return next;
                });
            }
        });

    }, [players, myPlayerId, localStream, createPeer]);

    const toggleAudio = (enabled: boolean) => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = enabled);
        }
    };

    const toggleVideo = (enabled: boolean) => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = enabled);
        }
    };

    const switchDevice = async (kind: 'audio' | 'video', deviceId: string) => {
        if (!localStream) return;

        try {
            const constraints: MediaStreamConstraints = {
                audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : false,
                video: kind === 'video' ? { deviceId: { exact: deviceId } } : false
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newTrack = kind === 'audio'
                ? newStream.getAudioTracks()[0]
                : newStream.getVideoTracks()[0];

            if (!newTrack) return;

            // Replace track in local stream
            const oldTrack = kind === 'audio'
                ? localStream.getAudioTracks()[0]
                : localStream.getVideoTracks()[0];

            if (oldTrack) {
                localStream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            localStream.addTrack(newTrack);

            // Update state
            if (kind === 'audio') setSelectedAudioDeviceId(deviceId);
            else setSelectedVideoDeviceId(deviceId);

            // Replace track in all peers
            Object.values(peersRef.current).forEach(peer => {
                // simple-peer internal check: needs mapped old track to replace
                // actually simple-peer's replaceTrack takes (oldTrack, newTrack, stream)
                // We need to be careful. SimplePeer types might vary but generally:
                // peer.replaceTrack(oldTrack, newTrack, localStream)

                try {
                    // @ts-ignore - simple-peer types can be finicky with replaceTrack
                    peer.replaceTrack(oldTrack, newTrack, localStream);
                } catch (e) {
                    console.error('Error replacing track in peer:', e);
                }
            });

            // Note: We deliberately do NOT create a new MediaStream here.
            // Mutating the existing `localStream` (via addTrack/removeTrack above) is sufficient
            // because the `<video>` element's `srcObject` reference remains valid.
            // Creating a new MediaStream object would reset `srcObject`, potentially causing 
            // a black screen or requiring a play() call.
            // The state updates for `selectedDevice` (above) will provoke a re-render 
            // of the consuming component, ensuring the UI reflects the change.

        } catch (err) {
            console.error(`Error switching ${kind} device:`, err);
        }
    };

    return {
        localStream,
        remoteStreams,
        devices,
        selectedAudioDeviceId,
        selectedVideoDeviceId,
        toggleAudio,
        toggleVideo,
        switchDevice
    };
}
