import { getTranslation } from '@/app/i18n/server'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { getGeneralSettings, getGameplaySettings } from '@/lib/settings'

export default async function AdminSettingsPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  // Load current settings from database
  const generalSettings = await getGeneralSettings()
  const gameplaySettings = await getGameplaySettings()

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
        <p className="text-muted-foreground">
          {t('admin_settings_subtitle')}
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <SettingsForm
          generalSettings={generalSettings}
          gameplaySettings={gameplaySettings}
        />
      </div>
    </div>
  )
}
