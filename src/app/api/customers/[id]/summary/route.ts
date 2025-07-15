export const dynamic = 'force-dynamic';
export const revalidate = 0;
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
  
  // 1. 거래 건수만 먼저 정확히 계산 (JOIN 없이)
  const { count: transaction_count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('customer_id', customer_id);
  
  // 2. 고객의 모든 거래 (상세 정보 포함)
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, customer_id, type, amount, status, description, created_at, updated_at, due_date, model, model_type, models_types(model, type), payments(*)')
    .eq('customer_id', customer_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 거래별 입금액 집계
  const txs = (transactions || []).map(tx => {
    const paid = (tx.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const unpaid = (tx.amount || 0) - paid;
    const ratio = tx.amount ? Math.round((paid / tx.amount) * 100) : 0;
    // 외상은 note로 이동, description은 비움
    let description = tx.description;
    let note = '';
    if (description === '외상') {
      note = '외상';
      description = '';
    }
    return {
      ...tx,
      date: tx.created_at, // 거래일자 필드로 created_at을 명확히 전달
      due_date: tx.due_date, // 지급예정일
      description,
      note,
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
    transaction_count: transaction_count || 0, // 정확한 거래 건수
    transactions: txs
  });
} 