/**
 * 솔라피 자동 알림 스케줄러
 * 월말 자동 알림 기능 (제외 고객 필터링 포함)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  getArrearsCustomers, 
  sendBulkArrearsNotifications,
  isMonthlyNotificationDay
} from '@/lib/solapi/service';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// Cron Job API 키 검증
function validateCronKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronKey = process.env.CRON_SECRET_KEY;
  
  if (!cronKey) return true; // 설정되지 않은 경우 허용 (개발 환경)
  
  return authHeader === `Bearer ${cronKey}`;
}

/**
 * 제외 고객 ID 목록 조회
 * 이전 달에 제외된 고객은 해제 전까지 계속 제외 상태 유지
 */
async function getExcludedCustomerIds(month: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from('sms_exclusions')
    .select('customer_id')
    .lte('exclusion_month', month);

  if (error) {
    console.error('제외 목록 조회 오류:', error);
    return new Set();
  }

  return new Set(data?.map((ex: any) => ex.customer_id) || []);
}

/**
 * 스케줄러 실행 결과를 DB에 저장
 */
async function saveSchedulerRun(result: {
  month: string;
  totalCustomers: number;
  excludedCount: number;
  sentCount: number;
  successCount: number;
  failedCount: number;
  executedAt: string;
  status: 'success' | 'partial' | 'failed';
}) {
  try {
    await getSupabase().from('scheduler_runs').insert(result as any);
  } catch (error) {
    console.error('스케줄러 실행 이력 저장 오류:', error);
  }
}

/**
 * GET /api/solapi/scheduler/monthly
 * 월말 자동 알림 실행 (Vercel Cron 또는 외부 스케줄러에서 호출)
 */
export async function GET(request: NextRequest) {
  try {
    // Cron 키 검증
    if (!validateCronKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 월말 알림일 확인
    if (!(await isMonthlyNotificationDay())) {
      return NextResponse.json({
        success: false,
        message: 'Today is not the monthly notification day',
        executed: false,
      });
    }

    return await executeMonthlySend();
  } catch (error) {
    console.error('월말 알림 스케줄러 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/solapi/scheduler/monthly
 * 수동으로 즉시 발송 실행 (messages 페이지에서 호출)
 */
export async function POST(request: NextRequest) {
  try {
    return await executeMonthlySend();
  } catch (error) {
    console.error('수동 발송 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 월별 발송 공통 로직
 */
async function executeMonthlySend() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 1. 미수금 고객 조회 (1원 이상)
  const minAmount = parseInt(process.env.MIN_ARREARS_AMOUNT || '1');
  const allCustomers = await getArrearsCustomers(minAmount);

  if (allCustomers.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No customers with arrears found',
      executed: true,
      data: { 
        total: 0, 
        excluded: 0,
        scheduled: 0,
        success: 0, 
        failed: 0 
      },
    });
  }

  // 2. 제외 고객 필터링
  const excludedIds = await getExcludedCustomerIds(currentMonth);
  const customersToSend = allCustomers.filter(c => !excludedIds.has(c.id));

  if (customersToSend.length === 0) {
    await saveSchedulerRun({
      month: currentMonth,
      totalCustomers: allCustomers.length,
      excludedCount: excludedIds.size,
      sentCount: 0,
      successCount: 0,
      failedCount: 0,
      executedAt: now.toISOString(),
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      message: `All ${allCustomers.length} customers are excluded for ${currentMonth}`,
      executed: true,
      data: { 
        total: allCustomers.length, 
        excluded: excludedIds.size,
        scheduled: 0,
        success: 0, 
        failed: 0 
      },
    });
  }

  // 3. 일괄 발송
  const result = await sendBulkArrearsNotifications(customersToSend, 'monthly');

  // 4. 실행 결과 저장
  const status = result.failed === 0 ? 'success' : result.success > 0 ? 'partial' : 'failed';
  await saveSchedulerRun({
    month: currentMonth,
    totalCustomers: allCustomers.length,
    excludedCount: excludedIds.size,
    sentCount: result.total,
    successCount: result.success,
    failedCount: result.failed,
    executedAt: now.toISOString(),
    status,
  });

  return NextResponse.json({
    success: result.failed === 0,
    message: `Monthly notification sent to ${result.success}/${result.total} customers (${excludedIds.size} excluded)`,
    executed: true,
    data: { 
      total: allCustomers.length, 
      excluded: excludedIds.size,
      scheduled: result.total,
      success: result.success, 
      failed: result.failed 
    },
  });
}
