"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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





export function TransactionList() {
  useTransactionsRealtime(); // 실시간 반영 추가
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summaries, setSummaries] = useState<SummaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(null);
  const [modelTypeRefresh, setModelTypeRefresh] = useState(0);
  // 단순한 검색 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // 페이지네이션 상태
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;





















  // 데이터 로딩 함수 (단순화)
  const fetchDataCallback = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 고객 데이터 로드
      const customersResponse = await fetch('/api/customers?page=1&pageSize=1000');
      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData.data || []);
      }
      
      // 전체 요약 데이터 로드
      const summariesResponse = await fetch('/api/transactions/summary');
      if (summariesResponse.ok) {
        const summariesData = await summariesResponse.json();
        setSummaries(summariesData.data || []);
        setGlobalSummary(summariesData.global || {});
      }
      
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
      setCustomers([]);
      setSummaries([]);
      setGlobalSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 데이터 로딩
  useEffect(() => {
    fetchDataCallback();
  }, [fetchDataCallback]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setSearchTerm('');
      setPage(1);
      await fetchDataCallback();
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExcelDownload = () => {
    const dataToExport = filteredSummaries.map(summary => {
      const customer = customers.find(c => c.id === summary.customer_id);
      return {
        '고객명': customer?.name || '',
        '거래건수': summary.transaction_count || 0,
        '총 매출액': summary.total_amount || 0,
        '입금액': summary.total_paid || 0,
        '미수금': summary.total_unpaid || 0,
        '입금률': summary.total_ratio || 0,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '고객거래목록');
    XLSX.writeFile(wb, `고객거래목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 🔍 단순한 고객명 필터링
  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) {
      return summaries;
    }

    return summaries.filter(summary => {
      const customer = customers.find(c => c.id === summary.customer_id);
      return customer?.name?.toLowerCase().includes(searchTerm.toLowerCase().trim());
    });
  }, [searchTerm, summaries, customers]);

  // 📄 페이지네이션 적용
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredSummaries.slice(startIndex, endIndex);
  }, [filteredSummaries, page, pageSize]);

  // 전체 집계 데이터 계산
  const totalCount = filteredSummaries.length;
  const totalCustomerCount = customers.length;
  const totalSales = globalSummary?.total_amount || 0;
  const totalPaid = globalSummary?.total_paid || 0;
  const totalUnpaid = globalSummary?.total_unpaid || 0;
  const totalRatio = totalSales > 0 ? Math.round((totalPaid / totalSales) * 100) : 0;

  // 로딩 화면
  if (loading) {
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
      {/* 🔍 단순한 검색 UI */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="flex-1 max-w-2xl">
            <label className="block text-xl font-bold text-gray-700 mb-3">
              🔍 고객명 검색
            </label>
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="고객명을 입력하세요..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // 검색 시 첫 페이지로
                }}
                className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-semibold"
                title="검색 초기화"
              >
                초기화
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                title="데이터 새로고침"
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  '새로고침'
                )}
              </button>
            </div>
            {searchTerm && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-700">
                  🔍 &quot;<strong>{searchTerm}</strong>&quot; 검색 결과: {totalCount}명
                </div>
              </div>
            )}
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
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 text-center">
                고객명
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 text-center">
                거래건수
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 text-right">
                총 매출액
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 text-right">
                입금액
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-32 text-right">
                미수금
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-24 text-center">
                입금%
              </TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 w-16 text-center">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {searchTerm && (
              <TableRow className="bg-blue-50">
                <TableCell colSpan={7} className="border-2 border-gray-300 px-4 py-3 text-center text-lg font-bold text-blue-800">
                  🔍 &quot;{searchTerm}&quot; 검색 결과 ({totalCount}명)
                </TableCell>
              </TableRow>
            )}
            {paginatedData.length > 0 ? (
              paginatedData.map((summary) => {
                const customer = customers.find(c => c.id === summary.customer_id);
                if (!customer) return null;
                
                return (
                  <TableRow key={summary.customer_id} className="hover:bg-blue-50 cursor-pointer border-b border-gray-200 h-16">
                    <TableCell 
                      className="border-2 border-gray-300 px-4 py-4 text-base text-blue-700 underline font-medium text-center cursor-pointer" 
                      onClick={() => router.push(`/customers/${customer.id}/transactions`)}
                    >
                      {customer.name}
                    </TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-base text-gray-900 text-center">
                      {summary.transaction_count || 0}건
                    </TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-base text-gray-900 font-semibold text-right">
                      {(summary.total_amount || 0).toLocaleString()}원
                    </TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-base text-green-700 font-semibold text-right">
                      {(summary.total_paid || 0).toLocaleString()}원
                    </TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-base text-gray-900 font-semibold text-right">
                      {(summary.total_unpaid || 0).toLocaleString()}원
                    </TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-base text-gray-900 font-semibold text-center">
                      {summary.total_ratio || 0}%
                    </TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">
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
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="border-2 border-gray-300 px-4 py-8 text-center text-lg text-gray-500">
                  {searchTerm ? (
                    <div>
                      <div className="mb-2">🔍 &quot;{searchTerm}&quot; 검색 결과가 없습니다.</div>
                      <div className="text-base text-gray-400">다른 고객명을 검색해보세요.</div>
                    </div>
                  ) : (
                    <div>📊 고객 데이터가 없습니다.</div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {/* 📄 페이지네이션 */}
      {filteredSummaries.length > pageSize && (
        <div className="flex justify-center my-8">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(filteredSummaries.length / pageSize)}
            totalItems={filteredSummaries.length}
            itemsPerPage={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
} 