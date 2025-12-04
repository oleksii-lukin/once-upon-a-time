import { createClient } from '@/utils/supabase/server';
import AdminLobbyView from '@/components/lobby/AdminLobbyView';
import UserLobbyView from '@/components/lobby/UserLobbyView';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

export default async function LobbyDetailsPage({
    params,
}: {
    params: Promise<{ id: string; lng: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const { userId } = await auth();

    // Fetch lobby and players
    const { data: lobby } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', id)
        .single();

    if (!lobby) {
        notFound();
    }

    const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('lobby_id', id);

    // Get guest ID from cookies (server-side equivalent)
    const cookieStore = await cookies();
    const guestIdCookie = cookieStore.get('ouat_guest_id');
    const guestId = guestIdCookie?.value;

    // Determine if current user is the host
    const isHost = players?.some(player =>
        player.role === 'host' &&
        (
            (userId && player.user_id === userId) ||
            (guestId && player.guest_id === guestId)
        )
    ) || false;

    return (
        <div className="min-h-screen bg-[#141118]">
            {isHost ? (
                <AdminLobbyView lobby={lobby} initialPlayers={players || []} />
            ) : (
                <UserLobbyView lobby={lobby} initialPlayers={players || []} />
            )}
        </div>
    );
}
