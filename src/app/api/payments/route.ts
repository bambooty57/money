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
  const { transaction_id, amount, paid_at, method, payer_name, cash_place, cash_receiver, cash_detail, account_number, account_holder, note, paid_location, paid_by, bank_name } = body;
  // 변제내역 저장
  const paymentData: any = { transaction_id, amount, paid_at, method, payer_name };
  if (method === '현금') {
    paymentData.cash_place = cash_place;
    paymentData.cash_receiver = cash_receiver;
    paymentData.cash_detail = cash_detail;
  }
  if (method === '계좌이체') {
    paymentData.account_number = account_number;
    paymentData.account_holder = account_holder;
    paymentData.note = note;
    paymentData.bank_name = bank_name;
  }
  if (method === '카드') {
    paymentData.bank_name = bank_name;
    paymentData.paid_location = paid_location;
    paymentData.paid_by = paid_by;
    paymentData.note = note;
  }
  if (method === '중고인수') {
    paymentData.used_model_type = body.used_model_type;
    paymentData.used_model = body.used_model;
    paymentData.used_place = body.used_place;
    paymentData.used_by = body.used_by;
    paymentData.used_at = body.used_at;
    paymentData.note = note;
  }
  if (method === '융자') {
    paymentData.bank_name = bank_name;
    paymentData.note = note;
  }
  const { data, error } = await supabase.from('payments').insert([paymentData]).select();
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