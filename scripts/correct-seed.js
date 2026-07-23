const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 서비스 롤 키 사용 (RLS 우회)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 실제 데이터베이스 구조에 맞춘 고객 데이터
const correctCustomers = [
  {
    name: '김농민',
    phone: '010-1234-5678',
    business_no: '123-45-67890',
    address: '경기도 안산시 단원구 농민로 123',
    email: 'kim@example.com',
    grade: 'A',
  },
  {
    name: '(주)그린센터',
    phone: '010-2345-6789',
    business_no: '234-56-78901',
    address: '서울시 강남구 테헤란로 456',
    email: 'center@green.co.kr',
    grade: 'B',
  },
  {
    name: '안산시청',
    phone: '031-481-2000',
    business_no: '345-67-89012',
    address: '경기도 안산시 단원구 시청로 789',
    email: 'contact@ansan.go.kr',
    grade: 'S',
  },
  {
    name: '박개인사업자',
    phone: '010-4567-8901',
    business_no: '456-78-90123',
    address: '인천시 남동구 산업로 101',
    email: 'park@business.com',
    grade: 'C',
  },
  {
    name: '최농장',
    phone: '010-5678-9012',
    business_no: '567-89-01234',
    address: '충남 천안시 동남구 농장길 202',
    email: 'choi@farm.kr',
    grade: 'A',
  },
];

// 거래 데이터 생성 함수
const createTransactions = (customerIds) => [
  // 김농민
  {
    customer_id: customerIds[0],
    type: '비료 구매',
    amount: 150000,
    status: 'unpaid',
    description: '가을 작물용 복합비료 10포',
    balance: 0,
  },
  {
    customer_id: customerIds[0],
    type: '농약 구매',
    amount: 80000,
    status: 'paid',
    description: '살충제 및 살균제',
    balance: 0,
  },
  
  // (주)그린센터
  {
    customer_id: customerIds[1],
    type: '대량 구매',
    amount: 2500000,
    status: 'unpaid',
    description: '센터 전체 물량 공급계약',
    balance: 0,
  },
  {
    customer_id: customerIds[1],
    type: '컨설팅 서비스',
    amount: 500000,
    status: 'paid',
    description: '농업 기술 컨설팅',
    balance: 0,
  },
  
  // 안산시청
  {
    customer_id: customerIds[2],
    type: '공공사업',
    amount: 5000000,
    status: 'paid',
    description: '시민 텃밭 조성 사업',
    balance: 0,
  },
  
  // 박개인사업자
  {
    customer_id: customerIds[3],
    type: '개별 주문',
    amount: 300000,
    status: 'unpaid',
    description: '소규모 농자재 구매',
    balance: 0,
  },
  {
    customer_id: customerIds[3],
    type: '배송비',
    amount: 50000,
    status: 'unpaid',
    description: '원거리 배송 추가비용',
    balance: 0,
  },
  
  // 최농장
  {
    customer_id: customerIds[4],
    type: '시설 자재',
    amount: 1200000,
    status: 'paid',
    description: '비닐하우스 자재 구매',
    balance: 0,
  },
  {
    customer_id: customerIds[4],
    type: '종자 구매',
    amount: 200000,
    status: 'unpaid',
    description: '내년 봄 작물용 종자',
    balance: 0,
  },
];

async function seedCorrectData() {
  try {
    console.log('🌱 정확한 스키마로 더미 데이터 생성 시작...');
    
    // 1. 기존 데이터 확인
    const { data: existingData, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' });
    
    console.log(`📊 기존 고객 데이터: ${count}개`);
    
    // 2. 새로운 고객 데이터 생성
    console.log('👥 새로운 고객 데이터 생성 중...');
    
    const { data: newCustomers, error: customerError } = await supabase
      .from('customers')
      .insert(correctCustomers)
      .select('id, name, phone, grade');
    
    if (customerError) {
      console.error('❌ 고객 데이터 생성 실패:', customerError);
      return;
    }
    
    console.log(`✅ ${newCustomers.length}개 고객 데이터 생성 완료`);
    const customerIds = newCustomers.map(c => c.id);
    
    // 3. 거래 데이터 생성
    console.log('💰 거래 데이터 생성 중...');
    
    const transactionData = createTransactions(customerIds);
    const { data: newTransactions, error: transactionError } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select('id, customer_id, type, amount, status');
    
    if (transactionError) {
      console.error('❌ 거래 데이터 생성 실패:', transactionError);
      console.log('고객 ID들:', customerIds);
      return;
    }
    
    console.log(`✅ ${newTransactions.length}개 거래 데이터 생성 완료`);
    
    // 4. 결과 요약
    console.log('\n🎉 더미 데이터 생성 완료!');
    console.log('📋 생성된 데이터 요약:');
    
    // 고객 정보
    console.log('\n👥 새로 생성된 고객:');
    newCustomers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name} (등급: ${customer.grade}, 전화: ${customer.phone})`);
    });
    
    // 거래 요약
    const unpaidTransactions = transactionData.filter(t => t.status === 'unpaid');
    const totalUnpaid = unpaidTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = transactionData
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log('\n💳 거래 현황:');
    console.log(`   ✅ 완료된 거래: ${totalPaid.toLocaleString()}원`);
    console.log(`   🔴 미수금 총액: ${totalUnpaid.toLocaleString()}원`);
    console.log(`   📊 미수금 건수: ${unpaidTransactions.length}건`);
    
    // 고객별 미수금
    console.log('\n📋 고객별 미수금:');
    customerIds.forEach((customerId, index) => {
      const customerUnpaid = transactionData
        .filter(t => t.customer_id === customerId && t.status === 'unpaid')
        .reduce((sum, t) => sum + t.amount, 0);
      
      if (customerUnpaid > 0) {
        console.log(`   ${correctCustomers[index].name}: ${customerUnpaid.toLocaleString()}원`);
      }
    });
    
    // 5. 전체 현황 확인
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact' });
    
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' });
    
    console.log('\n📊 전체 데이터 현황:');
    console.log(`   👥 총 고객 수: ${totalCustomers}명`);
    console.log(`   💰 총 거래 건수: ${totalTransactions}건`);
    
    console.log('\n🚀 웹 애플리케이션에서 확인해보세요!');
    console.log('   - 고객 목록: http://localhost:3000/customers');
    console.log('   - 거래 내역: http://localhost:3000/transactions');
    
  } catch (error) {
    console.error('❌ 전체 프로세스 실패:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  seedCorrectData();
}

module.exports = { seedCorrectData }; 