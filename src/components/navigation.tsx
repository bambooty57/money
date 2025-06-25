"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

// 성능 최적화: 네비게이션 메뉴 데이터 구조화
const navigationItems = [
  { href: '/', label: '대시보드', prefetch: true },
  { href: '/customers', label: '고객 관리', prefetch: true },
  { href: '/transactions', label: '거래 관리', prefetch: true },
  { href: '/legal-actions', label: '법적 조치', prefetch: false }, // 덜 중요한 페이지는 prefetch 비활성화
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
              {Array.from({ length: 4 }).map((_, i) => (
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

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white shadow sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link 
                href="/" 
                className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors duration-200"
                prefetch={true}
              >
                크레딧-노트
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* 성능 최적화: 모바일 메뉴 버튼 (필요시 확장) */}
          <div className="sm:hidden flex items-center">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700 transition-colors duration-200"
              aria-label="메뉴 열기"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 성능 최적화: 모바일 메뉴 (숨김 상태, 필요시 확장) */}
        <div className="sm:hidden hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                prefetch={item.prefetch}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
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