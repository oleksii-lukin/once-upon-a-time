import { getTranslation } from '@/app/i18n/server'
import path from 'path'
import { promises as fs } from 'fs'
import CreateLobbyLink from '@/components/lobby/CreateLobbyLink'

function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const html: string[] = []
  let inList = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('### ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const title = line.slice(4)
      html.push(`<h3 class="text-xl font-bold text-amber-400 mb-3 mt-6 border-l-4 border-amber-400 pl-3">${title}</h3>`)
    }
    else if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const title = line.slice(3)
      html.push(`<h2 class="text-2xl font-bold text-purple-400 mb-4 mt-8 flex items-center"><span class="w-8 h-8 bg-purple-400 text-gray-900 rounded-full flex items-center justify-center mr-3 text-sm font-bold">§</span>${title}</h2>`)
    }
    else if (line.startsWith('# ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const title = line.slice(2)
      html.push(`<h1 class="text-5xl font-bold text-center mb-8 mt-4 bg-linear-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">${title}</h1>`)
    }
    else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul class="space-y-2 mb-4">')
        inList = true
      }
      const item = line.slice(2)
      // Highlight bold text within list items
      const processedItem = item.replace(/\*\*(.*?)\*\*/g, '<span class="text-cyan-400 font-semibold">$1</span>')
      html.push(`<li class="flex items-start"><span class="text-green-400 mr-2 mt-1">▸</span><span class="text-gray-200">${processedItem}</span></li>`)
    }
    else if (line === '') {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push('<br class="mb-4">')
    }
    else {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      // Process bold text and add styling to paragraphs
      const processedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<span class="text-cyan-400 font-semibold">$1</span>')
        .replace(/(\d+\.\s)/g, '<span class="text-purple-400 font-bold mr-2">$1</span>')

      html.push(`<p class="text-gray-200 mb-4 leading-relaxed">${processedLine}</p>`)
    }
  }
  if (inList) {
    html.push('</ul>')
  }
  return html.join('\n')
}

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
