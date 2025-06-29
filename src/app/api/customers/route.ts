import { NextResponse } from 'next/server';
import { typedQuery, SchemaChecker } from '@/lib/supabase';
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
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
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
    
    // 스키마 체크는 임시로 비활성화
    // if (process.env.NODE_ENV === 'development') {
    //   await schemaChecker.checkTableSchema('customers');
    // }
    
    // 페이지네이션 계산
    const offset = (page - 1) * pageSize;
    
    // 성능 최적화: 직접 supabase 쿼리 구성
    let query = typedQuery.customers.selectAll();
    
    // 검색 조건 적용 (성능 최적화: 인덱스를 활용한 검색)
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,business_number.ilike.%${search}%`);
    }
    
    // 정렬 적용
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });
    
    // 페이지네이션 적용 (성능 최적화: LIMIT/OFFSET 대신 range 사용)
    query = query.range(offset, offset + pageSize - 1);
    
    // 전체 고객 수 카운트 쿼리 (페이지네이션 정보용)
    const { count: totalCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact' });

    let customers = [];
    if (minUnpaid || maxUnpaid) {
      // 미수금 필터: 고객별 미납 합계 계산
      const { data: txs } = await supabase
        .from('transactions')
        .select('customer_id,amount,status')
        .eq('status', 'unpaid');
      const unpaidMap = {};
      (txs || []).forEach(tx => {
        unpaidMap[tx.customer_id] = (unpaidMap[tx.customer_id] || 0) + (tx.amount || 0);
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
    // 사진 동기화
    for (const customer of customers) {
      const { data: files } = await supabase
        .from('files')
        .select('url')
        .eq('customer_id', customer.id)
        .limit(3);
      customer.photos = Array.isArray(files) ? files : [];

      // 거래건수 추가
      const { count: transaction_count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('customer_id', customer.id);
      customer.transaction_count = transaction_count || 0;
    }

    // 런타임 검증을 임시로 완전히 제거
    // const validatedData = validateCustomers(data || []);

    // 페이지네이션 정보는 헤더로 이동하고 원본 배열 반환
    return NextResponse.json({
      data: customers,
      pagination: {
        total: totalCount || 0,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
        cacheControl: search 
          ? 's-maxage=60, stale-while-revalidate=30' 
          : 's-maxage=300, stale-while-revalidate=60',
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
        // 성능 최적화: 검색 결과는 짧은 캐시, 기본 목록은 긴 캐시
        'Cache-Control': search 
          ? 's-maxage=60, stale-while-revalidate=30' 
          : 's-maxage=300, stale-while-revalidate=60',
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