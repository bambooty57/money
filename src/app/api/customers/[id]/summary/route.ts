import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, context: any) {
  let params = context.params;
  if (typeof params?.then === 'function') {
    params = await params;
  }
  if (!params || !params.id) {
    return NextResponse.json({ error: 'Missing customer id' }, { status: 400 });
  }
  const customer_id = params.id;
  // 1. 고객의 모든 거래
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*, payments(*)')
    .eq('customer_id', customer_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // 거래별 입금액 집계
  const txs = (transactions || []).map(tx => {
    const paid = (tx.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const unpaid = (tx.amount || 0) - paid;
    const ratio = tx.amount ? Math.round((paid / tx.amount) * 100) : 0;
    return {
      ...tx,
      paid_amount: paid,
      unpaid_amount: unpaid,
      paid_ratio: ratio,
      payments: tx.payments
    };
  });
  // 전체 집계
  const total_amount = txs.reduce((sum, t) => sum + (t.amount || 0), 0);
  const total_paid = txs.reduce((sum, t) => sum + (t.paid_amount || 0), 0);
  const total_unpaid = total_amount - total_paid;
  const total_ratio = total_amount ? Math.round((total_paid / total_amount) * 100) : 0;
  return NextResponse.json({
    customer_id,
    total_amount,
    total_paid,
    total_unpaid,
    total_ratio,
    transactions: txs
  });
} 