import { useEffect, useRef } from 'react'
import { Database } from '@/supabase/types'
import { PlayerAvatar, getPlayerDisplayName } from '../lobby/PlayerDisplay'

type Player = Database['public']['Tables']['players']['Row']

interface VideoPlayerProps {
  stream: MediaStream | null
  player: Player
  isLocal?: boolean
  styleCount?: number // Prop to replicate the "5 cards" badge in the design
  isTurn?: boolean
}

export default function VideoPlayer({ stream, player, isLocal = false, styleCount, isTurn }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/50">
      {/* Video Feed */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video to prevent echo
          className={`w-full h-full object-cover transform ${isLocal ? 'scale-x-[-1]' : ''}`} // Mirror local video
        />
      ) : (
      // Fallback if no stream (e.g. loading or camera disabled)
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <PlayerAvatar player={player} size="lg" />
        </div>
      )}

      {/* Overlay Info */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">
              {getPlayerDisplayName(player)}
              {' '}
              {isLocal && '(You)'}
            </p>
            {isTurn && <p className="text-xs text-primary">Storyteller</p>}
          </div>
          {styleCount !== undefined && (
            <div className="flex items-center gap-1 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
              <span className="material-symbols-outlined text-xs">style</span>
              <span>{styleCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls (Local Only) */}
      {/* We might want specific indicators for remote players (muted icon) later */}
    </div>
  )
}
