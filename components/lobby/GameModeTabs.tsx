'use client'

import { getTranslation } from '@/app/i18n/client'
import type { LobbySettings } from '@/types/lobby'

interface GameModeTabsProps {
  settings: LobbySettings
  updateSettings?: (updates: Partial<LobbySettings>) => void
  lng: string
  readOnly?: boolean
}

export default function GameModeTabs({ settings, updateSettings, lng, readOnly = false }: GameModeTabsProps) {
  const { t } = getTranslation(lng, 'common')

  const TabComponent = readOnly ? 'div' : 'button'

  return (
    <div className="flex flex-col gap-4 pb-6 border-b border-border mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em]">{t('game_rules')}</h2>
        <div className="flex bg-muted p-1 rounded-lg">
          <TabComponent
            onClick={() => !readOnly && updateSettings?.({ gameMode: 'main' })}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'main' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('main_game_mode')}
          </TabComponent>
          <TabComponent
            onClick={() => !readOnly && updateSettings?.({ gameMode: 'fast', allowInterrupts: false })}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'fast' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('fast_game_mode')}
          </TabComponent>
          <TabComponent
            onClick={() => !readOnly && updateSettings?.({ gameMode: 'tutorial' })}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'tutorial' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('tutorial_game_mode')}
          </TabComponent>
          <TabComponent
            onClick={() => !readOnly && updateSettings?.({ gameMode: 'solo', allowInterrupts: false })}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${settings.gameMode === 'solo' ? 'bg-background text-foreground shadow-sm' : readOnly ? 'text-muted-foreground opacity-50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('solo_game_mode')}
          </TabComponent>
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
