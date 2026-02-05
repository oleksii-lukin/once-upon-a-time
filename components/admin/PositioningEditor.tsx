'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Maximize, Save, X, RotateCcw, TypeIcon, ImageIcon, UserIcon, type LucideIcon } from 'lucide-react'

import { CardLayout, defaultCardLayout, LayoutElement } from '@/types/model'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import CardComponent from '@/components/game/Card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/types/model'

interface PositioningEditorProps {
  isOpen: boolean
  onClose: () => void
  layout: CardLayout
  onApply: (layout: CardLayout) => void
  borderImageUrl?: string
  cards: Card[]
  categoryImages: Record<string, string>
}

type ElementKey = keyof CardLayout

export default function PositioningEditor({ isOpen, onClose, layout, onApply, borderImageUrl, cards, categoryImages }: PositioningEditorProps) {
  const { t } = useTranslation()
  const [currentLayout, setCurrentLayout] = useState<CardLayout>(layout)
  const [activeElement, setActiveElement] = useState<ElementKey | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInteracting, setIsInteracting] = useState<'move' | 'resize' | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number, y: number, initial: LayoutElement, initialRatio: number } | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const selectedCardIdRef = useRef(selectedCardId)

  // Update ref when selectedCardId changes
  useEffect(() => {
    selectedCardIdRef.current = selectedCardId
  }, [selectedCardId])

  const previewCard = cards.find(c => c.id === selectedCardId) || cards[0]

  // Reset state when dialog opens - use setTimeout to avoid synchronous setState
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setCurrentLayout(layout)
      }, 0)
      if (cards.length > 0 && !selectedCardIdRef.current) {
        setTimeout(() => {
          setSelectedCardId(cards[0].id)
        }, 0)
      }
    }
  }, [isOpen, layout, cards])

  const filteredCards = cards
    .filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 50)

  const handleInteractionStart = (key: ElementKey, mode: 'move' | 'resize', e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveElement(key)
    setIsInteracting(mode)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initial: { ...currentLayout[key] },
      initialRatio: (currentLayout[key].width * (rect.width / rect.height)) / currentLayout[key].height,
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isInteracting || !activeElement || !dragStart || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100

    setCurrentLayout((prev) => {
      const el = { ...prev[activeElement] }
      if (isInteracting === 'move') {
        el.left = Math.max(0, Math.min(100 - el.width, dragStart.initial.left + dx))
        el.top = Math.max(0, Math.min(100 - el.height, dragStart.initial.top + dy))
      }
      else if (isInteracting === 'resize') {
        if (el.preserveRatio && dragStart.initialRatio) {
          // Proportionally resize based on width change
          const newWidth = Math.max(5, Math.min(100 - el.left, dragStart.initial.width + dx))
          el.width = newWidth
          // newHeight% = (newWidth% * containerRatio) / initialPixelRatio
          const containerRatio = rect.width / rect.height
          el.height = Math.max(5, Math.min(100 - el.top, (newWidth * containerRatio) / dragStart.initialRatio))
        }
        else {
          el.width = Math.max(5, Math.min(100 - el.left, dragStart.initial.width + dx))
          el.height = Math.max(5, Math.min(100 - el.top, dragStart.initial.height + dy))
        }
      }
      return { ...prev, [activeElement]: el }
    })
  }, [isInteracting, activeElement, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsInteracting(null)
    setDragStart(null)
  }, [])

  useEffect(() => {
    if (isInteracting) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isInteracting, handleMouseMove, handleMouseUp])

  const handleReset = () => {
    setCurrentLayout(defaultCardLayout)
  }

  const updateElement = (key: ElementKey, field: keyof LayoutElement, value: number | boolean) => {
    setCurrentLayout(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const elements: { key: ElementKey, label: string, icon: LucideIcon }[] = [
    { key: 'name', label: t('admin.deckEditor.layout.name'), icon: TypeIcon },
    { key: 'image', label: t('admin.deckEditor.layout.image'), icon: ImageIcon },
    { key: 'icon', label: t('admin.deckEditor.layout.icon'), icon: UserIcon },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle>{t('admin.deckEditor.layout.title')}</DialogTitle>
          <div className="flex items-center gap-3 mr-8">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.deckEditor.search_cards_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={selectedCardId || ''} onValueChange={setSelectedCardId}>
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder="Select card for preview" />
              </SelectTrigger>
              <SelectContent>
                {filteredCards.map(card => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                    {' '}
                    (
                    {card.category}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/20">
          {/* Preview Area */}
          <div className="flex-1 p-8 flex items-center justify-center relative overflow-hidden">
            <div
              ref={containerRef}
              onClick={() => setActiveElement(null)}
              className="relative aspect-[2.5/3.5] w-full max-w-[350px] shadow-2xl overflow-hidden select-none cursor-default"
            >
              {/* Actual Live Card Preview */}
              {previewCard && (
                <div className="absolute inset-0 pointer-events-none">
                  <CardComponent
                    card={{
                      ...previewCard,
                      category: previewCard.category,
                      description: previewCard.description,
                      image_url: previewCard.image_url,
                      usage_examples: previewCard.usage_examples,
                    }}
                    cardBackImageUrl={borderImageUrl}
                    categoryImages={categoryImages}
                    layout={currentLayout}
                  />
                </div>
              )}

              {/* Interaction Overlays */}
              {elements.map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveElement(key)
                  }}
                  onMouseDown={e => handleInteractionStart(key, 'move', e)}
                  className={`absolute border-2 transition-colors duration-200 cursor-move flex flex-col items-center justify-center p-1
                  ${activeElement === key
                  ? 'border-primary bg-primary/10 z-20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)] scale-[1.01]'
                  : 'border-dashed border-slate-400/30 bg-transparent z-10 hover:border-slate-400/60 hover:bg-slate-400/5'}`}
                  style={{
                    top: `${currentLayout[key].top}%`,
                    left: `${currentLayout[key].left}%`,
                    width: `${currentLayout[key].width}%`,
                    height: `${currentLayout[key].height}%`,
                  }}
                >
                  {activeElement === key && (
                    <>
                      <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                      <Icon className="w-4 h-4 mb-1 text-primary relative z-10" />
                      <span className="text-[10px] font-bold uppercase truncate w-full text-center text-primary relative z-10">
                        {label}
                      </span>
                    </>
                  )}

                  {/* Resize Handle only for active */}
                  {activeElement === key && (
                    <div
                      onMouseDown={e => handleInteractionStart(key, 'resize', e)}
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full border-2 border-white cursor-se-resize flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-30"
                    >
                      <Maximize className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Controls Area */}
          <div className="w-full md:w-80 bg-background border-l p-6 overflow-y-auto space-y-6 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] z-30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{t('admin.deckEditor.layout.settings')}</h4>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs">
                <RotateCcw className="w-3 h-3 mr-1" />
                {t('admin.deckEditor.layout.reset')}
              </Button>
            </div>

            <div className="space-y-6">
              {elements.map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border transition-all ${activeElement === key ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'}`}
                  onClick={() => setActiveElement(key)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${activeElement === key ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-semibold text-sm">{label}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">X</Label>
                        <span className="text-[10px] font-mono">
                          {Math.round(currentLayout[key].left)}
                          %
                        </span>
                      </div>
                      <Slider
                        value={[currentLayout[key].left]}
                        onValueChange={v => updateElement(key, 'left', v[0])}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Y</Label>
                        <span className="text-[10px] font-mono">
                          {Math.round(currentLayout[key].top)}
                          %
                        </span>
                      </div>
                      <Slider
                        value={[currentLayout[key].top]}
                        onValueChange={v => updateElement(key, 'top', v[0])}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">W</Label>
                        <span className="text-[10px] font-mono">
                          {Math.round(currentLayout[key].width)}
                          %
                        </span>
                      </div>
                      <Slider
                        value={[currentLayout[key].width]}
                        onValueChange={v => updateElement(key, 'width', v[0])}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">H</Label>
                        <span className="text-[10px] font-mono">
                          {Math.round(currentLayout[key].height)}
                          %
                        </span>
                      </div>
                      <Slider
                        value={[currentLayout[key].height]}
                        onValueChange={v => updateElement(key, 'height', v[0])}
                        max={100}
                        step={0.5}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center space-x-2">
                    <Checkbox
                      id={`ratio-${key}`}
                      checked={currentLayout[key].preserveRatio}
                      onCheckedChange={(checked) => {
                        updateElement(key, 'preserveRatio', checked === true)
                      }}
                    />
                    <Label
                      htmlFor={`ratio-${key}`}
                      className="text-xs font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t('admin.deckEditor.layout.preserve_ratio')}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} className="mr-auto">
            <X className="w-4 h-4 mr-2" />
            {t('admin.deckEditor.layout.cancel')}
          </Button>
          <Button onClick={() => onApply(currentLayout)}>
            <Save className="w-4 h-4 mr-2" />
            {t('admin.deckEditor.layout.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
