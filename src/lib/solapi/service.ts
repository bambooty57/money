/**
 * 미수금 알림 서비스
 * 고객의 미수금을 조회하고 알림을 발송하는 기능
 */

import { createClient } from '@supabase/supabase-js';
import { sendSMS, sendAlimtalk, getBalance } from './client';
import type { 
  ArrearsCustomer, 
  ArrearsNotificationConfig, 
  NotificationHistory,
  SolapiCredentials,
  SolapiMessageRequest 
} from '@/types/solapi';

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 솔라피 인증 정보 (환경 변수에서 로드)
const solapiCredentials: SolapiCredentials = {
  apiKey: process.env.SOLAPI_API_KEY || '',
  apiSecret: process.env.SOLAPI_API_SECRET || '',
  senderNumber: process.env.SOLAPI_SENDER_NUMBER || '',
};

// 기본 알림 설정
const defaultConfig: ArrearsNotificationConfig = {
  monthlyDay: 25,           // 매월 25일
  minArrearsAmount: 1,      // 1원 이상 (모든 미수금 대상)
  messageTemplate: `{customerName}고객님 매월 정기발송 메세지입니다 {month}월{day}일 기준 잔액이 {amount}원입니다 농협 302-2602-3276-61(정현목) 입금해 주시면 감사하겠습니다 자세한 내용은 010-2602-3276 상담 주세요`,
};

/**
 * 미수금 고객 조회
 * @param minAmount - 최소 미수금액
 * @returns 미수금 고객 목록
 */
