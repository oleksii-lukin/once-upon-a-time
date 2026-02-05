import { createClient } from '@/utils/supabase/server'
import { getTranslation } from '@/app/i18n/server'
import AdminLobbiesClient from '@/components/admin/AdminLobbiesClient'
import { LobbyWithPlayerCount as Lobby } from '@/types/model'

export default async function AdminLobbiesPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')
  const supabase = await createClient()

  // Fetch ALL lobbies including soft-deleted ones
  const { data: lobbies } = await supabase
    .from('lobbies')
    .select('*, players(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div>
          <h1 className="text-white text-2xl font-bold">{t('lobbies')}</h1>
          <p className="text-white/50 text-sm mt-1">{t('admin.lobbies.manageAll')}</p>
        </div>
      </div>

      <AdminLobbiesClient lobbies={lobbies as Lobby[]} lng={lng} />
    </div>
  )
}
