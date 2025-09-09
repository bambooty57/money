"use client";

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange?: (page: number) => void;
  showInfo?: boolean;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
  className?: string;
  scrollToTopOnPageChange?: boolean; // 추가
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  showPageSize = true,
  pageSizeOptions = [10, 18, 20, 30, 50, 100],
  className = '',
  scrollToTopOnPageChange = true, // 기본값 true
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 페이지 변경 시 URL 업데이트 (SEO 최적화)
  const handlePageChange = (page: number) => {
    if (scrollToTopOnPageChange) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', page.toString());
      router.push(`?${params.toString()}`);
    }
    onPageChange?.(page);
  };

  // 페이지 크기 변경
  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', size.toString());
    params.set('page', '1'); // 페이지 크기 변경 시 첫 페이지로
    router.push(`?${params.toString()}`);
  };

  // 페이지 번호 생성 로직 (성능 최적화)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // 전체 페이지가 적으면 모두 표시
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 전체 페이지가 많으면 스마트하게 표시
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // 키보드 접근성
  const handleKeyDown = (e: React.KeyboardEvent, page: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePageChange(page);
    }
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`flex flex-col lg:flex-row items-center justify-between gap-6 ${className}`}>
      {/* 정보 표시 */}
      {showInfo && (
        <div className="text-lg text-gray-600 order-2 lg:order-1 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
          <div className="font-semibold text-blue-800">
            📊 <span className="font-bold">{startItem.toLocaleString()}</span>
            {' - '}
            <span className="font-bold">{endItem.toLocaleString()}</span>
            {' / '}
            <span className="font-bold">{totalItems.toLocaleString()}</span>
            {' 항목'}
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
      <div className="flex items-center gap-3 order-1 lg:order-2">
        {/* 이전 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-6 py-3 text-lg font-bold text-white bg-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:border-gray-400 transition-colors duration-200 shadow-lg"
          aria-label="Previous page"
        >
          ⬅️ 이전
        </button>

        {/* 페이지 번호들 */}
        <div className="flex items-center gap-2">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-4 py-3 text-lg text-gray-500 font-bold">...</span>
              ) : (
                <button
                  onClick={() => handlePageChange(page as number)}
                  onKeyDown={(e) => handleKeyDown(e, page as number)}
                  className={`px-4 py-3 text-lg font-bold rounded-lg transition-colors duration-200 shadow-lg min-w-[60px] ${
                    currentPage === page
                      ? 'bg-blue-600 text-white border-2 border-blue-600'
                      : 'text-blue-600 bg-white border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-500'
                  }`}
                  aria-label={`Go to page ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 다음 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-6 py-3 text-lg font-bold text-white bg-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:border-gray-400 transition-colors duration-200 shadow-lg"
          aria-label="Next page"
        >
          다음 ➡️
        </button>
      </div>

      {/* 페이지 크기 선택 */}
      {showPageSize && (
        <div className="flex items-center gap-3 text-lg text-gray-600 order-3 bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <span className="font-semibold text-green-800">📄 페이지당 항목 수:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="px-4 py-2 text-lg font-semibold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
            title="페이지당 항목 수 선택"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}개
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// 빠른 점프 컴포넌트 (대용량 데이터용)
export function QuickJump({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void; 
}) {
  const [jumpValue, setJumpValue] = React.useState('');

  const handleJump = () => {
    const page = parseInt(jumpValue);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>Jump to:</span>
      <input
        type="number"
        min="1"
        max={totalPages}
        value={jumpValue}
        onChange={(e) => setJumpValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onWheel={(e) => {
          // 마우스 스크롤로 인한 숫자 변경 방지
          e.preventDefault();
        }}
        placeholder={currentPage.toString()}
        className="w-16 px-2 py-1 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="페이지 번호 입력 (마우스 스크롤 비활성화됨)"
      />
      <button
        onClick={handleJump}
        className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Go
      </button>
    </div>
  );
}

// 페이지네이션 정보 훅 (로직 재사용)
export function usePagination(totalItems: number, itemsPerPage: number = 18) {
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || itemsPerPage.toString());
  
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (currentPage - 1) * pageSize;
  
  return {
    currentPage,
    pageSize,
    totalPages,
    offset,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
} 