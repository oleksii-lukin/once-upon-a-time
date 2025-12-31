import React from 'react'
import { useTranslation } from 'react-i18next'
import { Play as PlayIcon } from 'lucide-react'

interface TurnControlsProps {
  isMyTurn: boolean
  isStoryteller: boolean
  canInterrupt: boolean
  handSize: number
  selectedCardId: string | null
  onPlaySelected: () => void
  onPass: () => void
  onInterrupt: () => void
  onWin: () => void
}

export default function TurnControls({
  isMyTurn,
  isStoryteller,
  canInterrupt,
  handSize,
  selectedCardId,
  onPlaySelected,
  onPass,
  onInterrupt,
  onWin,
}: TurnControlsProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed bottom-32 right-8 flex flex-col gap-4 z-50">
      {/* Storyteller Controls */}
      {isMyTurn && (
        <div className="flex flex-col gap-2">
          <button
            onClick={onPlaySelected}
            disabled={!selectedCardId}
            className="bg-primary hover:bg-primary/80 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <PlayIcon className="w-5 h-5" />
            {' '}
            {t('game.play_card_btn')}
          </button>

          <button
            onClick={onPass}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            {t('game.pass_turn_btn')}
          </button>
          {handSize === 0 && (
            <button
              onClick={onWin}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 animate-pulse"
            >
              {t('game.play_ending_win_btn')}
            </button>
          )}
        </div>
      )}

      {/* Interrupter Controls */}
      {!isMyTurn && canInterrupt && (
        <button
          onClick={onInterrupt}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
        >
          {t('game.interrupt_btn')}
        </button>
      )}
    </div>
  )
}