export async function getArrearsCustomers(minAmount: number = defaultConfig.minArrearsAmount): Promise<ArrearsCustomer[]> {
  try {
    // 거래 테이블에서 미수금이 있는 고객 조회 (payments 테이블 조인)
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        customer_id,
        amount,
        created_at,
        customers:customer_id (id, name, mobile, phone),
        payments(amount)
      `)
      .eq('status', 'unpaid')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('미수금 조회 오류:', error);
      return [];
    }

    // 고객별로 미수금 집계
    const customerMap = new Map<string, ArrearsCustomer>();

    transactions?.forEach((tx: any) => {
      const customer = tx.customers;
      if (!customer) return;

      // mobile이 없으면 phone 사용
      const contactNumber = customer.mobile || customer.phone;
      if (!contactNumber) return;

      // payments 테이블에서 입금액 합계 계산
      const paidAmount = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const arrearsAmount = (tx.amount || 0) - paidAmount;
      if (arrearsAmount <= 0) return;

      if (customerMap.has(customer.id)) {
        const existing = customerMap.get(customer.id)!;
        existing.totalArrears += arrearsAmount;
        existing.transactionCount += 1;
      } else {
        customerMap.set(customer.id, {
          id: customer.id,
          name: customer.name,
          mobile: contactNumber,
          totalArrears: arrearsAmount,
          lastTransactionDate: tx.created_at,
          transactionCount: 1,
        });
      }
    });

    // 최소 금액 이상인 고객만 필터링
    return Array.from(customerMap.values())
      .filter(customer => customer.totalArrears >= minAmount)
      .sort((a, b) => b.totalArrears - a.totalArrears);

  } catch (error) {
    console.error('미수금 조회 중 오류:', error);
    return [];
  }
}

/**
 * 이름으로 미수금 고객 검색
 * @param customerName - 검색할 고객명
 * @param minAmount - 최소 미수금액
 * @returns 검색된 고객 또는 null
 */
export async function getArrearsCustomerByName(
  customerName: string, 
  minAmount: number = defaultConfig.minArrearsAmount
): Promise<ArrearsCustomer | null> {
  try {
    const customers = await getArrearsCustomers(minAmount);
    
    // 정확히 일치하는 고객 먼저 찾기
    const exactMatch = customers.find(c => c.name === customerName);
    if (exactMatch) return exactMatch;
    
    // 포함하는 고객 찾기
    const partialMatch = customers.find(c => 
      c.name.includes(customerName) || customerName.includes(c.name)
    );
    
    return partialMatch || null;
  } catch (error) {
    console.error('고객명 검색 중 오류:', error);
    return null;
  }
}

/**
 * 알림 메시지 생성
 * @param customer - 고객 정보
 * @param template - 메시지 템플릿
 * @returns 생성된 메시지
 */
export function createNotificationMessage(
  customer: ArrearsCustomer,
  template: string = defaultConfig.messageTemplate
): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  return template
    .replace('{customerName}', customer.name)
    .replace('{month}', String(month))
    .replace('{day}', String(day))
    .replace('{amount}', customer.totalArrears.toLocaleString());
}

/**
 * 미수금 알림 발송
 * @param customer - 알림 대상 고객
 * @param notificationType - 알림 유형 (monthly/quarterly/manual)
 * @returns 발송 결과
 */
export async function sendArrearsNotification(
  customer: ArrearsCustomer,
  notificationType: 'monthly' | 'quarterly' | 'manual' = 'manual'
): Promise<{ success: boolean; messageId?: string; errorMessage?: string }> {
  try {
    // 솔라피 잔액 확인
    const balanceResult = await getBalance(solapiCredentials);
    if (!balanceResult.success || (balanceResult.balance && balanceResult.balance < 50)) {
      return {
        success: false,
        errorMessage: 'SMS 발송 잔액이 부족합니다.',
      };
    }

    // 메시지 생성
    const messageText = createNotificationMessage(customer);
    
    // SMS 발송
    const message: SolapiMessageRequest = {
      to: customer.mobile,
      from: solapiCredentials.senderNumber,
      text: messageText,
      type: 'SMS',
    };

    const result = await sendSMS(message, solapiCredentials);

    // 발송 이력 저장
    await saveNotificationHistory({
      id: crypto.randomUUID(),
      customerId: customer.id,
      customerName: customer.name,
      mobile: customer.mobile,
      message: messageText,
      amount: customer.totalArrears,
      sentAt: new Date().toISOString(),
      status: result.success ? 'success' : 'failed',
      messageId: result.messageId,
      errorMessage: result.errorMessage,
      notificationType,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      errorMessage: result.errorMessage,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    
    // 실패 이력 저장
    await saveNotificationHistory({
      id: crypto.randomUUID(),
      customerId: customer.id,
      customerName: customer.name,
      mobile: customer.mobile,
      message: createNotificationMessage(customer),
      amount: customer.totalArrears,
      sentAt: new Date().toISOString(),
      status: 'failed',
      errorMessage,
      notificationType,
    });

    return {
      success: false,
      errorMessage,
    };
  }
}

/**
 * 일괄 알림 발송
 * @param customers - 알림 대상 고객 목록
 * @param notificationType - 알림 유형
 * @returns 발송 결과 목록
 */
export async function sendBulkArrearsNotifications(
  customers: ArrearsCustomer[],
  notificationType: 'monthly' | 'quarterly' | 'manual' = 'manual'
): Promise<{ total: number; success: number; failed: number; results: any[] }> {
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  for (const customer of customers) {
    const result = await sendArrearsNotification(customer, notificationType);
    results.push({ customer, result });
    
    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    total: customers.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}

/**
 * 월말 알림 대상 확인
 * @returns 오늘이 월말 알림일인지 여부
 */
export function isMonthlyNotificationDay(config: ArrearsNotificationConfig = defaultConfig): boolean {
  const today = new Date();
  return today.getDate() === config.monthlyDay;
}

/**
 * 알림 발송 이력 저장
 * @param history - 저장할 이력 데이터
 */
async function saveNotificationHistory(history: NotificationHistory): Promise<void> {
  try {
    await supabase
      .from('notification_history')
      .insert(history);
  } catch (error) {
    console.error('알림 이력 저장 오류:', error);
  }
}

/**
 * 알림 발송 이력 조회
 * @param customerId - 고객 ID (선택적)
 * @param limit - 조회 개수
 * @returns 알림 이력 목록
 */
export async function getNotificationHistory(
  customerId?: string,
  limit: number = 50
): Promise<NotificationHistory[]> {
  try {
    let query = supabase
      .from('notification_history')
      .select('*')
      .order('sentAt', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customerId', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('알림 이력 조회 오류:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('알림 이력 조회 중 오류:', error);
    return [];
  }
}
