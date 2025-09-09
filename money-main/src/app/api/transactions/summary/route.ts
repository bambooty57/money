import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 🚀 성능 최적화: 단일 쿼리로 전체 통계 계산
    const { data: allTransactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        customer_id,
        status,
        customers(id, name),
        payments(amount)
      `)
      .neq('status', 'deleted');
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 🚀 성능 최적화: 메모리에서 통계 계산
    let total_transactions = 0;
    let total_amount = 0;
    let total_paid = 0;
    let total_unpaid = 0;
    const customerSet = new Set<string>();
    const customerSummaryMap = new Map();

    (allTransactions || []).forEach(tx => {
      total_transactions++;
      total_amount += tx.amount || 0;
      
      const paid = (tx.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const unpaid = (tx.amount || 0) - paid;
      
      total_paid += paid;
      total_unpaid += unpaid > 0 ? unpaid : 0;

      // 고객별 요약 계산
      const customerId = tx.customer_id;
      if (customerId) {
        customerSet.add(customerId);
        
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
        summary.transaction_count += 1;
        summary.total_amount += tx.amount || 0;
        summary.total_paid += paid;
        summary.total_unpaid += unpaid > 0 ? unpaid : 0;
      }
    });

    // 🚀 성능 최적화: 입금률 계산 및 배열 변환
    const customerSummaries = Array.from(customerSummaryMap.values()).map(summary => ({
      ...summary,
      total_ratio: summary.total_amount > 0 ? Math.round((summary.total_paid / summary.total_amount) * 100) : 0
    }));

    const paid_ratio = total_amount ? Math.round((total_paid / total_amount) * 1000) / 10 : 0;

    return NextResponse.json({
      data: customerSummaries,
      global: {
        total_transactions,
        total_customers: customerSet.size,
        total_amount,
        total_paid,
        total_unpaid,
        paid_ratio,
      }
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      error: '거래 요약 데이터를 불러오는데 실패했습니다.',
      details: errorMessage 
    }, { status: 500 });
  }
} 