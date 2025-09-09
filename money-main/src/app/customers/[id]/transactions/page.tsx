export const dynamic = "force-dynamic";
import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import TransactionDetailClient from './TransactionDetailClient';
import type { Database } from '@/types/database';
// import type { GetServerSidePropsContext } from 'next';

import HeaderButtons from './HeaderButtons';
// import { usePaymentsRealtime } from '@/lib/usePaymentsRealtime';

// 거래, 입금, 파일 타입
interface Payment {
  id: string;
  transaction_id: string;
  amount: number;
  paid_at: string;
  method: string;
  payer_name: string;
}

interface TransactionWithDetails extends Omit<Transaction, 'paid_amount' | 'unpaid_amount' | 'paid_ratio'> {
  payments?: Payment[];
  files?: File[];
  paid_amount: number | null;
  unpaid_amount: number | null;
  paid_ratio: number | null;
  customers?: any;
}

type Transaction = Database['public']['Tables']['transactions']['Row'];
type File = Database['public']['Tables']['files']['Row'];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*, payments(*), files(*), customers:customer_id(*), models_types:models_types_id(model, type)')
    .eq('customer_id', customerId);
  if (error) {
    return <div>에러가 발생했습니다: {error.message}</div>;
  }
  if (data === null || data === undefined) {
    notFound();
  }
  if (Array.isArray(data) && data.length === 0) {
    return <div>거래 내역이 없습니다.</div>;
  }
  // 고객명 기준 정렬
  const sorted = [...data].sort((a, b) => {
    const nameA = a.customers?.name || '';
    const nameB = b.customers?.name || '';
    return nameA.localeCompare(nameB);
  });
  // 거래별 집계
  const txs: TransactionWithDetails[] = (sorted as any[]).map(tx => {
    const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const unpaid = (tx.amount || 0) - paid;
    const ratio = tx.amount ? Math.round((paid / tx.amount) * 100) : 0;
    return {
      ...tx,
      paid_amount: paid,
      unpaid_amount: unpaid,
      paid_ratio: ratio,
      payments: tx.payments,
      files: tx.files
    };
  });
  // 고객명 추출
  const customerName = txs[0]?.customers?.name || customerId;
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-8 py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3 mb-8">
          📑 거래 관리
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800">거래상세 - {customerName}</h1>
            <HeaderButtons />
          </div>
          {/* usePaymentsRealtime은 클라이언트 컴포넌트에서 사용 */}
          <TransactionDetailClient transactions={txs.map(tx => ({ ...tx, customer_id: tx.customer_id || customerId }))} customerId={customerId} />
        </div>
      </div>
    </div>
  );
} 