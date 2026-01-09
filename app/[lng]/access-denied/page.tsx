import Link from 'next/link'
import { getTranslation } from '@/app/i18n/server'
import { ShieldAlert } from 'lucide-react'

export default async function AccessDeniedPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="mb-6 p-4 rounded-full bg-destructive/10">
        <ShieldAlert className="w-16 h-16 text-destructive" />
      </div>
      <h1 className="text-4xl font-bold mb-4">{t('access_denied')}</h1>
      <p className="text-muted-foreground text-lg mb-8 max-w-md">
        {t('access_denied_message')}
      </p>
      <Link
        href={`/${lng}`}
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
      >
        {t('back_to_home')}
      </Link>
    </div>
  )
}
