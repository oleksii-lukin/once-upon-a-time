import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, JetBrains_Mono, Epilogue } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import SiteHeader from '@/components/layout/SiteHeader'
import '../globals.css'

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-sans' })

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-epilogue',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
})

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

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
    <ClerkProvider>
      <html lang={lng} dir={dir(lng)} className={`${jetbrainsMono.variable} ${epilogue.variable}`} suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased font-display bg-background-light dark:bg-background-dark`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Suspense fallback={<div className="h-16 border-b border-gray-200/10 dark:border-white/10 bg-white/80 dark:bg-background/80 backdrop-blur" />}>
              <SiteHeader lng={lng} />
            </Suspense>
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
