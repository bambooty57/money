"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Pagination, usePagination } from '@/components/ui/pagination';
import type { Database } from '@/types/database';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useCustomersRealtime } from '@/lib/useCustomersRealtime';

type CustomerBase = Database['public']['Tables']['customers']['Row'];
type Customer = CustomerBase & {
  transaction_count?: number;
  total_unpaid?: number;
  photos?: { url: string }[];
};

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
  onSelectCustomer?: (customer: Customer | null) => void;
  refreshKey?: number;
}

const openKakaoMap = (address: string) => {
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
  window.open(kakaoMapUrl, '_blank');
};

function CustomerDetailModal({ customer, open, onClose }: { customer: any, open: boolean, onClose: () => void }) {
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 발송내역 fetch
  useEffect(() => {
    if (open && customer?.id) {
      setLoading(true);
      fetch(`/api/sms-messages?customer_id=${customer.id}`)
        .then(res => res.json())
        .then(data => setSmsMessages(data.data || []))
        .finally(() => setLoading(false));
    }
  }, [open, customer]);

  if (!customer) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer.name} 상세정보</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div><b>이름:</b> {customer.name}</div>
          <div><b>연락처:</b> {customer.mobile || customer.phone || '-'}</div>
          <div><b>주소:</b> {customer.address_road || customer.address_jibun || '-'}</div>
          <div><b>미수금:</b> {customer.total_unpaid?.toLocaleString() ?? '0'}원</div>
          <div><b>거래건수:</b> {customer.transaction_count ?? 0}건</div>
          <div><b>사진:</b> {customer.photos && customer.photos.length > 0 ? (
            <div className="flex space-x-1 mt-1">{customer.photos.map((photo: any, idx: number) => (
              <img key={idx} src={photo.url} alt="고객사진" className="w-12 h-12 rounded object-cover border" />
            ))}</div>
          ) : '-'}
          </div>
          <div><b>발송 메시지 내역:</b></div>
          {loading ? <div>로딩중...</div> : (
            <ul className="text-xs max-h-40 overflow-y-auto space-y-1">
              {smsMessages.length === 0 ? <li className="text-gray-400">내역 없음</li> : smsMessages.map((msg, i) => (
                <li key={i}>
                  <span className="font-mono">[{msg.sent_at?.slice(0,16).replace('T',' ')}]</span> {msg.content}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaginatedCustomerListInner({ 
  onEdit, 
  onDelete, 
  enableActions = false,
  onSelectCustomer,
  refreshKey
}: PaginatedCustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'created_at');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [showToast, setShowToast] = useState(false);
  
  // 페이지네이션 훅 사용 (3열6행 = 18개)
  const { currentPage, pageSize } = usePagination(data?.pagination.total || 0, 18);

  // 데이터 페칭 함수 (성능 최적화: useCallback 사용)
  const fetchCustomers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
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
        if (isRefresh) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, searchTerm, sortBy, sortOrder]);

  // 수동 새로고침 함수 (검색 입력 필드 초기화 포함)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // 검색 입력 필드 초기화
      setSearchTerm('');
      setSearchInputValue('');
      
      // URL 파라미터에서 search 제거
      const params = new URLSearchParams(searchParams.toString());
      params.delete('search');
      params.set('page', '1');
      router.push(`?${params.toString()}`);
      
      // 초기화된 검색어로 데이터 새로고침
      const fetchParams = new URLSearchParams({
        page: '1',
        pageSize: pageSize.toString(),
        search: '', // 빈 검색어로 설정
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/customers?${fetchParams}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error refreshing customers:', error);
    } finally {
      setRefreshing(false);
    }
  }, [searchParams, router, pageSize, sortBy, sortOrder]);

  // 초기 로딩 및 의존성 변경 시 데이터 페칭
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers, refreshKey]);

  // 실시간 동기화 - 즉시 데이터 새로고침
  useCustomersRealtime({ 
    onChange: () => {
      // 실시간 변경 시 즉시 새로고침 (로딩 상태 없이)
      fetchCustomers(true);
    }
  });

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

  // 체크박스 상태 관리 (1명만 선택 가능)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const handleCheck = (id: string, checked: boolean) => {
    setSelectedIds(() => {
      const next = new Set<string>();
      if (checked) next.add(id); // 1명만 선택
      return next;
    });
  };

  // selectedIds가 바뀔 때마다 onSelectCustomer 호출
  useEffect(() => {
    const checked = Array.from(selectedIds);
    if (checked.length === 1) {
      const customer = data?.data?.find(c => c.id === checked[0]);
      onSelectCustomer?.(customer || null);
    } else {
      onSelectCustomer?.(null);
    }
  }, [selectedIds, data, onSelectCustomer]);

  // 체크된 고객 목록
  const checkedCustomers = data?.data?.filter(c => selectedIds.has(c.id)) || [];

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
      {/* 검색 및 필터 영역 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="flex-1 max-w-2xl">
            <label className="block text-xl font-bold text-gray-700 mb-3">
              🔍 전체 고객 검색
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="고객명, 전화번호, 휴대폰, 사업자번호로 전체 고객 검색..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                className="w-full px-6 py-4 pr-32 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-semibold shadow-sm border border-green-600"
                title="고객 목록 새로고침"
              >
                {refreshing ? (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    새로고침
                  </span>
                ) : (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    🔄 새로고침
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-600 mb-2">📊 전체 고객 수</div>
            <div className="text-3xl font-bold text-blue-600">
              {data.pagination.total.toLocaleString()}명
            </div>
          </div>
        </div>
      </div>

      {/* 고객 카드 목록 (3열6행 = 18개) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.data.map(customer => (
          <div key={customer.id} className="bg-white rounded-xl shadow-lg border-2 border-gray-200 hover:shadow-xl transition-shadow duration-300 relative">
            {/* 체크박스와 작업 버튼 */}
            <div className="absolute top-4 left-4 z-10">
              <input
                type="checkbox"
                checked={selectedIds.has(customer.id)}
                onChange={e => handleCheck(customer.id, e.target.checked)}
                className="w-6 h-6 text-blue-600 rounded border-2 border-gray-300 focus:ring-2 focus:ring-blue-500"
                title="고객 선택"
              />
            </div>
            
            {enableActions && (
              <div className="absolute top-4 right-4 z-10 flex space-x-2">
                <button
                  onClick={() => onEdit && onEdit(customer)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 text-base font-semibold shadow-lg"
                  title="수정"
                >
                  ✏️ 수정
                </button>
                <button
                  onClick={async () => {
                    const confirmMessage = `⚠️ 정말로 이 고객을 삭제하시겠습니까?\n\n고객명: ${customer.name}\n거래건수: ${customer.transaction_count ?? 0}건\n미수금: ${customer.total_unpaid ? customer.total_unpaid.toLocaleString() + '원' : '0원'}\n\n⚠️ 고객을 삭제하면 해당 고객의 모든 거래내역도 함께 삭제됩니다!\n이 작업은 되돌릴 수 없습니다.`;
                    
                    if (!window.confirm(confirmMessage)) return;
                    
                    try {
                      // Supabase 세션에서 토큰 가져오기
                      const { createClient } = await import('@supabase/supabase-js');
                      const supabase = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                      );
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token;
                      
                      if (!token) {
                        alert('인증이 필요합니다. 로그인을 다시 해주세요.');
                        return;
                      }
                      
                      const res = await fetch(`/api/customers?id=${customer.id}`, { 
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      });
                      
                      if (res.ok) {
                        alert('고객과 관련된 모든 데이터가 삭제되었습니다.');
                        fetchCustomers();
                      } else {
                        const { error } = await res.json();
                        alert('삭제 실패: ' + error);
                      }
                    } catch (error) {
                      console.error('삭제 중 오류:', error);
                      alert('삭제 중 오류가 발생했습니다.');
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 text-base font-semibold shadow-lg"
                  title="삭제"
                >
                  🗑️ 삭제
                </button>
              </div>
            )}

            {/* 카드 내용 */}
            <div className="p-6 pt-16">
                              {/* 고객 기본 정보 */}
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mb-4">
                                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                      👤 {customer.name}
                    </h3>
                  {customer.business_name && (
                    <span className="text-lg text-blue-600 font-semibold">
                      {customer.business_name}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-semibold text-blue-700 block mb-1">🏷️ 고객유형</span>
                    <span className="text-lg font-semibold text-blue-800">
                      {Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? 
                        customer.customer_type_multi.join(', ') : 
                        customer.customer_type || '-'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-blue-700 block mb-1">📊 거래건수</span>
                    <span className="text-xl font-bold text-purple-800">
                      {customer.transaction_count ?? 0}건
                    </span>
                  </div>
                </div>
              </div>

              {/* 미수금 정보 */}
              <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200 mb-4">
                                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-red-800 flex items-center gap-2">
                      💰 미수금
                    </h4>
                  <div className="text-right">
                    {customer.total_unpaid && customer.total_unpaid > 0 ? (
                      <span className="text-3xl font-bold text-red-700">
                        {customer.total_unpaid.toLocaleString()}원
                      </span>
                    ) : (
                      <span className="text-2xl text-gray-400">0원</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 연락처 정보 */}
              <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200 mb-4">
                <h4 className="text-lg font-bold text-indigo-800 mb-3 flex items-center gap-2">
                  📞 연락처
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.mobile && (
                    <div>
                      <span className="text-sm font-semibold text-indigo-700 block mb-1">📱 휴대폰</span>
                      <a
                        href={`tel:${customer.mobile.replace(/[^0-9]/g, '')}`}
                        className="text-lg text-indigo-600 underline hover:text-indigo-800 font-medium"
                      >
                        {customer.mobile}
                      </a>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <span className="text-sm font-semibold text-indigo-700 block mb-1">☎️ 일반전화</span>
                      <a
                        href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                        className="text-lg text-indigo-600 underline hover:text-indigo-800 font-medium"
                      >
                        {customer.phone}
                      </a>
                    </div>
                  )}
                  {customer.fax && (
                    <div>
                      <span className="text-sm font-semibold text-indigo-700 block mb-1">📠 팩스</span>
                      <span className="text-lg text-indigo-800">{customer.fax}</span>
                    </div>
                  )}
                </div>
                {!customer.mobile && !customer.phone && !customer.fax && (
                  <span className="text-lg text-gray-400">연락처 정보 없음</span>
                )}
              </div>

              {/* 주소 정보 */}
              <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200 mb-4">
                <h4 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                  🏠 주소
                </h4>
                <div className="space-y-3">
                  {customer.address_road && (
                    <div>
                      <span className="text-sm font-semibold text-green-700 block mb-1">도로명주소</span>
                      <button
                        onClick={() => openKakaoMap(customer.address_road!)}
                        className="text-lg text-green-600 underline hover:text-green-800 font-medium text-left block"
                        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        title="카카오맵에서 보기"
                      >
                        {customer.address_road}
                      </button>
                    </div>
                  )}
                  {customer.address_jibun && (
                    <div>
                      <span className="text-sm font-semibold text-green-700 block mb-1">지번주소</span>
                      <button
                        onClick={() => openKakaoMap(customer.address_jibun!)}
                        className="text-lg text-green-600 underline hover:text-green-800 font-medium text-left block"
                        style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        title="카카오맵에서 보기"
                      >
                        {customer.address_jibun}
                      </button>
                    </div>
                  )}
                  {customer.zipcode && (
                    <div>
                      <span className="text-sm font-semibold text-green-700 block mb-1">우편번호</span>
                      <span className="text-lg text-green-800">{customer.zipcode}</span>
                    </div>
                  )}
                  {!customer.address_road && !customer.address_jibun && !customer.zipcode && (
                    <span className="text-lg text-gray-400">주소 정보 없음</span>
                  )}
                </div>
              </div>

              {/* 추가 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 사업자 정보 */}
                <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                  <h5 className="text-base font-bold text-yellow-800 mb-2">🏢 사업자 정보</h5>
                  <div className="space-y-2">
                    {customer.business_no && (
                      <div>
                        <span className="text-sm font-semibold text-yellow-700 block">사업자번호</span>
                        <span className="text-base font-semibold text-yellow-800">{customer.business_no}</span>
                      </div>
                    )}
                    {customer.ssn && (
                      <div>
                        <span className="text-sm font-semibold text-yellow-700 block">주민등록번호</span>
                        <span className="text-base font-semibold text-yellow-800">{customer.ssn}</span>
                      </div>
                    )}
                    {!customer.business_no && !customer.ssn && (
                      <span className="text-base text-gray-400">사업자 정보 없음</span>
                    )}
                  </div>
                </div>

                {/* 사진 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                  <h5 className="text-base font-bold text-gray-800 mb-2">📷 사진</h5>
                  {customer.photos && customer.photos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {customer.photos.slice(0, 4).map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo.url}
                          alt="고객사진"
                          className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80 border-2 border-gray-300 shadow-sm"
                          onClick={() => window.open(photo.url, '_blank')}
                        />
                      ))}
                      {customer.photos.length > 4 && (
                        <div className="w-16 h-16 rounded-lg bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600">
                          +{customer.photos.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-base text-gray-400">사진 없음</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 데이터가 없을 때 */}
      {data.data.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg shadow-lg">
          <div className="text-2xl text-gray-400 font-semibold mb-4">
            {searchTerm ? '🔍 검색 결과가 없습니다' : '👥 등록된 고객이 없습니다'}
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
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-lg font-semibold"
            >
              🔄 검색 조건 초기화
            </button>
          )}
        </div>
      )}

      {/* 페이지네이션 */}
      {data.pagination.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <div className="text-center mb-6">
            <div className="text-lg font-semibold text-gray-600 mb-2">
              📄 페이지 정보
            </div>
            <div className="text-xl text-blue-600">
              {data.pagination.page} / {data.pagination.totalPages} 페이지
            </div>
          </div>
                      <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              totalItems={data.pagination.total}
              itemsPerPage={data.pagination.pageSize}
              onPageChange={handlePageChange}
              pageSizeOptions={[10, 18, 20, 30, 50]}
              className="mt-6"
            />
        </div>
      )}

      {/* 로딩 오버레이 */}
      {(loading || refreshing) && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              <div className="text-xl font-semibold text-gray-700">
                {refreshing ? '고객 목록을 새로고침하는 중...' : '고객 목록을 불러오는 중...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 메시지 */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-green-600 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <div className="font-bold text-lg">새로고침 완료!</div>
              <div className="text-sm opacity-90">고객 목록이 업데이트되었습니다.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PaginatedCustomerList(props: PaginatedCustomerListProps) {
  return (
    <Suspense fallback={<div>고객 목록 불러오는 중...</div>}>
      <PaginatedCustomerListInner {...props} />
    </Suspense>
  );
} 