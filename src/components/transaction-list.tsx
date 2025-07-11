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

// 거래(입금) 기준 타입 정의
interface Payment {
  id: string;
  method: string;
  amount: number;
  bank_name?: string | null;
  paid_at?: string;
  used_by?: string | null;
  used_place?: string | null;
  used_model_type?: string | null;
  used_model?: string | null;
  note?: string | null;
}
interface TransactionRow {
  id: string;
  customer: { name: string };
  payments: Payment[];
  created_at: string;
  amount: number;
  status: string;
  // 기타 필요한 필드 추가
}

export function TransactionList() {
  usePaymentsRealtime(); // 실시간 반영 추가
  const [customers, setCustomers] = useState<any[]>([]); // 고객 데이터는 현재 사용되지 않음
  const [summaries, setSummaries] = useState<any[]>([]); // 고객별 요약 데이터는 현재 사용되지 않음
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalCustomerCount, setTotalCustomerCount] = useState<number>(0); // 전체 고객 수 저장
  const searchParams = useSearchParams();
  const urlRefreshKey = searchParams.get('refresh') || 0;
  const [modelTypeRefresh, setModelTypeRefresh] = useState(0);
  // 페이지네이션 상태 추가
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // page, pageSize를 API에 전달
        const res = await fetch(`/api/transactions?page=${page}&pageSize=${pageSize}`);
        const data = await res.json();
        setTransactions(data.data || []);
        setTotalCount(data.pagination?.total || 0);
        // 고객별 summary 병렬 호출 (현재는 사용되지 않음)
        // const summaryResults = await Promise.all(
        //   (data.data || []).map((c: Customer) =>
        //     fetch(`/api/customers/${c.id}/summary`).then(r => r.json())
        //   )
        // );
        // setSummaries(summaryResults);
        // 전체 거래 row 수 fetch (현재는 사용되지 않음)
        // const txRes = await fetch('/api/transactions?count=1');
        // const txData = await txRes.json();
        // setTotalCount(txData.count || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [page]);

  const handleExcelDownload = () => {
    const excelRows = transactions.map(tx => {
      return {
        일자: tx.created_at.slice(0, 10),
        입금자: tx.customer?.name || '',
        방식: tx.payments.map(p => p.method).join(', '),
        금액: tx.payments.reduce((sum, p) => sum + p.amount, 0),
        입금은행: tx.payments.map(p => p.bank_name).filter(Boolean).join(', '),
        상세정보: tx.payments.map(p => {
          if (p.method === '중고인수') {
            return [p.used_by, p.used_place, p.used_model_type, p.used_model].filter(Boolean).join(' / ');
          }
          return '';
        }).join(', '),
        비고: tx.payments.map(p => p.note).filter(Boolean).join(', '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래별 입금 내역');
    XLSX.writeFile(wb, '거래별 입금 내역.xlsx');
  };

  if (loading) return <div className="p-4">로딩 중...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  // 상단 요약 집계 (현재는 사용되지 않음)
  const totalSales = summaries.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalPaid = summaries.reduce((sum, s) => sum + (s.total_paid || 0), 0);
  const totalUnpaid = summaries.reduce((sum, s) => sum + (s.total_unpaid || 0), 0);
  const totalRatio = totalSales ? ((totalPaid / totalSales) * 100).toFixed(1) : '0.0';

  return (
    <div className="overflow-x-auto">
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
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">일자</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">입금자</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">방식</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-right">금액</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">입금은행</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">상세정보</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">비고</TableHead>
              <TableHead className="border-2 border-gray-300 px-4 py-4 font-bold text-gray-800 text-center">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => (
              tx.payments.map((payment) => {
                const isUsed = payment.method === '중고인수';
                const detail = isUsed
                  ? [payment.used_by, payment.used_place, payment.used_model_type, payment.used_model].filter(Boolean).join(' / ')
                  : '';
                const note = isUsed ? payment.note || '' : '';
                return (
                  <TableRow key={payment.id} className="hover:bg-blue-50 cursor-pointer border-b border-gray-200 h-16">
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">{payment.paid_at?.slice(0, 10) || tx.created_at.slice(0, 10)}</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">{tx.customer?.name || ''}</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">{payment.method}</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-right font-semibold">{payment.amount.toLocaleString()}원</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">{payment.bank_name || ''}</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">{detail}</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">{note}</TableCell>
                    <TableCell className="border-2 border-gray-300 px-4 py-4 text-center">
                      <button
                        className="text-red-600 hover:text-red-900 text-lg p-1 hover:bg-red-50 rounded transition-colors"
                        title="입금 삭제"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm('정말로 이 입금을 삭제하시겠습니까?')) return;
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            if (!token) {
                              alert('인증이 필요합니다. 다시 로그인해주세요.');
                              return;
                            }
                            const res = await fetch(`/api/payments/${payment.id}`, { 
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
                            console.error('입금 삭제 중 오류:', error);
                            alert('입금 삭제 중 오류가 발생했습니다.');
                          }
                        }}
                      >🗑️</button>
                    </TableCell>
                  </TableRow>
                );
              })
            ))}
          </TableBody>
        </Table>
      </div>
      {/* 페이지네이션 */}
      {totalCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalCount / pageSize)}
            totalItems={totalCount}
            itemsPerPage={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
} 