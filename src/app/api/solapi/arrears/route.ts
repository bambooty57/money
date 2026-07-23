/**
 * 솔라피 API 라우트
 * 미수금 알림 발송 관련 API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getArrearsCustomers, 
  sendArrearsNotification, 
  sendBulkArrearsNotifications,
  isMonthlyNotificationDay,
  getNotificationHistory,
  createNotificationMessage 
} from '@/lib/solapi/service';
import type { ArrearsCustomer } from '@/types/solapi';

// API 키 검증
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  return apiKey === process.env.SOLAPI_WEBHOOK_API_KEY;
}

/**
 * GET /api/solapi/arrears
 * 미수금 고객 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // API 키 검증 (선택적)
    if (process.env.SOLAPI_WEBHOOK_API_KEY && !validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const minAmount = parseInt(searchParams.get('minAmount') || '1');
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 특정 고객의 알림 이력 조회
    if (customerId) {
      const history = await getNotificationHistory(customerId, limit);
      return NextResponse.json({ success: true, data: history });
    }

    // 미수금 고객 목록 조회
    const customers = await getArrearsCustomers(minAmount);
    
    return NextResponse.json({ 
      success: true, 
      data: customers,
      meta: {
        total: customers.length,
        totalArrears: customers.reduce((sum, c) => sum + c.totalArrears, 0),
      }
    });

  } catch (error) {
    console.error('미수금 조회 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/solapi/arrears
 * 미수금 알림 발송
 */
export async function POST(request: NextRequest) {
  try {
    // API 키 검증
    if (process.env.SOLAPI_WEBHOOK_API_KEY && !validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      action, 
      customerId, 
      customers, 
      notificationType = 'manual',
      minAmount = 1 
    } = body;

    // 단일 고객 알림 발송
    if (action === 'send' && customerId) {
      const arrearsCustomers = await getArrearsCustomers(minAmount);
      const customer = arrearsCustomers.find(c => c.id === customerId);
      
      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found or no arrears' },
          { status: 404 }
        );
      }

      const result = await sendArrearsNotification(customer, notificationType);
      
      return NextResponse.json({
        success: result.success,
        data: {
          customer,
          messageId: result.messageId,
        },
        error: result.errorMessage,
      });
    }

    // 일괄 알림 발송
    if (action === 'send-bulk' && Array.isArray(customers)) {
      const result = await sendBulkArrearsNotifications(customers, notificationType);
      
      return NextResponse.json({
        success: result.failed === 0,
        data: result,
      });
    }

    // 월말 자동 알림 발송
    if (action === 'send-monthly') {
      if (!isMonthlyNotificationDay()) {
        return NextResponse.json({
          success: false,
          error: 'Today is not the monthly notification day',
        });
      }

      const arrearsCustomers = await getArrearsCustomers(minAmount);
      const result = await sendBulkArrearsNotifications(arrearsCustomers, 'monthly');
      
      return NextResponse.json({
        success: result.failed === 0,
        data: result,
      });
    }

    // 미리보기 메시지 생성
    if (action === 'preview' && customerId) {
      const arrearsCustomers = await getArrearsCustomers(minAmount);
      const customer = arrearsCustomers.find(c => c.id === customerId);
      
      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const message = createNotificationMessage(customer);
      
      return NextResponse.json({
        success: true,
        data: {
          customer,
          message,
          estimatedLength: message.length,
          smsType: message.length > 90 ? 'LMS' : 'SMS',
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('알림 발송 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
