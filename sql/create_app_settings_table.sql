-- 앱 설정 테이블 (발송 메시지 템플릿 등)
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,           -- 설정 키 (예: 'sms_template')
    value TEXT NOT NULL,                -- 설정 값
    description TEXT,                   -- 설정 설명
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- RLS 설정
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Enable read access for all users" 
    ON app_settings FOR SELECT 
    USING (true);

-- service_role만 쓰기 가능
CREATE POLICY "Enable write for service role" 
    ON app_settings FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 기본 SMS 템플릿 삽입
INSERT INTO app_settings (key, value, description)
VALUES (
    'sms_template',
    '{customerName}고객님 구보다대리점입니다 매월 정기발송 안내입니다 {month}월{day}일 기준 잔액이 {amount}원 입니다 농협:302-2602-3276-61(정현목)입금 부탁드립니다 자세한 내용은 010-2603-3276으로 상담 주세요',
    '월별 미수금 알림 SMS 기본 템플릿'
)
ON CONFLICT (key) DO NOTHING;

-- 테이블 설명
COMMENT ON TABLE app_settings IS '앱 전역 설정 테이블';
COMMENT ON COLUMN app_settings.key IS '설정 키 (UNIQUE)';
COMMENT ON COLUMN app_settings.value IS '설정 값';
COMMENT ON COLUMN app_settings.description IS '설정 설명';
