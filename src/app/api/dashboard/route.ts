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
    // 6. 거래 상태별 합계
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('status,amount');
    const statusStats = (allTxs || []).reduce((acc: Record<string, number>, tx: any) => {
      const s = tx.status;
      acc[s] = (acc[s] || 0) + (tx.amount || 0);
      return acc;
    }, {} as Record<string, number>);
    const statusStatsArr = Object.entries(statusStats).map(([status, total]) => ({ status, total }));
    return NextResponse.json({
      totalUnpaid,
      agingAnalysis,
      topCustomers: topCustomers.slice(0, 5),
      monthlyStats: monthlyStats || [],
      typeStats: typeStats || [],
      statusStats: statusStatsArr,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
} 