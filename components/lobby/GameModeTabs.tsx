'use client'

import { getTranslation } from '@/app/i18n/client'
import type { LobbySettings } from '@/types/lobby'
import { Info as InfoIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface GameModeTabsProps {
  settings: LobbySettings
  updateSettings?: (updates: Partial<LobbySettings>) => void
  lng: string
  readOnly?: boolean
}

export default function GameModeTabs({ settings, updateSettings, lng, readOnly = false }: GameModeTabsProps) {
  const { t } = getTranslation(lng, 'common')

  const TabComponent = readOnly ? 'div' : 'button'

  const ModeInfo = ({ mode }: { mode: 'main' | 'fast' | 'tutorial' | 'solo' }) => {
    const info = (t as any)(`game_modes_info.${mode}`, { returnObjects: true })
    if (!info || typeof info === 'string') return null

    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="p-1 hover:bg-muted rounded-full transition-colors ml-1">
            <InfoIcon className="w-4 h-4 text-muted-foreground" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              {info.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <h4 className="text-lg font-bold mb-2 text-foreground">{t('description')}</h4>
              <p className="text-muted-foreground leading-relaxed">
                {info.description}
              </p>
            </div>
            {info.examples && info.examples.length > 0 && (
              <div>
                <h4 className="text-lg font-bold mb-2 text-foreground">{t('usage_examples')}</h4>
                <div className="space-y-3">
                  {info.examples.map((example: string, i: number) => (
                    <div key={i} className="p-3 bg-muted/50 rounded-lg border border-border italic text-sm text-muted-foreground">
                      "{example}"
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6 border-b border-border mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em]">{t('game_rules')}</h2>
        <div className="flex bg-muted p-1 rounded-lg">
          <div className="flex items-center p-1">
            <TabComponent
              onClick={() => !readOnly && updateSettings?.({ gameMode: 'main' })}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'main' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('main_game_mode')}
            </TabComponent>
            <ModeInfo mode="main" />
          </div>
          <div className="flex items-center p-1">
            <TabComponent
              onClick={() => !readOnly && updateSettings?.({ gameMode: 'fast', allowInterrupts: false })}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'fast' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('fast_game_mode')}
            </TabComponent>
            <ModeInfo mode="fast" />
          </div>
          <div className="flex items-center p-1">
            <TabComponent
              onClick={() => !readOnly && updateSettings?.({ gameMode: 'tutorial' })}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'tutorial' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('tutorial_game_mode')}
            </TabComponent>
            <ModeInfo mode="tutorial" />
          </div>
          <div className="flex items-center p-1">
            <TabComponent
              onClick={() => !readOnly && updateSettings?.({ gameMode: 'solo', allowInterrupts: false })}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'solo' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('solo_game_mode')}
            </TabComponent>
            <ModeInfo mode="solo" />
          </div>
        </div>
      </div>
      {settings.gameMode === 'fast' && (
        <p className="text-muted-foreground text-xs italic">{t('fast_mode_description')}</p>
      )}
      {settings.gameMode === 'tutorial' && (
        <p className="text-muted-foreground text-xs italic">{t('tutorial_mode_description')}</p>
      )}
      {settings.gameMode === 'solo' && (
        <p className="text-muted-foreground text-xs italic">{t('solo_mode_description')}</p>
      )}
    </div>
  )
}
