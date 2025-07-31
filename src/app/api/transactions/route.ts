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
    
    // 검색 파라미터 추가
    const search = url?.searchParams.get('search') || '';
    
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
    
    // 검색어가 있는 경우 고객별로 필터링
    let query = supabase
      .from('transactions')
      .select('*,customers(*),models_types(id,model,type),payments(*)')
      .neq('status', 'deleted');
    
    // 검색어가 있으면 고객명으로 필터링
    if (search.trim()) {
      // 먼저 검색어와 일치하는 고객들을 찾기
      const { data: matchingCustomers, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .or(`name.ilike.%${search}%,mobile.ilike.%${search}%,address.ilike.%${search}%,business_name.ilike.%${search}%,representative_name.ilike.%${search}%`);
      
      if (customerError) throw customerError;
      
      if (matchingCustomers && matchingCustomers.length > 0) {
        const customerIds = matchingCustomers.map(c => c.id);
        query = query.in('customer_id', customerIds);
      } else {
        // 검색 결과가 없으면 빈 결과 반환
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          }
        });
      }
    }
    
    // 전체 거래 수 카운트 (검색 조건 적용)
    const { count: totalCount } = await query;
    
    // 페이지네이션 적용된 거래 데이터
    const { data, error } = await query
      .order('created_at', { ascending: true })
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
  const customerId = searchParams.get('customer_id');
  
  if (!id && !customerId) {
    return NextResponse.json({ error: '거래 ID 또는 고객 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    if (customerId) {
      // 고객별 모든 거래 삭제
      // 1. 해당 고객의 모든 거래 ID 조회
      const { data: transactions, error: fetchError } = await authenticatedSupabase
        .from('transactions')
        .select('id')
        .eq('customer_id', customerId);
      
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
      
      if (!transactions || transactions.length === 0) {
        return NextResponse.json({ error: '해당 고객의 거래가 없습니다.' }, { status: 404 });
      }
      
      const transactionIds = transactions.map(tx => tx.id);
      
      // 2. files에서 해당 거래 참조 파일 먼저 삭제
      const { error: fileError } = await authenticatedSupabase
        .from('files')
        .delete()
        .in('transaction_id', transactionIds);
      
      if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });
      
      // 3. payments에서 해당 거래의 결제 내역 삭제
      const { error: paymentError } = await authenticatedSupabase
        .from('payments')
        .delete()
        .in('transaction_id', transactionIds);
      
      if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
      
      // 4. 거래 삭제
      const { error } = await authenticatedSupabase
        .from('transactions')
        .delete()
        .in('id', transactionIds);
      
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      
      return NextResponse.json({ 
        success: true, 
        deletedCount: transactionIds.length 
      });
    } else {
      // 단일 거래 삭제 (기존 로직)
      if (!id) {
        return NextResponse.json({ error: '거래 ID가 필요합니다.' }, { status: 400 });
      }
      
      // 1. files에서 해당 거래 참조 파일 먼저 삭제
      const { error: fileError } = await authenticatedSupabase
        .from('files')
        .delete()
        .eq('transaction_id', id);
      
      if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });
      
      // 2. payments에서 해당 거래의 결제 내역 삭제
      const { error: paymentError } = await authenticatedSupabase
        .from('payments')
        .delete()
        .eq('transaction_id', id);
      
      if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
      
      // 3. 거래 삭제
      const { error } = await authenticatedSupabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting transaction(s):', error);
    return NextResponse.json({ error: 'Failed to delete transaction(s)' }, { status: 500 });
  }
} 