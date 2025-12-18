import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { useTranslation } from '../i18n/server'

export default async function Home({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await useTranslation(lng, 'common')

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-6xl font-bold text-white mb-6 leading-tight">
            {t('welcome')}
          </h2>
          <p className="text-xl text-purple-200 mb-12 max-w-2xl mx-auto">
            {t('tagline')}
          </p>

          <div className="flex gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-white text-purple-900 rounded-full font-semibold text-lg hover:bg-purple-50 transition-all shadow-lg">
                  {t('get_started')}
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <a
                href={`/${lng}/lobbies`}
                className="px-8 py-4 bg-white text-purple-900 rounded-full font-semibold text-lg hover:bg-purple-50 transition-all shadow-lg"
              >
                {t('join_lobby')}
              </a>
            </SignedIn>
            <button className="px-8 py-4 bg-white/10 text-white rounded-full font-semibold text-lg hover:bg-white/20 transition-all border border-white/20">
              {t('learn_more')}
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-4xl mb-4">🎭</div>
            <h3 className="text-xl font-semibold text-white mb-3">{t('realtime_gameplay')}</h3>
            <p className="text-purple-200">
              {t('realtime_desc')}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-4xl mb-4">📖</div>
            <h3 className="text-xl font-semibold text-white mb-3">{t('classic_storytelling')}</h3>
            <p className="text-purple-200">
              {t('classic_desc')}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-white mb-3">{t('easy_to_learn')}</h3>
            <p className="text-purple-200">
              {t('easy_desc')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
