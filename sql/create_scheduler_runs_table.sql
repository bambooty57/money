-- 스케줄러 실행 이력 테이블
CREATE TABLE IF NOT EXISTS scheduler_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,              -- YYYY-MM 형식
    total_customer INTEGER NOT NULL DEFAULT 0,
    excluded_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_month 
    ON scheduler_runs(month DESC);
    
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_executed_at 
    ON scheduler_runs(executed_at DESC);

-- Row Level Security (RLS) 설정
ALTER TABLE scheduler_runs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Enable read access for all users" 
    ON scheduler_runs FOR SELECT 
    USING (true);

-- service_role만 쓰기 가능
CREATE POLICY "Enable insert for service role" 
    ON scheduler_runs FOR INSERT 
    TO service_role 
    WITH CHECK (true);

-- 테이블 설명
COMMENT ON TABLE scheduler_runs IS '월별 SMS 발송 스케줄러 실행 이력';
COMMENT ON COLUMN scheduler_runs.month IS '발송 대상 월 (YYYY-MM)';
COMMENT ON COLUMN scheduler_runs.total_customer IS '전체 미수금 고객 수';
COMMENT ON COLUMN scheduler_runs.excluded_count IS '제외된 고객 수';
COMMENT ON COLUMN scheduler_runs.sent_count IS '발송 시도한 고객 수';
COMMENT ON COLUMN scheduler_runs.success_count IS '발송 성공 수';
COMMENT ON COLUMN scheduler_runs.failed_count IS '발송 실패 수';
COMMENT ON COLUMN scheduler_runs.executed_at IS '스케줄러 실행 일시';
COMMENT ON COLUMN scheduler_runs.status IS '실행 결과 (success/partial/failed)';
