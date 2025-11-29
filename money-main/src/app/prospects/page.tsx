"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import ScrollToTop from '@/components/ui/scroll-to-top';
import { useCustomersRealtime } from '@/lib/useCustomersRealtime';

type Prospect = {
  id: string;
  customer_id: string;
  prospect_device_type: '트랙터' | '콤바인' | '이앙기' | '작업기' | '기타';
  current_device_model_id: string | null;
  created_at: string;
  updated_at: string;
  customers: {
    id: string;
    name: string;
    mobile: string | null;
    phone: string | null;
    address_road: string | null;
    address_jibun: string | null;
    business_name: string | null;
    customer_type: string | null;
  };
  models_types: {
    id: string;
    model: string;
    type: string;
  } | null;
};

type ApiResponse = {
  data: Prospect[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type Stats = {
  트랙터: number;
  콤바인: number;
  이앙기: number;
  작업기: number;
  기타: number;
  total: number;
};

const DEVICE_TYPES = ['트랙터', '콤바인', '이앙기', '작업기', '기타'] as const;
const DEVICE_COLORS = {
  트랙터: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    textBold: 'text-blue-800',
    button: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700',
    buttonActive: 'bg-blue-600',
    buttonInactive: 'bg-blue-100',
    buttonInactiveHover: 'hover:bg-blue-200',
  },
  콤바인: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    textBold: 'text-green-800',
    button: 'bg-green-600',
    buttonHover: 'hover:bg-green-700',
    buttonActive: 'bg-green-600',
    buttonInactive: 'bg-green-100',
    buttonInactiveHover: 'hover:bg-green-200',
  },
  이앙기: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    textBold: 'text-purple-800',
    button: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-700',
    buttonActive: 'bg-purple-600',
    buttonInactive: 'bg-purple-100',
    buttonInactiveHover: 'hover:bg-purple-200',
  },
  작업기: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    textBold: 'text-orange-800',
    button: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-700',
    buttonActive: 'bg-orange-600',
    buttonInactive: 'bg-orange-100',
    buttonInactiveHover: 'hover:bg-orange-200',
  },
  기타: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    textBold: 'text-gray-800',
    button: 'bg-gray-600',
    buttonHover: 'hover:bg-gray-700',
    buttonActive: 'bg-gray-600',
    buttonInactive: 'bg-gray-100',
    buttonInactiveHover: 'hover:bg-gray-200',
  },
} as const;

