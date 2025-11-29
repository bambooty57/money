-- 가망고객 테이블에 가망모델과 현재보유 기종 텍스트 필드 추가
ALTER TABLE customer_prospects 
ADD COLUMN IF NOT EXISTS prospect_device_model TEXT,
ADD COLUMN IF NOT EXISTS current_device_model_text TEXT;

-- 주석 추가
COMMENT ON COLUMN customer_prospects.prospect_device_model IS '가망모델 (예: L47H, ER575K 등)';
COMMENT ON COLUMN customer_prospects.current_device_model_text IS '현재보유 기종 텍스트 (예: L45SV / 트랙터)';

