-- ============================================
-- customers 테이블에 메모(memo) 필드 추가
-- ============================================
-- 실행 전 안내:
-- 1. 이 SQL은 기존 데이터를 보존하면서 안전하게 실행됩니다
-- 2. IF NOT EXISTS로 중복 실행을 방지합니다
-- 3. Supabase SQL Editor에서 전체를 복사하여 한 번에 실행하세요
-- ============================================

-- memo 필드 추가 (이미 존재하면 스킵)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS memo TEXT;

-- 필드 주석 추가
COMMENT ON COLUMN customers.memo IS '고객에 대한 메모 (선택사항)';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'customers 테이블에 memo 필드 추가 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '변경사항:';
  RAISE NOTICE '1. memo 필드 추가 (TEXT, NULL 허용)';
  RAISE NOTICE '2. 필드 주석 추가';
  RAISE NOTICE '============================================';
END $$;

