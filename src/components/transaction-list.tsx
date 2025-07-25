"use client";

import { useEffect, useState, useCallback } from 'react';
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
  // 페이지네이션 상태 추가
  const [page, setPage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('page');
      return p ? parseInt(p, 10) : 1;
    }
    return 1;
  });
  const pageSize = 15;

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
        // 검색 시 첫 페이지로 이동
        const params = new URLSearchParams(window.location.search);
        params.set('search', searchInputValue);
        params.set('page', '1');
        window.history.replaceState(null, '', `?${params.toString()}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInputValue, searchTerm]);

  // 새로고침 핸들러
  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchTerm('');
    setSearchInputValue('');
    const params = new URLSearchParams(window.location.search);
    params.delete('search');
    params.set('page', '1');
    window.history.replaceState(null, '', `?${params.toString()}`);
    setRefreshing(false);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 전체 집계 fetch
        const summaryRes = await fetch('/api/transactions/summary', { cache: 'no-store' });
        const summaryData = await summaryRes.json();
        setGlobalSummary(summaryData);
        // page, pageSize, searchTerm를 API에 전달
        const res = await fetch(`/api/customers?hasTransactions=true&page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(searchTerm)}`, { cache: 'no-store' });
        const data = await res.json();
        setCustomers(data.data || []);
        // 고객별 summary 병렬 호출
        const summaryResults = await Promise.all(
          (data.data || []).map((c: Customer) =>
            fetch(`/api/customers/${c.id}/summary`).then(r => r.json())
          )
        );
        setSummaries(summaryResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [page, searchTerm]);

  const handleExcelDownload = () => {
    const excelRows = customers.map(c => {
      const summary = summaries.find(s => s.customer_id === c.id) || {};
      // 고객관리 페이지와 동일한 COUNT 방식만 사용
      const transactionCount = summary.transaction_count || 0;
      return {
        고객명: c.name,
        거래건수: transactionCount,
        총매출액: summary.total_amount || 0,
        총입금액: summary.total_paid || 0,
        총미수금: summary.total_unpaid || 0,
        입금률: summary.total_ratio || 0,
      };
    });
    // 전체 합계 행 추가 - COUNT 방식만 사용
    const totalTransactionCount = summaries.reduce((sum, s) => sum + (s.transaction_count || 0), 0);
    const totalSales = summaries.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPaid = summaries.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const totalUnpaid = summaries.reduce((sum, s) => sum + (s.total_unpaid || 0), 0);
    excelRows.push({
      고객명: '총합계',
      거래건수: totalTransactionCount,
      총매출액: totalSales,
      총입금액: totalPaid,
      총미수금: totalUnpaid,
      입금률: '',
    });
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '고객별요약');
    XLSX.writeFile(wb, '고객별요약.xlsx');
  };

  if (loading) return <div className="p-4">로딩 중...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  // 상단 요약 집계: 전체 집계 API 결과 사용
  const totalCustomerCount = globalSummary?.total_customers || 0;
  const totalCount = globalSummary?.total_transactions || 0;
  const totalSales = globalSummary?.total_amount || 0;
  const totalPaid = globalSummary?.total_paid || 0;
  const totalUnpaid = globalSummary?.total_unpaid || 0;
  const totalRatio = globalSummary ? globalSummary.paid_ratio?.toFixed(1) : '0.0';

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