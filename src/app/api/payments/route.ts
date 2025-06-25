import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const transaction_id = searchParams.get('transaction_id');
  let query = supabase.from('payments').select('*').order('paid_at', { ascending: true });
  if (transaction_id) query = query.eq('transaction_id', transaction_id);
  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { transaction_id, amount, paid_at, method, payer_name } = body;
  // 변제내역 저장
  const { data, error } = await supabase.from('payments').insert([{ transaction_id, amount, paid_at, method, payer_name }]).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 거래의 paid_amount, unpaid_amount, paid_ratio 갱신
  const { data: payments } = await supabase.from('payments').select('amount').eq('transaction_id', transaction_id);
  const paidSum = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const { data: tx } = await supabase.from('transactions').select('amount').eq('id', transaction_id).single();
  const unpaid = (tx?.amount || 0) - paidSum;
  const ratio = tx?.amount ? Math.round((paidSum / tx.amount) * 100) : 0;
  await supabase.from('transactions').update({ paid_amount: paidSum, unpaid_amount: unpaid, paid_ratio: ratio }).eq('id', transaction_id);
  return NextResponse.json(data[0]);
}

export async function PUT(request: Request) {
  // Implementation for PUT request
}

export async function DELETE(request: Request) {
  // Implementation for DELETE request
} 