export default function ProspectsPage() {
  useCustomersRealtime();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '18');
  const searchTerm = searchParams.get('search') || '';
  const deviceType = searchParams.get('deviceType') || '전체';

  // 통계 데이터 로드
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/prospects/stats');
        const statsData = await res.json();
        setStats(statsData);
      } catch (error) {
        console.error('통계 로드 실패:', error);
      }
    }
    fetchStats();
  }, []);

  // 가망고객 목록 로드
  useEffect(() => {
    async function fetchProspects() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          pageSize: pageSize.toString(),
          search: searchTerm,
          deviceType: deviceType === '전체' ? '' : deviceType,
        });

        const res = await fetch(`/api/prospects?${params}`);
        const result = await res.json();
        
        // 에러 응답 처리
        if (result.error) {
          console.error('API 에러:', result.error);
          setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
        } else {
          // data가 배열인지 확인하고 기본값 설정
          setData({
            data: Array.isArray(result.data) ? result.data : [],
            pagination: result.pagination || { page: 1, pageSize, total: 0, totalPages: 0 },
          });
        }
      } catch (error) {
        console.error('가망고객 목록 로드 실패:', error);
        setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
      } finally {
        setLoading(false);
      }
    }
    fetchProspects();
  }, [currentPage, pageSize, searchTerm, deviceType]);

  // 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
        deviceType: deviceType === '전체' ? '' : deviceType,
      });

      const res = await fetch(`/api/prospects?${params}`);
      const result = await res.json();
      
      // 에러 응답 처리
      if (result.error) {
        console.error('API 에러:', result.error);
        setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
      } else {
        setData({
          data: Array.isArray(result.data) ? result.data : [],
          pagination: result.pagination || { page: 1, pageSize, total: 0, totalPages: 0 },
        });
      }
    } catch (error) {
      console.error('새로고침 실패:', error);
      setData({ data: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } });
    } finally {
      setRefreshing(false);
    }
  };

  // 검색 실행
  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', searchTerm);
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  // 기종 필터 변경
  const handleDeviceTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('deviceType', type);
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-bold">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 flex items-center gap-3">
            🎯 가망고객 관리
          </h1>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div 
              className={`bg-white rounded-lg shadow-lg p-4 border-2 border-gray-200 cursor-pointer hover:shadow-xl transition-shadow ${
                deviceType === '전체' ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleDeviceTypeChange('전체')}
            >
              <div className="text-lg font-semibold text-gray-600 mb-1">전체</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            </div>
            {DEVICE_TYPES.map((type) => {
              const colors = DEVICE_COLORS[type];
              return (
                <div
                  key={type}
                  className={`${colors.bg} rounded-lg shadow-lg p-4 ${colors.border} border-2 cursor-pointer hover:shadow-xl transition-shadow`}
                  onClick={() => handleDeviceTypeChange(type)}
                >
                  <div className={`text-lg font-semibold ${colors.text} mb-1`}>{type}</div>
                  <div className={`text-2xl font-bold ${colors.textBold}`}>{stats[type]}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 검색 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1 flex gap-2">
              <Input
                type="text"
                placeholder="고객명, 연락처로 검색"
                value={searchTerm}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('search', e.target.value);
                  router.push(`?${params.toString()}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1 text-lg px-4 py-3"
              />
              <Button
                onClick={handleSearch}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700"
              >
                🔍 검색
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-6 py-3 bg-green-600 hover:bg-green-700"
              >
                {refreshing ? '🔄' : '🔄'} 새로고침
              </Button>
            </div>
          </div>
        </div>

        {/* 가망고객 카드 그리드 */}
        {data && data.data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {data.data.map((prospect) => {
                const colors = DEVICE_COLORS[prospect.prospect_device_type];
                return (
                  <div
                    key={prospect.id}
                    className={`bg-white rounded-xl shadow-lg border-2 ${colors.border} hover:shadow-xl transition-shadow p-6`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">
                          {prospect.customers.name}
                        </h3>
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${colors.bg} ${colors.text}`}>
                          {prospect.prospect_device_type}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-lg">
                      {prospect.customers.mobile && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📱</span>
                          <span>{prospect.customers.mobile}</span>
                        </div>
                      )}
                      {prospect.customers.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📞</span>
                          <span>{prospect.customers.phone}</span>
                        </div>
                      )}
                          {prospect.models_types && (
                        <div className="flex items-center gap-2 text-gray-700 mt-3">
                          <span className="font-semibold">현재보유:</span>
                          <span className="bg-blue-100 px-2 py-1 rounded text-sm">
                            {prospect.models_types.model} / {prospect.models_types.type}
                          </span>
                        </div>
                      )}
                      {prospect.customers.address_road && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm mt-2">
                          <span>📍</span>
                          <span className="truncate">{prospect.customers.address_road}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
                      등록일: {new Date(prospect.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                );
              })}
            </div>

            {data.data.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow-lg">
                <div className="text-2xl font-bold text-gray-600 mb-2">
                  가망고객이 없습니다
                </div>
                <div className="text-lg text-gray-500">
                  고객 등록 시 가망기종 정보를 입력하면 여기에 표시됩니다.
                </div>
              </div>
            )}

            {/* 페이지네이션 */}
            {data.pagination && data.pagination.totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  currentPage={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  totalItems={data.pagination.total}
                  itemsPerPage={pageSize}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

