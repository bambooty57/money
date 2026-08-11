import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 허용 경로: 로그인, 정적파일, _next, favicon, 고객용 서명문서 열람 등
  const publicPaths = ['/login', '/favicon.ico', '/_next', '/public', '/api', '/statement/view'];
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Supabase 세션 쿠키 확인
  // @supabase/ssr은 'sb-<프로젝트ref>-auth-token(.0/.1...)' 형태의 쿠키를 사용하므로
  // 레거시 이름(sb-access-token, sb-session)과 실제 Supabase 쿠키 패턴을 모두 검사
  const hasSession = request.cookies.getAll().some(c =>
    c.name === 'sb-access-token' ||
    c.name === 'sb-session' ||
    (c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  );
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
