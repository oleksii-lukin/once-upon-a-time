import { getTranslation } from '@/app/i18n/server'
import path from 'path'
import { promises as fs } from 'fs'

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
      html.push(`<h3>${line.slice(4)}</h3>`)
    }
    else if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h2>${line.slice(3)}</h2>`)
    }
    else if (line.startsWith('# ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h1>${line.slice(2)}</h1>`)
    }
    else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${line.slice(2)}</li>`)
    }
    else if (line === '') {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push('')
    }
    else {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<p>${line}</p>`)
    }
  }
  if (inList) {
    html.push('</ul>')
  }
  return html.join('\n')
}

export default async function RulesPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params
  await getTranslation(lng, 'common')
  const mdPath = path.join(process.cwd(), 'specs', 'game-rules.md')
  let content = ''
  try {
    content = await fs.readFile(mdPath, 'utf-8')
  }
  catch (e) {
    content = '# Rules Not Found\n\nThe rules file could not be loaded.'
  }
  const html = mdToHtml(content)

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
          <div className="mx-auto max-w-3xl prose prose-invert prose-headings:font-bold prose-p:text-white/90">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </main>
      </div>
    </div>
  )
}
