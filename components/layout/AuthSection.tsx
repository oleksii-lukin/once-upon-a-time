'use client'

import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/nextjs'
import CustomUserButton from '@/components/clerk/CustomUserButton'

export default function AuthSection({ t }: { t: (key: string) => string }) {
  const { isLoaded } = useUser()

  if (!isLoaded) {
    return <div className="w-8 h-8 bg-white/10 animate-pulse" />
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-black/10 dark:border-white/10 transition-all text-sm">
            {t('sign_in')}
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="relative w-8 h-8">
          <div className="relative w-8 h-8 overflow-hidden">
            <CustomUserButton />
          </div>
        </div>
      </SignedIn>
    </>
  )
}
