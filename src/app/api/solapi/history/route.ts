/**
 * SMS 발송 이력 조회 API
 * 월별 발송 이력 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

/**
 * GET /api/solapi/history
 * 발송 이력 조회 (월별 필터링 가능)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM 형식
    const status = searchParams.get('status'); // success, failed, pending
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = getSupabase()
      .from('notification_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit);

    // 월별 필터링
    if (month) {
      const startDate = `${month}-01T00:00:00.000Z`;
      const endDate = getNextMonthFirstDay(month);
      query = query.gte('sent_at', startDate).lt('sent_at', endDate);
    }

    // 상태 필터링
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('발송 이력 조회 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notification history' },
        { status: 500 }
      );
    }

    // 통계 계산
    const stats = {
      total: data?.length || 0,
      success: data?.filter((h: any) => h.status === 'success').length || 0,
      failed: data?.filter((h: any) => h.status === 'failed').length || 0,
      pending: data?.filter((h: any) => h.status === 'pending').length || 0,
    };

    return NextResponse.json({
      success: true,
      data,
      stats,
    });

  } catch (error) {
    console.error('발송 이력 조회 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 다음 달 1일 날짜 문자열 반환 (ISO 형식)
 */
function getNextMonthFirstDay(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const formattedMonth = String(nextMonth).padStart(2, '0');
  return `${nextYear}-${formattedMonth}-01T00:00:00.000Z`;
}
