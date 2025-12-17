import { createClient } from '@/utils/supabase/server'
import DeckEditor from '@/components/admin/DeckEditor'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useTranslation } from '@/app/i18n/server'
import { ArrowLeft as ArrowLeftIcon } from 'lucide-react'

export default async function DeckDetailsPage({
  params,
}: {
  params: Promise<{ id: string, lng: string }>
}) {
  const { id, lng } = await params
  const { t } = await useTranslation(lng, 'common')
  const supabase = await createClient()

  const { data: deck } = await supabase
    .from('decks')
    .select('*')
    .eq('id', id)
    .single()

  if (!deck) {
    notFound()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link href={`/${lng}/admin/decks`} className="text-white/60 hover:text-white">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-white text-2xl font-bold">{deck.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${deck.is_active
            ? 'bg-green-500/20 text-green-400'
            : 'bg-white/10 text-white/50'
          }`}
          >
            {deck.is_active ? t('active') : t('inactive')}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8">
        <DeckEditor deck={deck} />
      </div>
    </div>
  )
}
