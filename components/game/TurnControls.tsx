import React from 'react'
import { useTranslation } from 'react-i18next'
import { Play as PlayIcon } from 'lucide-react'

interface TurnControlsProps {
  isMyTurn: boolean
  isStoryteller: boolean
  canInterrupt: boolean
  handSize: number
  selectedCardId: string | null
  onPlaySelected: () => void | Promise<void>
  onPass: () => void | Promise<void>
  onInterrupt: () => void | Promise<void>
  onWin: () => void | Promise<void>
  isEndingSelected?: boolean
  canObject?: boolean
  onObject?: () => void | Promise<void>
  canChallengeStutter?: boolean
  onChallengeStutter?: () => void | Promise<void>
  gameMode?: string
  isPending?: boolean
  rulesFinished?: boolean
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
  isEndingSelected,
  canObject,
  onObject,
  canChallengeStutter,
  onChallengeStutter,
  gameMode,
  isPending = false,
  rulesFinished = false,
}: TurnControlsProps) {
  const { t } = useTranslation()
  return (
    <div className="absolute bottom-8 right-8 flex flex-col gap-4 z-50">
      {/* Storyteller Controls */}
      {isMyTurn && (
        <div className="flex flex-col gap-2">
          {handSize > 0
            ? (
              <button
                onClick={onPlaySelected}
                disabled={!selectedCardId || isEndingSelected || isPending || rulesFinished}
                className="bg-primary hover:bg-primary/80 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5" />
                {' '}
                {t('game.play_card_btn')}
              </button>
            )
            : (
              <button
                onClick={onWin}
                disabled={!selectedCardId || !isEndingSelected || isPending || rulesFinished}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 animate-pulse disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5" />
                {' '}
                {t('game.play_ending_win_btn')}
              </button>
            )}

          <button
            onClick={onPass}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            {gameMode === 'solo' ? t('game.draw_card_btn') : t('game.pass_turn_btn')}
          </button>
        </div>
      )}

      {/* Interrupter/Objector Controls */}
      {!isMyTurn && (
        <div className="flex flex-col gap-2">
          {canObject && (
            <button
              onClick={onObject}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2 animate-bounce"
            >
              {t('game.object_btn')}
            </button>
          )}

          {canChallengeStutter && (
            <button
              onClick={onChallengeStutter}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
            >
              {t('game.challenge_stutter_btn')}
            </button>
          )}

          {canInterrupt && (
            <button
              onClick={onInterrupt}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
            >
              {t('game.interrupt_btn')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
