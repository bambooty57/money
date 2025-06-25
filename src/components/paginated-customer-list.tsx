"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Pagination, usePagination } from '@/components/ui/pagination';
import type { Customer } from '@/types/database';

interface ApiResponse {
  data: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    search: string;
    sortBy: string;
    sortOrder: string;
    itemsOnPage: number;
  };
}

interface PaginatedCustomerListProps {
  onEdit?: (customer: Customer) => void;
  onDelete?: (id: string) => void;
  enableActions?: boolean;
}

const openKakaoMap = (address: string) => {
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
  window.open(kakaoMapUrl, '_blank');
};

export function PaginatedCustomerList({ 
  onEdit, 
  onDelete, 
  enableActions = false 
}: PaginatedCustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'created_at');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  
  // 페이지네이션 훅 사용
  const { currentPage, pageSize } = usePagination(data?.pagination.total || 0);

  // 데이터 페칭 함수 (성능 최적화: useCallback 사용)
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/customers?${params}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, sortBy, sortOrder]);

  // 초기 로딩 및 의존성 변경 시 데이터 페칭
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // 검색 입력 디바운싱 (성능 최적화)
  const [searchInputValue, setSearchInputValue] = useState(searchTerm);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputValue !== searchTerm) {
        setSearchTerm(searchInputValue);
        // 검색 시 첫 페이지로 이동
        const params = new URLSearchParams(searchParams.toString());
        params.set('search', searchInputValue);
        params.set('page', '1');
        router.push(`?${params.toString()}`);
      }
    }, 300); // 300ms 디바운싱

    return () => clearTimeout(timer);
  }, [searchInputValue, searchTerm, searchParams, router]);

  // 정렬 핸들러
  const handleSort = (field: string) => {
    const newSortOrder = (sortBy === field && sortOrder === 'asc') ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newSortOrder);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('sortBy', field);
    params.set('sortOrder', newSortOrder);
    params.set('page', '1'); // 정렬 변경 시 첫 페이지로
    router.push(`?${params.toString()}`);
  };

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  // 메모이제이션된 정렬 아이콘 (성능 최적화)
  const getSortIcon = useMemo(() => (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  }, [sortBy, sortOrder]);

  const downloadRef = useRef<HTMLAnchorElement>(null);
  const handleExcelDownload = async () => {
    const res = await fetch('/api/customers/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    if (downloadRef.current) {
      downloadRef.current.href = url;
      downloadRef.current.download = 'customers.xlsx';
      downloadRef.current.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    }
  };

  // 로딩 스켈레톤
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-2">
        <button onClick={handleExcelDownload} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">엑셀 다운로드</button>
        <a ref={downloadRef} style={{ display: 'none' }} />
      </div>
      {/* 검색 및 필터 영역 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="고객명, 전화번호, 사업자번호로 검색..."
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="text-sm text-gray-600">
          총 {data.pagination.total.toLocaleString()}명의 고객
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  거래처명 {getSortIcon('name')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('customer_type')}
                >
                  고객유형 {getSortIcon('customer_type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주소</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사진</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">휴대전화</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">일반전화</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사업자명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사업자번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">대표자명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주민등록번호</th>
                {enableActions && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.data.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">{customer.representative_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{[customer.address_road, customer.address_jibun, customer.zipcode].filter(Boolean).join(' / ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.photos && customer.photos.length > 0 ? (
                      <div className="flex space-x-1">
                        {customer.photos.slice(0, 3).map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo.url}
                            alt="고객사진"
                            className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80 border-2 border-white shadow-sm"
                            onClick={() => window.open(photo.url, '_blank')}
                          />
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{customer.mobile}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{customer.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{customer.business_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{customer.business_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{customer.representative_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{customer.ssn}</td>
                  {enableActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => router.push(`/customers/${customer.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          보기
                        </button>
                        {onEdit && (
                          <button
                            onClick={() => onEdit(customer)}
                            className="text-green-600 hover:text-green-900"
                          >
                            수정
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(customer.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 데이터가 없을 때 */}
        {data.data.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">
              {searchTerm ? '검색 결과가 없습니다' : '등록된 고객이 없습니다'}
            </div>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchInputValue('');
                  setSearchTerm('');
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('search');
                  router.push(`?${params.toString()}`);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                검색 조건 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {data.pagination.totalPages > 1 && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.total}
          itemsPerPage={data.pagination.pageSize}
          onPageChange={handlePageChange}
          className="mt-6"
        />
      )}

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
} 