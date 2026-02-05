'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { languages } from '@/app/i18n/settings'
import { getTranslation } from '@/app/i18n/client'

const ThemeToggle = dynamic(() => import('@/components/theme/ThemeToggle'), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-9 rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10" />
  ),
})

const AuthSection = dynamic(() => import('./AuthSection'), {
  ssr: false,
  loading: () => <div className="w-8 h-8 bg-white/10 animate-pulse" />,
})

export default function SiteHeader({ lng }: { lng: string }) {
  const { t } = getTranslation(lng, 'common')
  const { user } = useUser()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isAdmin = (user?.publicMetadata as { is_admin?: boolean })?.is_admin === true

  const redirectedPathName = (locale: string) => {
    if (!pathname) return `/${locale}`
    const segments = pathname.split('/')
    segments[1] = locale
    const newPath = segments.join('/')
    return searchParams?.toString() ? `${newPath}?${searchParams.toString()}` : newPath
  }

  return (
    <header id="site-header" className="w-full border-b border-gray-200/10 dark:border-white/10 bg-white/80 dark:bg-background/80 backdrop-blur supports-backdrop-filter:bg-white/70 supports-backdrop-filter:dark:bg-background/70">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/${lng}`} className="flex items-center gap-3">
            <div className="size-6 text-primary shrink-0">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
            <span className="truncate text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
              {t('title')}
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-8">
          <Link className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors" href={`/${lng}/lobbies`}>
            {t('lobby_nav')}
          </Link>
          <Link className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors" href={`/${lng}/rules`}>
            {t('rules_nav')}
          </Link>
          <Link className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors" href={`/${lng}/profile`}>
            {t('profile_nav')}
          </Link>
          {isAdmin && (
            <Link className="text-primary font-bold hover:opacity-80 text-sm transition-all" href={`/${lng}/admin`}>
              {t('admin_nav')}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {languages.filter(l => l !== lng).map(l => (
              <span key={l}>
                <Link href={redirectedPathName(l)} className="text-gray-600 dark:text-white/80 hover:text-primary dark:hover:text-primary uppercase text-xs font-semibold">
                  {l}
                </Link>
              </span>
            ))}
          </div>
          <ThemeToggle />
          <AuthSection t={t} />
        </div>
      </div>
    </header>
  )
}
