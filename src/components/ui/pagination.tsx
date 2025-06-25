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
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  showPageSize = true,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 페이지 변경 시 URL 업데이트 (SEO 최적화)
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
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
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* 정보 표시 */}
      {showInfo && (
        <div className="text-sm text-gray-600 order-2 sm:order-1">
          <span className="font-medium">{startItem.toLocaleString()}</span>
          {' - '}
          <span className="font-medium">{endItem.toLocaleString()}</span>
          {' of '}
          <span className="font-medium">{totalItems.toLocaleString()}</span>
          {' items'}
        </div>
      )}

      {/* 페이지네이션 */}
      <div className="flex items-center gap-2 order-1 sm:order-2">
        {/* 이전 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          Previous
        </button>

        {/* 페이지 번호들 */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-3 py-2 text-sm text-gray-500">...</span>
              ) : (
                <button
                  onClick={() => handlePageChange(page as number)}
                  onKeyDown={(e) => handleKeyDown(e, page as number)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
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
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          Next
        </button>
      </div>

      {/* 페이지 크기 선택 */}
      {showPageSize && (
        <div className="flex items-center gap-2 text-sm text-gray-600 order-3">
          <span>Show:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>per page</span>
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
        placeholder={currentPage.toString()}
        className="w-16 px-2 py-1 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
export function usePagination(totalItems: number, itemsPerPage: number = 20) {
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