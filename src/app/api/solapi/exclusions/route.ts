/**
 * SMS 발송 제외 관리 API
 * 특정 고객을 해당 월 발송 대상에서 제외/포함
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

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

    const { data, error } = await getSupabase()
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

    // 이미 제외되었는지 확인 (이전 달 제외도 계속 유지되므로 해당 월 이하 모두 확인)
    const { data: existing } = await getSupabase()
      .from('sms_exclusions')
      .select('id')
      .eq('customer_id', customerId)
      .lte('exclusion_month', month)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Customer is already excluded' },
        { status: 409 }
      );
    }

    const { data, error } = await getSupabase()
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
      message: `${customerName} 고객이 발송 대상에서 제외되었습니다. 해제 전까지 매월 제외 상태가 유지됩니다.`
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
 * 제외는 해제 전까지 유지되므로 해당 고객의 기존 제외 기록을 모두 삭제
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

    const { error } = await getSupabase()
      .from('sms_exclusions')
      .delete()
      .eq('customer_id', customerId)
      .lte('exclusion_month', month);

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
