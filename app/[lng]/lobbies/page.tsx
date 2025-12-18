import { createClient } from '@/utils/supabase/server'
import LobbyList from '@/components/lobby/LobbyList'
import CreateLobbyButton from '@/components/lobby/CreateLobbyButton'
import UserProfileCard from '@/components/profile/UserProfileCard'
import { useTranslation } from '@/app/i18n/server'
import { Search as SearchIcon, UserPlus as UserPlusIcon } from 'lucide-react'

export default async function LobbiesPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await useTranslation(lng, 'common')
  const supabase = await createClient()
  const { data: lobbies } = await supabase
    .from('lobbies')
    .select('*, players(count)')
    .is('deleted_at', null) // Only show active (non-deleted) lobbies
    .order('created_at', { ascending: false })

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">

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
                      <SearchIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
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
                      <UserPlusIcon className="w-5 h-5" />
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
                      <UserPlusIcon className="w-5 h-5" />
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
                      <UserPlusIcon className="w-5 h-5" />
                    </button>
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
