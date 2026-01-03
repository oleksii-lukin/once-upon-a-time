import { useEffect, useRef } from 'react'
import { Layers as CardsIcon } from 'lucide-react'
import { Database } from '@/supabase/types'
import { PlayerAvatar, getPlayerDisplayName } from '../lobby/PlayerDisplay'
import { useTranslation } from 'react-i18next'

type Player = Database['public']['Tables']['players']['Row']

interface VideoPlayerProps {
  stream: MediaStream | null
  player: Player
  isLocal?: boolean
  cardCount?: number // Number of cards in hand
  isTurn?: boolean
}

export default function VideoPlayer({ stream, player, isLocal = false, cardCount, isTurn }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/50">
      {/* Video Feed */}
      {stream
        ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal} // Always mute local video to prevent echo
            className={`w-full h-full object-cover transform ${isLocal ? 'scale-x-[-1]' : ''}`} // Mirror local video
          />
        )
        : (
          // Fallback if no stream (e.g. loading or camera disabled)
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <PlayerAvatar player={player} size="lg" />
          </div>
        )}

      {/* Overlay Info */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-linear-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">
              {getPlayerDisplayName(player)}
              {' '}
              {isLocal && '(You)'}
            </p>
            {isTurn && <p className="text-xs text-primary">{t('game.storyteller_label')}</p>}
          </div>
          {cardCount !== undefined && (
            <div className="flex items-center gap-1 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
              <CardsIcon className="w-3.5 h-3.5" />
              <span>{cardCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls (Local Only) */}
      {/* We might want specific indicators for remote players (muted icon) later */}
    </div>
  )
}
