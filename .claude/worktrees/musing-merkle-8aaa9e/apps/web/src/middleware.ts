import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Enforce boundary isolation for /admin routes
  if (pathname.startsWith('/admin')) {
    // Exclude /login/admin if mapped, or allow /login/admin directly
    if (pathname === '/login/admin') {
      return NextResponse.next();
    }

    const adminSessionCookie = request.cookies.get('cc_admin_session')?.value;
    const adminRoleCookie = request.cookies.get('cc_admin_role')?.value;

    // Check if valid admin session exists in cookie
    const hasValidAdminSession = Boolean(adminSessionCookie && adminSessionCookie.length > 5);

    if (!hasValidAdminSession) {
      const loginUrl = new URL('/login/admin', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('reason', 'unauthorized_admin_access');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Student-only routes — the cookie is just a presence flag (not
  // authoritative, mirrors the admin guard above); the actual access token
  // lives in local/session storage and every API call is verified
  // server-side by the JWT guard regardless of this redirect.
  if (pathname.startsWith('/profile') || pathname.startsWith('/onboarding')) {
    const studentSessionCookie = request.cookies.get('cc_user_session')?.value;
    const hasValidStudentSession = Boolean(studentSessionCookie && studentSessionCookie.length > 0);

    if (!hasValidStudentSession) {
      const loginUrl = new URL('/login/student', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('reason', 'unauthorized_student_access');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/profile/:path*', '/onboarding/:path*'],
};
