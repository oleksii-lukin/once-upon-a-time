import { getTranslation } from '@/app/i18n/server'
import path from 'path'
import { promises as fs } from 'fs'
import CreateLobbyLink from '@/components/lobby/CreateLobbyLink'
import { mdToHtml } from '@/lib/mdToHtml'

export default async function RulesPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  const { t } = await getTranslation(lng, 'common')
  const mdPath = path.join(process.cwd(), 'game-modes-content', lng, 'rules.md')
  let content = ''
  try {
    content = await fs.readFile(mdPath, 'utf-8')
  }
  catch (e) {
    console.error(e)
    content = '# Rules Not Found\n\nThe rules file could not be loaded.'
  }
  const html = mdToHtml(content)

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-linear-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full filter blur-3xl"></div>

      <div className="relative layout-container flex h-full grow flex-col">
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
          <div className="mx-auto max-w-4xl">
            {/* Rules container with enhanced styling */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-purple-500/20 p-8 mb-8">
              <div className="rules-content">
                <div dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </div>

            {/* Footer with navigation hint */}
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                🎮
                {' '}
                {t('ready_to_play')}
                {' '}
                <CreateLobbyLink className="text-purple-400 hover:text-purple-300 underline decoration-2 underline-offset-4 transition-colors duration-200 font-medium bg-transparent border-none cursor-pointer">
                  {t('create_lobby')}
                </CreateLobbyLink>
                {' '}
                {t('start_adventure')}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
