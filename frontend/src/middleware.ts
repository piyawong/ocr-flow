import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/register'];

// Routes that should be excluded from middleware entirely
const excludedRoutes = ['/_next', '/favicon.ico', '/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for excluded routes (static files, etc.)
  if (excludedRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Get token from cookie or header
  // Note: For client-side auth with localStorage, we can't check server-side
  // This middleware provides basic route protection, but actual auth check happens client-side

  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, we'll let the client-side handle authentication
  // The AuthContext will redirect to login if not authenticated
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
