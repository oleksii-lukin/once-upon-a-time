import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import acceptLanguage from 'accept-language'
import { fallbackLng, languages, cookieName } from './app/i18n/settings'

acceptLanguage.languages(languages)

const isProtectedRoute = createRouteMatcher([
  '/game(.*)',
  '/lobby(.*)',
])

export const proxy = clerkMiddleware(async (auth, req) => {
  // Handle i18n language detection and redirection
  let lng
  if (req.cookies.has(cookieName)) lng = acceptLanguage.get(req.cookies.get(cookieName)!.value)
  if (!lng) lng = acceptLanguage.get(req.headers.get('Accept-Language'))
  if (!lng) lng = fallbackLng

  // Redirect if lng in path is not supported
  if (
    !languages.some(loc => req.nextUrl.pathname.startsWith(`/${loc}`))
    && !req.nextUrl.pathname.startsWith('/_next')
    && !req.nextUrl.pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL(`/${lng}${req.nextUrl.pathname}`, req.url))
  }

  if (req.headers.has('referer')) {
    const refererUrl = new URL(req.headers.get('referer')!)
    const lngInReferer = languages.find(l => refererUrl.pathname.startsWith(`/${l}`))
    const response = NextResponse.next()
    if (lngInReferer) response.cookies.set(cookieName, lngInReferer)

    // Handle Clerk authentication
    if (isProtectedRoute(req)) await auth.protect()

    return response
  }

  // Handle Clerk authentication
  if (isProtectedRoute(req)) await auth.protect()

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|favicon.ico|sitemap.xml|robots.txt|.well-known)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
