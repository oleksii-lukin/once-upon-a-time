'use client'

import { Database } from '@/supabase/types'

function normalizeTypeKey(raw?: string) {
  const s = (raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const map: Record<string, string> = {
    endings: 'ending',
    ending: 'ending',
    catalysts: 'catalyst',
    catalyst: 'catalyst',
    characters: 'character',
    character: 'character',
    settings: 'setting',
    setting: 'setting',
    aspects: 'aspect',
    aspect: 'aspect',
    card: 'card',
  }
  return map[s] || 'card'
}

type CardData = Database['public']['Tables']['cards']['Row']

interface CardProps {
  card: Partial<CardData> & { type?: string } // Allow partial for now as we might mock data
  isHoverable?: boolean
  onClick?: () => void
  className?: string
}

import { useTranslation } from 'react-i18next'
import { getLocalizedCardContent } from '@/utils/gameUtils'

export default function Card({ card, isHoverable = false, onClick, className = '' }: CardProps) {
  const { t, i18n } = useTranslation()
  const localizedContent = getLocalizedCardContent(card, i18n.language)

  const typeKey = normalizeTypeKey(localizedContent.type)
  const localizedType = t(`card_types.${typeKey}`, { defaultValue: t('card_types.card') })

  return (
    <div
      onClick={onClick}
      className={`
                relative aspect-[2.5/3.5] overflow-hidden rounded-xl shadow-2xl 
                transition-all duration-300 ease-out
                ${isHoverable ? 'cursor-pointer hover:-translate-y-8 hover:scale-105 hover:z-10 hover:shadow-yellow-500/20' : ''}
                ${className}
            `}
    >
      {/* Base Border Background */}
      <div
        className="absolute inset-0 bg-cover bg-center z-20 pointer-events-none"
        style={{ backgroundImage: `url("/images/cards/Border.jpg")` }}
      />

      {/* Main Card Image Area - Centered in the frame */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pt-[15%]">
        <div
          className="w-[72%] h-[55%] bg-cover bg-center rounded-sm shadow-inner brightness-90 contrast-110 sepia-[.2]"
          style={{
            backgroundImage: `url("${card.image_url || '/placeholder-card.jpg'}")`,
          }}
        />
      </div>

      {/* Card Name - Top Area */}
      {/* Dark text typically works better on parchment-like borders, assuming Border.jpg is light/parchment styling based on the genre. 
          If it's black, we need white text. User said "currently cards are text on black background", implies moving away from that. 
          Usually borders are gold/ornate. Text color is a guess. I'll use a class that I can easily flip.
          "It has place for card name placeholder at the top"
      */}
      <div className="absolute top-[7%] left-[12%] right-[12%] pb-2 h-[12%] flex items-center justify-center z-30 text-center">
        <p className="text-slate-900 text-xs sm:text-sm font-serif font-bold leading-tight tracking-tight uppercase line-clamp-2 drop-shadow-sm">
          {localizedContent.name}
        </p>
      </div>

      {/* Category Icon - Top Left */}
      <div className="absolute top-[3.5%] left-[3.5%] z-30 w-[12%] aspect-square flex items-center justify-center">
        {/* Placeholder circle for category */}
        <div className="w-full h-full rounded-full bg-slate-900/40 border border-white/20 shadow-sm backdrop-blur-sm" title={localizedType} />
      </div>

    </div>
  )
}
