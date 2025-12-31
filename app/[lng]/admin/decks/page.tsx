import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import NewDeckButton from '@/components/admin/NewDeckButton'
import { useTranslation } from '@/app/i18n/server'

export default async function DecksPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await useTranslation(lng, 'common')
  const supabase = await createClient()
  const { data: decks } = await supabase
    .from('decks')
    .select('*, cards(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-6 border-b border-border">
        <h1 className="text-foreground text-2xl font-bold">{t('decks')}</h1>
        <NewDeckButton />
      </div>

      <div className="p-8">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('deck_name')}</th>
                <th className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('cards')}</th>
                <th className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('status')}</th>
                <th className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('last_updated')}</th>
                <th className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {decks?.map(deck => (
                <tr key={deck.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4 text-sm text-foreground font-medium">{deck.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{deck.cards?.[0]?.count || 0}</td>
                  <td className="px-6 py-4">
                    <button className={`px-3 py-1 rounded-full text-xs font-medium ${deck.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-muted text-muted-foreground'
                    }`}
                    >
                      {deck.is_active ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(deck.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/${lng}/admin/decks/${deck.id}`}
                      className="text-primary hover:text-primary/80 text-sm font-medium"
                    >
                      {t('edit')}
                    </Link>
                  </td>
                </tr>
              ))}
              {(!decks || decks.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    {t('no_decks_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
