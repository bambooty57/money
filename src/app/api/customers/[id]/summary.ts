// This file should be moved to src/app/api/customers/[id]/summary/route.ts for correct Next.js routing.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const customer_id = params.id;
  // 1. 고객의 모든 거래
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, files(*), payments(*)')
    .eq('customer_id', customer_id)
    .order('created_at', { ascending: false });
  // 2. 거래별 변제/미수금/비율 집계
  const txs = (transactions || []).map(tx => {
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
  // 3. 고객 전체 집계
  const totalAmount = txs.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalPaid = txs.reduce((sum: number, t: any) => sum + (t.paid_amount || 0), 0);
  const totalUnpaid = totalAmount - totalPaid;
  const totalRatio = totalAmount ? Math.round((totalPaid / totalAmount) * 100) : 0;
  return NextResponse.json({
    customer_id,
    total_amount: totalAmount,
    total_paid: totalPaid,
    total_unpaid: totalUnpaid,
    total_ratio: totalRatio,
    transactions: txs
  });
} 