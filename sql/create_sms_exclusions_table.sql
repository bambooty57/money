-- SMS 발송 제외 관리 테이블
-- 매월 25일 발송 대상에서 특정 고객을 제외하는 기능

CREATE TABLE IF NOT EXISTS sms_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    exclusion_month TEXT NOT NULL,  -- '2025-07' 형식 (YYYY-MM)
    reason TEXT,                     -- 제외 사유 (선택 입력)
    excluded_by TEXT,                -- 제외한 사람 (선택 입력)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 복합 유니크 키: 같은 고객이 같은 달에 중복 제외되지 않도록
    CONSTRAINT sms_exclusions_customer_month_unique UNIQUE (customer_id, exclusion_month)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sms_exclusions_customer_id 
    ON sms_exclusions(customer_id);

CREATE INDEX IF NOT EXISTS idx_sms_exclusions_exclusion_month 
    ON sms_exclusions(exclusion_month);

CREATE INDEX IF NOT EXISTS idx_sms_exclusions_created_at 
    ON sms_exclusions(created_at DESC);

-- Row Level Security (RLS) 설정
ALTER TABLE sms_exclusions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Enable read access for all users" 
    ON sms_exclusions FOR SELECT 
    USING (true);

-- 모든 사용자가 쓰기 가능 (누구나 제외 가능)
CREATE POLICY "Enable write access for all users" 
    ON sms_exclusions FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" 
    ON sms_exclusions FOR DELETE 
    USING (true);

-- 테이블 설명
COMMENT ON TABLE sms_exclusions IS 'SMS 발송 제외 관리 테이블';
COMMENT ON COLUMN sms_exclusions.customer_id IS '고객 ID';
COMMENT ON COLUMN sms_exclusions.customer_name IS '고객명';
COMMENT ON COLUMN sms_exclusions.exclusion_month IS '제외할 월 (YYYY-MM)';
COMMENT ON COLUMN sms_exclusions.reason IS '제외 사유 (선택)';
COMMENT ON COLUMN sms_exclusions.excluded_by IS '제외한 사람 (선택)';

-- notification_history 테이블에 발송 예정 여부 필드 추가
ALTER TABLE notification_history 
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_month TEXT;

COMMENT ON COLUMN notification_history.is_scheduled IS '발송 예정 여부';
COMMENT ON COLUMN notification_history.scheduled_month IS '발송 예정 월 (YYYY-MM)';
