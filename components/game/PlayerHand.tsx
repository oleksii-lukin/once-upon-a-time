'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'

import { CardLayout } from '@/types/card'
import { type HandCardData } from '@/utils/gameUtils'

import Card from './Card'

interface PlayerHandProps {
  cards: HandCardData[]
  onSelectCard: (card: HandCardData) => void
  selectedCardId: string | null
  isMyTurn: boolean
  deck?: {
    card_back_image_url?: string | null
    category_images?: Record<string, string> | null
    card_layout?: CardLayout | null
  }
  onShowDetails?: (card: HandCardData) => void
}

export default function PlayerHand({ cards, onSelectCard, selectedCardId, isMyTurn, deck, onShowDetails }: PlayerHandProps) {
  const { t } = useTranslation()
  // Sort cards: Story cards first, Ending cards last
  // We use useMemo to prevent re-sorting on every render if cards dependencies don't change
  const sortedCards = React.useMemo(() => {
    return [...cards].sort((a, b) => {
      const isAEnding = a.category?.toLowerCase() === 'ending'
      const isBEnding = b.category?.toLowerCase() === 'ending'

      if (isAEnding === isBEnding) {
        // Determine secondary sort (e.g., by ID or position to keep stable)
        return (a.position || 0) - (b.position || 0)
      }
      return isAEnding ? 1 : -1
    })
  }, [cards])

  return (
    <div className="relative w-full h-72 shrink-0 z-40">
      {/* Visual Tray Background - This is the part that takes up space and has the border */}
      <div className="absolute inset-0 bg-black/20 dark:bg-black/30 backdrop-blur-md border-t border-white/10 pointer-events-none" />

      {/* Scrollable Area - Taller than the tray to allow cards to stick out without clipping */}
      <div className="player-hand absolute inset-x-0 bottom-0 h-96 flex justify-center items-end gap-6 px-8 overflow-x-auto pb-1 overflow-y-visible scrollbar-hide">
        {sortedCards.map((card, index) => {
          const isEnding = card.category?.toLowerCase() === 'ending'
          // Check if previous card was NOT an ending, and this one IS an ending
          // But actually, we just want a separator BEFORE the first ending card
          // Since they are sorted, we can just check if this is the first ending card in the list
          const isFirstEnding = isEnding && (index === 0 || (sortedCards[index - 1].category?.toLowerCase() !== 'ending'))
          const isSelected = selectedCardId === card.id

          return (
            <React.Fragment key={card.id}>
              {isFirstEnding && index > 0 && (
                <div className="flex flex-col items-center justify-center h-48 mx-6 animate-fade-in mb-8">
                  <div className="h-full w-0.5 bg-linear-to-b from-transparent via-yellow-500/50 to-transparent shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
                </div>
              )}
              <div className={`w-48 shrink-0 transition-all duration-300 ease-out mb-0 ${isSelected ? 'transform -translate-y-16 z-30 scale-105' : 'hover:-translate-y-10 hover:z-10'} ${!isMyTurn ? 'pointer-events-none' : 'cursor-pointer'}`}>
                <Card
                  card={card}
                  isHoverable={false}
                  onClick={() => isMyTurn && onSelectCard(card)}
                  cardBackImageUrl={deck?.card_back_image_url}
                  categoryImages={deck?.category_images as Record<string, string> | null}
                  layout={deck?.card_layout}
                  onShowDetails={onShowDetails ? () => onShowDetails(card) : undefined}
                  showInfoButton={isSelected}
                  className={`${!isMyTurn ? 'opacity-70 grayscale' : ''} ${isEnding ? 'ring-2 ring-rose-500/30' : ''} ${isSelected ? 'ring-4 ring-white shadow-[0_0_40px_rgba(255,255,255,0.5)]' : ''}`}
                />
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
