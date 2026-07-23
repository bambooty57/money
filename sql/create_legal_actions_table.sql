-- ============================================
-- legal_actions 테이블 생성
-- ============================================
-- 이 테이블은 고객에 대한 법적 조치 정보(지급명령, 소송 등)를 저장합니다.
-- ============================================

-- legal_actions 테이블 생성
CREATE TABLE IF NOT EXISTS legal_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_actions_customer_id ON legal_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_legal_actions_status ON legal_actions(status);
CREATE INDEX IF NOT EXISTS idx_legal_actions_created_at ON legal_actions(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_legal_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_legal_actions_updated_at ON legal_actions;
CREATE TRIGGER trigger_update_legal_actions_updated_at
  BEFORE UPDATE ON legal_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_actions_updated_at();

-- RLS 정책 설정
ALTER TABLE legal_actions ENABLE ROW LEVEL SECURITY;

-- 조회 정책 (모든 사용자 허용)
DROP POLICY IF EXISTS "모든 사용자는 legal_actions를 조회할 수 있습니다" ON legal_actions;
CREATE POLICY "모든 사용자는 legal_actions를 조회할 수 있습니다"
  ON legal_actions FOR SELECT
  USING (true);

-- 생성 정책 (인증된 사용자만)
DROP POLICY IF EXISTS "인증된 사용자는 legal_actions를 생성할 수 있습니다" ON legal_actions;
CREATE POLICY "인증된 사용자는 legal_actions를 생성할 수 있습니다"
  ON legal_actions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 수정 정책 (인증된 사용자만)
DROP POLICY IF EXISTS "인증된 사용자는 legal_actions를 수정할 수 있습니다" ON legal_actions;
CREATE POLICY "인증된 사용자는 legal_actions를 수정할 수 있습니다"
  ON legal_actions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 삭제 정책 (인증된 사용자만)
DROP POLICY IF EXISTS "인증된 사용자는 legal_actions를 삭제할 수 있습니다" ON legal_actions;
CREATE POLICY "인증된 사용자는 legal_actions를 삭제할 수 있습니다"
  ON legal_actions FOR DELETE
  USING (auth.role() = 'authenticated');

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'legal_actions 테이블 생성 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '컬럼: id, customer_id, type, description,';
  RAISE NOTICE '       status, due_date, created_at, updated_at';
  RAISE NOTICE '============================================';
END $$;
