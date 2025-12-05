import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import LobbyList from '@/components/lobby/LobbyList';
import CreateLobbyButton from '@/components/lobby/CreateLobbyButton';
import UserProfileCard from '@/components/profile/UserProfileCard';
import { useTranslation } from '@/app/i18n/server';

export default async function LobbiesPage({ params }: { params: Promise<{ lng: string }> }) {
    const { lng } = await params;
    const { t } = await useTranslation(lng, 'common');
    const supabase = await createClient();
    const { data: lobbies } = await supabase
        .from('lobbies')
        .select('*, players(count)')
        .is('deleted_at', null)  // Only show active (non-deleted) lobbies
        .order('created_at', { ascending: false });

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
            <div className="layout-container flex h-full grow flex-col">
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200/10 dark:border-white/10 px-4 sm:px-6 lg:px-10 py-3">
                    <div className="flex items-center gap-4 text-gray-800 dark:text-white">
                        <div className="size-6 text-primary">
                            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fill="currentColor" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 className="text-gray-800 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">{t('title')}</h2>
                    </div>
                    <div className="flex flex-1 justify-end items-center gap-4 md:gap-8">
                        <div className="hidden md:flex items-center gap-9">
                            <Link className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium leading-normal transition-colors" href="#">{t('lobby_nav')}</Link>
                            <Link className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium leading-normal transition-colors" href="#">{t('rules_nav')}</Link>
                            <Link className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary text-sm font-medium leading-normal transition-colors" href="#">{t('profile_nav')}</Link>
                        </div>
                        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCLjMNnIlFsl13nBUCg4K6TsmL_GQXWVw7ZVYiGdHLxEcsgSwYA2raqQ8iC3j3_TGZXC7m88NoZ5e__kWcuwcsawmkqAovv7yeuczyXQpDhPGsvmyyLcEhQgtd4vJ05ploqkTY7gwUjV3uk971d3hNZJg3fxuAm1Mm3-QC9cM3p6IzR741ZQ4dipOGpz3mcWUaKhYspl0l3k78pEhEenISfq60OpxKDw125nnse8YJISRlIsQzxGUXeirnNgBvCcz1lzLyyJwfmgE4")' }}></div>
                    </div>
                </header>
                <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
                    <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <div className="flex flex-wrap justify-between items-center gap-4">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">{t('game_lobby')}</h1>
                                    <p className="text-gray-500 dark:text-gray-400 text-base font-normal leading-normal">{t('lobby_subtitle')}</p>
                                </div>
                                <CreateLobbyButton />
                            </div>
                            <div className="flex flex-col md:flex-row gap-4">
                                <label className="flex flex-col min-w-40 h-12 w-full flex-1">
                                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                        <div className="text-gray-400 flex border border-gray-200/20 dark:border-white/20 bg-gray-100 dark:bg-white/10 items-center justify-center pl-4 rounded-l-lg border-r-0">
                                            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">search</span>
                                        </div>
                                        <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-800 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-gray-200/20 dark:border-white/20 bg-gray-100 dark:bg-white/10 h-full placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" placeholder={t('search_placeholder')} />
                                    </div>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-800 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-gray-200/20 dark:border-white/20 bg-gray-100 dark:bg-white/10 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 text-base font-normal leading-normal" placeholder={t('enter_join_code')} />
                                    <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-4 bg-gray-200 dark:bg-white/20 text-gray-800 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-300 dark:hover:bg-white/30 transition-colors">
                                        <span className="truncate">{t('join')}</span>
                                    </button>
                                </div>
                            </div>

                            <LobbyList initialLobbies={lobbies as any} />

                        </div>
                        <div className="flex flex-col gap-8">
                            <UserProfileCard />
                            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200/20 dark:border-white/20 rounded-xl p-6">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('online_friends')}</h4>
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDZJCeF_JiZOVzzsYRhE2RF65A4UvDmZhgK7aQdIV_sYcAHmsuNK2jUJCOtqnb8Li9fpOaFWKLOe41f6oNGkpa_vVyLpYw4BWNbSW7lPkNowaweNm_Z80IyNCGlF84cvwJtOVQo_-cXYTWwAICxhTdbhHQ9mJo890jDEmKtOCtAJsfkwuLvPZSGs5GX8tMRmZHzHhivme0GJgRWFlAlzy21ShVwyGZTgeTGgA2cDweF1RKRME3op2lhUEwgzoeBJ-Ma0dr4BtJJqt4")' }}></div>
                                                <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-gray-50 dark:border-background-dark"></div>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 dark:text-white">JaneSmith</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('in_lobby')}</p>
                                            </div>
                                        </div>
                                        <button className="text-primary hover:text-primary/80 transition-colors">
                                            <span className="material-symbols-outlined">person_add</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCo2iaCAm0ZBprwkmOwRRQvx1HLT3fgTDB777FiQCUBjk-bwTac1Kpe4BXLhY2Ped9-FxWmrC7o5tf-FFQ1bnjCmNtjXJ-9FFyZxbZOttazKkR9aCrY6qZ6kt6_C9XqygJYeNpHsE-Cie8NctWTsOWqeiGDBGqXMyElhSeO_tScdGEpsZh0pCFUXCRufw-Emtp4H4BzoUT_8UpOyshIdvdo5BYn5foL1wW4W62LLAmf4MiT7t5DSCR9RY-qSCjbqL6hkQyK-Q_Q94w")' }}></div>
                                                <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-gray-50 dark:border-background-dark"></div>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 dark:text-white">MikeP</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('in_game')}</p>
                                            </div>
                                        </div>
                                        <button className="text-primary hover:text-primary/80 transition-colors">
                                            <span className="material-symbols-outlined">person_add</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDbHZ07BNY-PzCNvled2nVESLVGjYPiG7SZjNjRUXcq3LEe4Q7cEq9hMh9VQMajSmqM-ZwAz_r-n44giXB6Y8kNYuMeN_MCHNxgd9Wr9n-Uowp2_d5C7oQujFZWGF37qvbN1eyM0yOvcd8te8bYLJQIvdvzgmBch0u5x-yfQyw7f7m67qt4yk3zv1og7vqy-evaobBm0Py1-d7Olr2yB8Hf4ShFxBw2CT4Yupj4UnvvbUakt41DT2cDU4lM5tSNX07g0iX_Y3kCt0k")' }}></div>
                                                <div className="absolute bottom-0 right-0 size-3 bg-gray-500 rounded-full border-2 border-gray-50 dark:border-background-dark"></div>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 dark:text-white">StoryMaster</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('offline')}</p>
                                            </div>
                                        </div>
                                        <button className="text-primary hover:text-primary/80 transition-colors">
                                            <span className="material-symbols-outlined">person_add</span>
                                        </button>
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

