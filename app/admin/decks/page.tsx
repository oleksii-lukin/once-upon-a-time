import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import NewDeckButton from '@/components/admin/NewDeckButton';

export default async function DecksPage() {
    const supabase = await createClient();
    const { data: decks } = await supabase
        .from('decks')
        .select('*, cards(count)')
        .order('created_at', { ascending: false });

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
                <h1 className="text-white text-2xl font-bold">Decks</h1>
                <NewDeckButton />
            </div>

            <div className="p-8">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#141118]">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#211c27] text-left">
                                <th className="px-6 py-3 text-sm font-medium text-white/70">Deck Name</th>
                                <th className="px-6 py-3 text-sm font-medium text-white/70">Cards</th>
                                <th className="px-6 py-3 text-sm font-medium text-white/70">Status</th>
                                <th className="px-6 py-3 text-sm font-medium text-white/70">Last Updated</th>
                                <th className="px-6 py-3 text-sm font-medium text-white/70">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {decks?.map((deck) => (
                                <tr key={deck.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-sm text-white font-medium">{deck.name}</td>
                                    <td className="px-6 py-4 text-sm text-white/60">{deck.cards?.[0]?.count || 0}</td>
                                    <td className="px-6 py-4">
                                        <button className={`px-3 py-1 rounded-full text-xs font-medium ${deck.is_active
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-white/10 text-white/50'
                                            }`}>
                                            {deck.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-white/60">
                                        {new Date(deck.updated_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link
                                            href={`/admin/decks/${deck.id}`}
                                            className="text-primary hover:text-primary/80 text-sm font-medium"
                                        >
                                            Edit
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {(!decks || decks.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-white/40">
                                        No decks found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
