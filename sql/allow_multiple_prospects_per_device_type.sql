-- 같은 고객이 같은 가망기종을 여러 개 등록할 수 있도록 UNIQUE 제약조건 제거

-- 기존 UNIQUE 제약조건 제거
ALTER TABLE customer_prospects 
DROP CONSTRAINT IF EXISTS customer_prospects_customer_id_prospect_device_type_key;

-- UNIQUE 제약조건이 다른 이름일 수도 있으므로 확인 후 제거
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- customer_id와 prospect_device_type에 대한 UNIQUE 제약조건 찾기
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'customer_prospects'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
    AND EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = conrelid
        AND attname IN ('customer_id', 'prospect_device_type')
        AND attnum = ANY(conkey)
        GROUP BY attrelid
        HAVING COUNT(*) = 2
    )
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE customer_prospects DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
        RAISE NOTICE '제약조건 제거됨: %', constraint_name;
    ELSE
        RAISE NOTICE '제거할 UNIQUE 제약조건을 찾을 수 없습니다.';
    END IF;
END $$;

-- 이제 같은 고객이 같은 기종을 여러 개 등록할 수 있습니다.

