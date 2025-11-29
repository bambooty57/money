-- 가망고객 정보 테이블 생성
CREATE TABLE IF NOT EXISTS customer_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  prospect_device_type TEXT NOT NULL CHECK (prospect_device_type IN ('트랙터', '콤바인', '이앙기', '작업기', '기타')),
  current_device_model_id UUID REFERENCES models_types(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, prospect_device_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_prospects_customer_id ON customer_prospects(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_prospects_device_type ON customer_prospects(prospect_device_type);
CREATE INDEX IF NOT EXISTS idx_customer_prospects_created_at ON customer_prospects(created_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_customer_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_customer_prospects_updated_at
  BEFORE UPDATE ON customer_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_prospects_updated_at();

-- RLS 정책 설정
ALTER TABLE customer_prospects ENABLE ROW LEVEL SECURITY;

-- 조회 정책
CREATE POLICY "사용자는 자신의 가망고객 정보를 조회할 수 있습니다"
  ON customer_prospects FOR SELECT
  USING (auth.role() = 'authenticated');

-- 생성 정책
CREATE POLICY "사용자는 가망고객 정보를 생성할 수 있습니다"
  ON customer_prospects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 수정 정책
CREATE POLICY "사용자는 가망고객 정보를 수정할 수 있습니다"
  ON customer_prospects FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 삭제 정책
CREATE POLICY "사용자는 가망고객 정보를 삭제할 수 있습니다"
  ON customer_prospects FOR DELETE
  USING (auth.role() = 'authenticated');

