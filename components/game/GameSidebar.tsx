'use client'

import { useState } from 'react'
import {
  Mic as MicOnIcon,
  MicOff as MicOffIcon,
  Video as VideoOnIcon,
  VideoOff as VideoOffIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import { Database } from '@/supabase/types'
import { PlayerAvatar, getPlayerDisplayName } from '../lobby/PlayerDisplay'
import useWebRTC, { DeviceInfo } from './useWebRTC'
import VideoPlayer from './VideoPlayer'
import { useTranslation } from 'react-i18next'

type Player = Database['public']['Tables']['players']['Row']

interface ControlsProps {
  enableVideoChat: boolean
  audioEnabled: boolean
  videoEnabled: boolean
  showSettings: boolean
  devices: DeviceInfo[]
  selectedAudioDeviceId: string
  selectedVideoDeviceId: string
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleSettings: () => void
  onSwitchDevice: (type: 'audio' | 'video', deviceId: string) => void
}

function Controls({ enableVideoChat, audioEnabled, videoEnabled, showSettings, devices, selectedAudioDeviceId, selectedVideoDeviceId, onToggleAudio, onToggleVideo, onToggleSettings, onSwitchDevice }: ControlsProps) {
  const { t } = useTranslation()

  if (!enableVideoChat) return null

  return (
    <div className="absolute top-2 right-2 flex gap-2">
      <button
        onClick={onToggleAudio}
        className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-colors ${audioEnabled ? 'bg-black/50 hover:bg-black/70' : 'bg-red-500 hover:bg-red-600'}`}
        title={audioEnabled ? t('game.mute_audio') : t('game.unmute_audio')}
      >
        {audioEnabled ? <MicOnIcon className="w-5 h-5" /> : <MicOffIcon className="w-5 h-5" />}
      </button>
      <button
        onClick={onToggleVideo}
        className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-colors ${videoEnabled ? 'bg-black/50 hover:bg-black/70' : 'bg-red-500 hover:bg-red-600'}`}
        title={videoEnabled ? t('game.turn_off_video') : t('game.turn_on_video')}
      >
        {videoEnabled ? <VideoOnIcon className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
      </button>
      <button
        onClick={onToggleSettings}
        className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-colors ${showSettings ? 'bg-primary' : 'bg-black/50 hover:bg-black/70'}`}
        title={t('game.device_settings')}
      >
        <SettingsIcon className="w-5 h-5" />
      </button>

      {/* Device Settings Popover */}
      {showSettings && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl z-50 flex flex-col gap-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">{t('game.microphone_label')}</label>
            <select
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-primary"
              value={selectedAudioDeviceId}
              onChange={e => onSwitchDevice('audio', e.target.value)}
            >
              {devices.filter(d => d.kind === 'audioinput').map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `${t('game.microphone_label')} ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">{t('game.camera_label')}</label>
            <select
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-primary"
              value={selectedVideoDeviceId}
              onChange={e => onSwitchDevice('video', e.target.value)}
            >
              {devices.filter(d => d.kind === 'videoinput').map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `${t('game.camera_label')} ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

interface GameSidebarProps {
  players: Player[]
  currentPlayerId: string | null
  currentTurnPlayerId: string
  lobbyId: string
  enableVideoChat?: boolean
  isSpectator?: boolean
  isAdmin?: boolean
  playerHandCounts?: Record<string, number>
}

export default function GameSidebar({ players, currentPlayerId, currentTurnPlayerId, lobbyId, enableVideoChat = true, isSpectator = false, isAdmin = false, playerHandCounts = {} }: GameSidebarProps) {
  const { t } = useTranslation()
  const {
    localStream,
    remoteStreams,
    toggleAudio,
    toggleVideo,
    devices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    switchDevice,
  } = useWebRTC(lobbyId, currentPlayerId, players, enableVideoChat, isSpectator, isAdmin)

  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)

  const handleToggleAudio = () => {
    const newState = !audioEnabled
    setAudioEnabled(newState)
    toggleAudio(newState)
  }

  const handleToggleVideo = () => {
    const newState = !videoEnabled
    setVideoEnabled(newState)
    toggleVideo(newState)
  }

  const me = players.find(p => p.user_id === currentPlayerId || p.guest_id === currentPlayerId)

  // Determine the "Active Player" (Storyteller) to show at the top
  const activePlayer = players.find(p => p.id === currentTurnPlayerId) || players.filter(p => p.role !== 'spectator')[0]

  // Only players in the grid
  const gridPlayers = players.filter(p => p.role !== 'spectator')
  const spectatorsList = players.filter(p => p.role === 'spectator')

  const [showSettings, setShowSettings] = useState(false)

  return (
    <aside className="w-96 bg-black/20 dark:bg-black/30 backdrop-blur-md border-l border-white/10 flex flex-col p-6 gap-6 h-full overflow-y-auto shrink-0">
      {/* Active Player (Storyteller) */}
      {activePlayer && (
        <div className="relative aspect-video w-full rounded-lg overflow-hidden ring-2 shadow-lg ring-primary shadow-primary/20">
          <VideoPlayer
            stream={enableVideoChat ? (activePlayer.id === me?.id ? localStream : (remoteStreams[activePlayer.id] || null)) : null}
            player={activePlayer}
            isLocal={activePlayer.id === me?.id}
            cardCount={playerHandCounts[activePlayer.id]}
            isTurn={true}
          />
          {activePlayer.id === me?.id && (
            <Controls
              enableVideoChat={enableVideoChat}
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              showSettings={showSettings}
              devices={devices}
              selectedAudioDeviceId={selectedAudioDeviceId}
              selectedVideoDeviceId={selectedVideoDeviceId}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onToggleSettings={() => setShowSettings(!showSettings)}
              onSwitchDevice={switchDevice}
            />
          )}
        </div>
      )}

      {/* All Players Grid */}
      <div className="flex-1 overflow-y-auto p-1">
        <div className="grid grid-cols-2 gap-4">
          {gridPlayers.map((player) => {
            const isActive = player.id === activePlayer?.id
            return (
              <div
                key={player.id}
                className={`relative aspect-video w-full rounded-lg ${isActive ? 'outline-2 outline-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.6)]' : ''}`}
              >
                <div className="absolute inset-0 rounded-lg overflow-hidden">
                  <VideoPlayer
                    // If active, show avatar (stream=null). Else show video.
                    stream={enableVideoChat && !isActive ? (player.id === me?.id ? localStream : (remoteStreams[player.id] || null)) : null}
                    player={player}
                    isLocal={player.id === me?.id}
                    cardCount={playerHandCounts[player.id]}
                    isTurn={isActive}
                  />
                </div>
                {/* Show controls if it's me AND I'm not the active player (controls already at top) */}
                {player.id === me?.id && !isActive && (
                  <Controls
                    enableVideoChat={enableVideoChat}
                    audioEnabled={audioEnabled}
                    videoEnabled={videoEnabled}
                    showSettings={showSettings}
                    devices={devices}
                    selectedAudioDeviceId={selectedAudioDeviceId}
                    selectedVideoDeviceId={selectedVideoDeviceId}
                    onToggleAudio={handleToggleAudio}
                    onToggleVideo={handleToggleVideo}
                    onToggleSettings={() => setShowSettings(!showSettings)}
                    onSwitchDevice={switchDevice}
                  />
                )}
              </div>
            )
          })}

        </div>
        {gridPlayers.length === 0 && (
          <div className="text-center p-8 border-2 border-dashed border-white/10 rounded-xl">
            <p className="text-white/40 text-sm italic">{t('game.waiting_players')}</p>
          </div>
        )}
      </div>

      {/* Spectators List */}
      {spectatorsList.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{t('game.spectators')}</p>
          <div className="flex flex-col gap-2">
            {spectatorsList.map(spectator => (
              <div
                key={spectator.id}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors p-2 rounded-lg"
              >
                <PlayerAvatar player={spectator} size="sm" />
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {getPlayerDisplayName(spectator)}
                    {spectator.id === me?.id && ` (${t('game.you')})`}
                  </p>
                </div>
                {/* Admin indicator for spectators if relevant */}
                {(spectator.user_id && players.find(p => p.user_id === spectator.user_id)?.role === 'host') && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-primary" title="Host" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Turn Indicator */}
      <div className="mt-auto text-center p-4 bg-white/5 rounded-lg shrink-0">
        <p className="text-sm text-white/70">{t('game.current_storyteller')}</p>
        <p className="text-lg font-bold text-white">
          {getPlayerDisplayName(players.find(p => p.id === currentTurnPlayerId) || players[0])}
        </p>
      </div>
    </aside>
  )
}
