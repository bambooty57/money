"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

// 성능 최적화: 네비게이션 메뉴 데이터 구조화
const navigationItems = [
  { href: '/', label: '대시보드', prefetch: true },
  { href: '/statement', label: '거래명세서', prefetch: true },
  { href: '/customers', label: '고객 관리', prefetch: true },
  { href: '/transactions', label: '거래 관리', prefetch: true },
  { href: '/prospects', label: '가망고객', prefetch: true },
] as const;

// 성능 최적화: 로딩 스켈레톤 컴포넌트
function NavigationSkeleton() {
  return (
    <nav className="bg-white shadow animate-pulse">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="h-6 w-32 bg-gray-200 rounded"></div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="inline-flex items-center px-1 pt-1">
                  <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// 메인 네비게이션 컴포넌트
function NavigationContent() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  // 로그아웃 핸들러
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  return (
    <nav className="w-full bg-white border-b-4 border-blue-400 shadow-xl">
      {/* 데스크톱 네비게이션 */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20 lg:h-24">
          {/* 왼쪽: 로고 */}
          <div className="flex items-center">
            <img 
              src="/kubotalogo5.png" 
              alt="크레딧-노트" 
              className="h-12 md:h-16 lg:h-20 w-auto drop-shadow-xl" 
            />
          </div>

          {/* 데스크톱 메뉴 */}
          <div className="hidden lg:flex items-center space-x-2">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.prefetch}
                className={`inline-flex items-center px-4 py-2 text-lg font-bold transition-all duration-200 rounded-lg ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-blue-100 hover:text-blue-900'
                }`}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* 오른쪽: 로그아웃 + 모바일 메뉴 버튼 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm md:text-lg font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg transition-colors duration-200"
              title="로그아웃"
            >
              로그아웃
            </button>
            
            {/* 모바일 햄버거 메뉴 버튼 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t-2 border-blue-200 shadow-lg">
            <div className="px-4 py-4 space-y-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 text-lg font-bold rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-blue-100 hover:text-blue-900'
                  }`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// 성능 최적화: Suspense로 래핑된 메인 컴포넌트
export function Navigation() {
  return (
    <Suspense fallback={<NavigationSkeleton />}>
      <NavigationContent />
    </Suspense>
  );
} 