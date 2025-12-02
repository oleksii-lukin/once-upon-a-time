import { createClient } from '@/utils/supabase/server';
import AdminLobbyView from '@/components/lobby/AdminLobbyView';
import UserLobbyView from '@/components/lobby/UserLobbyView';
import { notFound } from 'next/navigation';

export default async function LobbyDetailsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id } = await params;
    const { view } = await searchParams;
    const supabase = await createClient();

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

    // Determine view mode
    // Ideally we check if the current user is the host
    // For now, we trust the URL param or default to user view
    const isUserView = view === 'user';

    return (
        <div className="min-h-screen bg-[#141118]">
            {isUserView ? (
                <UserLobbyView lobby={lobby} initialPlayers={players || []} />
            ) : (
                <AdminLobbyView lobby={lobby} initialPlayers={players || []} />
            )}
        </div>
    );
}
