-- app_settings RLS 수정 (기존 테이블이 있는 경우)
-- service_role이 모든 작업을 할 수 있도록 허용

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable write for service role" ON app_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON app_settings;

-- 새 정책 생성 (service_role은 모든 작업 가능, anon은 읽기만 가능)
CREATE POLICY "service_role_all" 
    ON app_settings FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "anon_read" 
    ON app_settings FOR SELECT 
    TO anon 
    USING (true);

-- 기본 템플릿이 없으면 삽입
INSERT INTO app_settings (key, value, description)
VALUES (
    'sms_template',
    '{customerName}고객님 구보다대리점입니다 매월 정기발송 안내입니다 {month}월{day}일 기준 잔액이 {amount}원 입니다 농협:302-2602-3276-61(정현목)입금 부탁드립니다 자세한 내용은 010-2603-3276으로 상담 주세요',
    '월별 미수금 알림 SMS 기본 템플릿'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
