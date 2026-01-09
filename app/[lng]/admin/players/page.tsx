import { createClient } from '@/utils/supabase/server'
import { getTranslation } from '@/app/i18n/server'
import { PlayersTable } from '@/components/admin/PlayersTable'

export default async function AdminPlayersPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')
  const supabase = await createClient()

  const { data: players, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching players:', error)
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('players')}</h1>
        <p className="text-muted-foreground">
          {t('admin_players_subtitle')}
        </p>
      </div>

      <PlayersTable players={players || []} />
    </div>
  )
}
