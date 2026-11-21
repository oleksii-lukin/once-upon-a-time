import type { Instance, SignalData } from 'simple-peer'

/**
 * Framework-free WebRTC controller: owns the local media stream, the peer
 * map, remote streams and device selection, and exposes them through a
 * subscribe/getSnapshot pair (useSyncExternalStore-style). React glue
 * lives in components/game/useWebRTC; this module has no React and no
 * module-level side effects, so its peer/signaling lifecycle is unit
 * testable with injected fakes.
 */

/** Media device information used in WebRTC setup. */
export interface DeviceInfo {
  /** Unique device identifier provided by the browser */
  deviceId: string
  /** Human-readable device name/label */
  label: string
  /** Type of media device (audioinput, audiooutput, videoinput) */
  kind: MediaDeviceKind
}

export interface WebRTCState {
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  devices: DeviceInfo[]
  selectedAudioDeviceId: string
  selectedVideoDeviceId: string
}

interface SignalPayload {
  from: string
  to: string
  signal: SignalData
}

/* Structural dependency types — tests inject fakes matching these shapes. */

export interface SignalingChannel {
  on: (
    type: 'broadcast',
    opts: { event: string },
    cb: (msg: { payload: SignalPayload }) => void,
  ) => SignalingChannel
  subscribe: () => SignalingChannel
  send?: (msg: unknown) => Promise<unknown>
}

export interface SupabaseLike {
  channel: (name: string) => SignalingChannel
  removeChannel: (channel: SignalingChannel) => void
}

export interface MediaDevicesLike {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  enumerateDevices: () => Promise<Array<{ deviceId: string, label: string, kind: MediaDeviceKind }>>
}

export type LoadSimplePeer = () => Promise<{
  default: new (opts: { initiator: boolean, trickle: boolean, stream?: MediaStream }) => Instance
}>

export interface WebRTCDeps {
  supabase: SupabaseLike
  mediaDevices: MediaDevicesLike | undefined
  loadSimplePeer: LoadSimplePeer
}

