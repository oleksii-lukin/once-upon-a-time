'use client'

import { useCallback } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const toggle = useCallback(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const currentlyDark = root.classList.contains('dark')
    if (currentlyDark) {
      root.classList.remove('dark')
      try {
        localStorage.setItem('theme', 'light')
      }
      catch {}
    }
    else {
      root.classList.add('dark')
      try {
        localStorage.setItem('theme', 'dark')
      }
      catch {}
    }
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-900 dark:text-white transition-colors"
    >
      <Moon className="h-4 w-4 transition-opacity opacity-100 dark:opacity-0" />
      <Sun className="h-4 w-4 absolute transition-opacity opacity-0 dark:opacity-100" />
    </button>
  )
}
