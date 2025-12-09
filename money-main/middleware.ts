import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 허용 경로: 로그인, 정적파일, _next, favicon 등
  const publicPaths = ['/login', '/favicon.ico', '/_next', '/public', '/api'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Supabase는 기본적으로 localStorage를 사용하므로 서버 사이드 쿠키 확인이 제한적입니다.
  // 클라이언트 사이드에서 세션 확인을 하므로, middleware는 관대하게 처리합니다.
  // Supabase 세션 쿠키 확인 (다양한 가능한 쿠키 이름 체크)
  const supabaseCookieName = 'sb-jcqdjkxllgiedjqxryoq-auth-token';
  const hasSession = request.cookies.has(supabaseCookieName) || 
                     request.cookies.has('sb-access-token') || 
                     request.cookies.has('sb-session') ||
                     request.headers.get('authorization')?.startsWith('Bearer ');
  
  // 세션이 없어도 통과시킴 (클라이언트 사이드에서 세션 확인)
  // 클라이언트 사이드에서 세션이 없으면 자동으로 /login으로 리다이렉트됨
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|public|login).*)'],
}; 