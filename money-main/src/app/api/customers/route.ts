import { NextResponse } from 'next/server';
import { typedQuery, SchemaChecker, createServerClient } from '@/lib/supabase';
import { 
  validateCustomerInsert, 
  validateCustomers,
  createValidationError
} from '@/lib/schema-validators';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// 성능 최적화: 스키마 체커 인스턴스
const schemaChecker = SchemaChecker.getInstance();

export async function GET(request: Request) {
  try {
    // 페이지네이션 및 필터링 파라미터
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '18');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const fields = searchParams.get('fields');
    const customerType = searchParams.get('customerType')?.split(',') || [];
    const address = searchParams.get('address') || '';
    const minUnpaid = searchParams.get('minUnpaid');
    const maxUnpaid = searchParams.get('maxUnpaid');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const hasTransactions = searchParams.get('hasTransactions') === 'true';
    
    // 페이지네이션 계산
    const offset = (page - 1) * pageSize;
    
    // 1. 필터(검색, hasTransactions 등) 먼저 적용
    let query = typedQuery.customers.selectAll();
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,mobile.ilike.%${search}%,business_no.ilike.%${search}%`);
    }
    
    // customerIdsSet를 함수 스코프에 선언하여 재사용
    let customerIdsSet: string[] = [];
    if (hasTransactions) {
      // 거래가 있는 고객 ID 목록 추출
      const { data: customerIdsWithTransactions } = await supabase
        .from('transactions')
        .select('customer_id')
        .not('customer_id', 'is', null);
      // null 제거
      customerIdsSet = Array.from(new Set((customerIdsWithTransactions || []).map(tx => tx.customer_id).filter((id): id is string => !!id)));
      if (customerIdsSet.length > 0) {
        query = query.in('id', customerIdsSet);
      } else {
        // 거래가 있는 고객이 없으면 빈 결과
        return NextResponse.json({ data: [], pagination: { total: 0, page, pageSize, totalPages: 0 } });
      }
    }
    
    // 정렬 적용
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // 2. 필터 적용 후 전체 고객 수 카운트
    let countQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
    if (search) {
      countQuery = countQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%,mobile.ilike.%${search}%,business_no.ilike.%${search}%`);
    }
    if (hasTransactions && customerIdsSet.length > 0) {
      countQuery = countQuery.in('id', customerIdsSet);
    }
    const { count: totalCount } = await countQuery;

    // 3. 필터 적용 후 range로 페이지네이션
    query = query.range(offset, offset + pageSize - 1);

    let customers = [];
    if (minUnpaid || maxUnpaid) {
      // 미수금 필터: 고객별 미납 합계 계산
      const { data: txs } = await supabase
        .from('transactions')
        .select('customer_id,amount,status')
        .eq('status', 'unpaid');
      const unpaidMap: Record<string, number> = {};
      (txs || []).forEach(tx => {
        if (tx.customer_id) {
          unpaidMap[tx.customer_id] = (unpaidMap[tx.customer_id] || 0) + (tx.amount || 0);
        }
      });
      const min = minUnpaid ? parseInt(minUnpaid, 10) : 0;
      const max = maxUnpaid ? parseInt(maxUnpaid, 10) : Number.MAX_SAFE_INTEGER;
      // 고객 목록 쿼리
      const { data: allCustomers } = await query;
      customers = (allCustomers || []).filter(c => {
        const unpaid = unpaidMap[c.id] || 0;
        return unpaid >= min && unpaid <= max;
      });
    } else {
      const { data: allCustomers } = await query;
      customers = allCustomers || [];
    }

    // 거래가 있는 고객만 필터링
    if (hasTransactions) {
      const { data: customerIdsWithTransactions } = await supabase
        .from('transactions')
        .select('customer_id')
        .not('customer_id', 'is', null);
      
      const customerIdsSet = new Set(
        (customerIdsWithTransactions || []).map(tx => tx.customer_id)
      );
      
      customers = customers.filter(customer => customerIdsSet.has(customer.id));
    }

    // 🚀 성능 최적화: N+1 문제 해결
    if (customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      
      // 1. 파일 정보 일괄 조회
      const { data: allFiles } = await supabase
        .from('files')
        .select('url, customer_id')
        .in('customer_id', customerIds)
        .limit(100); // 적절한 제한
      
      // 2. 거래 건수 일괄 조회
      const { data: transactionCounts } = await supabase
        .from('transactions')
        .select('customer_id')
        .in('customer_id', customerIds);
      
      // 3. 거래 및 입금 정보 일괄 조회
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select(`
          id, 
          customer_id, 
          amount, 
          status,
          payments(amount)
        `)
        .in('customer_id', customerIds);

      // 데이터 그룹화
      const filesByCustomer = new Map<string, any[]>();
      const transactionCountByCustomer = new Map<string, number>();
      const unpaidByCustomer = new Map<string, number>();

      // 파일 그룹화
      (allFiles || []).forEach(file => {
        if (file.customer_id && !filesByCustomer.has(file.customer_id)) {
          filesByCustomer.set(file.customer_id, []);
        }
        if (file.customer_id) {
          filesByCustomer.get(file.customer_id)!.push(file);
        }
      });

      // 거래 건수 계산
      (transactionCounts || []).forEach(tx => {
        if (tx.customer_id) {
          const count = transactionCountByCustomer.get(tx.customer_id) || 0;
          transactionCountByCustomer.set(tx.customer_id, count + 1);
        }
      });

      // 미수금 계산: 고객별 총매출과 총입금을 계산한 후 차이를 구함 (음수 잔액 포함)
      const customerTotals = new Map<string, { total_amount: number; total_paid: number }>();
      
      (allTransactions || []).forEach(tx => {
        if (!tx.customer_id) return;
        
        const paid = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const amount = tx.amount || 0;
        
        if (!customerTotals.has(tx.customer_id)) {
          customerTotals.set(tx.customer_id, { total_amount: 0, total_paid: 0 });
        }
        
        const totals = customerTotals.get(tx.customer_id)!;
        totals.total_amount += amount;
        totals.total_paid += paid;
      });
      
      // 고객별 미수금 계산 (총매출 - 총입금, 음수 포함)
      customerTotals.forEach((totals, customerId) => {
        const unpaid = totals.total_amount - totals.total_paid;
        unpaidByCustomer.set(customerId, unpaid);
      });

      // 고객 데이터에 정보 추가
      customers.forEach(customer => {
        // 사진 정보 추가 (최대 3개)
        (customer as any).photos = filesByCustomer.get(customer.id)?.slice(0, 3) || [];
        
        // 거래 건수 추가
        (customer as any).transaction_count = transactionCountByCustomer.get(customer.id) || 0;
        
        // 미수금 추가
        (customer as any).total_unpaid = unpaidByCustomer.get(customer.id) || 0;
      });
    }

    // 페이지네이션 정보는 헤더로 이동하고 원본 배열 반환
    return NextResponse.json({
      data: customers,
      pagination: {
        total: totalCount || 0,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
        cacheControl: 's-maxage=30, stale-while-revalidate=10',
      },
      meta: {
        search: search,
        sortBy: sortBy,
        sortOrder: sortOrder,
        fields: fields,
        customerType: customerType,
        address: address,
        minUnpaid: minUnpaid,
        maxUnpaid: maxUnpaid,
        startDate: startDate,
        endDate: endDate,
      },
    }, {
      headers: {
        // 페이지네이션 정보를 헤더로 전달
        'X-Total-Count': (totalCount || 0).toString(),
        'X-Page': page.toString(),
        'X-Page-Size': pageSize.toString(),
        'X-Total-Pages': Math.ceil((totalCount || 0) / pageSize).toString(),
        // 캐시 완전 비활성화
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        // CORS 헤더 (필요시)
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createValidationError(error),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // 신규 스키마 필드 매핑
    const insertData = {
      name: body.name,
      phone: body.phone,
      mobile: body.mobile,
      ssn: body.ssn,
      business_no: body.business_no,
      business_name: body.business_name,
      representative_name: body.representative_name,
      address: body.address_road,
      address_road: body.address_road,
      address_jibun: body.address_jibun,
      zipcode: body.zipcode,
      customer_type: body.customer_type,
      customer_type_multi: body.customer_type_multi,
      fax: body.fax,
    };
    const { data, error } = await supabase
      .from('customers')
      .insert(insertData)
      .select();
    if (error) {
      console.error('Database error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '이미 존재하는 고객입니다' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      );
    }
    // id 등 전체 row 반환 (프론트 사진 업로드 연동용)
    if (!data || !data[0]) {
      return NextResponse.json({}, {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    return NextResponse.json(data[0], {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createValidationError(error),
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
  if (!id) return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });

  // 1. 고객의 거래 ID 목록 조회
  const { data: transactions, error: txError } = await authenticatedSupabase.from('transactions').select('id').eq('customer_id', id);
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });
  const txIds = (transactions || []).map(tx => tx.id);

  // 2. payments에서 해당 거래 ID들에 연결된 입금 기록 삭제
  if (txIds.length > 0) {
    const { error: paymentError } = await authenticatedSupabase.from('payments').delete().in('transaction_id', txIds);
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  // 3. files에서 해당 거래 ID들에 연결된 파일 삭제
  if (txIds.length > 0) {
    const { error: fileError } = await authenticatedSupabase.from('files').delete().in('transaction_id', txIds);
    if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });
  }

  // 4. 고객 직접 연결된 파일들 삭제 (고객 사진 등)
  const { error: customerFileError } = await authenticatedSupabase.from('files').delete().eq('customer_id', id);
  if (customerFileError) return NextResponse.json({ error: customerFileError.message }, { status: 500 });

  // 5. 거래 삭제
  if (txIds.length > 0) {
    const { error: txDelError } = await authenticatedSupabase.from('transactions').delete().in('id', txIds);
    if (txDelError) return NextResponse.json({ error: txDelError.message }, { status: 500 });
  }

  // 6. 고객 삭제
  const { error } = await authenticatedSupabase.from('customers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
} 