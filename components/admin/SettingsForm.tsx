'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { saveGeneralSettings, saveGameplaySettings } from '@/app/actions/settings'
import { toast } from 'sonner'

interface SettingsFormProps {
  generalSettings: Record<string, unknown>
  gameplaySettings: Record<string, unknown>
}

export function SettingsForm({ generalSettings, gameplaySettings }: SettingsFormProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Form states
  const [appName, setAppName] = useState((generalSettings.app_name as string) || 'Once Upon a Time')
  const [maintenanceMode, setMaintenanceMode] = useState((generalSettings.maintenance_mode as boolean) || false)
  const [allowInterrupts, setAllowInterrupts] = useState<boolean>((gameplaySettings.allow_interrupts as boolean) || true)
  const [timerPerTurn, setTimerPerTurn] = useState((gameplaySettings.timer_per_turn as number) || 60)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Update general settings
      const generalResult = await saveGeneralSettings({
        app_name: appName,
        maintenance_mode: maintenanceMode,
      })

      // Update gameplay settings
      const gameplayResult = await saveGameplaySettings({
        allow_interrupts: allowInterrupts,
        timer_per_turn: timerPerTurn,
      })

      if (generalResult.success && gameplayResult.success) {
        toast.success(t('settings_saved'))
      }
      else {
        toast.error(generalResult.error || gameplayResult.error || t('save_settings_error'))
      }
    }
    catch (error) {
      console.error('Failed to save settings:', error)
      toast.error(t('save_settings_error'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('general_settings')}</CardTitle>
          <CardDescription>
            {t('general_settings_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="app-name">{t('app_name')}</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={e => setAppName(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('maintenance_mode')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('maintenance_mode_desc')}
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={checked => setMaintenanceMode(checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('gameplay_defaults')}</CardTitle>
          <CardDescription>
            {t('gameplay_defaults_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('allow_interrupts')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('allow_interrupts_desc')}
              </p>
            </div>
            <Switch
              checked={allowInterrupts}
              onCheckedChange={checked => setAllowInterrupts(checked)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default-timer">{t('timer_per_turn')}</Label>
            <Input
              id="default-timer"
              type="number"
              value={timerPerTurn}
              onChange={e => setTimerPerTurn(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : t('save_changes')}
        </Button>
      </div>
    </form>
  )
}
