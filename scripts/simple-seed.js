const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 간단한 고객 데이터 (필수 필드만)
const simpleCustomers = [
  {
    name: '김농민',
    phone: '010-1234-5678',
    email: 'kim@example.com',
    grade: 'A',
  },
  {
    name: '이센터',
    phone: '010-2345-6789',
    email: 'center@green.co.kr',
    grade: 'B',
  },
  {
    name: '박사업자',
    phone: '010-3456-7890',
    email: 'park@business.com',
    grade: 'C',
  },
  {
    name: '최농장',
    phone: '010-4567-8901',
    email: 'choi@farm.kr',
    grade: 'A',
  },
  {
    name: '안산시청',
    phone: '031-481-2000',
    email: 'contact@ansan.go.kr',
    grade: 'S',
  },
];

async function testConnection() {
  try {
    console.log('🔍 Supabase 연결 및 테이블 구조 확인...');
    
    // 1. 연결 테스트
    const { data: testData, error: testError } = await supabase
      .from('customers')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ 데이터베이스 연결 실패:', testError);
      return;
    }
    
    console.log('✅ 데이터베이스 연결 성공');
    
    // 2. 기존 데이터 확인
    const { data: existingData, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' });
    
    console.log(`📊 기존 고객 데이터: ${count}개`);
    
    if (count > 0) {
      console.log('🔍 기존 데이터 구조 확인:');
      console.log('첫 번째 고객 데이터:', JSON.stringify(existingData[0], null, 2));
    }
    
    // 3. 간단한 데이터 추가 시도
    console.log('\n🌱 간단한 테스트 데이터 생성 시도...');
    
    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert([simpleCustomers[0]])
      .select();
    
    if (insertError) {
      console.error('❌ 데이터 삽입 실패:', insertError);
      console.log('🔍 에러 세부사항:', JSON.stringify(insertError, null, 2));
      return;
    }
    
    console.log('✅ 테스트 데이터 생성 성공!');
    console.log('생성된 데이터:', JSON.stringify(newCustomer[0], null, 2));
    
    // 4. 나머지 데이터 추가
    console.log('\n📝 나머지 더미 데이터 생성...');
    
    const { data: remainingCustomers, error: remainingError } = await supabase
      .from('customers')
      .insert(simpleCustomers.slice(1))
      .select();
    
    if (remainingError) {
      console.error('❌ 나머지 데이터 삽입 실패:', remainingError);
      return;
    }
    
    console.log(`✅ ${remainingCustomers.length}개 추가 데이터 생성 완료`);
    
    // 5. 전체 데이터 확인
    const { data: allCustomers, count: totalCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact' });
    
    console.log(`\n🎉 총 ${totalCount}개 고객 데이터 존재`);
    console.log('최근 생성된 고객들:');
    allCustomers.slice(-5).forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name} (${customer.phone})`);
    });
    
  } catch (error) {
    console.error('❌ 전체 프로세스 실패:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  testConnection();
}

module.exports = { testConnection }; 