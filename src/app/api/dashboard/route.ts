import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. 총 미수금 계산
    const { data: unpaidTransactions, error: unpaidError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'unpaid');
    if (unpaidError) throw unpaidError;
    const totalUnpaid = unpaidTransactions?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

    // 2. 미수금 연령 분석
    const { data: agingAnalysis, error: agingError } = await supabase
      .from('transactions')
      .select('created_at,amount')
      .eq('status', 'unpaid')
      .order('created_at', { ascending: true });
    if (agingError) throw agingError;

    // 3. 상위 미수금 고객
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('*,transactions!inner(amount,status),address_road,address_jibun,zipcode,customer_type_multi')
      .order('created_at', { ascending: false });
    if (customerError) throw customerError;
    // 사진(files) 동기화
    const topCustomers = [];
    for (const customer of (customers || [])) {
      // 사진 최대 3장
      const { data: files } = await supabase
        .from('files')
        .select('url')
        .eq('customer_id', customer.id)
        .limit(3);
      topCustomers.push({
        ...customer,
        photos: Array.isArray(files) ? files : [],
        unpaidAmount: (customer.transactions || []).filter((tx: any) => tx.status === 'unpaid').reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0),
      });
    }
    topCustomers.sort((a, b) => b.unpaidAmount - a.unpaidAmount);

    // 4. 월별 미수금 통계
    const { data: monthlyStats } = await supabase
      .rpc('monthly_unpaid_stats'); // 예시: 월별 미수금 합계
    // 5. 고객유형별 미수금 통계
    const { data: typeStats } = await supabase
      .rpc('customer_type_unpaid_stats'); // 예시: 유형별 미수금 합계
    // 6. 이번달 지급예정 거래건 (고객, 모델, 기종, 입금액 등 조인)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    // 지급예정일이 이번달인 거래(미수금 남은 건만)
    const { data: dueThisMonthRaw, error: dueMonthError } = await supabase
      .from('transactions')
      .select('id,customer_id,amount,due_date,status,model,model_type,payments(amount),customers(name)' as any)
      .gte('due_date' as any, `${monthStr}-01` as any)
      .lte('due_date' as any, `${monthStr}-31` as any)
      .neq('status' as any, 'paid' as any);
    if (dueMonthError) throw dueMonthError;
    const dueThisMonth = (dueThisMonthRaw || []).map((tx: any) => {
      const paid = (tx.payments || []).reduce((sum: any, p: any) => sum + (p.amount || 0), 0);
      const unpaid = (tx.amount || 0) - paid;
      const ratio = tx.amount ? Math.round((paid / tx.amount) * 100) : 0;
      return {
        id: tx.id,
        customer_id: tx.customer_id,
        customer_name: tx.customers?.name || '',
        model: tx.model || '',
        model_type: tx.model_type || '',
        amount: tx.amount || 0,
        paid_amount: paid,
        unpaid_amount: unpaid,
        paid_ratio: ratio,
        due_date: tx.due_date,
        status: tx.status,
      };
    });
    // 7. 지급예정일이 지난 거래건(경과일수, 고객, 모델, 기종, 입금액 등 포함)
    const todayStr = now.toISOString().slice(0, 10);
    const { data: overdueTxsRaw, error: overdueError } = await supabase
      .from('transactions')
      .select('id,customer_id,amount,due_date,status,model,model_type,payments(amount),customers(name)' as any)
      .lt('due_date' as any, todayStr as any)
      .neq('status' as any, 'paid' as any);
    if (overdueError) throw overdueError;
    const overdueTxs = (overdueTxsRaw || []).map((tx: any) => {
      const paid = (tx.payments || []).reduce((sum: any, p: any) => sum + (p.amount || 0), 0);
      const unpaid = (tx.amount || 0) - paid;
      const ratio = tx.amount ? Math.round((paid / tx.amount) * 100) : 0;
      const due = tx.due_date ? new Date(tx.due_date) : null;
      const days = due ? Math.floor((now.getTime() - due.getTime()) / (1000*60*60*24)) : null;
      return {
        id: tx.id,
        customer_id: tx.customer_id,
        customer_name: tx.customers?.name || '',
        model: tx.model || '',
        model_type: tx.model_type || '',
        amount: tx.amount || 0,
        paid_amount: paid,
        unpaid_amount: unpaid,
        paid_ratio: ratio,
        due_date: tx.due_date,
        status: tx.status,
        overdue_days: days,
      };
    });
    return NextResponse.json({
      totalUnpaid,
      agingAnalysis,
      topCustomers: topCustomers.slice(0, 5),
      monthlyStats: monthlyStats || [],
      typeStats: typeStats || [],
      dueThisMonth,
      overdueTxs,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
} 