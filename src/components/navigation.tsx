"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

// 성능 최적화: 네비게이션 메뉴 데이터 구조화
const navigationItems = [
  { href: '/', label: '대시보드', prefetch: true },
  { href: '/statement', label: '거래명세서', prefetch: true },
  { href: '/customers', label: '고객 관리', prefetch: true },
  { href: '/transactions', label: '거래 관리', prefetch: true },
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
    <nav className="w-full bg-white border-b-4 border-blue-400 shadow-xl">
      <div className="max-w-screen-2xl mx-auto flex flex-row items-center justify-between px-12 h-24">
        <div className="flex flex-row items-center gap-2">
          <div className="flex items-center h-24">
            <img src="/kubotalogo5.png" alt="크레딧-노트" className="h-24 w-auto mr-2 drop-shadow-xl" />
          </div>
          <div className="hidden sm:ml-0 sm:flex sm:space-x-4">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.prefetch}
                className={`inline-flex items-center px-6 py-4 border-b-4 text-2xl font-extrabold transition-all duration-200 rounded-lg shadow-md ${
                  isActive(item.href)
                    ? 'border-blue-600 text-blue-800 bg-blue-50'
                    : 'border-transparent text-gray-700 hover:border-blue-300 hover:text-blue-900 hover:bg-blue-100'
                }`}
                style={{letterSpacing:'0.05em'}}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-end justify-center">
          <span className="text-2xl md:text-3xl font-extrabold text-blue-800 text-right mb-1 drop-shadow-lg">
            미수금 없는 세상!
          </span>
          <span className="text-xl md:text-2xl font-bold text-indigo-700 text-right drop-shadow-sm">
            살맛나는 세상!
          </span>
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