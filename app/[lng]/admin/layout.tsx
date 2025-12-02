import Link from 'next/link';
import { ReactNode } from 'react';
import { useTranslation } from '@/app/i18n/server';

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ lng: string }> }) {
    const { lng } = await params;
    const { t } = await useTranslation(lng, 'common');

    return (
        <div className="relative flex h-screen w-full bg-[#141118] overflow-hidden">
            <aside className="flex w-64 flex-col border-r border-white/10 bg-[#141118]">
                <div className="flex h-16 items-center px-6">
                    <h1 className="text-white text-lg font-bold">{t('storycraft_admin')}</h1>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-1">
                    <Link href={`/${lng}/admin`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="text-sm font-medium">{t('dashboard')}</span>
                    </Link>
                    <Link href={`/${lng}/admin/decks`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#302839] text-white">
                        <span className="material-symbols-outlined">style</span>
                        <span className="text-sm font-medium">{t('decks')}</span>
                    </Link>
                    <Link href={`/${lng}/admin/players`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">group</span>
                        <span className="text-sm font-medium">{t('players')}</span>
                    </Link>
                    <Link href={`/${lng}/admin/games`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">casino</span>
                        <span className="text-sm font-medium">{t('games')}</span>
                    </Link>
                    <Link href={`/${lng}/admin/settings`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">settings</span>
                        <span className="text-sm font-medium">{t('settings')}</span>
                    </Link>
                </nav>
            </aside>
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
