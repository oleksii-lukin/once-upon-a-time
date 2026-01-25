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
      html.push(`<h3 class="text-lg font-bold mb-2 text-foreground">${line.slice(4)}</h3>`)
    }
    else if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h2 class="text-lg font-bold mb-2 text-foreground">${line.slice(3)}</h2>`)
    }
    else if (line.startsWith('# ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h1 class="text-lg font-bold mb-2 text-foreground">${line.slice(2)}</h1>`)
    }
    else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul class="space-y-2">')
        inList = true
      }
      html.push(`<li class="p-3 bg-muted/50 rounded-lg border border-border italic text-sm text-muted-foreground">"${line.slice(2)}"</li>`)
    }
    else if (line === '') {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push('<br />')
    }
    else {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<p class="text-muted-foreground leading-relaxed">${line}</p>`)
    }
  }
  if (inList) {
    html.push('</ul>')
  }
  return html.join('\n')
}

export async function loadGameModeMarkdown(lng: string, mode: string): Promise<string> {
  const mdPath = path.join(process.cwd(), 'game-modes-content', lng, `${mode}.md`)
  let content = ''
  try {
    content = await fs.readFile(mdPath, 'utf-8')
  }
  catch (e) {
    console.error(e)
    content = '# Game Mode Info Not Found\n\nThe game mode information could not be loaded.'
  }
  return mdToHtml(content)
}
