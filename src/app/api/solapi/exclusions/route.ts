/**
 * SMS 발송 제외 관리 API
 * 특정 고객을 해당 월 발송 대상에서 제외/포함
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/solapi/exclusions
 * 특정 월의 제외 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM 형식

    if (!month) {
      return NextResponse.json(
        { error: 'Month parameter is required (YYYY-MM)' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('sms_exclusions')
      .select('*')
      .eq('exclusion_month', month)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('제외 목록 조회 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch exclusions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('제외 목록 조회 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/solapi/exclusions
 * 고객을 발송 대상에서 제외
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, customerName, month, reason, excludedBy } = body;

    if (!customerId || !customerName || !month) {
      return NextResponse.json(
        { error: 'Customer ID, name, and month are required' },
        { status: 400 }
      );
    }

    // 이미 제외되었는지 확인
    const { data: existing } = await supabase
      .from('sms_exclusions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('exclusion_month', month)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Customer is already excluded for this month' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('sms_exclusions')
      .insert({
        customer_id: customerId,
        customer_name: customerName,
        exclusion_month: month,
        reason: reason || null,
        excluded_by: excludedBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('제외 처리 오류:', error);
      return NextResponse.json(
        { error: 'Failed to exclude customer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: `${customerName} 고객이 ${month} 발송 대상에서 제외되었습니다.`
    });

  } catch (error) {
    console.error('제외 처리 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/solapi/exclusions
 * 제외 취소 (다시 발송 대상에 포함)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const month = searchParams.get('month');

    if (!customerId || !month) {
      return NextResponse.json(
        { error: 'Customer ID and month are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('sms_exclusions')
      .delete()
      .eq('customer_id', customerId)
      .eq('exclusion_month', month);

    if (error) {
      console.error('제외 취소 오류:', error);
      return NextResponse.json(
        { error: 'Failed to remove exclusion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: '제외가 취소되었습니다.'
    });

  } catch (error) {
    console.error('제외 취소 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
