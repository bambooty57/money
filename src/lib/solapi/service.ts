/**
 * 미수금 알림 서비스
 * 고객의 미수금을 조회하고 알림을 발송하는 기능
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendSMS, sendAlimtalk, getBalance } from './client';
import type { 
  ArrearsCustomer, 
  ArrearsNotificationConfig, 
  NotificationHistory,
  SolapiCredentials,
  SolapiMessageRequest 
} from '@/types/solapi';

// Supabase 클라이언트 (지연 초기화)
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWRqa3hsbGdpZWRqcXhyeW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzI0NTMsImV4cCI6MjA2NTY0ODQ1M30.WQA3Ycqeq8f-4RsWOCwP12iZ4HE-U1oAIpnHh63VJeA';
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

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
  messageTemplate: `{customerName}고객님 구보다대리점입니다 매월 정기발송 안내입니다 {month}월{day}일 기준 잔액이 {amount}원 입니다 농협:302-2602-3276-61(정현목)입금 부탁드립니다 자세한 내용은 010-2603-3276으로 상담 주세요`,
};

import fs from 'fs';
import path from 'path';

function getLocalSettings(): { template?: string; sendDay?: number } {
  try {
    const filePath = path.join(process.cwd(), '.sms-settings.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading local settings file:', err);
  }
  return {};
}

// DB에서 발송 메시지 템플릿 조회 (캐시 적용)
let _cachedTemplate: string | null = null;
let _templateCacheTime = 0;
const TEMPLATE_CACHE_TTL = 60000; // 1분 캐시

export async function getMessageTemplate(): Promise<string> {
  const now = Date.now();
  if (_cachedTemplate && (now - _templateCacheTime) < TEMPLATE_CACHE_TTL) {
    return _cachedTemplate;
  }

  try {
    const { data, error } = await getSupabase()
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_template')
      .single();

    if (error || !data) {
      const local = getLocalSettings();
      _cachedTemplate = local.template || defaultConfig.messageTemplate;
    } else {
      _cachedTemplate = data.value;
    }
    _templateCacheTime = now;
    return _cachedTemplate!;
  } catch {
    const local = getLocalSettings();
    _cachedTemplate = local.template || defaultConfig.messageTemplate;
    _templateCacheTime = now;
    return _cachedTemplate!;
  }
}

// DB에서 발송일 조회 (캐시 적용)
let _cachedSendDay: number | null = null;
let _sendDayCacheTime = 0;

export async function getSendDay(): Promise<number> {
  const now = Date.now();
  if (_cachedSendDay !== null && (now - _sendDayCacheTime) < TEMPLATE_CACHE_TTL) {
    return _cachedSendDay;
  }

  try {
    const { data, error } = await getSupabase()
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_send_day')
      .single();

    if (error || !data) {
      const local = getLocalSettings();
      _cachedSendDay = local.sendDay || defaultConfig.monthlyDay;
    } else {
      _cachedSendDay = parseInt(data.value, 10) || defaultConfig.monthlyDay;
    }
    _sendDayCacheTime = now;
    return _cachedSendDay!;
  } catch {
    const local = getLocalSettings();
    _cachedSendDay = local.sendDay || defaultConfig.monthlyDay;
    _sendDayCacheTime = now;
    return _cachedSendDay!;
  }
}

/**
 * 미수금 고객 조회
 * @param minAmount - 최소 미수금액
 * @returns 미수금 고객 목록
 */
export async function getArrearsCustomers(minAmount: number = defaultConfig.minArrearsAmount): Promise<ArrearsCustomer[]> {
  try {
    // 거래 테이블에서 미수금이 있는 고객 조회 (payments 테이블 조인)
    const { data: transactions, error } = await getSupabase()
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

    // 고객별로 거래금액/입금액 집계
    // (한 거래에 초과 입금된 금액은 같은 고객의 다른 거래 미수금과 상계하기 위해
    //  거래 단위가 아닌 고객 단위로 합산 후 계산)
    const customerMap = new Map<string, ArrearsCustomer & { totalPaid: number }>();

    transactions?.forEach((tx: any) => {
      const customer = tx.customers;
      if (!customer) return;

      // mobile이 없으면 phone 사용
      const contactNumber = customer.mobile || customer.phone;
      if (!contactNumber) return;

      // payments 테이블에서 입금액 합계 계산
      const paidAmount = (tx.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const txArrears = (tx.amount || 0) - paidAmount;

      if (customerMap.has(customer.id)) {
        const existing = customerMap.get(customer.id)!;
        existing.totalArrears += tx.amount || 0;
        existing.totalPaid += paidAmount;
        if (txArrears > 0) existing.transactionCount += 1;
      } else {
        customerMap.set(customer.id, {
          id: customer.id,
          name: customer.name,
          mobile: contactNumber,
          totalArrears: tx.amount || 0, // 거래 총액 누적 (아래에서 입금액 차감)
          totalPaid: paidAmount,
          lastTransactionDate: tx.created_at,
          transactionCount: txArrears > 0 ? 1 : 0,
        });
      }
    });

    // 고객 단위 상계: 총 거래액 - 총 입금액 = 실제 미수금
    // 최소 금액 이상인 고객만 필터링
    return Array.from(customerMap.values())
      .map(({ totalPaid, ...customer }) => ({
        ...customer,
        totalArrears: customer.totalArrears - totalPaid,
      }))
      .filter(customer => customer.totalArrears >= minAmount)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

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
  template: string = defaultConfig.messageTemplate,
  sendDay: number = defaultConfig.monthlyDay
): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  
  return template
    .replace('{customerName}', customer.name)
    .replace('{month}', String(month))
    .replace('{day}', String(sendDay))
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

    // 메시지 생성 (DB 템플릿 및 설정된 발송일 사용)
    const sendDay = await getSendDay();
    const template = await getMessageTemplate();
    const messageText = createNotificationMessage(customer, template, sendDay);
    
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
      message: createNotificationMessage(customer, await getMessageTemplate(), await getSendDay()),
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
export async function isMonthlyNotificationDay(): Promise<boolean> {
  const today = new Date();
  const sendDay = await getSendDay();
  return today.getDate() === sendDay;
}

/**
 * 알림 발송 이력 저장
 * @param history - 저장할 이력 데이터
 */
async function saveNotificationHistory(history: NotificationHistory): Promise<void> {
  try {
    await getSupabase()
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
    let query = getSupabase()
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
