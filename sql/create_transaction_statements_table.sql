-- =====================================================
-- 거래명세서 전자서명 시스템 (ESIGN)
-- transaction_statements 테이블 + 공개 인증 RPC + RLS
-- =====================================================
-- 설계 노트:
-- * anon 키만 사용하는 환경 제약상, 서명본 PDF/서명 이미지는
--   Supabase Storage가 아닌 테이블 bytea 컬럼에 저장한다.
--   (anon 키는 공개되어 있으므로 Storage에 anon SELECT 정책을 열면
--    버킷 전체 목록 조회가 가능해져 보안상 취약함)
-- * 공개 열람은 오직 security definer RPC로만 수행한다.

CREATE TABLE IF NOT EXISTS transaction_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_no TEXT NOT NULL UNIQUE,           -- ST-2026-08-0001 (월별 일련)
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  -- 문서/서명 데이터 (PDF 바이너리 + 서명 PNG 바이너리)
  pdf_data BYTEA,                             -- 서명 합성 완료된 최종 PDF
  pdf_size INTEGER,                           -- PDF 바이트 크기
  signature_data BYTEA,                       -- 서명 원본 PNG
  file_hash TEXT,                             -- PDF SHA-256 해시 (위변조 검증)

  -- 서명자/동의 정보
  signer_name TEXT,
  consent_agreed_at TIMESTAMPTZ,              -- 개인정보 동의 체크 시각
  consent_version TEXT,                       -- 동의 문구 버전 (예: v1.0)

  -- 서명 시점 금액 스냅샷 (이후 거래 수정과 무관하게 증빙 유지)
  total_amount NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  total_unpaid NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'voided')),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                     -- 고객 열람 링크 만료 (발송일 + 30일)

  -- 문자 발송 기록
  sms_sent_at TIMESTAMPTZ,                    -- 최초 자동 발송 시각
  sms_to TEXT,                                -- 발송 당시 번호 스냅샷
  resend_count INTEGER DEFAULT 0,

  -- 고객 열람 추적
  viewed_at TIMESTAMPTZ,                      -- 최초 열람 확인 시각
  view_count INTEGER DEFAULT 0,
  view_failed_count INTEGER DEFAULT 0,        -- 인증 실패 횟수
  locked_until TIMESTAMPTZ,                   -- 5회 실패 시 잠금 (10분)

  -- 무효 처리 (감사 추적)
  voided_at TIMESTAMPTZ,
  void_reason TEXT,

  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ts_customer_id ON transaction_statements(customer_id);
CREATE INDEX IF NOT EXISTS idx_ts_status ON transaction_statements(status);
CREATE INDEX IF NOT EXISTS idx_ts_expires_at ON transaction_statements(expires_at);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_transaction_statements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ts_updated_at ON transaction_statements;
CREATE TRIGGER trg_ts_updated_at
  BEFORE UPDATE ON transaction_statements
  FOR EACH ROW EXECUTE FUNCTION update_transaction_statements_updated_at();

-- =====================================================
-- RLS: 로그인 사용자(관리자)만 전체 접근, anon 직접 접근 차단
-- =====================================================
ALTER TABLE transaction_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ts_authenticated_all" ON transaction_statements;
CREATE POLICY "ts_authenticated_all" ON transaction_statements
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- anon 에게는 어떤 정책도 부여하지 않음 (직접 SELECT/INSERT/UPDATE 불가)
-- 공개 열람은 아래 security definer RPC로만 수행

-- =====================================================
-- RPC 1: 공개 정보 조회 (인증 전 화면 표시용, 민감정보 제외)
-- =====================================================
CREATE OR REPLACE FUNCTION get_statement_public_info(p_id UUID)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  c record;
  v_auth_method TEXT;
BEGIN
  SELECT * INTO s FROM transaction_statements WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO c FROM customers WHERE id = s.customer_id;

  -- 인증 방식은 이제 필요 없으므로 'none'으로 설정
  v_auth_method := 'none';

  RETURN jsonb_build_object(
    'found', true,
    'status', s.status,
    'document_no', s.document_no,
    'signed_at', s.signed_at,
    'expires_at', s.expires_at,
    'expired', (s.expires_at IS NOT NULL AND s.expires_at < NOW()),
    'locked', (s.locked_until IS NOT NULL AND s.locked_until > NOW()),
    'auth_method', v_auth_method,
    'customer_name_masked', CASE WHEN c.name IS NOT NULL THEN left(c.name, 1) || repeat('*', greatest(length(c.name) - 1, 1)) ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RPC 2: 본인 인증 + PDF 반환
--   (비밀번호 검증 없이 PDF 바로 반환)
-- =====================================================
CREATE OR REPLACE FUNCTION verify_statement_access(p_id UUID, p_auth TEXT DEFAULT NULL)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  c record;
BEGIN
  SELECT * INTO s FROM transaction_statements WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF s.status = 'voided' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'voided');
  END IF;
  IF s.status <> 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed');
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF s.locked_until IS NOT NULL AND s.locked_until > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked',
      'locked_until', s.locked_until);
  END IF;

  SELECT * INTO c FROM customers WHERE id = s.customer_id;

  -- 인증 성공: 열람 기록 갱신
  UPDATE transaction_statements SET
    viewed_at = COALESCE(viewed_at, NOW()),
    view_count = COALESCE(view_count, 0) + 1,
    view_failed_count = 0
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document_no', s.document_no,
    'signer_name', s.signer_name,
    'signed_at', s.signed_at,
    'customer_name', c.name,
    'pdf_base64', encode(s.pdf_data, 'base64')
  );
END;
$$ LANGUAGE plpgsql;

-- anon/authenticated 모두 RPC 실행 가능하도록 권한 부여
GRANT EXECUTE ON FUNCTION get_statement_public_info(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_statement_access(UUID, TEXT) TO anon, authenticated;
