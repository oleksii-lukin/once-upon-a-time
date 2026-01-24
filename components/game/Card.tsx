'use client'

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

import { type CardData } from '@/utils/gameUtils'
import { useTranslation } from 'react-i18next'
import { getLocalizedCardContent } from '@/utils/gameUtils'
import Image from 'next/image'
import { CardLayout, parseCardLayout } from '@/types/card'

interface CardProps {
  card: Partial<CardData> // Allow partial for now as we might mock data
  isHoverable?: boolean
  onClick?: () => void
  className?: string
  cardBackImageUrl?: string | null
  categoryImages?: Record<string, string> | null
  layout?: CardLayout | null
}

export default function Card({ card, isHoverable = false, onClick, className = '', cardBackImageUrl, categoryImages, layout }: CardProps) {
  const { t, i18n } = useTranslation()
  const localizedContent = getLocalizedCardContent(card, i18n.language)

  const typeKey = normalizeTypeKey(localizedContent.type || '')
  const localizedType = t(`card_types.${typeKey}`, { defaultValue: t('card_types.card') })

  const cardLayout = parseCardLayout(layout)

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
        className="absolute inset-0 bg-cover bg-center z-0 pointer-events-none"
        style={{ backgroundImage: `url("${cardBackImageUrl || '/images/cards/Border.jpg'}")` }}
      />

      {/* Main Card Image Area */}
      <div
        className="absolute z-10 overflow-hidden"
        style={{
          top: `${cardLayout.image.top}%`,
          left: `${cardLayout.image.left}%`,
          width: `${cardLayout.image.width}%`,
          height: `${cardLayout.image.height}%`,
        }}
      >
        <div className="relative w-full h-full rounded-sm shadow-inner overflow-hidden">
          {card.image_url
            ? (
              <Image
                src={card.image_url}
                alt={localizedContent.name || 'Card image'}
                fill
                sizes="(max-width: 768px) 30vw, 15vw"
                className={`brightness-90 contrast-110 sepia-[.2] ${cardLayout.image.preserveRatio ? 'object-contain' : 'object-cover'}`}
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
      <div
        className="absolute z-30 flex items-center justify-center text-center px-1"
        style={{
          top: `${cardLayout.name.top}%`,
          left: `${cardLayout.name.left}%`,
          width: `${cardLayout.name.width}%`,
          height: `${cardLayout.name.height}%`,
        }}
      >
        <p className="text-slate-900 text-[10px] sm:text-xs font-serif font-bold leading-tight tracking-tight uppercase line-clamp-2 drop-shadow-sm">
          {localizedContent.name}
        </p>
      </div>

      {/* Category Icon */}
      <div
        className="absolute z-30 flex items-center justify-center"
        style={{
          top: `${cardLayout.icon.top}%`,
          left: `${cardLayout.icon.left}%`,
          width: `${cardLayout.icon.width}%`,
          height: `${cardLayout.icon.height}%`,
        }}
      >
        <div className="relative w-full h-full">
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

    </div>
  )
}
