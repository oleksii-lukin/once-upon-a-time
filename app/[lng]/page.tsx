import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { getTranslation } from '../i18n/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function Home({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')

  return (
    <div className="min-h-screen bg-linear-to-br from-primary via-secondary to-accent">
      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-6xl font-bold text-primary-background mb-6 leading-tight">
            {t('welcome')}
          </h2>
          <p className="text-xl text-primary-background mb-12 max-w-2xl mx-auto">
            {t('tagline')}
          </p>

          <div className="flex gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <Button className="px-16 py-8 text-2xl font-semibold shadow-lg">
                  {t('get_started')}
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button asChild className="px-16 py-8 text-2xl font-semibold shadow-lg">
                <Link href={`/${lng}/lobbies`}>
                  {t('join_lobby')}
                </Link>
              </Button>
            </SignedIn>
            <Button asChild className="px-16 py-8 text-2xl font-semibold shadow-lg bg-info text-info-foreground hover:bg-info/80">
              <Link href={`/${lng}/rules`}>
                {t('learn_more')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="bg-foreground/10 backdrop-blur-sm rounded-2xl p-8 border border-border/20">
            <div className="text-4xl mb-4">🎭</div>
            <h3 className="text-xl font-semibold text-secondary-foreground mb-3">{t('realtime_gameplay')}</h3>
            <p className="text-secondary-foreground">
              {t('realtime_desc')}
            </p>
          </div>

          <div className="bg-foreground/10 backdrop-blur-sm rounded-2xl p-8 border border-border/20">
            <div className="text-4xl mb-4">📖</div>
            <h3 className="text-xl font-semibold text-secondary-foreground mb-3">{t('classic_storytelling')}</h3>
            <p className="text-secondary-foreground">
              {t('classic_desc')}
            </p>
          </div>

          <div className="bg-foreground/10 backdrop-blur-sm rounded-2xl p-8 border border-border/20">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-secondary-foreground mb-3">{t('easy_to_learn')}</h3>
            <p className="text-secondary-foreground">
              {t('easy_desc')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
