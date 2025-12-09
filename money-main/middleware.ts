import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-middleware';

export async function middleware(request: NextRequest) {
  // 허용 경로: 로그인, 정적파일, _next, favicon 등
  const publicPaths = ['/login', '/favicon.ico', '/_next', '/public', '/api'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Supabase SSR을 사용하여 세션 확인
  const { user, supabaseResponse } = await updateSession(request);

  if (!user) {
    // 세션이 없으면 로그인 페이지로 리다이렉트
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|public|login).*)'],
};
