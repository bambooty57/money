"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Download, PlusCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import TransactionForm from './transaction-form';
import ModelTypeManager from './model-type-manager';
import { usePaymentsRealtime } from '@/lib/usePaymentsRealtime';
import { supabase } from '@/lib/supabase';

// 디바운싱 유틸리티 함수
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 검색 히스토리 관리
interface SearchHistory {
  customerId: string;
  name: string;
  searchCount: number;
  lastSearched: Date;
}

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface TransactionWithCustomer {
  id: string;
  amount: number;
  payment_amount: number;
  payment_type: string;
  transaction_date: string;
  due_date: string;
  status: string;
  customers: Customer;
  model: string;
  model_type: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  data: TransactionWithCustomer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function TransactionList() {
  usePaymentsRealtime(); // 실시간 반영 추가
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  // 전체 집계 상태 추가
  const [globalSummary, setGlobalSummary] = useState<any>(null);
  const searchParams = useSearchParams();
  const urlRefreshKey = searchParams.get('refresh') || 0;
  const [modelTypeRefresh, setModelTypeRefresh] = useState(0);
  // 검색어 상태 추가
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [searchInputValue, setSearchInputValue] = useState(searchTerm);
  const [refreshing, setRefreshing] = useState(false);
  
  // 개선된 검색 관련 상태
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  
  // 페이지네이션 상태 추가
  const [page, setPage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('page');
      return p ? parseInt(p, 10) : 1;
    }
    return 1;
  });
  const pageSize = 15;

  const inputRef = useRef<HTMLInputElement>(null);

  // 검색 히스토리 로드
  useEffect(() => {
    const savedHistory = localStorage.getItem('customerSearchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setSearchHistory(parsed.map((item: any) => ({
          ...item,
          lastSearched: new Date(item.lastSearched)
        })));
      } catch (error) {
        console.error('검색 히스토리 로드 실패:', error);
      }
    }
  }, []);

  // 검색 히스토리 저장
  const saveSearchHistory = useCallback((customer: Customer) => {
    setSearchHistory(prev => {
      const existing = prev.find(h => h.customerId === customer.id);
      const updated = existing 
        ? prev.map(h => h.customerId === customer.id 
          ? { ...h, searchCount: h.searchCount + 1, lastSearched: new Date() }
          : h
        )
        : [...prev, {
          customerId: customer.id,
          name: customer.name,
          searchCount: 1,
          lastSearched: new Date()
        }];
      
      // 최대 20개로 제한하고 최신순으로 정렬
      const limited = updated
        .sort((a, b) => b.searchCount - a.searchCount || b.lastSearched.getTime() - a.lastSearched.getTime())
        .slice(0, 20);
      
      localStorage.setItem('customerSearchHistory', JSON.stringify(limited));
      return limited;
    });
  }, []);

  // 개선된 검색 함수 - 확장된 검색 필드
  const performSearch = useCallback((searchTerm: string) => {
    if (searchTerm.trim().length === 0) {
      setFilteredCustomers([]);
      setIsDropdownOpen(false);
      return;
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    const results = customers.filter(c => {
      // 기본 검색 필드
      const nameMatch = c.name?.toLowerCase().includes(normalizedSearch);
      const mobileMatch = c.mobile?.replace(/-/g, '').includes(normalizedSearch.replace(/-/g, ''));
      
      // 확장된 검색 필드
      const addressMatch = c.address?.toLowerCase().includes(normalizedSearch);
      const businessNameMatch = c.business_name?.toLowerCase().includes(normalizedSearch);
      const representativeNameMatch = c.representative_name?.toLowerCase().includes(normalizedSearch);
      const phoneMatch = c.phone?.replace(/-/g, '').includes(normalizedSearch.replace(/-/g, ''));
      
      return nameMatch || mobileMatch || addressMatch || businessNameMatch || representativeNameMatch || phoneMatch;
    });

    // 검색 히스토리 기반 정렬
    const sortedResults = results.sort((a, b) => {
      const aHistory = searchHistory.find(h => h.customerId === a.id);
      const bHistory = searchHistory.find(h => h.customerId === b.id);
      
      // 검색 히스토리가 있는 고객을 우선 표시
      if (aHistory && !bHistory) return -1;
      if (!aHistory && bHistory) return 1;
      if (aHistory && bHistory) {
        // 검색 횟수로 정렬, 같으면 최근 검색순
        if (aHistory.searchCount !== bHistory.searchCount) {
          return bHistory.searchCount - aHistory.searchCount;
        }
        return bHistory.lastSearched.getTime() - aHistory.lastSearched.getTime();
      }
      
      // 히스토리가 없는 경우 이름순
      return a.name.localeCompare(b.name);
    });

    setFilteredCustomers(sortedResults.slice(0, 20));
    setIsDropdownOpen(sortedResults.length > 0);
    setSelectedIndex(-1);
  }, [customers, searchHistory]);

  // 디바운싱된 검색 함수
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );

  // 검색 입력 처리
  const handleSearchInput = useCallback((value: string) => {
    debouncedSearch(value);
  }, [debouncedSearch]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredCustomers[selectedIndex]) {
          handleCustomerSelect(filteredCustomers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isDropdownOpen, filteredCustomers, selectedIndex]);

  // 고객 선택 처리
  const handleCustomerSelect = useCallback((customer: Customer) => {
    setFilteredCustomers([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    saveSearchHistory(customer);
    // 고객 선택 시 해당 고객의 거래만 필터링
    setSearchInputValue(customer.name);
    setSearchTerm(customer.name);
  }, [saveSearchHistory]);

  // page가 바뀌면 URL도 동기화
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', page.toString());
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [page]);

  useEffect(() => {
    router.refresh();
  }, [urlRefreshKey]);

  // 검색 입력 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputValue !== searchTerm) {
        setSearchTerm(searchInputValue);
        setPage(1); // 검색 시 첫 페이지로
      }
    }, 300); // 300ms 디바운싱

    return () => clearTimeout(timer);
  }, [searchInputValue, searchTerm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 검색어 초기화
      setSearchInputValue('');
      setSearchTerm('');
      setPage(1);
      
      // 데이터 새로고침
      await fetchData();
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setRefreshing(false);
    }
  };

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // 고객 목록과 거래 데이터를 병렬로 가져오기
      const [customersResponse, transactionsResponse, summariesResponse] = await Promise.all([
        fetch('/api/customers?page=1&pageSize=1000'),
        fetch(`/api/transactions?page=${page}&pageSize=${pageSize}&search=${searchTerm}`),
        fetch('/api/transactions/summary')
      ]);

      const [customersData, transactionsData, summariesData] = await Promise.all([
        customersResponse.json(),
        transactionsResponse.json(),
        summariesResponse.json()
      ]);

      if (customersResponse.ok) {
        setCustomers(customersData.data || []);
      }

      if (transactionsResponse.ok) {
        setData(transactionsData);
      }

      if (summariesResponse.ok) {
        setSummaries(summariesData.data || []);
        setGlobalSummary(summariesData.global || {});
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      setError('데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  const handleExcelDownload = () => {
    if (!data?.data) return;
    
    const excelRows = data.data.map(transaction => ({
      '거래일자': transaction.created_at?.slice(0, 10) || '',
      '고객명': transaction.customers?.name || '',
      '거래명': transaction.payment_type || '',
      '기종/모델': `${transaction.model || ''}${transaction.model && transaction.model_type ? '/' : ''}${transaction.model_type || ''}`,
      '거래금액': transaction.amount || 0,
      '입금금액': transaction.payment_amount || 0,
      '미수금액': (transaction.amount || 0) - (transaction.payment_amount || 0),
      '상태': transaction.status || '',
      '등록일': transaction.created_at?.slice(0, 10) || '',
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래목록');
    XLSX.writeFile(wb, `거래목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 초기 데이터 로딩
  useEffect(() => {
    fetchData();
  }, [page, searchTerm, urlRefreshKey]);

  // 집계 데이터 계산
  const totalCount = data?.pagination?.total || 0;
  const totalCustomerCount = customers.length;
  const totalSales = globalSummary?.total_amount || 0;
  const totalPaid = globalSummary?.total_paid || 0;
  const totalUnpaid = globalSummary?.total_unpaid || 0;
  const totalRatio = totalSales > 0 ? Math.round((totalPaid / totalSales) * 100) : 0;

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

  if (error) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  return (
    <div className="overflow-x-auto">
      {/* 전체 고객 검색 UI */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="flex-1 max-w-2xl">
            <label className="block text-xl font-bold text-gray-700 mb-3">
              🔍 전체 고객 검색
            </label>
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="고객명/전화번호/주소/회사명으로 검색"
                value={searchInputValue}
                onChange={(e) => {
                  setSearchInputValue(e.target.value);
                  handleSearchInput(e.target.value);
                }}
                onKeyDown={handleKeyDown}
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
              {isDropdownOpen && (
                <ul className="absolute left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 max-h-72 overflow-y-auto text-lg">
                  {filteredCustomers.map((c, index) => {
                    const history = searchHistory.find(h => h.customerId === c.id);
                    return (
                      <li
                        key={c.id}
                        className={`px-4 py-3 hover:bg-blue-100 cursor-pointer ${selectedIndex === index ? 'bg-blue-100 font-bold' : ''}`}
                        onClick={() => handleCustomerSelect(c)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onMouseLeave={() => setSelectedIndex(-1)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{c.name}</span>
                              {history && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  🔍 {history.searchCount}회
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500 text-base mt-1">
                              {c.mobile && <span className="mr-3">📱 {c.mobile}</span>}
                              {c.phone && <span className="mr-3">📞 {c.phone}</span>}
                              {c.address && <span className="mr-3">📍 {c.address}</span>}
                              {c.business_name && <span className="text-sm">🏢 {c.business_name}</span>}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {filteredCustomers.length === 0 && searchInputValue.trim().length > 0 && (
                    <li className="px-4 py-3 text-gray-500 text-lg">검색 결과 없음</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 상단 요약 집계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
          <div className="text-xs text-gray-600 mb-1">전체 고객</div>
          <div className="text-lg font-bold text-blue-700">{totalCustomerCount}명</div>
        </div>
        <div className="bg-blue-100 rounded-lg p-3 text-center border border-blue-300">
          <div className="text-xs text-gray-600 mb-1">전체 거래</div>
          <div className="text-lg font-bold text-blue-800">{totalCount}건</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
          <div className="text-xs text-gray-600 mb-1">총 매출액</div>
          <div className="text-lg font-bold text-green-700">{totalSales.toLocaleString()}원</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-200">
          <div className="text-xs text-gray-600 mb-1">총 입금액</div>
          <div className="text-lg font-bold text-indigo-700">{totalPaid.toLocaleString()}원</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
          <div className="text-xs text-gray-600 mb-1">총 미수금</div>
          <div className="text-lg font-bold text-red-700">{totalUnpaid.toLocaleString()}원</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
          <div className="text-xs text-gray-600 mb-1">입금률</div>
          <div className="text-lg font-bold text-yellow-700">{totalRatio}%</div>
        </div>
      </div>
      <div className="flex justify-end mb-4 gap-3">
        <button
          onClick={handleExcelDownload}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-base rounded-lg hover:bg-green-700 font-medium shadow-md"
        >
          <Download className="mr-2 h-4 w-4" />
          엑셀 다운로드
        </button>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-700 font-medium shadow-md"
              onClick={() => setFormOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> 신규 거래 등록
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">신규 거래 등록</DialogTitle>
            </DialogHeader>
            <TransactionForm 
              onSuccess={() => { 
                setFormOpen(false); 
                setTimeout(() => window.location.reload(), 700); 
              }} 
              refresh={modelTypeRefresh}
              onPaymentSuccess={() => window.location.reload()}
            />
          </DialogContent>
        </Dialog>
        <Dialog onOpenChange={open => { if (!open) setModelTypeRefresh(r => r + 1) }}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-base rounded-lg hover:bg-gray-700 font-medium shadow-md"
            >
              기종/형식명 관리
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">기종/형식명 관리</DialogTitle>
            </DialogHeader>
            <ModelTypeManager onChange={() => setModelTypeRefresh(r => r + 1)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <Table className="table-fixed w-full text-lg border-collapse bg-white rounded-lg shadow-lg">
          <TableHeader className="bg-gray-100">
            <TableRow className="h-16">
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-center whitespace-nowrap overflow-hidden text-ellipsis">고객명</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[80px] max-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">거래건수</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">총 매출액</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">입금액</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">미수금</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[80px] max-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">입금%</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-16 min-w-[60px] max-w-[60px] text-center whitespace-nowrap overflow-hidden text-ellipsis">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {customers.map((c, i) => {
              const summary = summaries[customers.findIndex(x => x.id === c.id)] || {};
              // transaction_count를 우선 사용, 없으면 기존 방식
              const transactionCount = summary.transaction_count || 0;
              return (
                <TableRow key={c.id} className="hover:bg-blue-50 cursor-pointer border-b border-gray-200 h-16">
                  <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-blue-700 underline font-medium w-32 min-w-[120px] max-w-[160px] text-center overflow-hidden text-ellipsis" onClick={() => router.push(`/customers/${c.id}/transactions`)}>{c.name}</TableCell>
                  <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 w-24 min-w-[80px] max-w-[100px] text-center overflow-hidden text-ellipsis">{transactionCount}건</TableCell>
                  <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">{(summary.total_amount || 0).toLocaleString()}원</TableCell>
                  <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-green-700 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">{(summary.total_paid || 0).toLocaleString()}원</TableCell>
                  <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-red-700 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">{(summary.total_unpaid || 0).toLocaleString()}원</TableCell>
                  <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-24 min-w-[80px] max-w-[100px] text-center overflow-hidden text-ellipsis">
                    {summary.total_ratio || 0}%
                  </TableCell>
                  <TableCell className="border-2 border-gray-300 px-4 py-4 w-16 min-w-[60px] max-w-[60px] text-center overflow-hidden text-ellipsis">
                    <button
                      className="text-red-600 hover:text-red-900 text-lg p-1 hover:bg-red-50 rounded transition-colors"
                      title="거래 삭제"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm('정말로 이 거래를 삭제하시겠습니까?')) return;
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          const token = session?.access_token;
                          if (!token) {
                            alert('인증이 필요합니다. 다시 로그인해주세요.');
                            return;
                          }
                          const res = await fetch(`/api/transactions?id=${summary.transactions?.[0]?.id}`, { 
                            method: 'DELETE',
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          });
                          if (res.ok) {
                            setTimeout(() => window.location.reload(), 700);
                            alert('삭제되었습니다.');
                          } else {
                            const errorText = await res.text();
                            alert('삭제 실패: ' + errorText);
                          }
                        } catch (error) {
                          console.error('거래 삭제 중 오류:', error);
                          alert('거래 삭제 중 오류가 발생했습니다.');
                        }
                      }}
                    >🗑️</button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {/* 페이지네이션: 15개 단위 */}
      {totalCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalCustomerCount / pageSize)}
            totalItems={totalCustomerCount}
            itemsPerPage={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
} 