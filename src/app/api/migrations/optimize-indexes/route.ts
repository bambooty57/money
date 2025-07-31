import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🚀 데이터베이스 인덱스 최적화 시작...');

    // 1. customers 테이블 인덱스 최적화
    console.log('📊 customers 테이블 인덱스 생성 중...');
    
    // 검색 성능 향상을 위한 복합 인덱스
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_customers_search 
        ON customers USING gin(to_tsvector('korean', name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(mobile, '') || ' ' || COALESCE(business_no, '')));
      `
    });

    // 개별 검색 필드 인덱스
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_customers_name 
        ON customers USING gin(to_tsvector('korean', name));
        
        CREATE INDEX IF NOT EXISTS idx_customers_phone 
        ON customers(phone);
        
        CREATE INDEX IF NOT EXISTS idx_customers_mobile 
        ON customers(mobile);
        
        CREATE INDEX IF NOT EXISTS idx_customers_business_no 
        ON customers(business_no);
      `
    });

    // 정렬 성능 향상
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_customers_created_at 
        ON customers(created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_customers_name_asc 
        ON customers(name ASC);
        
        CREATE INDEX IF NOT EXISTS idx_customers_type 
        ON customers(customer_type);
      `
    });

    // 2. transactions 테이블 인덱스 최적화
    console.log('📊 transactions 테이블 인덱스 생성 중...');
    
    await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    // 3. payments 테이블 인덱스 최적화
    console.log('📊 payments 테이블 인덱스 생성 중...');
    
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_payments_transaction_id 
        ON payments(transaction_id);
        
        CREATE INDEX IF NOT EXISTS idx_payments_paid_at 
        ON payments(paid_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_payments_method 
        ON payments(method);
        
        CREATE INDEX IF NOT EXISTS idx_payments_transaction_date 
        ON payments(transaction_id, paid_at DESC);
      `
    });

    // 4. files 테이블 인덱스 최적화
    console.log('📊 files 테이블 인덱스 생성 중...');
    
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_files_customer_id 
        ON files(customer_id);
        
        CREATE INDEX IF NOT EXISTS idx_files_transaction_id 
        ON files(transaction_id);
        
        CREATE INDEX IF NOT EXISTS idx_files_type 
        ON files(type);
        
        CREATE INDEX IF NOT EXISTS idx_files_customer_type 
        ON files(customer_id, type);
      `
    });

    // 5. models_types 테이블 인덱스 최적화
    console.log('📊 models_types 테이블 인덱스 생성 중...');
    
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_models_types_model 
        ON models_types USING gin(to_tsvector('korean', model));
        
        CREATE INDEX IF NOT EXISTS idx_models_types_type 
        ON models_types(type);
        
        CREATE INDEX IF NOT EXISTS idx_models_types_model_type 
        ON models_types(model, type);
      `
    });

    // 6. 부분 인덱스 생성
    console.log('📊 부분 인덱스 생성 중...');
    
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_transactions_active 
        ON transactions(customer_id, created_at DESC) 
        WHERE status != 'deleted';
        
        CREATE INDEX IF NOT EXISTS idx_transactions_unpaid 
        ON transactions(customer_id, amount) 
        WHERE status = 'unpaid';
        
        CREATE INDEX IF NOT EXISTS idx_files_customer_photos 
        ON files(customer_id, created_at DESC) 
        WHERE type = 'customer_photo';
      `
    });

    // 7. 통계 정보 업데이트
    console.log('📊 통계 정보 업데이트 중...');
    
    await supabase.rpc('exec_sql', {
      sql: `
        ANALYZE customers;
        ANALYZE transactions;
        ANALYZE payments;
        ANALYZE files;
        ANALYZE models_types;
      `
    });

    console.log('✅ 인덱스 최적화 완료!');

    return NextResponse.json({
      success: true,
      message: '데이터베이스 인덱스 최적화가 완료되었습니다.',
      optimizations: [
        '고객 검색 성능 향상 (GIN 인덱스)',
        '거래 조회 성능 향상 (복합 인덱스)',
        '입금 정보 조회 성능 향상',
        '파일 조회 성능 향상',
        '모델/타입 검색 성능 향상',
        '부분 인덱스로 메모리 사용량 최적화'
      ]
    });

  } catch (error) {
    console.error('❌ 인덱스 최적화 중 오류 발생:', error);
    
    return NextResponse.json({
      success: false,
      error: '인덱스 최적화 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 인덱스 상태 확인 API
export async function GET() {
  try {
    // 인덱스 크기 및 사용률 확인
    const { data: indexStats, error } = await supabase.rpc('exec_sql', {
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

    return NextResponse.json({
      success: true,
      indexStats: indexStats || []
    });

  } catch (error) {
    console.error('❌ 인덱스 상태 확인 중 오류 발생:', error);
    
    return NextResponse.json({
      success: false,
      error: '인덱스 상태 확인 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 