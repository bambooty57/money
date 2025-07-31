import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
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

    // 고객별 요약 데이터 계산
    const { data: customerTransactions, error: customerError } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        customer_id,
        customers(id, name),
        payments(amount)
      `)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });

    // 고객별로 거래 데이터 그룹화
    const customerSummaryMap = new Map();
    
    (customerTransactions || []).forEach(tx => {
      const customerId = tx.customer_id;
      if (!customerId) return;

      if (!customerSummaryMap.has(customerId)) {
        customerSummaryMap.set(customerId, {
          customer_id: customerId,
          customer_name: tx.customers?.name || '',
          transaction_count: 0,
          total_amount: 0,
          total_paid: 0,
          total_unpaid: 0,
          total_ratio: 0
        });
      }

      const summary = customerSummaryMap.get(customerId);
      const paid = (tx.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const unpaid = (tx.amount || 0) - paid;

      summary.transaction_count += 1;
      summary.total_amount += tx.amount || 0;
      summary.total_paid += paid;
      summary.total_unpaid += unpaid > 0 ? unpaid : 0;
    });

    // 입금률 계산 및 배열로 변환
    const customerSummaries = Array.from(customerSummaryMap.values()).map(summary => ({
      ...summary,
      total_ratio: summary.total_amount > 0 ? Math.round((summary.total_paid / summary.total_amount) * 100) : 0
    }));

    return NextResponse.json({
      data: customerSummaries,
      global: {
        total_transactions: total_transactions || 0,
        total_customers,
        total_amount,
        total_paid,
        total_unpaid,
        paid_ratio,
      }
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction summary' }, { status: 500 });
  }
} 