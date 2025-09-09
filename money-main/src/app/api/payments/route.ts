import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const transaction_id = searchParams.get('transaction_id');
  let query = supabase.from('payments').select('*, detail').order('paid_at', { ascending: true });
  if (transaction_id) query = query.eq('transaction_id', transaction_id);
  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { transaction_id, amount, paid_at, method, payer_name, cash_place, cash_receiver, cash_detail, account_number, account_holder, note, paid_location, paid_by, bank_name, otherReason, cheques } = body;
  // 변제내역 저장
  const paymentData: any = { transaction_id, amount: Math.round(Number(amount)), paid_at, method, payer_name };
  if (method === '현금') {
    paymentData.cash_place = cash_place;
    paymentData.cash_receiver = cash_receiver;
    paymentData.cash_detail = cash_detail;
    paymentData.note = note;
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
    paymentData.detail = body.detail;
    paymentData.note = note;
  }
  if (method === '기타') {
    paymentData.detail = body.detail;
    paymentData.note = body.note;
  }
  // ✅ 수표일 때 cheques, note 반드시 포함
  if (method === '수표') {
    paymentData.cheques = cheques;
    paymentData.note = note;
  }
  // ✅ note는 항상 포함(중복 방지 위해 마지막에 덮어씀)
  if (note !== undefined) paymentData.note = note;
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
  // Authorization 헤더에서 토큰 추출
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authorization token required' }, 
      { status: 401 }
    )
  }
  
  // 인증된 Supabase 클라이언트 생성
  const authenticatedSupabase = createServerClient(token)
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ids = searchParams.get('ids'); // 다중 삭제를 위한 ids 파라미터 추가
  
  if (!id && !ids) return NextResponse.json({ error: 'Payment id or ids required' }, { status: 400 });
  
  try {
    if (ids) {
      // 다중 삭제 로직
      const paymentIds = ids.split(',').filter(id => id.trim());
      if (paymentIds.length === 0) {
        return NextResponse.json({ error: 'Valid payment ids required' }, { status: 400 });
      }
      
      // 삭제 전 payment 정보 조회 (거래ID와 금액 필요)
      const { data: payments, error: fetchError } = await authenticatedSupabase
        .from('payments')
        .select('id, transaction_id, amount')
        .in('id', paymentIds);
      
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
      if (!payments || payments.length === 0) {
        return NextResponse.json({ error: 'Payments not found' }, { status: 404 });
      }
      
      // 거래별로 그룹화
      const transactionGroups = payments.reduce((acc, payment) => {
        if (payment.transaction_id) {
          if (!acc[payment.transaction_id]) {
            acc[payment.transaction_id] = [];
          }
          acc[payment.transaction_id].push(payment);
        }
        return acc;
      }, {} as Record<string, any[]>);
      
      // 입금 내역 삭제
      const { error: deleteError } = await authenticatedSupabase
        .from('payments')
        .delete()
        .in('id', paymentIds);
      
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      
      // 각 거래의 paid_amount, unpaid_amount, paid_ratio 갱신
      const updatePromises = Object.entries(transactionGroups).map(async ([transactionId, transactionPayments]) => {
        const { data: remainingPayments } = await authenticatedSupabase
          .from('payments')
          .select('amount')
          .eq('transaction_id', transactionId);
        
        const paidSum = (remainingPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const { data: tx } = await authenticatedSupabase
          .from('transactions')
          .select('amount')
          .eq('id', transactionId)
          .single();
        
        const unpaid = (tx?.amount || 0) - paidSum;
        const ratio = tx?.amount ? Math.round((paidSum / tx.amount) * 100) : 0;
        
        return authenticatedSupabase
          .from('transactions')
          .update({ 
            paid_amount: paidSum, 
            unpaid_amount: unpaid, 
            paid_ratio: ratio 
          })
          .eq('id', transactionId);
      });
      
      await Promise.all(updatePromises);
      
      return NextResponse.json({ 
        success: true, 
        deletedCount: paymentIds.length,
        message: `${paymentIds.length}개의 입금내역이 삭제되었습니다.`
      });
      
    } else {
      // 단일 삭제 로직 (기존 코드)
      if (!id) return NextResponse.json({ error: 'No payment id provided' }, { status: 400 });
      
      // 삭제 전 payment 정보 조회(거래ID 필요)
      const { data: payment, error: fetchError } = await authenticatedSupabase.from('payments').select('transaction_id, amount').eq('id', id).single();
      if (fetchError || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      
      // 삭제
      const { error } = await authenticatedSupabase.from('payments').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      
      // 거래의 paid_amount, unpaid_amount, paid_ratio 갱신
      if (payment.transaction_id) {
        const { data: payments } = await authenticatedSupabase.from('payments').select('amount').eq('transaction_id', payment.transaction_id);
        const paidSum = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const { data: tx } = await authenticatedSupabase.from('transactions').select('amount').eq('id', payment.transaction_id).single();
        const unpaid = (tx?.amount || 0) - paidSum;
        const ratio = tx?.amount ? Math.round((paidSum / tx.amount) * 100) : 0;
        await authenticatedSupabase.from('transactions').update({ paid_amount: paidSum, unpaid_amount: unpaid, paid_ratio: ratio }).eq('id', payment.transaction_id);
        return NextResponse.json({ success: true, paid_amount: paidSum, unpaid_amount: unpaid, paid_ratio: ratio });
      }
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting payment(s):', error);
    return NextResponse.json({ error: 'Failed to delete payment(s)' }, { status: 500 });
  }
} 