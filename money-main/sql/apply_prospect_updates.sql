-- ============================================
-- 가망고객 테이블 구조 업데이트 SQL
-- ============================================
-- 실행 전 안내:
-- 1. 이 SQL은 기존 데이터를 보존하면서 안전하게 실행됩니다
-- 2. 각 단계는 IF NOT EXISTS / 조건부 체크로 중복 실행을 방지합니다
-- 3. Supabase SQL Editor에서 전체를 복사하여 한 번에 실행하세요
-- ============================================

-- 1단계: 필드 추가 (이미 존재하면 스킵)
ALTER TABLE customer_prospects 
ADD COLUMN IF NOT EXISTS prospect_device_model TEXT,
ADD COLUMN IF NOT EXISTS current_device_model_text TEXT;

-- 2단계: 필드명 변경 (current_device_model_text → current_device_model)
DO $$
BEGIN
  -- current_device_model_text가 있고 current_device_model이 없으면 이름 변경
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'customer_prospects' 
    AND column_name = 'current_device_model_text'
    AND NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'customer_prospects' 
      AND column_name = 'current_device_model'
    )
  ) THEN
    ALTER TABLE customer_prospects 
    RENAME COLUMN current_device_model_text TO current_device_model;
    RAISE NOTICE '필드명 변경 완료: current_device_model_text → current_device_model';
  ELSE
    RAISE NOTICE '필드명 변경 스킵 (이미 변경됨 또는 필드가 없음)';
  END IF;
END $$;

-- 3단계: UNIQUE 제약조건 제거 (같은 고객이 같은 기종을 여러 개 등록할 수 있도록)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- customer_id와 prospect_device_type의 UNIQUE 제약조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'customer_prospects'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
    AND EXISTS (
      SELECT 1
      FROM pg_attribute a1, pg_attribute a2
      WHERE a1.attrelid = conrelid
        AND a1.attnum = conkey[1]
        AND a1.attname = 'customer_id'
        AND a2.attrelid = conrelid
        AND a2.attnum = conkey[2]
        AND a2.attname = 'prospect_device_type'
    );
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE customer_prospects DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    RAISE NOTICE 'UNIQUE 제약조건 제거 완료: %', constraint_name;
  ELSE
    RAISE NOTICE 'UNIQUE 제약조건 없음 (이미 제거됨)';
  END IF;
END $$;

-- 4단계: prospect_device_model을 TEXT[] 배열 타입으로 변경
DO $$
BEGIN
  -- prospect_device_model이 TEXT 타입이고 배열이 아니면 배열로 변경
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_prospects'
      AND column_name = 'prospect_device_model'
      AND data_type = 'text'
      AND udt_name = 'text'
  ) THEN
    -- TEXT 타입을 TEXT[] 배열로 변경 (기존 데이터 보존)
    ALTER TABLE customer_prospects 
    ALTER COLUMN prospect_device_model TYPE TEXT[] 
    USING CASE 
      WHEN prospect_device_model IS NULL THEN NULL
      WHEN prospect_device_model = '' THEN NULL
      ELSE ARRAY[prospect_device_model]
    END;
    RAISE NOTICE 'prospect_device_model을 TEXT[] 배열 타입으로 변경 완료';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_prospects'
      AND column_name = 'prospect_device_model'
      AND data_type = 'ARRAY'
  ) THEN
    RAISE NOTICE 'prospect_device_model이 이미 배열 타입입니다';
  ELSE
    RAISE NOTICE 'prospect_device_model 필드가 없습니다 (1단계를 먼저 실행하세요)';
  END IF;
END $$;

-- 5단계: 필드 주석 업데이트
COMMENT ON COLUMN customer_prospects.prospect_device_model IS '가망모델 배열 (예: {L47H, ER575K}) - 한 고객이 여러 모델을 가망할 수 있음';
COMMENT ON COLUMN customer_prospects.current_device_model IS '현재보유 모델 (예: L45SV / 트랙터) - 텍스트 직접 입력';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '가망고객 테이블 업데이트 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '변경사항:';
  RAISE NOTICE '1. prospect_device_model 필드 추가/업데이트 (TEXT[])';
  RAISE NOTICE '2. current_device_model 필드 추가/업데이트 (TEXT)';
  RAISE NOTICE '3. UNIQUE 제약조건 제거 (같은 고객이 같은 기종을 여러 개 등록 가능)';
  RAISE NOTICE '============================================';
END $$;

