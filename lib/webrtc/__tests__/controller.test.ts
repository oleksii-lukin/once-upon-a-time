import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWebRTCController, type SupabaseLike, type MediaDevicesLike } from '../controller'

interface FakeChannel {
  name: string
  handlers: Array<(msg: { payload: any }) => void>
  sent: any[]
  on: (type: any, opts: any, cb: (msg: { payload: any }) => void) => FakeChannel
  subscribe: () => FakeChannel
  send: (msg: any) => Promise<void>
}

/**
 * Unit tests for the WebRTC controller with injected fakes: peer mesh
 * reconciliation, signaling, media lifecycle and cleanup — no browser,
 * no React, no real WebRTC.
 */

class FakePeer {
  opts: { initiator: boolean, trickle: boolean, stream?: MediaStream }
  handlers: Record<string, Array<(arg?: any) => void>> = {}
  signals: any[] = []
  replacedTracks: any[][] = []
  destroyed = false

  constructor(opts: { initiator: boolean, trickle: boolean, stream?: MediaStream }) {
    this.opts = opts
  }

  on(event: string, cb: (arg?: any) => void) {
    ;(this.handlers[event] ||= []).push(cb)
  }

  emit(event: string, arg?: any) {
    this.handlers[event]?.forEach(cb => cb(arg))
  }

  signal(arg: any) {
    this.signals.push(arg)
  }

  destroy() {
    this.destroyed = true
  }

  replaceTrack(...args: any[]) {
    this.replacedTracks.push(args)
  }
}

const createdPeers: FakePeer[] = []

function makeDeps() {
  const channels: FakeChannel[] = []
  const channelsByName = new Map<string, FakeChannel>()

  const supabase: SupabaseLike = {
    channel: (name) => {
      const existing = channelsByName.get(name)
      if (existing) return existing
      const channel: FakeChannel = {
        name,
        handlers: [],
        sent: [],
        on: (_type, _opts, cb) => {
          channel.handlers.push(cb)
          return channel
        },
        subscribe: () => channel,
        send: (msg) => {
          channel.sent.push(msg)
          return Promise.resolve()
        },
      }
      channelsByName.set(name, channel)
      channels.push(channel)
      return channel
    },
    removeChannel: vi.fn(),
  }

  const mediaDevices: MediaDevicesLike = {
    getUserMedia: vi.fn(async () => makeStream()),
    enumerateDevices: vi.fn(async () => [
      { deviceId: 'mic-1', label: 'Mic', kind: 'audioinput' as const },
      { deviceId: 'cam-1', label: 'Cam', kind: 'videoinput' as const },
    ]),
  }

  const loadSimplePeer = vi.fn(async () => ({
    default: class extends FakePeer {
      constructor(opts: any) {
        super(opts)
        createdPeers.push(this)
      }
    } as any,
  }))

  return { supabase, mediaDevices, loadSimplePeer, channels }
}

