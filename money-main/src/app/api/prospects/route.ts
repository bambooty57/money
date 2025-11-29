import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create prospect', details: error.message },
        { status: 500 }
      );
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

