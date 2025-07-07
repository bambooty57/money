import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = request instanceof Request ? new URL(request.url) : null;
    const countOnly = url?.searchParams.get('count') === '1';
    if (countOnly) {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      const { data: sumData, error: sumError } = await supabase
        .from('transactions')
        .select('amount')
        .neq('status', 'deleted');
      if (sumError) throw sumError;
      const totalAmount = (sumData || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
      return NextResponse.json({ count: count ?? 0, totalAmount });
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('*,customers(*),models_types(model,type)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = (data || []).map((tx: any) => ({
      ...tx,
      model: tx.models_types?.model || '',
      model_type: tx.models_types?.type || '',
      due_date: tx.due_date,
      status: tx.status,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('transactions')
      .insert([body])
      .select('*,customers(*)')
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  // Implementation for PUT request
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '거래 ID가 필요합니다.' }, { status: 400 });

  // 1. files에서 해당 거래 참조 파일 먼저 삭제
  const { error: fileError } = await supabase.from('files').delete().eq('transaction_id', id);
  if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });

  // 2. 거래 삭제
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
} 