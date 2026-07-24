-- 기존 템플릿 업데이트 (이미 app_settings 테이블이 있는 경우)
UPDATE app_settings 
SET value = '{customerName}고객님 구보다대리점입니다 매월 정기발송 안내입니다 {month}월{day}일 기준 잔액이 {amount}원 입니다 농협:302-2602-3276-61(정현목)입금 부탁드립니다 자세한 내용은 010-2603-3276으로 상담 주세요',
    updated_at = NOW()
WHERE key = 'sms_template';
