import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 임시로 로그인 체크를 비활성화 (Supabase 연결 문제 해결 전까지)
  console.log('🔓 미들웨어: 로그인 체크 임시 비활성화');
  return NextResponse.next();
  
  /* 원래 코드 (Supabase 연결 정상화 후 복원)
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
  */
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|public|login).*)'],
}; 