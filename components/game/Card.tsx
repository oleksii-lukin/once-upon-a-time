'use client'

import { type CardData, getLocalizedCardContent, normalizeTypeKey } from '@/utils/gameUtils'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { CardLayout, parseCardLayout } from '@/types/card'
import { Info as InfoIcon } from 'lucide-react'

interface CardProps {
  card: Partial<CardData> // Allow partial for now as we might mock data
  isHoverable?: boolean
  onClick?: () => void
  className?: string
  cardBackImageUrl?: string | null
  categoryImages?: Record<string, string> | null
  layout?: CardLayout | null
  onShowDetails?: (e: React.MouseEvent) => void
  showInfoButton?: boolean
}

const typeColorMap: Record<string, string> = {
  ending: 'bg-rose-500/90 border-rose-400/50',
  protagonist: 'bg-sky-500/90 border-sky-400/50',
  antagonist: 'bg-amber-600/90 border-amber-500/50',
  setting: 'bg-emerald-500/90 border-emerald-400/50',
  object: 'bg-violet-500/90 border-violet-400/50',
  catalyst: 'bg-fuchsia-500/90 border-fuchsia-400/50',
  trait: 'bg-indigo-500/90 border-indigo-400/50',
  character: 'bg-blue-500/90 border-blue-400/50',
  aspect: 'bg-teal-500/90 border-teal-400/50',
  card: 'bg-slate-600/90 border-slate-500/50',
}

export default function Card({ card, isHoverable = false, onClick, className = '', cardBackImageUrl, categoryImages, layout, onShowDetails, showInfoButton }: CardProps) {
  const { t, i18n } = useTranslation()
  const localizedContent = getLocalizedCardContent(card, i18n.language)
  const typeKey = normalizeTypeKey(card.category)
  const localizedType = t(`card_types.${typeKey}`, { defaultValue: t('card_types.card') })

  const cardLayout = parseCardLayout(layout)
  const categoryStyles = typeColorMap[typeKey] || typeColorMap.card

  return (
    <div
      onClick={onClick}
      className={`
                relative aspect-[2.5/3.5] overflow-hidden rounded-xl shadow-2xl
                transition-all duration-300 ease-out group/card
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

      {/* Category Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 ${categoryStyles} text-white py-1.5 text-[8px] sm:text-[10px] font-bold text-center uppercase tracking-[0.2em] z-40 backdrop-blur-md border-t shadow-[0_-4px_10px_rgba(0,0,0,0.2)]`}>
        {localizedType}
      </div>

      {/* Info Button - Top Right */}
      {onShowDetails && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShowDetails(e)
          }}
          className={`
            absolute top-2 right-2 z-50 w-8 h-8 rounded-full 
            bg-slate-900/40 backdrop-blur-md border border-white/20
            flex items-center justify-center text-white
            transition-all duration-300 transform scale-0
            hover:bg-primary hover:scale-110 hover:border-primary-light
            ${showInfoButton ? 'scale-100 animate-in zoom-in' : 'group-hover/card:scale-100'}
          `}
        >
          <InfoIcon className="w-5 h-5" />
        </button>
      )}

    </div>
  )
}
