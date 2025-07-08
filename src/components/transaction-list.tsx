"use client";

import { useEffect, useState } from 'react';
import type { Database } from '@/types/database';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Download, PlusCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from './ui/button';
import { Alert } from './ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from './ui/table';
import TransactionForm from './transaction-form';
import ModelTypeManager from './model-type-manager';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

export function TransactionList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const searchParams = useSearchParams();
  const urlRefreshKey = searchParams.get('refresh') || 0;
  const [refreshKey, setRefreshKey] = useState(0);
  const [modelTypeRefresh, setModelTypeRefresh] = useState(0);

  useEffect(() => {
    setRefreshKey(k => k + 1);
  }, [urlRefreshKey]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/customers?hasTransactions=true', { cache: 'no-store' });
        const data = await res.json();
        setCustomers(data.data || []);
        // 고객별 summary 병렬 호출
        const summaryResults = await Promise.all(
          (data.data || []).map((c: Customer) =>
            fetch(`/api/customers/${c.id}/summary`).then(r => r.json())
          )
        );
        setSummaries(summaryResults);
        // 전체 거래 row 수 fetch
        const txRes = await fetch('/api/transactions?count=1');
        const txData = await txRes.json();
        setTotalCount(txData.count || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [refreshKey]);

  const handleExcelDownload = () => {
    const excelRows = customers.map(c => {
      const summary = summaries.find(s => s.customer_id === c.id) || {};
      const transactionCount = Array.isArray(summary.transactions) ? summary.transactions.length : 0;
      return {
        고객명: c.name,
        거래건수: transactionCount,
        총매출액: summary.total_amount || 0,
        총입금액: summary.total_paid || 0,
        총미수금: summary.total_unpaid || 0,
        입금률: summary.total_ratio || 0,
      };
    });
    // 전체 합계 행 추가
    const totalTransactionCount = summaries.reduce((sum, s) => sum + (Array.isArray(s.transactions) ? s.transactions.length : 0), 0);
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

  // 상단 요약 집계
  const totalSales = summaries.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalPaid = summaries.reduce((sum, s) => sum + (s.total_paid || 0), 0);
  const totalUnpaid = summaries.reduce((sum, s) => sum + (s.total_unpaid || 0), 0);
  const totalRatio = totalSales ? ((totalPaid / totalSales) * 100).toFixed(1) : '0.0';

  // Remove duplicate customers by name
  const uniqueCustomers = customers.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
          <div className="text-xs text-gray-600 mb-1">전체 거래</div>
          <div className="text-lg font-bold text-blue-700">{totalCount}건</div>
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
            <TransactionForm onSuccess={() => { 
              setFormOpen(false); 
              setRefreshKey(k => k + 1); 
              setTimeout(() => setRefreshKey(k => k + 1), 700); 
            }} refresh={modelTypeRefresh} />
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
            <ModelTypeManager />
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">고객명</TableHead>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">거래건수</TableHead>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">총 매출액</TableHead>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">입금액</TableHead>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">미수금</TableHead>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">입금%</TableHead>
              <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-700">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
          {uniqueCustomers.map((c, i) => {
            const summary = summaries[customers.findIndex(x => x.id === c.id)] || {};
            const transactionCount = Array.isArray(summary.transactions)
              ? summary.transactions.length
              : 0;
            return (
              <TableRow key={c.id} className="hover:bg-gray-50 cursor-pointer border-b border-gray-200">
                <TableCell className="px-4 py-2 whitespace-nowrap text-base text-blue-700 underline font-medium" onClick={() => router.push(`/customers/${c.id}/transactions`)}>{c.name}</TableCell>
                <TableCell className="px-4 py-2 whitespace-nowrap text-base text-gray-900">{transactionCount}건</TableCell>
                <TableCell className="px-4 py-2 whitespace-nowrap text-base text-gray-900 font-semibold">{(summary.total_amount || 0).toLocaleString()}원</TableCell>
                <TableCell className="px-4 py-2 whitespace-nowrap text-base text-green-700 font-semibold">{(summary.total_paid || 0).toLocaleString()}원</TableCell>
                <TableCell className="px-4 py-2 whitespace-nowrap text-base text-red-700 font-semibold">{(summary.total_unpaid || 0).toLocaleString()}원</TableCell>
                <TableCell className="px-4 py-2 whitespace-nowrap flex items-center gap-2">
                  <span className="text-base text-gray-900 font-semibold">{summary.total_ratio || 0}%</span>
                </TableCell>
                <TableCell>
                  <button
                    className="text-red-600 hover:text-red-900 text-lg p-1 hover:bg-red-50 rounded transition-colors"
                    title="거래 삭제"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm('정말로 이 거래를 삭제하시겠습니까?')) return;
                      const res = await fetch(`/api/transactions?id=${summary.transactions[0].id}`, { method: 'DELETE' });
                      if (res.ok) {
                        setRefreshKey(k => k + 1);
                        setTimeout(() => setRefreshKey(k => k + 1), 700);
                        alert('삭제되었습니다.');
                      } else {
                        const { error } = await res.json();
                        alert('삭제 실패: ' + error);
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
    </div>
  );
} 