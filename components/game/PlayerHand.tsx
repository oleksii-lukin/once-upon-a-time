'use client'

import Card from './Card'
import { Database } from '@/supabase/types'
import React from 'react'
import { useTranslation } from 'react-i18next'

// Mock card type for now until we have the full schema
type CardData = Database['public']['Tables']['cards']['Row'] & { type?: string, position?: number }

interface PlayerHandProps {
  cards: CardData[]
  onSelectCard: (card: CardData) => void
  selectedCardId: string | null
  isMyTurn: boolean
}

export default function PlayerHand({ cards, onSelectCard, selectedCardId, isMyTurn }: PlayerHandProps) {
  const { t } = useTranslation()
  // Sort cards: Story cards first, Ending cards last
  // We use useMemo to prevent re-sorting on every render if cards dependencies don't change
  const sortedCards = React.useMemo(() => {
    return [...cards].sort((a, b) => {
      const isAEnding = (a.type?.toLowerCase() === 'ending') || (a.category?.toLowerCase() === 'ending') || (a.category?.toLowerCase() === 'endings')
      const isBEnding = (b.type?.toLowerCase() === 'ending') || (b.category?.toLowerCase() === 'ending') || (b.category?.toLowerCase() === 'endings')

      if (isAEnding === isBEnding) {
        // Determine secondary sort (e.g., by ID or position to keep stable)
        return (a.position || 0) - (b.position || 0)
      }
      return isAEnding ? 1 : -1
    })
  }, [cards])

  return (
    <div className="relative w-full bg-black/20 dark:bg-black/30 backdrop-blur-md border-t border-white/10 pt-4 pb-6">
      <div className="player-hand flex justify-center items-end h-72 gap-4 px-4 overflow-x-auto pb-4">
        {sortedCards.map((card, index) => {
          const isEnding = (card.type?.toLowerCase() === 'ending') || (card.category?.toLowerCase() === 'ending') || (card.category?.toLowerCase() === 'endings')
          // Check if previous card was NOT an ending, and this one IS an ending
          // But actually, we just want a separator BEFORE the first ending card
          // Since they are sorted, we can just check if this is the first ending card in the list
          const isFirstEnding = isEnding && (index === 0 || !((sortedCards[index - 1].type?.toLowerCase() === 'ending') || (sortedCards[index - 1].category?.toLowerCase() === 'ending')))
          const isSelected = selectedCardId === card.id

          return (
            <React.Fragment key={card.id}>
              {isFirstEnding && index > 0 && (
                <div className="flex flex-col items-center justify-center h-48 mx-6 animate-fade-in">
                  <div className="h-full w-0.5 bg-linear-to-b from-transparent via-yellow-500/50 to-transparent shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
                </div>
              )}
              <div className={`w-48 shrink-0 transition-all duration-300 ${isEnding ? 'transform hover:-translate-y-4' : ''} ${isSelected ? 'transform -translate-y-6 z-10' : ''}`}>
                <Card
                  card={card}
                  isHoverable={isMyTurn}
                  onClick={() => isMyTurn && onSelectCard(card)}
                  className={`${!isMyTurn ? 'opacity-70 grayscale' : ''} ${isEnding ? 'ring-2 ring-yellow-500/30' : ''} ${isSelected ? 'ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : ''}`}
                />
                {isEnding && (
                  <div className="text-center text-xs text-yellow-400 mt-3 font-bold tracking-[0.2em] uppercase drop-shadow-md">
                    {t('game.ending_card_label')}
                  </div>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
      {/* Action buttons moved to TurnControls/Sidebar as requested */}
    </div>
  )
}
