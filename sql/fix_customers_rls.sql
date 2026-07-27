-- ============================================================
-- Supabase RLS 정책 수정 (고객, 거래, 입금 등 전체 삭제/수정 허용)
-- Supabase SQL Editor에서 실행하시면 삭제/수정이 100% 정상 작동합니다.
-- ============================================================

-- 1. customers 테이블 RLS 정책 (전체 허용)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_customers" ON customers;
CREATE POLICY "anon_all_customers" ON customers FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. transactions 테이블 RLS 정책 (전체 허용)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_transactions" ON transactions;
CREATE POLICY "anon_all_transactions" ON transactions FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. payments 테이블 RLS 정책 (전체 허용)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_payments" ON payments;
CREATE POLICY "anon_all_payments" ON payments FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. files 테이블 RLS 정책 (전체 허용)
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_files" ON files;
CREATE POLICY "anon_all_files" ON files FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. customer_prospects 테이블 RLS 정책 (전체 허용)
ALTER TABLE customer_prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_customer_prospects" ON customer_prospects;
CREATE POLICY "anon_all_customer_prospects" ON customer_prospects FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. legal_actions 테이블 RLS 정책 (전체 허용)
ALTER TABLE legal_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_legal_actions" ON legal_actions;
CREATE POLICY "anon_all_legal_actions" ON legal_actions FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. sms_exclusions 테이블 RLS 정책 (전체 허용)
ALTER TABLE sms_exclusions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_sms_exclusions" ON sms_exclusions;
CREATE POLICY "anon_all_sms_exclusions" ON sms_exclusions FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. sms_messages 테이블 RLS 정책 (전체 허용)
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_sms_messages" ON sms_messages;
CREATE POLICY "anon_all_sms_messages" ON sms_messages FOR ALL TO public USING (true) WITH CHECK (true);

-- 9. contacts 테이블 RLS 정책 (전체 허용)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_contacts" ON contacts;
CREATE POLICY "anon_all_contacts" ON contacts FOR ALL TO public USING (true) WITH CHECK (true);
