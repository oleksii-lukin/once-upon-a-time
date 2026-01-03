import { getTranslation } from '@/app/i18n/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default async function AdminSettingsPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
        <p className="text-muted-foreground">
          {t('admin_settings_subtitle') || 'Global application settings and configuration'}
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('general_settings') || 'General Settings'}</CardTitle>
            <CardDescription>
              {t('general_settings_desc') || 'Configure basic application information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="app-name">{t('app_name') || 'Application Name'}</Label>
              <Input id="app-name" defaultValue="Once Upon a Time" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('maintenance_mode') || 'Maintenance Mode'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('maintenance_mode_desc') || 'Temporarily disable public access to the game'}
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('gameplay_defaults') || 'Gameplay Defaults'}</CardTitle>
            <CardDescription>
              {t('gameplay_defaults_desc') || 'Default settings for newly created lobbies'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('allow_interrupts')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('allow_interrupts_desc') || 'Whether interrupts are enabled by default'}
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="default-timer">{t('timer_per_turn')}</Label>
              <Input id="default-timer" type="number" defaultValue={60} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button disabled>{t('save_changes') || 'Save Changes'}</Button>
        </div>
      </div>
    </div>
  )
}
