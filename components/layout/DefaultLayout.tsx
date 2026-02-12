import { Suspense } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import SiteHeader from './SiteHeader'
import { Geist, Geist_Mono, JetBrains_Mono, Epilogue } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-sans' })

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-epilogue',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
})

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

interface DefaultLayoutProps {
  children: React.ReactNode
  lng: string
  dir: string
}

export default function DefaultLayout({ children, lng, dir }: DefaultLayoutProps) {
  return (
    <ClerkProvider>
      <html lang={lng} dir={dir} className={`${jetbrainsMono.variable} ${epilogue.variable}`} suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased font-display bg-background-light dark:bg-background-dark`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Suspense fallback={<div className="h-16 border-b border-gray-200/10 dark:border-white/10 bg-white/80 dark:bg-background/80 backdrop-blur" />}>
              <SiteHeader lng={lng} />
            </Suspense>
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
