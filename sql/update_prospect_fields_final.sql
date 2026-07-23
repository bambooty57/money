-- 가망고객 테이블 구조 변경 및 필드 추가
-- 실행 순서:
-- 1. 필드 추가 (없으면)
-- 2. 필드명 변경 (current_device_model_text → current_device_model)
-- 3. 가망모델을 배열로 변경

-- 1. 필드 추가 (이미 추가되어 있으면 에러 없이 진행)
ALTER TABLE customer_prospects 
ADD COLUMN IF NOT EXISTS prospect_device_model TEXT,
ADD COLUMN IF NOT EXISTS current_device_model_text TEXT;

-- 2. 필드명 변경 (current_device_model_text가 있으면 current_device_model로 변경)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_prospects' 
    AND column_name = 'current_device_model_text'
    AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'customer_prospects' 
      AND column_name = 'current_device_model'
    )
  ) THEN
    ALTER TABLE customer_prospects 
    RENAME COLUMN current_device_model_text TO current_device_model;
  END IF;
END $$;

-- 3. 가망모델을 배열로 변경 (이미 배열이 아닌 경우에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customer_prospects' 
    AND column_name = 'prospect_device_model'
    AND data_type != 'ARRAY'
  ) THEN
    -- TEXT 타입을 TEXT[] 배열로 변경
    ALTER TABLE customer_prospects 
    ALTER COLUMN prospect_device_model TYPE TEXT[] 
    USING CASE 
      WHEN prospect_device_model IS NULL THEN NULL
      WHEN prospect_device_model = '' THEN NULL
      ELSE ARRAY[prospect_device_model]
    END;
  END IF;
END $$;

-- 주석 업데이트
COMMENT ON COLUMN customer_prospects.prospect_device_model IS '가망모델 배열 (예: {L47H, ER575K})';
COMMENT ON COLUMN customer_prospects.current_device_model IS '현재보유 모델 (예: L45SV / 트랙터)';

