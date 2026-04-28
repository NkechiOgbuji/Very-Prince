/**
 * @file middleware.ts
 * @description Next.js Edge Middleware for route protection.
 * 
 * This middleware runs at the Edge/Server level to protect sensitive routes
 * before the page even renders, preventing unauthorized users from seeing
 * a flash of protected content.
 * 
 * Protected routes:
 * - /payouts (maintainer dashboard)
 * - /settings (user settings)
 * 
 * The middleware checks for the presence of an HttpOnly JWT cookie.
 * If missing or malformed, it redirects to the homepage or login page.
 */

import { NextRequest, NextResponse } from 'next/server';

// Define protected routes that require authentication
const PROTECTED_ROUTES = ['/payouts', '/settings'];

// Define public routes that should never be redirected
const PUBLIC_ROUTES = ['/', '/login', '/dashboard', '/organizations', '/profile'];

/**
 * Middleware function to protect routes
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets, API routes, and public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  ) {
    return NextResponse.next();
  }

  // Check if the current path is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for JWT cookie (HttpOnly cookie set by backend)
  const token = request.cookies.get('auth-token')?.value || 
                request.cookies.get('jwt')?.value ||
                request.cookies.get('token')?.value;

  // If no token found, redirect to homepage
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Optional: Basic token format validation (not cryptographic verification)
  // This is just to catch obviously malformed tokens
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    // Check if the payload part is valid base64
    const payload = parts[1];
    if (!payload || payload.length === 0) {
      throw new Error('Invalid payload');
    }
    
    // Try to decode the payload (this will throw if it's not valid base64)
    Buffer.from(payload, 'base64');
  } catch (error) {
    // Token is malformed, redirect to homepage
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Token exists and has valid format, allow access
  return NextResponse.next();
}

/**
 * Configure which paths the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
