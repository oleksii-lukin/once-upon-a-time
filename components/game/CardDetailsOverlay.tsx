'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { X as CloseIcon, Info as InfoIcon, ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon } from 'lucide-react'
import { type CardData, getLocalizedCardContent } from '@/utils/gameUtils'

interface CardDetailsOverlayProps {
  card: Partial<CardData>
  onClose: () => void
  categoryImages?: Record<string, string> | null
  typeColorMap: Record<string, string>
}

export default function CardDetailsOverlay({ card, onClose, categoryImages, typeColorMap }: CardDetailsOverlayProps) {
  const { t, i18n } = useTranslation()
  const localizedContent = getLocalizedCardContent(card, i18n.language)
  const [showUsage, setShowUsage] = useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const normalizeTypeKey = (raw?: string) => {
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

  const typeKey = normalizeTypeKey(localizedContent.type || '')
  const localizedType = t(`card_types.${typeKey}`, { defaultValue: t('card_types.card') })
  const categoryStyles = typeColorMap[typeKey] || typeColorMap.card

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-start pointer-events-none p-8 animate-in fade-in duration-300">
      {/* Backdrop for closing */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      <div className="relative w-full max-w-7xl flex items-end gap-12 pointer-events-auto">
        {/* Left Side: Big Image Preview */}
        <div className="flex flex-col gap-4 shrink-0 mb-8">
          {/* Category Label */}
          <div className={`flex items-center gap-4 px-6 py-3 rounded-full ${categoryStyles} text-white shadow-2xl animate-in slide-in-from-left duration-500`}>
            <div className="relative w-16 h-16 drop-shadow-md">
              {categoryImages?.[typeKey]
                ? (
                    <Image
                      src={categoryImages[typeKey]}
                      alt={localizedType}
                      fill
                      className="object-contain"
                    />
                  )
                : (
                    <InfoIcon className="w-full h-full" />
                  )}
            </div>
            <span className="text-base font-bold uppercase tracking-[0.2em] drop-shadow-sm">{localizedType}</span>
          </div>

          {/* Main Image Container */}
          <div className="relative w-80 aspect-[2.5/3.5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 bg-slate-900 group animate-in slide-in-from-bottom duration-500">
            {card.image_url
              ? (
                  <Image
                    src={card.image_url}
                    alt={localizedContent.name || ''}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    priority
                  />
                )
              : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <Image
                      src="/images/cards/Border.jpg"
                      alt="Placeholder"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

            {/* Image Overlay Gradient */}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

            {/* Close Button on Image for mobile/quick close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500 transition-colors z-10"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Right Side: Description and Usage */}
        <div className="flex-1 flex flex-col gap-6 mb-12 max-w-4xl animate-in slide-in-from-right duration-500 max-h-[80vh]">
          <div className="space-y-2 shrink-0">
            <h2 className="text-5xl font-serif font-bold text-white tracking-tight drop-shadow-lg">
              {localizedContent.name}
            </h2>
            <div className="h-1.5 w-24 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6 overflow-y-auto scrollbar-hide custom-scrollbar">
            <div className="space-y-4">
              <p className="text-xl text-white/90 leading-relaxed font-light italic">
                {localizedContent.description || t('no_description_yet')}
              </p>
            </div>

            {localizedContent.usage_examples && (
              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowUsage(!showUsage)}
                  className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary hover:text-primary-light transition-colors"
                >
                  {t('usage_examples')}
                  {showUsage ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                </button>

                {showUsage && (
                  <div className="mt-4 p-4 bg-white/5 rounded-2xl animate-in fade-in zoom-in-95 duration-300 origin-top shadow-inner">
                    <p className="text-base text-white/70 leading-relaxed">
                      {localizedContent.usage_examples}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
