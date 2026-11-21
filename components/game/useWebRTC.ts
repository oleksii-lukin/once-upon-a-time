import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type Player } from '@/types/model'
import { createWebRTCController, type DeviceInfo, type SupabaseLike } from '@/lib/webrtc/controller'

export type { DeviceInfo }

/**
 * Thin React wrapper around the WebRTC controller (lib/webrtc). The
 * controller owns peers/streams/device state; this hook wires its
 * lifecycle to the component tree and exposes the same API as before.
 */
export default function useWebRTC(
  roomId: string,
  currentPlayerId: string | null,
  players: Player[],
  enabled: boolean = true,
  isSpectator: boolean = false,
  isAdmin: boolean = false,
) {
  const supabase = createClient()
  const controller = useMemo(() => createWebRTCController({
    // Structural boundary: supabase-js' `.on` overload set doesn't match
    // the narrow signaling shape by itself; fakes in tests satisfy it.
    supabase: supabase as unknown as SupabaseLike,
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
    loadSimplePeer: async () => (await import('simple-peer')),
  }), [supabase])

  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)

  // Derived state for the current player's persistent ID (database UUID);
  // signaling equality checks use it rather than the auth ID.
  const myPlayer = players.find(p => p.user_id === currentPlayerId || p.guest_id === currentPlayerId)
  const myPlayerId = myPlayer?.id
  const localStream = state.localStream

  // Initialize (or tear down) local media when the chat is toggled
  useEffect(() => {
    controller.initMedia(enabled, isSpectator, isAdmin)
  }, [controller, enabled, isSpectator, isAdmin, localStream])

  // Signaling channel for the room
  useEffect(() => {
    const detach = controller.attachSignaling(roomId, myPlayerId ?? '', enabled)
    return detach
  }, [controller, roomId, myPlayerId, enabled, localStream])

  // Keep the peer mesh in sync with the player list
  useEffect(() => {
    controller.syncPeers(roomId, myPlayerId ?? '', players, enabled)
  }, [controller, roomId, players, myPlayerId, enabled, localStream])

  // Tear everything down on unmount
  useEffect(() => () => controller.destroy(), [controller])

  return {
    localStream: state.localStream,
    remoteStreams: state.remoteStreams,
    devices: state.devices,
    selectedAudioDeviceId: state.selectedAudioDeviceId,
    selectedVideoDeviceId: state.selectedVideoDeviceId,
    toggleAudio: controller.toggleAudio,
    toggleVideo: controller.toggleVideo,
    switchDevice: controller.switchDevice,
  }
}
