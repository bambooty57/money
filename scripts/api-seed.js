const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

// 실제 데이터베이스 구조에 맞춘 고객 데이터
const testCustomers = [
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

// 거래 데이터 템플릿
const createTransactionTemplates = (customerIds) => [
  {
    customer_id: customerIds[0],
    type: '비료 구매',
    amount: 150000,
    status: 'unpaid',
    description: '가을 작물용 복합비료 10포',
  },
  {
    customer_id: customerIds[0],
    type: '농약 구매',
    amount: 80000,
    status: 'paid',
    description: '살충제 및 살균제',
  },
  {
    customer_id: customerIds[1],
    type: '대량 구매',
    amount: 2500000,
    status: 'unpaid',
    description: '센터 전체 물량 공급계약',
  },
  {
    customer_id: customerIds[1],
    type: '컨설팅 서비스',
    amount: 500000,
    status: 'paid',
    description: '농업 기술 컨설팅',
  },
  {
    customer_id: customerIds[2],
    type: '공공사업',
    amount: 5000000,
    status: 'paid',
    description: '시민 텃밭 조성 사업',
  },
  {
    customer_id: customerIds[3],
    type: '개별 주문',
    amount: 300000,
    status: 'unpaid',
    description: '소규모 농자재 구매',
  },
  {
    customer_id: customerIds[4],
    type: '시설 자재',
    amount: 1200000,
    status: 'paid',
    description: '비닐하우스 자재 구매',
  },
];

async function waitForServer() {
  console.log('⏳ 개발 서버 준비 대기 중...');
  
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${API_BASE}/customers`);
      if (response.ok) {
        console.log('✅ 개발 서버 준비 완료');
        return true;
      }
    } catch (error) {
      // 서버가 아직 준비되지 않음
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  
  throw new Error('개발 서버 준비 시간 초과');
}

async function createCustomerViaAPI(customerData) {
  try {
    const response = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(`고객 생성 실패 (${customerData.name}):`, error.message);
    return null;
  }
}

async function createTransactionViaAPI(transactionData) {
  try {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(`거래 생성 실패:`, error.message);
    return null;
  }
}

async function seedDataViaAPI() {
  try {
    // 1. 서버 준비 대기
    await waitForServer();
    
    console.log('\n🌱 API를 통한 더미 데이터 생성 시작...');
    
    // 2. 기존 데이터 확인
    const customersResponse = await fetch(`${API_BASE}/customers`);
    const existingCustomers = await customersResponse.json();
    console.log(`📊 기존 고객 데이터: ${existingCustomers.length}개`);
    
    // 3. 고객 데이터 생성
    console.log('\n👥 고객 데이터 생성 중...');
    const createdCustomers = [];
    
    for (const customerData of testCustomers) {
      const newCustomer = await createCustomerViaAPI(customerData);
      if (newCustomer) {
        createdCustomers.push(newCustomer);
        console.log(`✅ ${customerData.name} 생성 완료`);
      }
      // API 요청 간격 조절
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ 총 ${createdCustomers.length}개 고객 데이터 생성 완료`);
    
    if (createdCustomers.length === 0) {
      console.log('❌ 생성된 고객이 없어 거래 데이터 생성을 건너뜁니다.');
      return;
    }
    
    // 4. 거래 데이터 생성
    console.log('\n💰 거래 데이터 생성 중...');
    const customerIds = createdCustomers.map(c => c.id);
    const transactionTemplates = createTransactionTemplates(customerIds);
    const createdTransactions = [];
    
    for (const transactionData of transactionTemplates) {
      const newTransaction = await createTransactionViaAPI(transactionData);
      if (newTransaction) {
        createdTransactions.push(newTransaction);
        const customerName = createdCustomers.find(c => c.id === transactionData.customer_id)?.name;
        console.log(`✅ ${customerName} - ${transactionData.type} 생성 완료`);
      }
      // API 요청 간격 조절
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ 총 ${createdTransactions.length}개 거래 데이터 생성 완료`);
    
    // 5. 결과 요약
    console.log('\n🎉 더미 데이터 생성 완료!');
    console.log('📋 생성 결과:');
    console.log(`   👥 고객: ${createdCustomers.length}명`);
    console.log(`   💰 거래: ${createdTransactions.length}건`);
    
    // 미수금 계산
    const unpaidTransactions = transactionTemplates.filter(t => t.status === 'unpaid');
    const totalUnpaid = unpaidTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    console.log('\n💳 미수금 현황:');
    console.log(`   🔴 미수금 총액: ${totalUnpaid.toLocaleString()}원`);
    console.log(`   📊 미수금 건수: ${unpaidTransactions.length}건`);
    
    console.log('\n🚀 웹 애플리케이션에서 확인해보세요!');
    console.log('   - 고객 목록: http://localhost:3000/customers');
    console.log('   - 거래 내역: http://localhost:3000/transactions');
    console.log('   - 법적 조치: http://localhost:3000/legal-actions');
    
  } catch (error) {
    console.error('❌ API 더미 데이터 생성 실패:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  seedDataViaAPI();
}

module.exports = { seedDataViaAPI }; 