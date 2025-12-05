import { useTranslation } from '@/app/i18n/server';
import ProfileEditor from '@/components/profile/ProfileEditor';
import UserProfileCard from '@/components/profile/UserProfileCard';
import Link from 'next/link';

export default async function ProfilePage({ params }: { params: Promise<{ lng: string }> }) {
    const { lng } = await params;
    const { t } = await useTranslation(lng, 'common');

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200/10 dark:border-white/10 px-4 sm:px-6 lg:px-10 py-3">
                    <div className="flex items-center gap-4 text-gray-800 dark:text-white">
                        <Link href={`/${lng}/lobbies`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                            <div className="size-6 text-primary">
                                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd"></path>
                                </svg>
                            </div>
                            <h2 className="text-gray-800 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">{t('title')}</h2>
                        </Link>
                    </div>
                    <nav className="flex items-center gap-6">
                        <Link className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors" href={`/${lng}/lobbies`}>
                            {t('lobby_nav')}
                        </Link>
                        <Link className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors" href="#">
                            {t('rules_nav')}
                        </Link>
                        <Link className="text-primary text-sm font-medium" href={`/${lng}/profile`}>
                            {t('profile_nav')}
                        </Link>
                    </nav>
                </header>

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
    );
}
