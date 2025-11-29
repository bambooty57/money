-- 가망고객 테이블 구조 변경
-- 1. 현재보유 기종 → 현재보유 모델로 필드명 변경
-- 2. 가망모델을 여러 개 저장할 수 있도록 TEXT 배열로 변경

-- 먼저 기존 필드명 변경
ALTER TABLE customer_prospects 
RENAME COLUMN current_device_model_text TO current_device_model;

-- 가망모델을 배열로 변경 (쉼표로 구분된 문자열을 배열로 변환)
-- 먼저 배열 타입으로 변경
ALTER TABLE customer_prospects 
ALTER COLUMN prospect_device_model TYPE TEXT[] 
USING CASE 
  WHEN prospect_device_model IS NULL THEN NULL
  WHEN prospect_device_model = '' THEN NULL
  ELSE ARRAY[prospect_device_model]
END;

-- 주석 업데이트
COMMENT ON COLUMN customer_prospects.prospect_device_model IS '가망모델 배열 (예: {L47H, ER575K})';
COMMENT ON COLUMN customer_prospects.current_device_model IS '현재보유 모델 (예: L45SV / 트랙터)';

