'use client';

import { generateGuestIdentity } from '@/lib/auth/guestIdentity';
import { Database } from '@/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

interface PlayerAvatarProps {
    player: Player;
    size?: 'sm' | 'md' | 'lg';
}

export function PlayerAvatar({ player, size = 'md' }: PlayerAvatarProps) {
    const sizeClasses = {
        sm: 'size-8 text-lg',
        md: 'size-10 text-xl',
        lg: 'size-12 text-2xl'
    };

    // Check if player has stored avatar_url
    if (player.avatar_url) {
        // Check if it's an emoji avatar (format: emoji:🦊:#FF6B6B)
        if (player.avatar_url.startsWith('emoji:')) {
            const parts = player.avatar_url.split(':');
            const emoji = parts[1] || '🎭';
            const color = parts[2] || '#888888';
            return (
                <div
                    className={`flex items-center justify-center rounded-full ${sizeClasses[size]}`}
                    style={{ backgroundColor: color }}
                >
                    {emoji}
                </div>
            );
        }
        // Regular image URL
        return (
            <div
                className={`bg-center bg-no-repeat aspect-square bg-cover rounded-full ${sizeClasses[size]}`}
                style={{ backgroundImage: `url("${player.avatar_url}")` }}
            />
        );
    }

    // Fallback: generate from guest_id if available
    if (player.guest_id) {
        const identity = generateGuestIdentity(player.guest_id);
        return (
            <div
                className={`flex items-center justify-center rounded-full ${sizeClasses[size]}`}
                style={{ backgroundColor: identity.color }}
            >
                {identity.emoji}
            </div>
        );
    }

    // Ultimate fallback - show initial from display_name or generic
    const initial = (player.display_name || 'P').charAt(0).toUpperCase();
    return (
        <div className={`flex items-center justify-center rounded-full bg-primary ${sizeClasses[size]}`}>
            <span className="text-white font-bold">{initial}</span>
        </div>
    );
}

export function getPlayerDisplayName(player: Player): string {
    // Use stored display_name if available
    if (player.display_name) {
        return player.display_name;
    }

    // Fallback: generate from guest_id
    if (player.guest_id) {
        const identity = generateGuestIdentity(player.guest_id);
        return identity.name;
    }

    // Ultimate fallback
    return 'Player';
}
