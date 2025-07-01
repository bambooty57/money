export const dynamic = "force-dynamic";
import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import TransactionDetailClient from './TransactionDetailClient';
import type { Transaction, File } from '@/types/database';

import HeaderButtons from './HeaderButtons';

// 거래, 입금, 파일 타입
interface Payment {
  id: string;
  transaction_id: string;
  amount: number;
  paid_at: string;
  method: string;
  payer_name: string;
}

interface TransactionWithDetails extends Transaction {
  payments?: Payment[];
  files?: File[];
  paid_amount?: number;
  unpaid_amount?: number;
  paid_ratio?: number;
}

export default async function CustomerTransactionsPage(props: any) {
  let params = props.params;
  if (typeof params?.then === 'function') {
    params = await params;
  }
  const customerId = params.id;
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
    <div className="max-w-4xl mx-auto p-4">
      <HeaderButtons />
      <h1 className="text-2xl font-bold mb-4">거래상세 - {customerName}</h1>
      <TransactionDetailClient transactions={txs.map(tx => ({ ...tx, customer_id: tx.customer_id || customerId }))} customerId={customerId} />
    </div>
  );
} 