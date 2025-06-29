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
    .select('*')
    .eq('customer_id', customer_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // 거래가 없을 경우 빈 배열 반환
  return NextResponse.json({ transactions: transactions ?? [] });
} 