import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. 총 미수금 계산
    const { data: unpaidTransactions, error: unpaidError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', '미수');
    if (unpaidError) throw unpaidError;
    const totalUnpaid = unpaidTransactions?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

    // 2. 미수금 연령 분석
    const { data: agingAnalysis, error: agingError } = await supabase
      .from('transactions')
      .select('created_at,amount')
      .eq('status', '미수')
      .order('created_at', { ascending: true });
    if (agingError) throw agingError;

    // 3. 상위 미수금 고객
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('*,transactions!inner(amount,status)')
      .order('created_at', { ascending: false });
    if (customerError) throw customerError;
    const topCustomers = (customers || [])
      .map((customer: any) => ({
        ...customer,
        unpaidAmount: (customer.transactions || []).filter((tx: any) => tx.status === '미수').reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0),
      }))
      .sort((a: any, b: any) => b.unpaidAmount - a.unpaidAmount)
      .slice(0, 5);

    return NextResponse.json({
      totalUnpaid,
      agingAnalysis,
      topCustomers,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
} 