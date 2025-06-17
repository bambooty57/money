import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();

  // 1. 총 미수금
  const { data: totalUnpaid } = await supabase
    .from('transactions')
    .select('amount')
    .eq('status', 'unpaid')
    .select('sum(amount)');

  // 2. 미수금 연령 분석
  const { data: agingAnalysis } = await supabase
    .from('transactions')
    .select('created_at, amount')
    .eq('status', 'unpaid')
    .order('created_at');

  // 3. 상위 미수금 고객
  const { data: topCustomers } = await supabase
    .from('customers')
    .select(`
      id,
      name,
      transactions:transactions (
        amount,
        status
      )
    `)
    .order('transactions(amount)', { ascending: false })
    .limit(5);

  return NextResponse.json({
    totalUnpaid: totalUnpaid?.[0]?.sum || 0,
    agingAnalysis: agingAnalysis || [],
    topCustomers: topCustomers || []
  });
} 