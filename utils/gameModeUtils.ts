import path from 'path'
import { promises as fs } from 'fs'
import { mdToHtml } from '@/lib/mdToHtml'

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
