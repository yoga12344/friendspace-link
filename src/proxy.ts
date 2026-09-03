import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Next.js 16: "middleware" is now called "proxy"
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  const publicRoutes = ['/login', '/register', '/forgot-password']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
  const isInviteRoute = pathname.startsWith('/invite/')
  const isApiAuthRoute = pathname.startsWith('/api/auth')
  const isHealthRoute = pathname === '/api/health'
  const isNextInternal =
    pathname.startsWith('/_next') || pathname === '/favicon.ico'

  // Always allow internal routes, auth API, invite routes, health checks
  if (isNextInternal || isApiAuthRoute || isInviteRoute || isHealthRoute) return NextResponse.next()

  // Allow register API endpoint
  if (pathname === '/api/auth/register') return NextResponse.next()

  // Redirect unauthenticated users trying to access protected routes
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
