/**
 * Supabase 데이터베이스 스키마
 * notification_history 테이블 생성 SQL
 * 
 * 실행 방법:
 * 1. Supabase Dashboard > SQL Editor
 * 2. 아래 SQL 실행
 */

-- 알림 발송 이력 테이블
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    message TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    message_id TEXT,
    error_message TEXT,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('monthly', 'manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notification_history_customer_id 
    ON notification_history(customer_id);
    
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at 
    ON notification_history(sent_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_notification_history_status 
    ON notification_history(status);
    
CREATE INDEX IF NOT EXISTS idx_notification_history_notification_type 
    ON notification_history(notification_type);

-- Row Level Security (RLS) 설정
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Enable read access for all users" 
    ON notification_history FOR SELECT 
    USING (true);

-- 인증된 사용자만 쓰기 가능
CREATE POLICY "Enable write access for authenticated users" 
    ON notification_history FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 테이블 설명
COMMENT ON TABLE notification_history IS 'SMS/알림톡 발송 이력 테이블';
COMMENT ON COLUMN notification_history.customer_id IS '고객 ID';
COMMENT ON COLUMN notification_history.customer_name IS '고객명';
COMMENT ON COLUMN notification_history.mobile IS '수신자 전화번호';
COMMENT ON COLUMN notification_history.message IS '발송된 메시지 내용';
COMMENT ON COLUMN notification_history.amount IS '미수금액';
COMMENT ON COLUMN notification_history.sent_at IS '발송 일시';
COMMENT ON COLUMN notification_history.status IS '발송 상태 (success/failed/pending)';
COMMENT ON COLUMN notification_history.message_id IS '솔라피 메시지 ID';
COMMENT ON COLUMN notification_history.error_message IS '발송 실패 시 오류 메시지';
COMMENT ON COLUMN notification_history.notification_type IS '알림 유형 (monthly/manual)';
