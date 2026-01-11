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
    protagonists: 'protagonist',
    protagonist: 'protagonist',
    antagonists: 'antagonist',
    antagonist: 'antagonist',
    settings: 'setting',
    setting: 'setting',
    objects: 'object',
    object: 'object',
    traits: 'trait',
    trait: 'trait',
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
  cardBackImageUrl?: string | null
  categoryImages?: Record<string, string> | null
}

import { useTranslation } from 'react-i18next'
import { getLocalizedCardContent } from '@/utils/gameUtils'
import Image from 'next/image'

export default function Card({ card, isHoverable = false, onClick, className = '', cardBackImageUrl, categoryImages }: CardProps) {
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
      {/* Base Border Background - Moved to background (z-0) or behind content */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0 pointer-events-none"
        style={{ backgroundImage: `url("${cardBackImageUrl || '/images/cards/Border.jpg'}")` }}
      />

      {/* Main Card Image Area - Centered in the frame */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pt-[15%]">
        <div className="relative w-[72%] h-[55%] rounded-sm shadow-inner overflow-hidden">
          {card.image_url
            ? (
                <Image
                  src={card.image_url}
                  alt={localizedContent.name || 'Card image'}
                  fill
                  sizes="(max-width: 768px) 30vw, 15vw"
                  className="object-cover brightness-90 contrast-110 sepia-[.2]"
                />
              )
            : categoryImages?.[typeKey]
              ? (
                  <div className="w-full h-full relative p-4 flex items-center justify-center bg-slate-900/10">
                    <div className="relative w-full h-full opacity-40 brightness-75 contrast-125 sepia-[.4] grayscale-[.2]">
                      <Image
                        src={categoryImages[typeKey]}
                        alt={localizedType}
                        fill
                        sizes="(max-width: 768px) 30vw, 15vw"
                        className="object-contain"
                      />
                    </div>
                  </div>
                )
              : (
                  <div
                    className="w-full h-full bg-cover bg-center rounded-sm shadow-inner brightness-90 contrast-110 sepia-[.2]"
                    style={{
                      backgroundImage: `url("/images/cards/Border.jpg")`,
                    }}
                  />
                )}
        </div>
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
        {categoryImages?.[typeKey]
          ? (
              <Image
                src={categoryImages[typeKey]}
                alt={localizedType}
                fill
                sizes="(max-width: 768px) 10vw, 5vw"
                className="object-contain"
                title={localizedType}
              />
            )
          : (
            /* Fallback to placeholder circle if no category image is available */
              <div className="w-full h-full rounded-full bg-slate-900/40 border border-white/20 shadow-sm backdrop-blur-sm" title={localizedType} />
            )}
      </div>

    </div>
  )
}
