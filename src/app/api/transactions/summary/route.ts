import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // 전체 거래 수 (deleted 제외)
  const { count: total_transactions } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .neq('status', 'deleted');

  // 전체 고객 수 (거래가 1건이라도 있는 고객만)
  const { data: txCustomers } = await supabase
    .from('transactions')
    .select('customer_id')
    .neq('status', 'deleted');
  const customerSet = new Set((txCustomers || []).map(tx => tx.customer_id).filter(Boolean));
  const total_customers = customerSet.size;

  // 전체 거래 데이터 (deleted 제외, 입금/미수금 집계)
  const { data: allTxs, error } = await supabase
    .from('transactions')
    .select('id, amount, payments(amount), status')
    .neq('status', 'deleted');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let total_amount = 0;
  let total_paid = 0;
  let total_unpaid = 0;
  (allTxs || []).forEach(tx => {
    const paid = (tx.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const unpaid = (tx.amount || 0) - paid;
    total_amount += tx.amount || 0;
    total_paid += paid;
    total_unpaid += unpaid > 0 ? unpaid : 0;
  });
  const paid_ratio = total_amount ? Math.round((total_paid / total_amount) * 1000) / 10 : 0;

  return NextResponse.json({
    total_transactions: total_transactions || 0,
    total_customers,
    total_amount,
    total_paid,
    total_unpaid,
    paid_ratio,
  });
} 