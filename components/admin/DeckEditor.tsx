'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@clerk/nextjs';
import { Database } from '@/supabase/types';
import ImageUpload from './ImageUpload';

type Deck = Database['public']['Tables']['decks']['Row'];
type Card = Database['public']['Tables']['cards']['Row'];

export default function DeckEditor({ deck }: { deck: Deck }) {
    const { getToken } = useAuth();
    const [cards, setCards] = useState<Card[]>([]);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        usage_examples: '',
        image_url: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCards();
    }, [deck.id]);

    const fetchCards = async () => {
        const token = await getToken({ template: 'supabase' });
        if (!token) return;
        const supabase = createClient(token);
        const { data } = await supabase
            .from('cards')
            .select('*')
            .eq('deck_id', deck.id)
            .order('created_at', { ascending: true });
        if (data) setCards(data);
        setLoading(false);
    };

    const handleCardSelect = (card: Card | null) => {
        setSelectedCard(card);
        if (card) {
            setFormData({
                name: card.name,
                description: card.description || '',
                usage_examples: card.usage_examples || '',
                image_url: card.image_url || ''
            });
        } else {
            setFormData({ name: '', description: '', usage_examples: '', image_url: '' });
        }
    };

    const handleSave = async () => {
        if (!formData.name) return;

        const token = await getToken({ template: 'supabase' });
        if (!token) {
            alert('Authentication required. Please sign in again.');
            return;
        }
        const supabase = createClient(token);

        if (selectedCard) {
            const { error } = await supabase
                .from('cards')
                .update({
                    name: formData.name,
                    description: formData.description,
                    usage_examples: formData.usage_examples,
                    image_url: formData.image_url
                })
                .eq('id', selectedCard.id);

            if (error) {
                console.error('Error updating card:', error);
                alert(`Failed to update card: ${error.message}`);
            } else {
                fetchCards();
                // Keep selected to allow further edits or clear? Let's keep.
            }
        } else {
            const { error } = await supabase
                .from('cards')
                .insert({
                    deck_id: deck.id,
                    name: formData.name,
                    description: formData.description,
                    usage_examples: formData.usage_examples,
                    image_url: formData.image_url
                });

            if (error) {
                console.error('Error creating card:', error);
                alert(`Failed to create card: ${error.message}`);
            } else {
                fetchCards();
                handleCardSelect(null); // Clear form after add
            }
        }
    };

    const handleDelete = async (id: string) => {
        const token = await getToken({ template: 'supabase' });
        if (!token) {
            alert('Authentication required. Please sign in again.');
            return;
        }
        const supabase = createClient(token);
        const { error } = await supabase.from('cards').delete().eq('id', id);
        if (error) {
            console.error('Error deleting card:', error);
            alert(`Failed to delete card: ${error.message}`);
        } else {
            fetchCards();
            if (selectedCard?.id === id) handleCardSelect(null);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
                <h2 className="text-white text-xl font-bold">Cards ({cards.length})</h2>
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#141118]">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#211c27] text-left">
                                <th className="px-4 py-3 text-sm font-medium text-white/70">Name</th>
                                <th className="px-4 py-3 text-sm font-medium text-white/70">Description</th>
                                <th className="px-4 py-3 text-sm font-medium text-white/70">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {cards.map((card) => (
                                <tr
                                    key={card.id}
                                    className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedCard?.id === card.id ? 'bg-white/10' : ''}`}
                                    onClick={() => handleCardSelect(card)}
                                >
                                    <td className="px-4 py-3 text-sm text-white font-medium">{card.name}</td>
                                    <td className="px-4 py-3 text-sm text-white/60 truncate max-w-xs">{card.description}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                                            className="text-red-400 hover:text-red-300 text-xs font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {cards.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-6 text-center text-white/40">
                                        No cards yet. Add one below.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-[#211c27] p-6 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white text-lg font-bold">
                        {selectedCard ? 'Edit Card' : 'Add New Card'}
                    </h3>
                    {selectedCard && (
                        <button
                            onClick={() => handleCardSelect(null)}
                            className="text-white/60 hover:text-white text-sm"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-white/70 text-sm font-medium">Card Name</span>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="mt-1 block w-full rounded-lg bg-[#141118] border-white/10 text-white focus:ring-primary focus:border-primary"
                                placeholder="e.g. The Magic Sword"
                            />
                        </label>
                        <div className="space-y-2">
                            <span className="text-white/70 text-sm font-medium">Card Image</span>
                            <ImageUpload
                                value={formData.image_url}
                                onChange={(url) => setFormData({ ...formData, image_url: url })}
                            />
                            <label className="block">
                                <span className="text-white/60 text-xs">Or paste URL directly:</span>
                                <input
                                    type="text"
                                    value={formData.image_url}
                                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                    className="mt-1 block w-full rounded-lg bg-[#141118] border-white/10 text-white text-sm focus:ring-primary focus:border-primary"
                                    placeholder="https://..."
                                />
                            </label>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-white/70 text-sm font-medium">Description</span>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="mt-1 block w-full rounded-lg bg-[#141118] border-white/10 text-white focus:ring-primary focus:border-primary h-24"
                                placeholder="Card description..."
                            />
                        </label>
                        <label className="block">
                            <span className="text-white/70 text-sm font-medium">Usage Examples</span>
                            <textarea
                                value={formData.usage_examples}
                                onChange={(e) => setFormData({ ...formData, usage_examples: e.target.value })}
                                className="mt-1 block w-full rounded-lg bg-[#141118] border-white/10 text-white focus:ring-primary focus:border-primary h-24"
                                placeholder="Examples of how to use this card..."
                            />
                        </label>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={!formData.name}
                        className="px-6 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {selectedCard ? 'Update Card' : 'Add Card'}
                    </button>
                </div>
            </div>
        </div>
    );
}
