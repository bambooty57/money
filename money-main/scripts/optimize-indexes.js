#!/usr/bin/env node

/**
 * 🚀 데이터베이스 인덱스 최적화 스크립트
 * 고객관리 및 거래관리 성능 향상을 위한 인덱스 생성
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 인덱스 생성 함수
async function createIndexes() {
  console.log('🚀 데이터베이스 인덱스 최적화 시작...\n');

  try {
    // 1. customers 테이블 인덱스 최적화
    console.log('📊 customers 테이블 인덱스 생성 중...');
    
    // 검색 성능 향상을 위한 복합 인덱스
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_customers_search 
      ON customers USING gin(to_tsvector('korean', name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(mobile, '') || ' ' || COALESCE(business_no, '')));
    `);

    // 개별 검색 필드 인덱스
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_customers_name 
      ON customers USING gin(to_tsvector('korean', name));
      
      CREATE INDEX IF NOT EXISTS idx_customers_phone 
      ON customers(phone);
      
      CREATE INDEX IF NOT EXISTS idx_customers_mobile 
      ON customers(mobile);
      
      CREATE INDEX IF NOT EXISTS idx_customers_business_no 
      ON customers(business_no);
    `);

    // 정렬 성능 향상
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_customers_created_at 
      ON customers(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_customers_name_asc 
      ON customers(name ASC);
      
      CREATE INDEX IF NOT EXISTS idx_customers_type 
      ON customers(customer_type);
    `);

    // 2. transactions 테이블 인덱스 최적화
    console.log('📊 transactions 테이블 인덱스 생성 중...');
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_transactions_customer_id 
      ON transactions(customer_id);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_status 
      ON transactions(status);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
      ON transactions(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_due_date 
      ON transactions(due_date);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_customer_status_date 
      ON transactions(customer_id, status, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_amount 
      ON transactions(amount);
    `);

    // 3. payments 테이블 인덱스 최적화
    console.log('📊 payments 테이블 인덱스 생성 중...');
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_payments_transaction_id 
      ON payments(transaction_id);
      
      CREATE INDEX IF NOT EXISTS idx_payments_paid_at 
      ON payments(paid_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_payments_method 
      ON payments(method);
      
      CREATE INDEX IF NOT EXISTS idx_payments_transaction_date 
      ON payments(transaction_id, paid_at DESC);
    `);

    // 4. files 테이블 인덱스 최적화
    console.log('📊 files 테이블 인덱스 생성 중...');
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_files_customer_id 
      ON files(customer_id);
      
      CREATE INDEX IF NOT EXISTS idx_files_transaction_id 
      ON files(transaction_id);
      
      CREATE INDEX IF NOT EXISTS idx_files_type 
      ON files(type);
      
      CREATE INDEX IF NOT EXISTS idx_files_customer_type 
      ON files(customer_id, type);
    `);

    // 5. models_types 테이블 인덱스 최적화
    console.log('📊 models_types 테이블 인덱스 생성 중...');
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_models_types_model 
      ON models_types USING gin(to_tsvector('korean', model));
      
      CREATE INDEX IF NOT EXISTS idx_models_types_type 
      ON models_types(type);
      
      CREATE INDEX IF NOT EXISTS idx_models_types_model_type 
      ON models_types(model, type);
    `);

    // 6. 부분 인덱스 생성
    console.log('📊 부분 인덱스 생성 중...');
    
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_transactions_active 
      ON transactions(customer_id, created_at DESC) 
      WHERE status != 'deleted';
      
      CREATE INDEX IF NOT EXISTS idx_transactions_unpaid 
      ON transactions(customer_id, amount) 
      WHERE status = 'unpaid';
      
      CREATE INDEX IF NOT EXISTS idx_files_customer_photos 
      ON files(customer_id, created_at DESC) 
      WHERE type = 'customer_photo';
    `);

    // 7. 통계 정보 업데이트
    console.log('📊 통계 정보 업데이트 중...');
    
    await executeSQL(`
      ANALYZE customers;
      ANALYZE transactions;
      ANALYZE payments;
      ANALYZE files;
      ANALYZE models_types;
    `);

    console.log('\n✅ 인덱스 최적화 완료!');
    console.log('\n📈 성능 개선 사항:');
    console.log('  • 고객 검색 성능 향상 (GIN 인덱스)');
    console.log('  • 거래 조회 성능 향상 (복합 인덱스)');
    console.log('  • 입금 정보 조회 성능 향상');
    console.log('  • 파일 조회 성능 향상');
    console.log('  • 모델/타입 검색 성능 향상');
    console.log('  • 부분 인덱스로 메모리 사용량 최적화');

  } catch (error) {
    console.error('\n❌ 인덱스 최적화 중 오류 발생:', error);
    process.exit(1);
  }
}

// SQL 실행 함수
async function executeSQL(sql) {
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    throw new Error(`SQL 실행 오류: ${error.message}`);
  }
}

// 인덱스 상태 확인 함수
async function checkIndexStatus() {
  console.log('📊 인덱스 상태 확인 중...\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
          idx_scan as index_scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC;
      `
    });

    if (error) throw error;

    console.log('📋 인덱스 사용 현황:');
    console.table(data || []);

  } catch (error) {
    console.error('❌ 인덱스 상태 확인 중 오류 발생:', error);
  }
}

// 메인 실행 함수
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'create':
      await createIndexes();
      break;
    case 'check':
      await checkIndexStatus();
      break;
    case 'full':
      await createIndexes();
      console.log('\n');
      await checkIndexStatus();
      break;
    default:
      console.log('📖 사용법:');
      console.log('  node scripts/optimize-indexes.js create  - 인덱스 생성');
      console.log('  node scripts/optimize-indexes.js check   - 인덱스 상태 확인');
      console.log('  node scripts/optimize-indexes.js full    - 인덱스 생성 + 상태 확인');
      break;
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createIndexes, checkIndexStatus }; 