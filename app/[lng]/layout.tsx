import type { Metadata } from 'next'
import DefaultLayout from '@/components/layout/DefaultLayout'
import '../globals.css'

import { dir } from 'i18next'
import { languages } from '../i18n/settings'
import { getTranslation } from '../i18n/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  return {
    title: t('title'),
    description: t('app_description'),
  }
}

export function generateStaticParams() {
  return languages.map(lng => ({ lng }))
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params

  return (
    <DefaultLayout lng={lng} dir={dir(lng)}>
      {children}
    </DefaultLayout>
  )
}
