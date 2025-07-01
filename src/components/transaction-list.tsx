"use client";

import { useEffect, useState } from 'react';
import type { Transaction, Customer } from '@/types/database';
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
import { useRouter } from 'next/navigation';
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

export function TransactionList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/customers');
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
  }, []);

  const handleExcelDownload = () => {
    const ws = XLSX.utils.json_to_sheet(
      customers.map(c => ({
        고객명: c.name,
        총매출액: summaries.find(s => s.customer_id === c.id)?.total_amount || 0,
        총입금액: summaries.find(s => s.customer_id === c.id)?.total_paid || 0,
        총미수금: summaries.find(s => s.customer_id === c.id)?.total_unpaid || 0,
        입금률: summaries.find(s => s.customer_id === c.id)?.total_ratio || 0,
      }))
    );
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div className="bg-blue-50 rounded p-2 text-center">
          <div className="text-xs text-gray-500">전체 거래</div>
          <div className="text-lg font-bold">{totalCount}건</div>
        </div>
        <div className="bg-green-50 rounded p-2 text-center">
          <div className="text-xs text-gray-500">총 매출액</div>
          <div className="text-lg font-bold">{totalSales.toLocaleString()}원</div>
        </div>
        <div className="bg-indigo-50 rounded p-2 text-center">
          <div className="text-xs text-gray-500">총 입금액</div>
          <div className="text-lg font-bold">{totalPaid.toLocaleString()}원</div>
        </div>
        <div className="bg-red-50 rounded p-2 text-center">
          <div className="text-xs text-gray-500">총 미수금</div>
          <div className="text-lg font-bold">{totalUnpaid.toLocaleString()}원</div>
        </div>
        <div className="bg-yellow-50 rounded p-2 text-center">
          <div className="text-xs text-gray-500">입금률</div>
          <div className="text-lg font-bold">{totalRatio}%</div>
        </div>
      </div>
      <div className="flex justify-end mb-2">
        <button
          onClick={handleExcelDownload}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <Download className="mr-2 h-4 w-4" />
          엑셀 다운로드
        </button>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <button
              className="ml-2 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setFormOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> 신규 거래 등록
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>신규 거래 등록</DialogTitle>
            </DialogHeader>
            <TransactionForm customers={customers} onSuccess={() => { setFormOpen(false); router.refresh(); }} />
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="ml-2 inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              기종/형식명 관리
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>기종/형식명 관리</DialogTitle>
            </DialogHeader>
            <ModelTypeManager />
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객명</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거래건수</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 매출액</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입금액</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">미수금</TableHead>
            <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입금%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-gray-200">
          {uniqueCustomers.map((c, i) => {
            const summary = summaries[customers.findIndex(x => x.id === c.id)] || {};
            const transactionCount = Array.isArray(summary.transactions)
              ? summary.transactions.length
              : 0;
            return (
              <TableRow key={c.id} className="hover:bg-gray-50 cursor-pointer">
                <TableCell className="px-6 py-4 whitespace-nowrap text-blue-700 underline" onClick={() => router.push(`/customers/${c.id}/transactions`)}>{c.name}</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">{transactionCount}건</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">{(summary.total_amount || 0).toLocaleString()}원</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">{(summary.total_paid || 0).toLocaleString()}원</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">{(summary.total_unpaid || 0).toLocaleString()}원</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
                  {summary.total_ratio || 0}%
                  <button
                    className="text-red-600 hover:text-red-900 ml-2"
                    title="고객 및 거래 전체 삭제"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm('정말로 이 고객과 모든 거래를 삭제하시겠습니까?')) return;
                      const res = await fetch(`/api/customers?id=${c.id}`, { method: 'DELETE' });
                      if (res.ok) {
                        setCustomers(prev => prev.filter(x => x.id !== c.id));
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
  );
} 