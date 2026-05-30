import { NextRequest, NextResponse } from 'next/server'
import { decodeSessionToken } from '@/lib/session-token'
import { SESSION_COOKIE, isAdminRole } from '@/lib/auth-shared'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = decodeSessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname.startsWith('/checkout') && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (!isAdminRole(session.role)) {
      return NextResponse.redirect(new URL('/403', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/checkout/:path*', '/admin/:path*'],
}
