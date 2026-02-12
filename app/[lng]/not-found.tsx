import Link from 'next/link'
import { languages, fallbackLng } from '../i18n/settings'
import { getTranslation } from '../i18n/server'

export default async function NotFound() {
  const { t } = await getTranslation(fallbackLng, 'common')

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-6">
          {t('404_title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {t('404_description')}
        </p>
        <div className="space-y-4">
          <Link
            href={`/${fallbackLng}`}
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('go_home')}
          </Link>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            <p>{t('choose_language')}</p>
            <div className="flex gap-2 justify-center mt-2">
              {languages.map(lng => (
                <Link
                  key={lng}
                  href={`/${lng}`}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {lng.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
