import { getTranslation } from '@/app/i18n/server'
import { getAISettings } from '@/lib/settings'
import { AIConfigForm } from '@/components/admin/AIConfigForm'

export default async function AdminAIPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  // Load current AI settings from database
  const aiSettings = await getAISettings()

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('ai_configuration')}</h1>
        <p className="text-muted-foreground">
          {t('ai_configuration_subtitle')}
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <AIConfigForm
          aiSettings={aiSettings}
        />
      </div>
    </div>
  )
}