function makeStream() {
  const makeTrack = (deviceId: string) => ({
    enabled: true,
    stop: vi.fn(),
    getSettings: () => ({ deviceId }),
  })
  const audioTrack = makeTrack('mic-1')
  const videoTrack = makeTrack('cam-1')
  return {
    getAudioTracks: () => [audioTrack],
    getVideoTracks: () => [videoTrack],
    getTracks: () => [audioTrack, videoTrack],
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    audioTrack,
    videoTrack,
  } as unknown as MediaStream & { audioTrack: ReturnType<typeof makeTrack>, videoTrack: ReturnType<typeof makeTrack> }
}

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('WebRTC controller', () => {
  beforeEach(() => {
    createdPeers.length = 0
  })

  it('initializes local media with device selections and device list', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)

    await controller.initMedia(true, false, false)

    const state = controller.getSnapshot()
    expect(state.localStream).not.toBeNull()
    expect(state.selectedAudioDeviceId).toBe('mic-1')
    expect(state.selectedVideoDeviceId).toBe('cam-1')
    expect(state.devices).toHaveLength(2)
  })

  it('does not request media for spectators who are not admins', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)

    await controller.initMedia(true, true, false)

    expect(deps.mediaDevices.getUserMedia).not.toHaveBeenCalled()
    expect(controller.getSnapshot().localStream).toBeNull()
  })

  it('creates outgoing peers only when the local ID is lower (initiator)', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    await controller.initMedia(true, false, false)

    await controller.syncPeers('room-1', ME, [{ id: ME }, { id: OTHER }], true)

    expect(createdPeers).toHaveLength(1)
    expect(createdPeers[0].opts.initiator).toBe(true)
    expect(createdPeers[0].opts.stream).toBe(controller.getSnapshot().localStream)

    // second sync must not duplicate the peer
    await controller.syncPeers('room-1', ME, [{ id: ME }, { id: OTHER }], true)
    expect(createdPeers).toHaveLength(1)
  })

  it('destroys peers of departed players and drops their streams', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    await controller.initMedia(true, false, false)

    await controller.syncPeers('room-1', ME, [{ id: ME }, { id: OTHER }], true)
    const peer = createdPeers[0]

    // simulate an established remote stream
    peer.emit('stream', makeStream())
    expect(Object.keys(controller.getSnapshot().remoteStreams)).toEqual([OTHER])

    await controller.syncPeers('room-1', ME, [{ id: ME }], true)

    expect(peer.destroyed).toBe(true)
    expect(controller.getSnapshot().remoteStreams).toEqual({})
  })

  it('creates a non-initiator peer for an inbound signal and forwards it', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    await controller.initMedia(true, false, false)

    controller.attachSignaling('room-1', ME, true)
    const channel = deps.channels[0]

    await channel.handlers[0]({
      payload: { from: OTHER, to: ME, signal: { type: 'offer', sdp: 'x' } },
    })

    expect(createdPeers).toHaveLength(1)
    expect(createdPeers[0].opts.initiator).toBe(false)
    expect(createdPeers[0].signals).toEqual([{ type: 'offer', sdp: 'x' }])
  })

  it('ignores signals addressed to other players', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    controller.attachSignaling('room-1', ME, true)
    const channel = deps.channels[0]

    await channel.handlers[0]({
      payload: { from: OTHER, to: 'someone-else', signal: { type: 'offer' } },
    })

    expect(createdPeers).toHaveLength(0)
  })

  it('sends outbound peer signals through the signaling channel', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    await controller.initMedia(true, false, false)
    controller.attachSignaling('room-1', ME, true)

    await controller.syncPeers('room-1', ME, [{ id: ME }, { id: OTHER }], true)
    const peer = createdPeers[0]

    peer.emit('signal', { type: 'answer', sdp: 'y' })

    const channel = deps.channels[0]
    await vi.waitFor(() => {
      expect(channel.sent).toHaveLength(1)
    })
    expect(channel.sent[0]).toMatchObject({
      type: 'broadcast',
      event: 'signal',
      payload: { from: ME, to: OTHER, signal: { type: 'answer', sdp: 'y' } },
    })
  })

  it('destroy stops media, peers and signaling', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    await controller.initMedia(true, false, false)
    controller.attachSignaling('room-1', ME, true)
    await controller.syncPeers('room-1', ME, [{ id: ME }, { id: OTHER }], true)

    const stream = controller.getSnapshot().localStream as any
    const peer = createdPeers[0]
    controller.destroy()

    expect(stream.audioTrack.stop).toHaveBeenCalled()
    expect(stream.videoTrack.stop).toHaveBeenCalled()
    expect(peer.destroyed).toBe(true)
    expect(deps.supabase.removeChannel).toHaveBeenCalledTimes(1)

    // no state updates after destroy
    const before = controller.getSnapshot()
    controller.toggleAudio(false)
    expect(controller.getSnapshot()).toBe(before)
  })

  it('switchDevice replaces the track and notifies peers', async () => {
    const deps = makeDeps()
    const controller = createWebRTCController(deps)
    await controller.initMedia(true, false, false)
    await controller.syncPeers('room-1', ME, [{ id: ME }, { id: OTHER }], true)
    const peer = createdPeers[0]

    await controller.switchDevice('audio', 'mic-2')

    const state = controller.getSnapshot()
    expect(state.selectedAudioDeviceId).toBe('mic-2')
    expect(peer.replacedTracks).toHaveLength(1)
  })
})
