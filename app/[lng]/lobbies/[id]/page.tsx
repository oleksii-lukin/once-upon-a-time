import { createClient } from '@/utils/supabase/server'
import LobbyManager from '@/components/lobby/LobbyManager'
import LobbyDetailsErrorBoundary from '@/components/lobby/LobbyDetailsErrorBoundary'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { Lobby } from '@/types/model'
import { Suspense } from 'react'

function LobbyDetailsLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading lobby...</p>
      </div>
    </div>
  )
}

export default async function LobbyDetailsPage({
  params,
}: {
  params: Promise<{ id: string, lng: string }>
}) {
  const { id, lng } = await params
  const supabase = await createClient()
  const { userId } = await auth()

  // Fetch lobby and players
  const { data: lobby } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', id)
    .single()

  if (!lobby) {
    notFound()
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('lobby_id', id)

  // Get guest ID from cookies (server-side equivalent)
  const cookieStore = await cookies()
  const guestIdCookie = cookieStore.get('ouat_guest_id')
  const guestId = guestIdCookie?.value

  // Determine if current user is the host
  const isHost = players?.some(player =>
    player.role === 'host'
    && (
      (userId && player.user_id === userId)
      || (guestId && player.guest_id === guestId)
    ),
  ) || false

  return (
    <LobbyDetailsErrorBoundary lng={lng}>
      <Suspense fallback={<LobbyDetailsLoader />}>
        <div className="min-h-screen bg-background">
          <LobbyManager
            initialLobby={lobby as Lobby}
            initialPlayers={players || []}
            isHost={isHost}
            userId={userId}
            guestId={guestId}
          />
        </div>
      </Suspense>
    </LobbyDetailsErrorBoundary>
  )
}
