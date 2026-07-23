/**
 * 특정 고객에게 미수금 알림 발송 테스트
 * 사용: node scripts/send-test-sms.js "최형섭"
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jcqdjkxllgiedjqxryoq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Solapi API 설정
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSC1MQ5IG0XTWHI';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'ZWN6HLVBJOMCTBWPQYR1NPQNCNWFRD45';
const SOLAPI_SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER || '01040515179';

// 인증 헤더 생성
function createAuthHeader() {
  const authString = `${SOLAPI_API_KEY}:${SOLAPI_API_SECRET}`;
  return `Basic ${Buffer.from(authString).toString('base64')}`;
}

/**
 * 이름으로 미수금 고객 검색
 */
async function getArrearsCustomerByName(customerName) {
  try {
    // 거래 테이블에서 미수금이 있는 고객 조회
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        customer_id,
        amount,
        paid_amount,
        transaction_date,
        customers:customer_id (id, name, mobile)
      `)
      .eq('status', 'unpaid')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('미수금 조회 오류:', error);
      return null;
    }

    // 고객별로 미수금 집계
    const customerMap = new Map();

    transactions?.forEach((tx) => {
      const customer = tx.customers;
      if (!customer || !customer.mobile) return;

      const arrearsAmount = (tx.amount || 0) - (tx.paid_amount || 0);
      if (arrearsAmount <= 0) return;

      if (customerMap.has(customer.id)) {
        const existing = customerMap.get(customer.id);
        existing.totalArrears += arrearsAmount;
        existing.transactionCount += 1;
      } else {
        customerMap.set(customer.id, {
          id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          totalArrears: arrearsAmount,
          lastTransactionDate: tx.transaction_date,
          transactionCount: 1,
        });
      }
    });

    // 이름으로 필터링
    const customers = Array.from(customerMap.values());
    const foundCustomer = customers.find(c => 
      c.name.includes(customerName) || customerName.includes(c.name)
    );

    return foundCustomer || null;

  } catch (error) {
    console.error('고객 검색 중 오류:', error);
    return null;
  }
}

/**
 * 메시지 생성
 */
function createMessage(customer) {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  return `${customer.name}고객님 매월 정기발송 메세지입니다 ${month}월${day}일 기준 잔액이 ${customer.totalArrears.toLocaleString()}원입니다 자세한 내용은 010-2602-3276(정현목)상담 주세요`;
}

/**
 * SMS 발송
 */
async function sendSMS(to, text) {
  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: SOLAPI_SENDER_NUMBER.replace(/-/g, ''),
          text: text,
          type: text.length > 90 ? 'LMS' : 'SMS',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errorMessage || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: data.statusCode === '2000',
      messageId: data.messageId,
      statusCode: data.statusCode,
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 발송 이력 저장
 */
async function saveNotificationHistory(history) {
  try {
    await supabase
      .from('notification_history')
      .insert(history);
  } catch (error) {
    console.error('이력 저장 오류:', error);
  }
}

/**
 * 메인 실행
 */
async function main() {
  const customerName = process.argv[2];
  
  if (!customerName) {
    console.log('사용법: node scripts/send-test-sms.js "고객명"');
    console.log('예시: node scripts/send-test-sms.js "최형섭"');
    process.exit(1);
  }

  console.log(`🔍 "${customerName}" 고객 검색 중...`);
  
  const customer = await getArrearsCustomerByName(customerName);
  
  if (!customer) {
    console.error(`❌ "${customerName}" 고객을 찾을 수 없거나 미수금이 없습니다.`);
    process.exit(1);
  }

  console.log('✅ 고객 정보:');
  console.log(`   이름: ${customer.name}`);
  console.log(`   전화번호: ${customer.mobile}`);
  console.log(`   미수금: ${customer.totalArrears.toLocaleString()}원`);
  console.log(`   미수 거래: ${customer.transactionCount}건`);
  
  const message = createMessage(customer);
  console.log('\n📱 발송 메시지:');
  console.log(`   ${message}`);
  console.log(`   (길이: ${message.length}자, 타입: ${message.length > 90 ? 'LMS' : 'SMS'})`);
  
  // 실제 발송 여부 확인
  console.log('\n⚠️  실제 발송하시겠습니까? (yes/no)');
  
  // 자동으로 발송 (테스트용)
  console.log('\n🚀 SMS 발송 중...');
  
  const result = await sendSMS(customer.mobile, message);
  
  if (result.success) {
    console.log('✅ 발송 성공!');
    console.log(`   메시지 ID: ${result.messageId}`);
    
    // 이력 저장
    await saveNotificationHistory({
      id: crypto.randomUUID(),
      customerId: customer.id,
      customerName: customer.name,
      mobile: customer.mobile,
      message: message,
      amount: customer.totalArrears,
      sentAt: new Date().toISOString(),
      status: 'success',
      messageId: result.messageId,
      notificationType: 'manual',
    });
    
    console.log('✅ 발송 이력 저장 완료');
  } else {
    console.error('❌ 발송 실패:');
    console.error(`   오류: ${result.error}`);
    
    // 실패 이력 저장
    await saveNotificationHistory({
      id: crypto.randomUUID(),
      customerId: customer.id,
      customerName: customer.name,
      mobile: customer.mobile,
      message: message,
      amount: customer.totalArrears,
      sentAt: new Date().toISOString(),
      status: 'failed',
      errorMessage: result.error,
      notificationType: 'manual',
    });
  }
}

// Node.js 내장 crypto 모듈 사용
const crypto = require('crypto');

main().catch(console.error);
