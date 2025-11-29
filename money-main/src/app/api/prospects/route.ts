import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 하드코딩된 Supabase 설정 (환경 변수 문제 해결)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';
// Service Role Key는 환경변수에서만 가져옴 (보안상 하드코딩 금지)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 인증된 Supabase 클라이언트 생성 헬퍼 함수
function createAuthenticatedClient(accessToken?: string) {
  // Service Role Key가 있으면 사용 (RLS 우회)
  if (supabaseServiceKey) {
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
  }
  // 없으면 anon key + access token 사용
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

// Authorization 헤더에서 토큰 추출
function extractToken(request: Request): string | undefined {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceType = searchParams.get('deviceType');
    const customerId = searchParams.get('customer_id');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '18');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const accessToken = extractToken(request);
    const supabase = createAuthenticatedClient(accessToken);

    // 기본 쿼리 구성 (관계 조회는 별도로 처리)
    let query = supabase
      .from('customer_prospects')
      .select(`
        *,
        customers (
          id,
          name,
          mobile,
          phone,
          address_road,
          address_jibun,
          business_name,
          customer_type
        )
      `, { count: 'exact' });

    // 고객 ID 필터
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    // 기종 필터
    if (deviceType && deviceType !== '전체') {
      query = query.eq('prospect_device_type', deviceType);
    }

    // 검색 필터 (고객명, 연락처)
    if (search) {
      query = query.or(`customers.name.ilike.%${search}%,customers.mobile.ilike.%${search}%,customers.phone.ilike.%${search}%`);
    }

    // 정렬
    const orderColumn = sortBy === 'name' ? 'customers.name' : 'created_at';
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // 페이지네이션
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prospects', details: error.message },
        { status: 500 }
      );
    }

    // models_types 정보를 별도로 조회하여 매핑
    const modelIds = [...new Set((data || [])
      .map(p => p.current_device_model_id)
      .filter((id): id is string => id !== null))];

    let modelsTypesMap = new Map();
    if (modelIds.length > 0) {
      const { data: modelsTypesData, error: modelsTypesError } = await supabase
        .from('models_types')
        .select('id, model, type')
        .in('id', modelIds);

      if (modelsTypesError) {
        console.error('Models types query error:', modelsTypesError);
      } else {
        modelsTypesMap = new Map(
          (modelsTypesData || []).map(mt => [mt.id, mt])
        );
      }
    }

    // 결과에 models_types 정보 추가
    const enrichedData = (data || []).map(prospect => ({
      ...prospect,
      models_types: prospect.current_device_model_id 
        ? modelsTypesMap.get(prospect.current_device_model_id) || null
        : null,
    }));

    return NextResponse.json({
      data: enrichedData,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error: any) {
    console.error('API error:', error);
    console.error('Error details:', error?.message, error?.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, prospect_device_type, prospect_device_model, current_device_model, current_device_model_id } = body;

    if (!customer_id || !prospect_device_type) {
      return NextResponse.json(
        { error: 'customer_id and prospect_device_type are required' },
        { status: 400 }
      );
    }

    const accessToken = extractToken(request);
    const supabase = createAuthenticatedClient(accessToken);
    
    console.log('🔍 가망고객 저장 요청:', { customer_id, prospect_device_type, prospect_device_model, current_device_model });
    console.log('🔑 Service Role Key 존재:', !!supabaseServiceKey);
    console.log('🎫 Access Token 존재:', !!accessToken);

    // 항상 새 레코드 생성 (같은 고객이 같은 기종을 여러 개 등록할 수 있도록)
    const insertData: Database['public']['Tables']['customer_prospects']['Insert'] = {
      customer_id,
      prospect_device_type,
      prospect_device_model: (Array.isArray(prospect_device_model) && prospect_device_model.length > 0) ? prospect_device_model : null,
      current_device_model: current_device_model || null,
      current_device_model_id: current_device_model_id || null,
    };

    const { data, error } = await supabase
      .from('customer_prospects')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Insert error:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      return NextResponse.json(
        { error: 'Failed to create prospect', details: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      );
    }

    console.log('✅ 가망고객 저장 성공:', data);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customer_id is required' },
        { status: 400 }
      );
    }

    const accessToken = extractToken(request);
    const supabase = createAuthenticatedClient(accessToken);

    const { error } = await supabase
      .from('customer_prospects')
      .delete()
      .eq('customer_id', customerId);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete prospects', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

