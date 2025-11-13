import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 더미 고객 데이터
const dummyCustomers: Database['public']['Tables']['customers']['Insert'][] = [
  {
    name: '김농민',
    business_no: '123-45-67890',
    representative_name: '김농민',
    customer_type: '일반농민',
    phone: '010-1234-5678',
    address: '경기도 안산시 단원구 농민로 123',
  },
  {
    name: '(주)그린센터',
    business_no: '234-56-78901',
    representative_name: '이대표',
    customer_type: '센터등 사업자',
    phone: '010-2345-6789',
    address: '서울시 강남구 테헤란로 456',
  },
  {
    name: '안산시청',
    business_no: '345-67-89012',
    representative_name: '시장',
    customer_type: '관공서',
    phone: '031-481-2000',
    address: '경기도 안산시 단원구 시청로 789',
  },
  {
    name: '박개인사업자',
    business_no: '456-78-90123',
    representative_name: '박사장',
    customer_type: '기타',
    phone: '010-4567-8901',
    address: '인천시 남동구 산업로 101',
  },
  {
    name: '최농장',
    business_no: '567-89-01234',
    representative_name: '최농장주',
    customer_type: '일반농민',
    phone: '010-5678-9012',
    address: '충남 천안시 동남구 농장길 202',
  },
];

// 더미 거래 데이터 (고객당 2-3개씩)
const createDummyTransactions = (customerIds: string[]): Database['public']['Tables']['transactions']['Insert'][] => [
  // 김농민
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
  
  // (주)그린센터
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
  
  // 안산시청
  {
    customer_id: customerIds[2],
    type: '공공사업',
    amount: 5000000,
    status: 'paid',
    description: '시민 텃밭 조성 사업',
  },
  
  // 박개인사업자
  {
    customer_id: customerIds[3],
    type: '개별 주문',
    amount: 300000,
    status: 'unpaid',
    description: '소규모 농자재 구매',
  },
  {
    customer_id: customerIds[3],
    type: '배송비',
    amount: 50000,
    status: 'unpaid',
    description: '원거리 배송 추가비용',
  },
  
  // 최농장
  {
    customer_id: customerIds[4],
    type: '시설 자재',
    amount: 1200000,
    status: 'paid',
    description: '비닐하우스 자재 구매',
  },
  {
    customer_id: customerIds[4],
    type: '종자 구매',
    amount: 200000,
    status: 'unpaid',
    description: '내년 봄 작물용 종자',
  },
];

// 더미 연락 기록
const createDummyContacts = (customerIds: string[]): Database['public']['Tables']['contacts']['Insert'][] => [
  {
    customer_id: customerIds[0],
    type: '전화 상담',
    content: '비료 사용법 문의 및 안내 완료',
  },
  {
    customer_id: customerIds[1],
    type: '방문 상담',
    content: '센터 방문하여 대량 구매 계약 논의',
  },
  {
    customer_id: customerIds[2],
    type: '공문 발송',
    content: '공공사업 관련 견적서 및 제안서 전달',
  },
  {
    customer_id: customerIds[3],
    type: 'SMS 발송',
    content: '미수금 안내 및 결제 독촉',
  },
  {
    customer_id: customerIds[4],
    type: '이메일',
    content: '신제품 소개 및 할인 이벤트 안내',
  },
];

// 더미 법적 조치 데이터
const createDummyLegalActions = (customerIds: string[]): Database['public']['Tables']['legal_actions']['Insert'][] => [
  {
    customer_id: customerIds[3], // 박개인사업자
    type: '지급명령',
    description: '350,000원 미수금에 대한 지급명령 신청',
    status: 'in_progress',
  },
  {
    customer_id: customerIds[0], // 김농민
    type: '내용증명',
    description: '150,000원 미수금 관련 내용증명 발송',
    status: 'completed',
  },
];

async function seedDummyData() {
  try {
    console.log('🌱 더미 데이터 생성을 시작합니다...');
    
    // 1. 고객 데이터 삽입
    console.log('👥 고객 데이터 삽입 중...');
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .insert(dummyCustomers)
      .select('id');
      
    if (customerError) {
      throw new Error(`고객 데이터 삽입 실패: ${customerError.message}`);
    }
    
    if (!customers || customers.length === 0) {
      throw new Error('고객 데이터가 생성되지 않았습니다');
    }
    
    const customerIds = customers.map(c => c.id);
    console.log(`✅ ${customers.length}개 고객 데이터 생성 완료`);
    
    // 2. 거래 데이터 삽입
    console.log('💰 거래 데이터 삽입 중...');
    const transactionData = createDummyTransactions(customerIds);
    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select('id');
      
    if (transactionError) {
      throw new Error(`거래 데이터 삽입 실패: ${transactionError.message}`);
    }
    
    console.log(`✅ ${transactions?.length || 0}개 거래 데이터 생성 완료`);
    
    // 3. 연락 기록 삽입
    console.log('📞 연락 기록 삽입 중...');
    const contactData = createDummyContacts(customerIds);
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .insert(contactData)
      .select('id');
      
    if (contactError) {
      throw new Error(`연락 기록 삽입 실패: ${contactError.message}`);
    }
    
    console.log(`✅ ${contacts?.length || 0}개 연락 기록 생성 완료`);
    
    // 4. 법적 조치 데이터 삽입
    console.log('⚖️ 법적 조치 데이터 삽입 중...');
    const legalActionData = createDummyLegalActions(customerIds);
    const { data: legalActions, error: legalActionError } = await supabase
      .from('legal_actions')
      .insert(legalActionData)
      .select('id');
      
    if (legalActionError) {
      throw new Error(`법적 조치 데이터 삽입 실패: ${legalActionError.message}`);
    }
    
    console.log(`✅ ${legalActions?.length || 0}개 법적 조치 데이터 생성 완료`);
    
    // 5. 생성된 데이터 요약
    console.log('\n🎉 더미 데이터 생성 완료!');
    console.log('📊 생성된 데이터 요약:');
    console.log(`   👥 고객: ${customers.length}명`);
    console.log(`   💰 거래: ${transactions?.length || 0}건`);
    console.log(`   📞 연락기록: ${contacts?.length || 0}건`);
    console.log(`   ⚖️ 법적조치: ${legalActions?.length || 0}건`);
    
    // 6. 미수금 현황 출력
    console.log('\n💳 미수금 현황:');
    const unpaidTransactions = transactionData.filter(t => t.status === 'unpaid');
    const totalUnpaid = unpaidTransactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`   🔴 미수금 총액: ${totalUnpaid.toLocaleString()}원`);
    console.log(`   📊 미수금 건수: ${unpaidTransactions.length}건`);
    
  } catch (error) {
    console.error('❌ 더미 데이터 생성 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  seedDummyData();
}

export { seedDummyData }; 