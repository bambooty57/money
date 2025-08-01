"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';
import type { Database } from '@/types/database';
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
import { useTransactionsRealtime } from '@/lib/useTransactionsRealtime';
import { supabase } from '@/lib/supabase';



// 검색 히스토리 관리
interface SearchHistory {
  customerId: string;
  name: string;
  searchCount: number;
  lastSearched: Date;
}

type Customer = Database['public']['Tables']['customers']['Row'] & {
  total_unpaid?: number;
  transaction_count?: number;
};

interface SummaryData {
  customer_id: string;
  transaction_count: number;
  total_amount: number;
  total_paid: number;
  total_unpaid: number;
  total_ratio: number;
}

interface GlobalSummary {
  total_amount: number;
  total_paid: number;
  total_unpaid: number;
}

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
  payments?: { amount: number; payment_type: string; payment_date: string; id: string }[];
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
  useTransactionsRealtime(); // 실시간 반영 추가
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [summaries, setSummaries] = useState<SummaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  // 전체 집계 상태 추가
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(null);
  const searchParams = useSearchParams();
  const urlRefreshKey = searchParams.get('refresh') || 0;
  const [modelTypeRefresh, setModelTypeRefresh] = useState(0);
  // 검색어 상태 추가
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [searchInputValue, setSearchInputValue] = useState(searchTerm);
  const [refreshing, setRefreshing] = useState(false);
  
  // clear 파라미터 처리
  const clearParam = searchParams.get('clear');
  
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
  const pageSize = 20; // 15에서 20으로 변경

  const inputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 검색 히스토리 로드
  useEffect(() => {
    const savedHistory = localStorage.getItem('customerSearchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setSearchHistory(parsed.map((item: {customerId: string; name: string; searchCount: number; lastSearched: string | Date}) => ({
          ...item,
          lastSearched: new Date(item.lastSearched)
        })));
      } catch (error) {
        console.error('검색 히스토리 로드 실패:', error);
      }
    }
  }, []);

  // clear 파라미터 처리 - 검색 상태 초기화
  useEffect(() => {
    if (clearParam === '1') {
      setSearchInputValue('');
      setSearchTerm('');
      setPage(1);
      setFilteredCustomers([]);
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      
      // URL에서 clear 파라미터 제거
      const params = new URLSearchParams(window.location.search);
      params.delete('clear');
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [clearParam]);



  // 간단한 고객 선택 처리
  const handleCustomerSelect = useCallback(async (customer: Customer) => {
    setFilteredCustomers([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    
    // 선택한 고객명을 입력란에 설정
    setSearchInputValue(customer.name);
    setSearchTerm(customer.name);
    setPage(1);
    
    // URL 파라미터 업데이트
    const params = new URLSearchParams(window.location.search);
    params.set('search', customer.name);
    params.set('page', '1');
    window.history.replaceState(null, '', `?${params.toString()}`);
    
    // 해당 고객의 거래 데이터만 가져오기
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/transactions?search=${encodeURIComponent(customer.name)}&page=1&pageSize=${pageSize}`);
      
      if (!response.ok) {
        throw new Error('거래 데이터를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      setData(data);
      
    } catch (error) {
      console.error('고객 선택 후 데이터 로딩 실패:', error);
      setError('데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // 간단하고 확실한 검색 함수
  const performSearch = useCallback((searchTerm: string) => {
    if (searchTerm.trim().length === 0) {
      setFilteredCustomers([]);
      setIsDropdownOpen(false);
      return;
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // 고객명으로만 검색 (간단하게)
    const results = customers.filter(c => 
      c.name?.toLowerCase().includes(normalizedSearch)
    );

    setFilteredCustomers(results.slice(0, 10));
    setIsDropdownOpen(results.length > 0);
    setSelectedIndex(-1);
  }, [customers]);

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
  }, [isDropdownOpen, filteredCustomers, selectedIndex, handleCustomerSelect]);

  // page가 바뀌면 URL도 동기화
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', page.toString());
    if (searchTerm) {
      params.set('search', searchTerm);
    } else {
      params.delete('search');
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [page, searchTerm]);

  useEffect(() => {
    router.refresh();
  }, [router, urlRefreshKey]);

  // 개선된 데이터 로딩 함수
  const fetchDataCallback = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 고객 데이터 로드 (검색용) - 항상 필요
      const customersResponse = await fetch('/api/customers?page=1&pageSize=1000');
      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData.data || []);
      }
      
      if (searchTerm.trim()) {
        // 🔍 검색어가 있을 때: 해당 고객의 거래 데이터만 로드
        const transactionsResponse = await fetch(`/api/transactions?search=${encodeURIComponent(searchTerm.trim())}&page=${page}&pageSize=${pageSize}`);
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          setData(transactionsData);
          // 검색 시에는 summaries 데이터 클리어
          setSummaries([]);
          setGlobalSummary(null);
        } else {
          // 검색 실패 시
          setData(null);
          setSummaries([]);
          setGlobalSummary(null);
        }
      } else {
        // 📊 검색어가 없을 때: 전체 요약 데이터 로드
        const summariesResponse = await fetch('/api/transactions/summary');
        if (summariesResponse.ok) {
          const summariesData = await summariesResponse.json();
          setSummaries(summariesData.data || []);
          setGlobalSummary(summariesData.global || {});
          // 일반 모드에서는 거래 데이터 클리어
          setData(null);
        }
      }
      
    } catch (err) {
      console.error('데이터 로딩 중 오류:', err);
      setError('데이터를 불러오는데 실패했습니다.');
      // 오류 시 모든 데이터 클리어
      setData(null);
      setSummaries([]);
      setGlobalSummary(null);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, page, pageSize]);

  // 🔄 데이터 로딩 트리거 (검색어, 페이지, URL 새로고침 시)
  useEffect(() => {
    fetchDataCallback();
  }, [searchTerm, page, urlRefreshKey, fetchDataCallback]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 검색어 초기화
      setSearchInputValue('');
      setSearchTerm('');
      setPage(1);
      
      // 데이터 새로고침
      await fetchDataCallback();
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setRefreshing(false);
    }
  };

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

  // 📊 일반 모드 페이지네이션 데이터 (검색어가 없을 때만)
  const paginatedData = useMemo(() => {
    if (searchTerm.trim()) {
      // 🔍 검색 모드: 페이지네이션 없이 data.data 사용
      return [];
    } else {
      // 📊 일반 모드: 20개씩 페이지네이션
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return summaries.slice(startIndex, endIndex);
    }
  }, [summaries, searchTerm, page, pageSize]);

  // 전체 집계 데이터 계산
  const totalCount = searchTerm.trim() ? (data?.data?.length || 0) : summaries.length;
  const totalCustomerCount = customers.length;
  const totalSales = globalSummary?.total_amount || 0;
  const totalPaid = globalSummary?.total_paid || 0;
  const totalUnpaid = globalSummary?.total_unpaid || 0;
  const totalRatio = totalSales > 0 ? Math.round((totalPaid / totalSales) * 100) : 0;

  // 검색 중일 때만 로딩 표시
  if (loading && !data && !searchTerm) {
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
              🔍 고객 검색 및 거래 조회
            </label>
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="고객명/전화번호/주소/회사명으로 검색 후 선택하세요"
                value={searchInputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchInputValue(value);
                  
                  // 1자 이상 입력 시 드롭다운 표시
                  if (value.trim().length >= 1) {
                    performSearch(value);
                  } else {
                    setFilteredCustomers([]);
                    setIsDropdownOpen(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (searchInputValue.trim().length >= 1) {
                    setIsDropdownOpen(true);
                  }
                }}
                className="w-full px-6 py-4 pr-32 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-semibold shadow-sm border border-green-600"
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
              {isDropdownOpen && searchInputValue.trim().length >= 1 && (
                <ul className="absolute left-0 right-0 bg-white border-2 border-blue-200 rounded-lg shadow-xl z-10 mt-1 max-h-80 overflow-y-auto text-lg">
                  {filteredCustomers.map((c, index) => {
                    const history = searchHistory.find(h => h.customerId === c.id);
                    return (
                      <li
                        key={c.id}
                        className={`px-4 py-4 hover:bg-blue-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${selectedIndex === index ? 'bg-blue-100 font-bold' : ''}`}
                        onClick={() => handleCustomerSelect(c)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onMouseLeave={() => setSelectedIndex(-1)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-lg text-blue-800">{c.name}</span>
                              {history && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                  🔍 {history.searchCount}회
                                </span>
                              )}
                              {c.total_unpaid && c.total_unpaid > 0 && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                  💰 미수금
                                </span>
                              )}
                            </div>
                            <div className="text-gray-600 text-base space-y-1">
                              {c.mobile && <div className="flex items-center gap-2">📱 {c.mobile}</div>}
                              {c.phone && <div className="flex items-center gap-2">📞 {c.phone}</div>}
                              {c.address && <div className="flex items-center gap-2">📍 {c.address}</div>}
                              {c.business_name && <div className="flex items-center gap-2">🏢 {c.business_name}</div>}
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="text-purple-600">거래: {c.transaction_count ?? 0}건</span>
                                <span className="text-red-600">미수금: {c.total_unpaid?.toLocaleString() ?? '0'}원</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <div>클릭하여 선택</div>
                            <div className="text-xs">Enter 키로도 선택 가능</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {filteredCustomers.length === 0 && searchInputValue.trim().length >= 1 && (
                    <li className="px-4 py-4 text-gray-500 text-lg text-center">
                      <div className="mb-2">🔍 검색 결과가 없습니다</div>
                      <div className="text-sm text-gray-400">다른 검색어를 입력해보세요</div>
                    </li>
                  )}
                  {searchInputValue.trim().length === 0 && isDropdownOpen && (
                    <li className="px-4 py-4 text-gray-500 text-lg text-center">
                      <div className="mb-2">💡 검색어를 입력하세요</div>
                      <div className="text-sm text-gray-400">고객명, 전화번호, 주소, 회사명으로 검색 가능</div>
                    </li>
                  )}
                </ul>
              )}
            </div>
            {searchTerm && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-green-800">
                      ✅ 선택된 고객: {searchTerm}
                    </div>
                    <div className="text-sm text-green-600">
                      해당 고객의 거래 내역을 조회 중입니다
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSearchInputValue('');
                        setSearchTerm('');
                        setPage(1);
                        handleRefresh();
                        
                        // URL 파라미터도 정리
                        const params = new URLSearchParams(window.location.search);
                        params.delete('search');
                        params.delete('page');
                        window.history.replaceState(null, '', `?${params.toString()}`);
                      }}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                    >
                      검색 초기화
                    </button>
                    <button
                      onClick={() => {
                        // 현재 검색어로 고객 상세 페이지로 이동
                        const selectedCustomer = customers.find(c => c.name === searchTerm);
                        if (selectedCustomer) {
                          router.push(`/customers/${selectedCustomer.id}/transactions`);
                        }
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                    >
                      고객 상세보기
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 선택된 고객 상세 정보 표시 - 제거 */}
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-600 mb-2">📊 전체 고객 수</div>
            <div className="text-3xl font-bold text-blue-600">
              {totalCustomerCount.toLocaleString()}명
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
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                {searchTerm ? '고객명 (검색결과)' : '고객명'}
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[80px] max-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                {searchTerm ? '거래건수' : '거래건수'}
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">
                {searchTerm ? '거래금액' : '총 매출액'}
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">
                {searchTerm ? '입금액' : '입금액'}
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 min-w-[120px] max-w-[160px] text-right whitespace-nowrap overflow-hidden text-ellipsis">
                {searchTerm ? '미수금' : '미수금'}
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 min-w-[80px] max-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                {searchTerm ? '입금%' : '입금%'}
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-16 min-w-[60px] max-w-[60px] text-center whitespace-nowrap overflow-hidden text-ellipsis">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {/* 🔍 검색 모드: 검색어가 있을 때 */}
            {searchTerm.trim() ? (
              loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="border-2 border-gray-300 px-4 py-8 text-center text-lg text-gray-500">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                      <span>&quot;{searchTerm}&quot; 고객을 검색 중...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.data && data.data.length > 0 ? (
                <>
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={7} className="border-2 border-gray-300 px-4 py-3 text-center text-lg font-bold text-blue-800">
                      🔍 &quot;{searchTerm}&quot; 고객의 거래 내역 ({data.data.length}건)
                    </TableCell>
                  </TableRow>
                  {data.data.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-blue-50 cursor-pointer border-b border-gray-200 h-16">
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-blue-700 underline font-medium w-32 min-w-[120px] max-w-[160px] text-center overflow-hidden text-ellipsis" onClick={() => router.push(`/customers/${transaction.customers.id}/transactions`)}>
                        {transaction.customers.name}
                      </TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 w-24 min-w-[80px] max-w-[100px] text-center overflow-hidden text-ellipsis">
                        1건
                      </TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">
                        {transaction.amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-green-700 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">
                        {transaction.payment_amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">
                        {(transaction.amount - transaction.payment_amount).toLocaleString()}원
                      </TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-24 min-w-[80px] max-w-[100px] text-center overflow-hidden text-ellipsis">
                        {transaction.amount > 0 ? Math.round((transaction.payment_amount / transaction.amount) * 100) : 0}%
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
                              const res = await fetch(`/api/transactions/${transaction.id}`, { 
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              if (res.ok) {
                                // 검색 결과를 즉시 업데이트
                                fetchDataCallback();
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
                        >
                          🗑️
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="border-2 border-gray-300 px-4 py-8 text-center text-lg text-gray-500">
                    <div className="mb-2">🔍 &quot;{searchTerm}&quot; 고객의 거래를 찾을 수 없습니다.</div>
                    <div className="text-base text-gray-400 mb-4">다른 고객을 검색해보세요.</div>
                    <button
                      onClick={() => {
                        setSearchInputValue('');
                        setSearchTerm('');
                        setPage(1);
                        
                        // URL 파라미터도 정리
                        const params = new URLSearchParams(window.location.search);
                        params.delete('search');
                        params.delete('page');
                        window.history.replaceState(null, '', `?${params.toString()}`);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-semibold"
                    >
                      🔄 전체 고객 목록으로 돌아가기
                    </button>
                  </TableCell>
                </TableRow>
              )
            ) : (
              /* 📊 일반 모드: 검색어가 없을 때 전체 고객 요약 표시 */
              <>
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={7} className="border-2 border-gray-300 px-4 py-3 text-center text-lg font-bold text-gray-800">
                    📊 전체 고객 거래 요약 ({totalCustomerCount}명)
                  </TableCell>
                </TableRow>
                {paginatedData.map((summary) => {
                  const customer = customers.find(c => c.id === summary.customer_id);
                  if (!customer) return null;
                  
                  return (
                    <TableRow key={summary.customer_id} className="hover:bg-blue-50 cursor-pointer border-b border-gray-200 h-16">
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-blue-700 underline font-medium w-32 min-w-[120px] max-w-[160px] text-center overflow-hidden text-ellipsis" onClick={() => router.push(`/customers/${customer.id}/transactions`)}>{customer.name}</TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 w-24 min-w-[80px] max-w-[100px] text-center overflow-hidden text-ellipsis">{summary.transaction_count}건</TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">{summary.total_amount.toLocaleString()}원</TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-green-700 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">{summary.total_paid.toLocaleString()}원</TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-32 min-w-[120px] max-w-[160px] text-right overflow-hidden text-ellipsis">{summary.total_unpaid.toLocaleString()}원</TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 whitespace-nowrap text-base text-gray-900 font-semibold w-24 min-w-[80px] max-w-[100px] text-center overflow-hidden text-ellipsis">
                        {summary.total_ratio}%
                      </TableCell>
                      <TableCell className="border-2 border-gray-300 px-4 py-4 w-16 min-w-[60px] max-w-[60px] text-center overflow-hidden text-ellipsis">
                        <button
                          className="text-red-600 hover:text-red-900 text-lg p-1 hover:bg-red-50 rounded transition-colors"
                          title="고객 삭제"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm('정말로 이 고객의 모든 거래를 삭제하시겠습니까?')) return;
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const token = session?.access_token;
                              if (!token) {
                                alert('인증이 필요합니다. 다시 로그인해주세요.');
                                return;
                              }
                              // 해당 고객의 모든 거래 삭제
                              const res = await fetch(`/api/transactions?customer_id=${summary.customer_id}`, { 
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              if (res.ok) {
                                // 전체 데이터를 즉시 업데이트
                                fetchDataCallback();
                                alert('삭제되었습니다.');
                              } else {
                                const errorText = await res.text();
                                alert('삭제 실패: ' + errorText);
                              }
                            } catch (error) {
                              console.error('고객 거래 삭제 중 오류:', error);
                              alert('고객 거래 삭제 중 오류가 발생했습니다.');
                            }
                          }}
                        >🗑️</button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      {/* 📄 페이지네이션: 검색어가 없을 때만 표시 */}
      {!searchTerm.trim() && summaries.length > 0 && (
        <div className="flex justify-center my-8">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(summaries.length / pageSize)}
            totalItems={summaries.length}
            itemsPerPage={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
} 