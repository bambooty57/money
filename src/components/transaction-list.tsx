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
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 실시간 동기화
  const { connectionStatus, retryCount } = usePaymentsRealtime();
  
  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [modelTypeRefresh, setModelTypeRefresh] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [totalSummary, setTotalSummary] = useState<{
    count: number;
    totalAmount: number;
  }>({ count: 0, totalAmount: 0 });
  
  // 페이지네이션 훅 사용 (15건 기본)
  const { currentPage, pageSize } = usePagination(data?.pagination.total || 0, 15);

  // 데이터 페칭 함수
  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`/api/transactions?${params}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
        if (isRefresh) {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }
      } else {
        console.error('Failed to fetch transactions:', result.error);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize]);

  // 전체 요약 데이터 페칭
  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/transactions?count=1');
      const result = await response.json();
      if (response.ok) {
        setTotalSummary(result);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  // 수동 새로고침 함수
  const handleRefresh = useCallback(() => {
    fetchTransactions(true);
    fetchSummary();
  }, [fetchTransactions, fetchSummary]);

  // 초기 로딩 및 의존성 변경 시 데이터 페칭
  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [fetchTransactions, fetchSummary]);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  // 엑셀 다운로드
  const handleExcelDownload = useCallback(() => {
    if (!data?.data) return;

    const excelRows = data.data.map(tx => ({
      거래일자: tx.transaction_date,
      고객명: tx.customers.name,
      기종: tx.model,
      모델명: tx.model_type,
      매출액: tx.amount,
      입금액: tx.payment_amount,
      입금방법: tx.payment_type,
      미수금: tx.amount - tx.payment_amount,
      만기일자: tx.due_date,
      상태: tx.status,
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래목록');
    XLSX.writeFile(wb, `거래목록_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [data]);

  // 거래 삭제 함수
  const handleDelete = useCallback(async (transactionId: string) => {
    const confirmMessage = '⚠️ 정말로 이 거래를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.';
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        alert('인증이 필요합니다. 로그인을 다시 해주세요.');
        return;
      }
      
      const res = await fetch(`/api/transactions?id=${transactionId}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        alert('거래가 삭제되었습니다.');
        fetchTransactions();
        fetchSummary();
      } else {
        const { error } = await res.json();
        alert('삭제 실패: ' + error);
      }
    } catch (error) {
      console.error('삭제 중 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }, [fetchTransactions, fetchSummary]);

  // 로딩 스켈레톤
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
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
    <div className="space-y-6">
      {/* 상단 요약 카드 */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <div className="text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
              📊 전체 거래건수
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {totalSummary.count.toLocaleString()}건
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
              💰 전체 매출액
            </div>
            <div className="text-3xl font-bold text-green-600">
              {totalSummary.totalAmount.toLocaleString()}원
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <div className="text-lg font-bold text-purple-800 mb-2 flex items-center gap-2">
              📋 현재 페이지
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {data.pagination.page} / {data.pagination.totalPages}
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
            <div className="text-lg font-bold text-orange-800 mb-2 flex items-center gap-2">
              🔄 새로고침
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-lg font-semibold"
            >
              {refreshing ? '새로고침 중...' : '🔄 새로고침'}
            </button>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-4 justify-end">
        <button
          onClick={handleExcelDownload}
          className="inline-flex items-center px-6 py-3 bg-green-600 text-white text-lg rounded-lg hover:bg-green-700 font-semibold shadow-lg transition-colors duration-200"
        >
          <Download className="mr-2 h-5 w-5" />
          📊 엑셀 다운로드
        </button>
        
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 font-semibold shadow-lg transition-colors duration-200"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              ➕ 신규 거래 등록
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">신규 거래 등록</DialogTitle>
            </DialogHeader>
            <TransactionForm 
              onSuccess={() => { 
                setFormOpen(false); 
                fetchTransactions();
                fetchSummary();
              }} 
              refresh={modelTypeRefresh}
              onPaymentSuccess={() => {
                fetchTransactions();
                fetchSummary();
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={open => { if (!open) setModelTypeRefresh(r => r + 1) }}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center px-6 py-3 bg-gray-600 text-white text-lg rounded-lg hover:bg-gray-700 font-semibold shadow-lg transition-colors duration-200"
            >
              ⚙️ 기종/형식명 관리
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">기종/형식명 관리</DialogTitle>
            </DialogHeader>
            <ModelTypeManager onChange={() => setModelTypeRefresh(r => r + 1)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* 거래 목록 테이블 */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200">
        <Table className="w-full text-lg">
          <TableHeader className="bg-blue-100">
            <TableRow className="h-16">
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-center border-r-2 border-blue-200">거래일자</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-center border-r-2 border-blue-200">고객명</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-center border-r-2 border-blue-200">기종/모델</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-right border-r-2 border-blue-200">매출액</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-right border-r-2 border-blue-200">입금액</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-right border-r-2 border-blue-200">미수금</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-center border-r-2 border-blue-200">입금방법</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-center border-r-2 border-blue-200">만기일</TableHead>
              <TableHead className="px-4 py-4 font-bold text-blue-800 text-center">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((tx, index) => {
              const unpaidAmount = tx.amount - tx.payment_amount;
              return (
                <TableRow key={tx.id} className="h-16 hover:bg-blue-50 transition-colors duration-200">
                  <TableCell className="px-4 py-4 text-center border-r border-gray-200 font-medium">
                    {new Date(tx.transaction_date).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center border-r border-gray-200">
                    <button
                      onClick={() => router.push(`/customers/${tx.customers.id}/transactions`)}
                      className="text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      {tx.customers.name}
                    </button>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center border-r border-gray-200">
                    <div className="text-sm">
                      <div className="font-semibold">{tx.model || '-'}</div>
                      <div className="text-gray-600">{tx.model_type || '-'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right border-r border-gray-200 font-bold text-gray-900">
                    {tx.amount.toLocaleString()}원
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right border-r border-gray-200 font-bold text-green-600">
                    {tx.payment_amount.toLocaleString()}원
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right border-r border-gray-200 font-bold">
                    <span className={unpaidAmount > 0 ? 'text-red-600' : 'text-gray-400'}>
                      {unpaidAmount.toLocaleString()}원
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center border-r border-gray-200 font-medium">
                    {tx.payment_type || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center border-r border-gray-200 font-medium">
                    {tx.due_date ? new Date(tx.due_date).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 font-semibold"
                      title="거래 삭제"
                    >
                      🗑️ 삭제
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 데이터가 없을 때 */}
      {data.data.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg shadow-lg">
          <div className="text-2xl text-gray-400 font-semibold mb-4">
            📋 등록된 거래가 없습니다
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-lg font-semibold"
          >
            ➕ 첫 거래 등록하기
          </button>
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
              (총 {data.pagination.total.toLocaleString()}건)
            </div>
          </div>
          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            totalItems={data.pagination.total}
            itemsPerPage={data.pagination.pageSize}
            onPageChange={handlePageChange}
            pageSizeOptions={[10, 15, 20, 30, 50]}
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
                {refreshing ? '거래 목록을 새로고침하는 중...' : '거래 목록을 불러오는 중...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 연결 상태 표시 */}
      {connectionStatus === 'connecting' && (
        <div className="fixed top-4 left-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg border-2 border-blue-600">
          <div className="flex items-center gap-2">
            <div className="animate-spin">🔄</div>
            <div className="text-sm">실시간 연결 중...</div>
          </div>
        </div>
      )}
      
      {connectionStatus === 'disconnected' && (
        <div className="fixed top-4 left-4 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg border-2 border-amber-600">
          <div className="flex items-center gap-3">
            <div className="text-sm">⚠️</div>
            <div className="text-sm">
              실시간 연결 끊김 
              {retryCount > 0 && <span className="ml-1">({retryCount}/3 재시도)</span>}
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-white text-amber-600 rounded text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              새로고침
            </button>
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
              <div className="text-sm opacity-90">거래 목록이 업데이트되었습니다.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 