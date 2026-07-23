-- ============================================
-- sms_messages 테이블에 수신 전화번호(phone) 필드 추가
-- ============================================
-- 실행 전 안내:
-- 1. 이 SQL은 기존 데이터를 보존하면서 안전하게 실행됩니다
-- 2. IF NOT EXISTS로 중복 실행을 방지합니다
-- 3. Supabase SQL Editor에서 전체를 복사하여 한 번에 실행하세요
-- ============================================

-- phone 필드 추가 (이미 존재하면 스킵)
ALTER TABLE sms_messages
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 필드 주석 추가
COMMENT ON COLUMN sms_messages.phone IS 'SMS 수신 전화번호';

-- 기존 row의 phone 값은 미저장 상태이므로 그대로 두며,
-- 이후 발송되는 SMS부터 자동 저장됩니다.

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'sms_messages 테이블에 phone 필드 추가 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '변경사항:';
  RAISE NOTICE '1. phone 필드 추가 (TEXT, NULL 허용)';
  RAISE NOTICE '2. 필드 주석 추가';
  RAISE NOTICE '============================================';
END $$;
