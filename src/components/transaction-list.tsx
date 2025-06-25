"use client";

import { useEffect, useState } from 'react';
import type { Transaction } from '@/types/database';

export function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const response = await fetch('/api/transactions');
        if (!response.ok) {
          throw new Error('거래 목록을 불러오는데 실패했습니다.');
        }
        const data = await response.json();
        setTransactions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, []);

  if (loading) {
    return <div className="p-4">로딩 중...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">잔액</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거래일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">비고</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">{tx.type}</td>
              <td className="px-6 py-4 whitespace-nowrap">{tx.amount.toLocaleString()}원</td>
              <td className="px-6 py-4 whitespace-nowrap">-</td>
              <td className="px-6 py-4 whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap">{tx.status}</td>
              <td className="px-6 py-4 whitespace-nowrap">{tx.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 