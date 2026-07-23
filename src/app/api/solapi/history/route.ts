/**
 * SMS 발송 이력 조회 API
 * 월별 발송 이력 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    let query = supabase
      .from('notification_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit);

    // 월별 필터링
    if (month) {
      const startDate = `${month}-01T00:00:00.000Z`;
      const endDate = `${month}-31T23:59:59.999Z`;
      query = query.gte('sent_at', startDate).lte('sent_at', endDate);
    }

    // 상태별 필터링
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('발송 이력 조회 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    // 통계 계산
    const stats = {
      total: count || 0,
      success: data?.filter((h: any) => h.status === 'success').length || 0,
      failed: data?.filter((h: any) => h.status === 'failed').length || 0,
      pending: data?.filter((h: any) => h.status === 'pending').length || 0,
      totalAmount: data?.reduce((sum: number, h: any) => sum + (h.amount || 0), 0) || 0,
    };

    return NextResponse.json({
      success: true,
      data: data || [],
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