export function createWebRTCController(deps: WebRTCDeps) {
  let state: WebRTCState = {
    localStream: null,
    remoteStreams: {},
    devices: [],
    selectedAudioDeviceId: '',
    selectedVideoDeviceId: '',
  }
  const peers = new Map<string, Instance>()
  const listeners = new Set<() => void>()

  let destroyed = false
  let initializing = false
  let signalingChannel: SignalingChannel | null = null
  // Signaling context for outbound peer signals (set when the room attaches)
  let roomId: string | null = null
  let myPlayerId: string | null = null

  const setState = (patch: Partial<WebRTCState>) => {
    if (destroyed) return
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }

  const getSnapshot = () => state

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const sendSignal = async (to: string, signal: SignalData) => {
    if (destroyed || !roomId || !myPlayerId) return
    await deps.supabase.channel(`game_signaling:${roomId}`).send?.({
      type: 'broadcast',
      event: 'signal',
      payload: {
        from: myPlayerId, // Send my DB UUID, not my Auth ID
        to,
        signal,
      },
    })
  }

  async function createPeer(targetId: string, initiator: boolean): Promise<Instance> {
    const SimplePeer = (await deps.loadSimplePeer()).default

    const peer = new SimplePeer({
      initiator,
      trickle: false, // one large offer/answer instead of trickle ICE
      stream: state.localStream || undefined,
    })

    peer.on('signal', (signal) => {
      sendSignal(targetId, signal)
    })

    peer.on('stream', (remoteStream) => {
      if (destroyed) return
      setState({ remoteStreams: { ...state.remoteStreams, [targetId]: remoteStream } })
    })

    peer.on('error', (err) => {
      console.error(`Peer error with ${targetId}:`, err)
    })

    peer.on('close', () => {
      if (destroyed) return
      const remoteStreams = { ...state.remoteStreams }
      delete remoteStreams[targetId]
      peers.delete(targetId)
      setState({ remoteStreams })
    })

    peers.set(targetId, peer)
    return peer
  }

  const cleanupLocalMedia = () => {
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop())
      setState({ localStream: null })
    }
  }

  /** Initializes (or tears down) the local camera/mic stream. */
  async function initMedia(enabled: boolean, isSpectator: boolean, isAdmin: boolean) {
    if (destroyed) return

    // Spectators who are not admins don't send media
    if (!enabled || (isSpectator && !isAdmin)) {
      cleanupLocalMedia()
      return
    }
    if (state.localStream || initializing || !deps.mediaDevices) return

    initializing = true
    try {
      const stream = await deps.mediaDevices.getUserMedia({ video: true, audio: true })

      if (destroyed) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      const audioTrack = stream.getAudioTracks()[0]
      const videoTrack = stream.getVideoTracks()[0]
      setState({
        localStream: stream,
        selectedAudioDeviceId: audioTrack?.getSettings().deviceId || 'default',
        selectedVideoDeviceId: videoTrack?.getSettings().deviceId || 'default',
      })

      const deviceInfos = await deps.mediaDevices.enumerateDevices()
      if (destroyed) return
      setState({
        devices: deviceInfos.map(d => ({
          deviceId: d.deviceId,
          label: d.label,
          kind: d.kind,
        })),
      })
    }
    catch (err) {
      console.error('Error accessing media devices:', err)
    }
    finally {
      initializing = false
    }
  }

  /**
   * Attaches the signaling channel for the room; returns a detach fn.
   * Inbound signals create a non-initiator peer when none exists yet
   * (the sender is the initiator).
   */
  function attachSignaling(room: string, playerId: string, enabled: boolean): () => void {
    if (!enabled || !playerId || destroyed) return () => {}
    detachSignaling()

    roomId = room
    myPlayerId = playerId

    const channel = deps.supabase
      .channel(`game_signaling:${room}`)
      .on(
        'broadcast',
        { event: 'signal' },
        async ({ payload }) => {
          if (destroyed || payload.to !== myPlayerId) return

          let peer = peers.get(payload.from)
          if (!peer) {
            peer = await createPeer(payload.from, false)
          }
          peer.signal(payload.signal)
        },
      )
      .subscribe()

    signalingChannel = channel
    return detachSignaling
  }

  function detachSignaling() {
    if (signalingChannel) {
      deps.supabase.removeChannel(signalingChannel)
      signalingChannel = null
    }
  }

  /**
   * Reconciles the peer mesh with the current player list: creates
   * outgoing connections (the lower UUID initiates) and destroys peers of
   * departed players.
   */
  async function syncPeers(room: string, playerId: string, players: Array<{ id: string }>, enabled: boolean) {
    if (!enabled || !playerId || destroyed) return
    roomId = room
    myPlayerId = playerId

    for (const player of players) {
      const targetId = player.id
      if (targetId === myPlayerId) continue
      if (peers.has(targetId)) continue

      // Decide who initiates: simpler ID initiates
      if (myPlayerId! < targetId) {
        await createPeer(targetId, true)
      }
    }

    // Cleanup peers for players who left
    const activePlayerIds = new Set(players.map(p => p.id))
    for (const [peerId, peer] of peers) {
      if (!activePlayerIds.has(peerId)) {
        peer.destroy()
        peers.delete(peerId)
        const remoteStreams = { ...state.remoteStreams }
        delete remoteStreams[peerId]
        setState({ remoteStreams })
      }
    }
  }

  function toggleAudio(enabled: boolean) {
    state.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  function toggleVideo(enabled: boolean) {
    state.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  async function switchDevice(kind: 'audio' | 'video', deviceId: string) {
    const localStream = state.localStream
    if (!localStream || !deps.mediaDevices || destroyed) return

    try {
      const constraints: MediaStreamConstraints = {
        audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : false,
        video: kind === 'video' ? { deviceId: { exact: deviceId } } : false,
      }

      const newStream = await deps.mediaDevices.getUserMedia(constraints)
      const newTrack = kind === 'audio'
        ? newStream.getAudioTracks()[0]
        : newStream.getVideoTracks()[0]

      if (!newTrack) return

      const oldTrack = kind === 'audio'
        ? localStream.getAudioTracks()[0]
        : localStream.getVideoTracks()[0]

      if (oldTrack) {
        localStream.removeTrack(oldTrack)
        oldTrack.stop()
      }
      localStream.addTrack(newTrack)

      setState(kind === 'audio'
        ? { selectedAudioDeviceId: deviceId }
        : { selectedVideoDeviceId: deviceId })

      // Replace the track in all peers. The stream object itself is
      // mutated on purpose: <video> elements keep their srcObject valid.
      for (const peer of peers.values()) {
        try {
          peer.replaceTrack(oldTrack, newTrack, localStream)
        }
        catch (e) {
          console.error('Error replacing track in peer:', e)
        }
      }
    }
    catch (err) {
      console.error(`Error switching ${kind} device:`, err)
    }
  }

  function destroy() {
    destroyed = true
    detachSignaling()
    state.localStream?.getTracks().forEach(track => track.stop())
    peers.forEach(peer => peer.destroy())
    peers.clear()
    listeners.clear()
  }

  return {
    subscribe,
    getSnapshot,
    initMedia,
    attachSignaling,
    syncPeers,
    toggleAudio,
    toggleVideo,
    switchDevice,
    destroy,
  }
}

export type WebRTCController = ReturnType<typeof createWebRTCController>
