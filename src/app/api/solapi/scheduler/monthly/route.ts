/**
 * 솔라피 자동 알림 스케줄러
 * 월말 자동 알림 기능
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getArrearsCustomers, 
  sendBulkArrearsNotifications,
  isMonthlyNotificationDay
} from '@/lib/solapi/service';

// Cron Job API 키 검증
function validateCronKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronKey = process.env.CRON_SECRET_KEY;
  
  if (!cronKey) return true; // 설정되지 않은 경우 허용 (개발 환경)
  
  return authHeader === `Bearer ${cronKey}`;
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
    if (!isMonthlyNotificationDay()) {
      return NextResponse.json({
        success: false,
        message: 'Today is not the monthly notification day',
        executed: false,
      });
    }

    // 미수금 고객 조회 (1원 이상)
    const minAmount = parseInt(process.env.MIN_ARREARS_AMOUNT || '1');
    const customers = await getArrearsCustomers(minAmount);

    if (customers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No customers with arrears found',
        executed: true,
        data: { total: 0, success: 0, failed: 0 },
      });
    }

    // 일괄 발송
    const result = await sendBulkArrearsNotifications(customers, 'monthly');

    return NextResponse.json({
      success: result.failed === 0,
      message: `Monthly notification sent to ${result.success}/${result.total} customers`,
      executed: true,
      data: result,
    });

  } catch (error) {
    console.error('월말 알림 스케줄러 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
