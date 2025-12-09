'use client';

import { Database } from '@/supabase/types';

type CardData = Database['public']['Tables']['cards']['Row'];

interface CardProps {
    card: Partial<CardData> & { type?: string }; // Allow partial for now as we might mock data
    isHoverable?: boolean;
    onClick?: () => void;
    className?: string;
}

import { useTranslation } from 'react-i18next';
import { getLocalizedCardContent } from '@/utils/gameUtils';

export default function Card({ card, isHoverable = false, onClick, className = '' }: CardProps) {
    const { t, i18n } = useTranslation();
    const localizedContent = getLocalizedCardContent(card as any, i18n.language);

    // key might be 'ending', 'catalyst' etc.
    const typeKey = localizedContent.type.toLowerCase();
    const localizedType = t(`card_types.${typeKey}`, { defaultValue: localizedContent.type });

    return (
        <div
            onClick={onClick}
            className={`
                bg-cover bg-center flex flex-col justify-end p-4 rounded-xl aspect-[3/4] shadow-lg border border-white/10 
                ${isHoverable ? 'cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-8 hover:scale-105 hover:z-10' : ''}
                ${className}
            `}
            style={{
                backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 60%), url("${card.image_url || '/placeholder-card.jpg'}")`
            }}
        >
            <p className="text-white text-base font-bold leading-tight">{localizedContent.name}</p>
            <p className="text-white/80 text-sm">{localizedType}</p>
        </div>
    );
}
