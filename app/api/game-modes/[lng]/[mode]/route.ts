import { NextRequest, NextResponse } from 'next/server'
import { loadGameModeMarkdown } from '@/utils/gameModeUtils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lng: string, mode: string }> },
) {
  const { lng, mode } = await params

  try {
    const html = await loadGameModeMarkdown(lng, mode)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  }
  catch (error) {
    console.error('Error loading game mode markdown:', error)
    return new NextResponse(
      '<h1>Game Mode Info Not Found</h1><p>The game mode information could not be loaded.</p>',
      {
        status: 404,
        headers: {
          'Content-Type': 'text/html',
        },
      },
    )
  }
}
