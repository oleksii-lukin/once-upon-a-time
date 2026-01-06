import { createClient } from '@/utils/supabase/server'
import { getTranslation } from '@/app/i18n/server'
import { StatsCard } from '@/components/admin/StatsCard'
import { Users, DoorOpen, Palette, Layers } from 'lucide-react'

export default async function AdminDashboardPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')
  const supabase = await createClient()

  // Fetch stats concurrently
  const [
    { count: playersCount },
    { count: activeLobbiesCount },
    { count: decksCount },
    { count: cardsCount },
  ] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('lobbies').select('*', { count: 'exact', head: true }).neq('status', 'finished'),
    supabase.from('decks').select('*', { count: 'exact', head: true }),
    supabase.from('cards').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
        <p className="text-muted-foreground">
          {t('admin_dashboard_subtitle') || 'Application overview and statistics'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('players')}
          value={playersCount || 0}
          icon={Users}
          description={t('total_registered_players') || 'Total registered players'}
        />
        <StatsCard
          title={t('active_lobbies')}
          value={activeLobbiesCount || 0}
          icon={DoorOpen}
          description={t('lobbies_currently_active') || 'Lobbies currently active'}
        />
        <StatsCard
          title={t('decks')}
          value={decksCount || 0}
          icon={Palette}
          description={t('total_decks_available') || 'Total decks available'}
        />
        <StatsCard
          title={t('total_cards') || 'Total Cards'}
          value={cardsCount || 0}
          icon={Layers}
          description={t('cards_across_decks') || 'Cards across all decks'}
        />
      </div>
    </div>
  )
}
