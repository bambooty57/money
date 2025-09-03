import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 허용 경로: 로그인, 정적파일, _next, favicon 등
  const publicPaths = ['/login', '/favicon.ico', '/_next', '/public', '/api'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Supabase 세션 쿠키 확인 (sb-access-token 등)
  const hasSession = request.cookies.has('sb-access-token') || request.cookies.has('sb-session');
  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|public|login).*)'],
}; 