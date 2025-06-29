"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Pagination, usePagination } from '@/components/ui/pagination';
import type { Customer } from '@/types/database';
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

export function PaginatedCustomerList({ 
  onEdit, 
  onDelete, 
  enableActions = false,
  onSelectCustomer
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

  // 상세/삭제 상태 관리
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [detailSummary, setDetailSummary] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // 상세 fetch
  const handleDetail = async (customer: any) => {
    setDetailOpen(true);
    setDetailCustomer(null);
    setDetailSummary(null);
    setDetailLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/customers/${customer.id}`),
        fetch(`/api/customers/${customer.id}/summary`)
      ]);
      const data1 = await res1.json();
      const data2 = await res2.json();
      setDetailCustomer(data1);
      setDetailSummary(data2);
    } catch (e) {
      setDetailCustomer({ error: '상세 정보를 불러오지 못했습니다.' });
    } finally {
      setDetailLoading(false);
    }
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!window.confirm('정말로 이 고객을 삭제하시겠습니까?')) return;
    setDeleteLoading(id);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      fetchCustomers();
    } catch (e) {
      alert('삭제 중 오류 발생');
    } finally {
      setDeleteLoading(null);
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
      <div className="flex justify-end mb-2">
        <button onClick={handleExcelDownload} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">엑셀 다운로드</button>
        <a ref={downloadRef} style={{ display: 'none' }} />
      </div>
      {/* 검색 및 필터 영역 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex-1 max-w-md">
          <Input
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>거래처명</TableHead>
                <TableHead>거래건수</TableHead>
                <TableHead>총미수금</TableHead>
                <TableHead>고객유형</TableHead>
                <TableHead>주소</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>주민등록번호</TableHead>
                <TableHead>사업자번호</TableHead>
                <TableHead>사진</TableHead>
                {enableActions && (
                  <TableHead>작업</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map(customer => (
                <TableRow key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(customer.id)}
                      onChange={e => handleCheck(customer.id, e.target.checked)}
                      className="mr-2"
                      title="고객 선택"
                    />
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900 cursor-pointer underline" onClick={() => handleDetail(customer)}>{customer.name}</div>
                    <div className="text-sm text-gray-500">{customer.business_name || ''}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-center">{customer.transaction_count ?? 0}건</TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    {customer.total_unpaid && customer.total_unpaid > 0 ? (
                      <span>{customer.total_unpaid.toLocaleString()}원</span>
                    ) : (
                      <span className="text-gray-400">0원</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div>
                      {customer.address_road ? (
                        <button
                          onClick={() => openKakaoMap(customer.address_road!)}
                          className="text-blue-600 underline hover:text-blue-800"
                          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                          title="카카오맵에서 보기"
                        >
                          {customer.address_road}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div>
                      {customer.address_jibun ? (
                        <button
                          onClick={() => openKakaoMap(customer.address_jibun!)}
                          className="text-blue-600 underline hover:text-blue-800"
                          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                          title="카카오맵에서 보기"
                        >
                          {customer.address_jibun}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div>
                      {customer.mobile ? (
                        <a
                          href={`tel:${customer.mobile.replace(/[^0-9]/g, '')}`}
                          className="text-blue-600 underline hover:text-blue-800"
                          style={{ wordBreak: 'break-all' }}
                        >
                          {customer.mobile}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div>
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                          className="text-blue-600 underline hover:text-blue-800"
                          style={{ wordBreak: 'break-all' }}
                        >
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div>{customer.fax || ''}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">{customer.ssn}</TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">{customer.business_no}</TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
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
                  </TableCell>
                  {enableActions && (
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onEdit && onEdit(customer)}
                          className="text-green-600 hover:text-green-900"
                          title="수정"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-600 hover:text-red-900"
                          title="삭제"
                          disabled={deleteLoading === customer.id}
                        >{deleteLoading === customer.id ? '...' : '🗑️'}</button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      {/* 수신자 선택: 체크된 고객만 표시 */}
      <div className="mt-4 p-3 bg-gray-50 rounded border text-sm">
        <div className="font-semibold mb-1">수신자 선택</div>
        <ul className="space-y-1">
          {checkedCustomers.length === 0 ? (
            <li className="text-gray-400">선택된 고객이 없습니다.</li>
          ) : (
            checkedCustomers.map(c => (
              <li key={c.id}>
                {c.name} {c.mobile ? `(${c.mobile})` : ''}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 고객 상세 모달 */}
      <CustomerDetailModal customer={detailCustomer} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  );
} 