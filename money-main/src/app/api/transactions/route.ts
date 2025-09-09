import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = request instanceof Request ? new URL(request.url) : null;
    if (!url) {
      return NextResponse.json({ error: 'Invalid request URL' }, { status: 400 });
    }
    
    const countOnly = url.searchParams.get('count') === '1';
    
    // 페이지네이션 파라미터
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get('pageSize') || '15')));
    const offset = (page - 1) * pageSize;
    

    
    if (countOnly) {
      // 🚀 성능 최적화: 단일 쿼리로 카운트와 합계 계산
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'deleted');
      
      if (error) {
        console.error('Count query error:', error);
        throw new Error(`Count query failed: ${error.message}`);
      }
      
      // 전체 금액 계산을 위한 별도 쿼리
      const { data: amountData, error: amountError } = await supabase
        .from('transactions')
        .select('amount')
        .neq('status', 'deleted');
      
      if (amountError) {
        console.error('Amount query error:', amountError);
        throw new Error(`Amount query failed: ${amountError.message}`);
      }
      
      const totalAmount = (amountData || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
      
      return NextResponse.json({ count: count || 0, totalAmount });
    }
    
    // 🚀 성능 최적화: 간단하고 안전한 쿼리
    let query = supabase
      .from('transactions')
      .select(`
        id,
        amount,
        balance,
        created_at,
        customer_id,
        description,
        due_date,
        model,
        model_type,
        models_types_id,
        paid_amount,
        paid_ratio,
        status,
        type,
        unpaid_amount,
        updated_at
      `)
      .neq('status', 'deleted');
    

    
    // 전체 거래 수 카운트 (검색 조건 적용)
    const { data: countData } = await query.select('id');
    const totalCount = countData?.length || 0;
    
    // 페이지네이션 적용된 거래 데이터
    const { data, error } = await query
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
      
    if (error) {
      console.error('Main query error:', error);
      throw new Error(`Main query failed: ${error.message}`);
    }
    
    // 🚀 성능 최적화: 배치로 고객 정보 조회
    const customerIds = [...new Set((data || []).map(tx => tx.customer_id).filter((id): id is string => id !== null))];
    let customersMap = new Map();
    
    if (customerIds.length > 0) {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, phone, mobile, business_name, representative_name, address')
        .in('id', customerIds);
      
      if (customersError) {
        console.error('Customers query error:', customersError);
        // 고객 정보 조회 실패는 치명적이지 않으므로 계속 진행
      } else {
        customersMap = new Map(
          (customersData || []).map(c => [c.id, c])
        );
      }
    }
    
    // 🚀 성능 최적화: 배치로 모델/타입 정보 조회
    const transactionIds = (data || []).map(tx => tx.id);
    let modelsTypesMap = new Map();
    
    if (transactionIds.length > 0) {
      const { data: modelsTypesData, error: modelsTypesError } = await supabase
        .from('models_types')
        .select('id, model, type')
        .in('id', (data || []).map(tx => tx.models_types_id).filter((id): id is string => id !== null));
      
      if (modelsTypesError) {
        console.error('Models types query error:', modelsTypesError);
        // 모델/타입 조회 실패는 치명적이지 않으므로 계속 진행
      } else {
        modelsTypesMap = new Map(
          (modelsTypesData || []).map(mt => [mt.id, mt])
        );
      }
    }
    
    // 🚀 성능 최적화: 배치로 입금 정보 조회
    let paymentsMap = new Map();
    
    if (transactionIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('transaction_id, amount, method, paid_at')
        .in('transaction_id', transactionIds);
      
      if (paymentsError) {
        console.error('Payments query error:', paymentsError);
        // payments 조회 실패는 치명적이지 않으므로 계속 진행
      } else {
        // 거래별로 입금 정보 그룹화
        paymentsMap = new Map();
        (paymentsData || []).forEach(payment => {
          if (!paymentsMap.has(payment.transaction_id)) {
            paymentsMap.set(payment.transaction_id, []);
          }
          paymentsMap.get(payment.transaction_id).push(payment);
        });
      }
    }
    
    // 결과 데이터 구성
    const result = (data || []).map((tx: any) => {
      const customer = customersMap.get(tx.customer_id);
      const modelType = modelsTypesMap.get(tx.models_types_id);
      const payments = paymentsMap.get(tx.id) || [];
      
      return {
        ...tx,
        customers: customer || null,
        model: modelType?.model || tx.model || '',
        model_type: modelType?.type || tx.model_type || '',
        payments: payments,
        due_date: tx.due_date,
        status: tx.status,
      };
    });
    
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      error: '거래 데이터를 불러오는데 실패했습니다.',
      details: errorMessage 
    }, { status: 500 });
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