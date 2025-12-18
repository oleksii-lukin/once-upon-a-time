import { useTranslation } from '@/app/i18n/server'
import ProfileEditor from '@/components/profile/ProfileEditor'
import UserProfileCard from '@/components/profile/UserProfileCard'

export default async function ProfilePage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await useTranslation(lng, 'common')

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
                  {t('your_profile')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-base">
                  {t('profile_subtitle')}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <ProfileEditor />
                </div>
                <div>
                  <h3 className="text-white text-lg font-bold mb-4">{t('profile_preview')}</h3>
                  <UserProfileCard compact />
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-6">
                <h3 className="text-white text-lg font-bold mb-4">{t('game_statistics')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-primary">0</p>
                    <p className="text-sm text-white/60">{t('total_games')}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-400">0</p>
                    <p className="text-sm text-white/60">{t('victories')}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-400">0%</p>
                    <p className="text-sm text-white/60">{t('win_rate')}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-400">0</p>
                    <p className="text-sm text-white/60">{t('cards_played')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
