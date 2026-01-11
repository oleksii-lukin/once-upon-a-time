'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-900 dark:text-white transition-colors"
    >
      <Moon className="h-4 w-4 transition-opacity opacity-100 dark:opacity-0 absolute" />
      <Sun className="h-4 w-4 transition-opacity opacity-0 dark:opacity-100 absolute" />
    </button>
  )
}
