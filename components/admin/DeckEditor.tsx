'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@clerk/nextjs';
import { Database } from '@/supabase/types';
import ImageUpload from './ImageUpload';

type Deck = Database['public']['Tables']['decks']['Row'];
type Card = Database['public']['Tables']['cards']['Row'] & {
    translations?: {
        [key: string]: {
            name: string;
            description: string;
            usage_examples: string;
        };
    };
};

export default function DeckEditor({ deck }: { deck: Deck }) {
    const { getToken } = useAuth();
    const [cards, setCards] = useState<Card[]>([]);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [activeLang, setActiveLang] = useState('en');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        usage_examples: '',
        image_url: '',
        translations: {
            ru: { name: '', description: '', usage_examples: '' },
            ua: { name: '', description: '', usage_examples: '' }
        }
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
        if (data) setCards(data as any);
        setLoading(false);
    };

    const handleCardSelect = (card: Card | null) => {
        setSelectedCard(card);
        setActiveLang('en');
        if (card) {
            setFormData({
                name: card.name,
                description: card.description || '',
                usage_examples: card.usage_examples || '',
                image_url: card.image_url || '',
                translations: {
                    ru: {
                        name: card.translations?.ru?.name || '',
                        description: card.translations?.ru?.description || '',
                        usage_examples: card.translations?.ru?.usage_examples || ''
                    },
                    ua: {
                        name: card.translations?.ua?.name || '',
                        description: card.translations?.ua?.description || '',
                        usage_examples: card.translations?.ua?.usage_examples || ''
                    }
                }
            });
        } else {
            setFormData({
                name: '',
                description: '',
                usage_examples: '',
                image_url: '',
                translations: {
                    ru: { name: '', description: '', usage_examples: '' },
                    ua: { name: '', description: '', usage_examples: '' }
                }
            });
        }
    };

    const handleSave = async () => {
        console.log('handleSave called', { formData, selectedCard });
        if (!formData.name) {
            console.log('Name is missing');
            return;
        }

        const token = await getToken({ template: 'supabase' });
        if (!token) {
            alert('Authentication required. Please sign in again.');
            return;
        }
        const supabase = createClient(token);

        // Include 'en' in translations to match seed data structure
        const translationsToSave = {
            ...formData.translations,
            en: {
                name: formData.name,
                description: formData.description,
                usage_examples: formData.usage_examples
            }
        };

        const cardData = {
            name: formData.name,
            description: formData.description,
            usage_examples: formData.usage_examples,
            image_url: formData.image_url || null, // Send null if empty
            translations: translationsToSave
        };

        console.log('Sending card data:', cardData);

        if (selectedCard) {
            const { error, data } = await supabase
                .from('cards')
                .update(cardData)
                .eq('id', selectedCard.id)
                .select();

            if (error) {
                console.error('Error updating card:', error);
                alert(`Failed to update card: ${error.message}`);
            } else {
                console.log('Update success:', data);
                await fetchCards();
                // Keep the form as is, but maybe show a success indicator?
            }
        } else {
            const { error, data } = await supabase
                .from('cards')
                .insert({
                    deck_id: deck.id,
                    ...cardData
                })
                .select();

            if (error) {
                console.error('Error creating card:', error);
                alert(`Failed to create card: ${error.message}`);
            } else {
                console.log('Create success:', data);
                await fetchCards();
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

    const updateField = (field: string, value: string) => {
        if (activeLang === 'en') {
            setFormData({ ...formData, [field]: value });
        } else {
            setFormData({
                ...formData,
                translations: {
                    ...formData.translations,
                    [activeLang]: {
                        ...(formData.translations as any)[activeLang],
                        [field]: value
                    }
                }
            });
        }
    };

    const getValue = (field: string) => {
        if (activeLang === 'en') {
            return (formData as any)[field];
        }
        return (formData.translations as any)[activeLang]?.[field] || '';
    };

    return (
        <div className="h-full grid grid-rows-2 gap-8">
            <div className="flex flex-col gap-4 min-h-0">
                <h2 className="text-white text-xl font-bold">Cards ({cards.length})</h2>
                <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-[#141118]">
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

            <div className="bg-[#211c27] p-6 rounded-xl border border-white/10 overflow-auto">
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

                <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
                    {['en', 'ru', 'ua'].map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setActiveLang(lang)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeLang === lang
                                ? 'bg-primary text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {lang.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-white/70 text-sm font-medium">Card Name ({activeLang.toUpperCase()})</span>
                            <input
                                type="text"
                                value={getValue('name')}
                                onChange={(e) => updateField('name', e.target.value)}
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
                            <span className="text-white/70 text-sm font-medium">Description ({activeLang.toUpperCase()})</span>
                            <textarea
                                value={getValue('description')}
                                onChange={(e) => updateField('description', e.target.value)}
                                className="mt-1 block w-full rounded-lg bg-[#141118] border-white/10 text-white focus:ring-primary focus:border-primary h-24"
                                placeholder="Card description..."
                            />
                        </label>
                        <label className="block">
                            <span className="text-white/70 text-sm font-medium">Usage Examples ({activeLang.toUpperCase()})</span>
                            <textarea
                                value={getValue('usage_examples')}
                                onChange={(e) => updateField('usage_examples', e.target.value)}
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
