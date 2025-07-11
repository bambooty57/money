import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = request instanceof Request ? new URL(request.url) : null;
    const countOnly = url?.searchParams.get('count') === '1';
    
    // 페이지네이션 파라미터
    const page = parseInt(url?.searchParams.get('page') || '1');
    const pageSize = parseInt(url?.searchParams.get('pageSize') || '15');
    const offset = (page - 1) * pageSize;
    
    if (countOnly) {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .neq('status', 'deleted');
      if (error) throw error;
      const { data: sumData, error: sumError } = await supabase
        .from('transactions')
        .select('amount')
        .neq('status', 'deleted');
      if (sumError) throw sumError;
      const totalAmount = (sumData || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
      return NextResponse.json({ count: count ?? 0, totalAmount });
    }
    
    // 전체 거래 수 카운트
    const { count: totalCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .neq('status', 'deleted');
    
    // 페이지네이션 적용된 거래 데이터
    const { data, error } = await supabase
      .from('transactions')
      .select('*,customers(*),models_types(model,type),payments(*)')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
      
    if (error) throw error;
    
    const result = (data || []).map((tx: any) => ({
      ...tx,
      model: tx.models_types?.model || '',
      model_type: tx.models_types?.type || '',
      due_date: tx.due_date,
      status: tx.status,
    }));
    
    return NextResponse.json({
      data: result,
      pagination: {
        page,
        pageSize,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
        hasNext: page < Math.ceil((totalCount || 0) / pageSize),
        hasPrev: page > 1,
      }
    });
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
  
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' }, 
        { status: 400 }
      )
    }
    
    const { data, error } = await authenticatedSupabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select('*,customers(*)')
      .single();
      
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
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
  if (!id) return NextResponse.json({ error: '거래 ID가 필요합니다.' }, { status: 400 });

  // 1. files에서 해당 거래 참조 파일 먼저 삭제
  const { error: fileError } = await authenticatedSupabase.from('files').delete().eq('transaction_id', id);
  if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });

  // 2. 거래 삭제
  const { error } = await authenticatedSupabase.from('transactions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
} 