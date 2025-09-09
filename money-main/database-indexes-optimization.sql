-- 🚀 데이터베이스 인덱스 최적화 스크립트
-- 고객관리 및 거래관리 성능 향상을 위한 인덱스 생성

-- ========================================
-- 1. customers 테이블 인덱스 최적화
-- ========================================

-- 검색 성능 향상을 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_search 
ON customers USING gin(to_tsvector('korean', name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(mobile, '') || ' ' || COALESCE(business_no, '')));

-- 개별 검색 필드 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_name 
ON customers USING gin(to_tsvector('korean', name));

CREATE INDEX IF NOT EXISTS idx_customers_phone 
ON customers(phone);

CREATE INDEX IF NOT EXISTS idx_customers_mobile 
ON customers(mobile);

CREATE INDEX IF NOT EXISTS idx_customers_business_no 
ON customers(business_no);

-- 정렬 성능 향상
CREATE INDEX IF NOT EXISTS idx_customers_created_at 
ON customers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_name_asc 
ON customers(name ASC);

-- 고객 타입 필터링
CREATE INDEX IF NOT EXISTS idx_customers_type 
ON customers(customer_type);

-- ========================================
-- 2. transactions 테이블 인덱스 최적화
-- ========================================

-- 고객별 거래 조회 성능
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id 
ON transactions(customer_id);

-- 상태별 필터링
CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions(status);

-- 날짜별 정렬 및 필터링
CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_due_date 
ON transactions(due_date);

-- 복합 인덱스: 고객별 + 상태별 + 날짜별
CREATE INDEX IF NOT EXISTS idx_transactions_customer_status_date 
ON transactions(customer_id, status, created_at DESC);

-- 금액 범위 검색
CREATE INDEX IF NOT EXISTS idx_transactions_amount 
ON transactions(amount);

-- ========================================
-- 3. payments 테이블 인덱스 최적화
-- ========================================

-- 거래별 입금 조회
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id 
ON payments(transaction_id);

-- 입금 날짜별 조회
CREATE INDEX IF NOT EXISTS idx_payments_paid_at 
ON payments(paid_at DESC);

-- 입금 방법별 조회
CREATE INDEX IF NOT EXISTS idx_payments_method 
ON payments(method);

-- 복합 인덱스: 거래별 + 날짜별
CREATE INDEX IF NOT EXISTS idx_payments_transaction_date 
ON payments(transaction_id, paid_at DESC);

-- ========================================
-- 4. files 테이블 인덱스 최적화
-- ========================================

-- 고객별 파일 조회
CREATE INDEX IF NOT EXISTS idx_files_customer_id 
ON files(customer_id);

-- 거래별 파일 조회
CREATE INDEX IF NOT EXISTS idx_files_transaction_id 
ON files(transaction_id);

-- 파일 타입별 조회
CREATE INDEX IF NOT EXISTS idx_files_type 
ON files(type);

-- 복합 인덱스: 고객별 + 타입별
CREATE INDEX IF NOT EXISTS idx_files_customer_type 
ON files(customer_id, type);

-- ========================================
-- 5. models_types 테이블 인덱스 최적화
-- ========================================

-- 모델명 검색
CREATE INDEX IF NOT EXISTS idx_models_types_model 
ON models_types USING gin(to_tsvector('korean', model));

-- 타입별 조회
CREATE INDEX IF NOT EXISTS idx_models_types_type 
ON models_types(type);

-- 복합 인덱스: 모델 + 타입
CREATE INDEX IF NOT EXISTS idx_models_types_model_type 
ON models_types(model, type);

-- ========================================
-- 6. 성능 모니터링을 위한 통계 업데이트
-- ========================================

-- 통계 정보 업데이트
ANALYZE customers;
ANALYZE transactions;
ANALYZE payments;
ANALYZE files;
ANALYZE models_types;

-- ========================================
-- 7. 부분 인덱스 (선택적 최적화)
-- ========================================

-- 활성 거래만 인덱싱 (삭제되지 않은 거래)
CREATE INDEX IF NOT EXISTS idx_transactions_active 
ON transactions(customer_id, created_at DESC) 
WHERE status != 'deleted';

-- 미수금 거래만 인덱싱
CREATE INDEX IF NOT EXISTS idx_transactions_unpaid 
ON transactions(customer_id, amount) 
WHERE status = 'unpaid';

-- 고객 사진만 인덱싱
CREATE INDEX IF NOT EXISTS idx_files_customer_photos 
ON files(customer_id, created_at DESC) 
WHERE type = 'customer_photo';

-- ========================================
-- 8. 성능 테스트 쿼리
-- ========================================

-- 인덱스 사용 여부 확인 쿼리
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT c.*, 
--        COUNT(t.id) as transaction_count,
--        SUM(CASE WHEN t.status = 'unpaid' THEN t.amount ELSE 0 END) as total_unpaid
-- FROM customers c
-- LEFT JOIN transactions t ON c.id = t.customer_id
-- WHERE c.name ILIKE '%검색어%' OR c.mobile ILIKE '%검색어%'
-- GROUP BY c.id
-- ORDER BY c.created_at DESC
-- LIMIT 18 OFFSET 0;

-- ========================================
-- 9. 인덱스 크기 및 사용률 모니터링
-- ========================================

-- 인덱스 크기 확인
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_indexes 
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- 인덱스 사용률 확인
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC; 