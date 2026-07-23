# 솔라피(Solapi) 미수금 알림 시스템 설정 가이드

## 개요

이 시스템은 솔라피 API를 사용하여 월말 및 분기별로 미수금이 있는 고객에게 자동으로 SMS 알림을 발송하는 기능을 제공합니다.

## 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
# Supabase 설정 (이미 설정되어 있음)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 솔라피 API 설정
SOLAPI_API_KEY=your_solapi_api_key
SOLAPI_API_SECRET=your_solapi_api_secret
SOLAPI_SENDER_NUMBER=발신자번호 (예: 01012345678)

# 선택적 설정
SOLAPI_WEBHOOK_API_KEY=webhook_api_key_for_security
SOLAPI_WEBHOOK_SECRET=webhook_secret_for_signature_verification
CRON_SECRET_KEY=cron_job_secret_key

# 알림 설정
COMPANY_NAME=회사명 (예: 구보다농기계)
CONTACT_NUMBER=문의전화번호
MIN_ARREARS_AMOUNT=100000  # 최소 미수금액 (기본값: 100,000원)
```

## 데이터베이스 설정

### 1. notification_history 테이블 생성

Supabase Dashboard > SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- 알림 발송 이력 테이블
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    message TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    message_id TEXT,
    error_message TEXT,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('monthly', 'quarterly', 'manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_notification_history_customer_id ON notification_history(customer_id);
CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at DESC);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_notification_history_notification_type ON notification_history(notification_type);

-- RLS 설정
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
    ON notification_history FOR SELECT USING (true);

CREATE POLICY "Enable write access for authenticated users" 
    ON notification_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## API 엔드포인트

### 1. 미수금 고객 조회

```http
GET /api/solapi/arrears?minAmount=100000
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "홍길동",
      "mobile": "010-1234-5678",
      "totalArrears": 500000,
      "lastTransactionDate": "2024-01-15",
      "transactionCount": 3
    }
  ],
  "meta": {
    "total": 1,
    "totalArrears": 500000
  }
}
```

### 2. 단일 고객 알림 발송

```http
POST /api/solapi/arrears
Content-Type: application/json

{
  "action": "send",
  "customerId": "customer-uuid",
  "notificationType": "manual"
}
```

### 3. 일괄 알림 발송

```http
POST /api/solapi/arrears
Content-Type: application/json

{
  "action": "send-bulk",
  "customers": [
    { "id": "uuid", "name": "홍길동", "mobile": "010-1234-5678", "totalArrears": 500000 }
  ],
  "notificationType": "monthly"
}
```

### 4. 메시지 미리보기

```http
POST /api/solapi/arrears
Content-Type: application/json

{
  "action": "preview",
  "customerId": "customer-uuid"
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "customer": { ... },
    "message": "[구보다농기계] 홍길동님, 미수금 500,000원이 있습니다...",
    "estimatedLength": 85,
    "smsType": "SMS"
  }
}
```

### 5. 솔라피 상태 확인

```http
GET /api/solapi/status
```

**응답 예시:**
```json
{
  "success": true,
  "configured": true,
  "connected": true,
  "data": {
    "balance": 50000,
    "senderNumber": "01012345678",
    "estimatedMessages": 5555
  }
}
```

## 자동 스케줄링 설정

### Vercel Cron Jobs (권장)

`vercel.json`에 다음을 추가하세요:

```json
{
  "crons": [
    {
      "path": "/api/solapi/scheduler/monthly",
      "schedule": "0 9 25 * *"
    },
    {
      "path": "/api/solapi/scheduler/quarterly",
      "schedule": "0 9 25 3,6,9,12 *"
    }
  ]
}
```

- 월말 알림: 매월 25일 오전 9시
- 분기 알림: 3, 6, 9, 12월 25일 오전 9시

### 외부 스케줄러 사용

curl이나 외부 스케줄러에서 호출:

```bash
# 월말 알림
curl -X GET "https://your-domain.com/api/solapi/scheduler/monthly" \
  -H "Authorization: Bearer $CRON_SECRET_KEY"

# 분기 알림
curl -X GET "https://your-domain.com/api/solapi/scheduler/quarterly" \
  -H "Authorization: Bearer $CRON_SECRET_KEY"
```

## 메시지 템플릿 설정

기본 메시지 템플릿은 다음 변수를 사용할 수 있습니다:

- `{companyName}` - 회사명
- `{customerName}` - 고객명
- `{amount}` - 미수금액 (포맷팅된)
- `{contactNumber}` - 문의 전화번호

기본 템플릿:
```
[{companyName}] {customerName}님, 미수금 {amount}원이 있습니다. 입금 부탁드립니다. 문의: {contactNumber}
```

## 알림 설정 변경

`src/lib/solapi/service.ts`에서 다음 설정을 수정할 수 있습니다:

```typescript
const defaultConfig: ArrearsNotificationConfig = {
  monthlyDay: 25,              // 월말 알림일 (1-31)
  quarterlyMonths: [3, 6, 9, 12],  // 분기 알림 월
  minArrearsAmount: 100000,    // 최소 미수금액
  messageTemplate: "...",        // 메시지 템플릿
};
```

## 웹훅 설정

솔라피 대시보드에서 웹훅 URL을 설정하세요:

```
https://your-domain.com/api/solapi/webhook
```

웹훅을 통해 발송 결과를 실시간으로 받아서 이력을 업데이트합니다.

## 주의사항

1. **발신번호 등록**: 솔라피 대시보드에서 발신번호를 미리 등록해야 합니다.
2. **잔액 확인**: 정기적으로 `/api/solapi/status`로 잔액을 확인하세요.
3. **Rate Limiting**: API 호출 시 100ms 간격으로 제한됩니다.
4. **개인정보**: 고객 전화번호는 암호화하여 저장하고, 로그에 남기지 마세요.

## 테스트

```bash
# 1. 상태 확인
curl http://localhost:3000/api/solapi/status

# 2. 미수금 고객 조회
curl "http://localhost:3000/api/solapi/arrears?minAmount=100000"

# 3. 메시지 미리보기
curl -X POST http://localhost:3000/api/solapi/arrears \
  -H "Content-Type: application/json" \
  -d '{"action": "preview", "customerId": "test-uuid"}'

# 4. 단일 발송 테스트
curl -X POST http://localhost:3000/api/solapi/arrears \
  -H "Content-Type: application/json" \
  -d '{"action": "send", "customerId": "test-uuid", "notificationType": "manual"}'
```

## 문제 해결

### "Unauthorized" 오류
- 환경 변수가 올바르게 설정되었는지 확인
- `.env.local` 파일이 프로젝트 루트에 있는지 확인

### "Customer not found" 오류
- 고객 ID가 올바른지 확인
- 해당 고객의 미수금이 `minAmount` 이상인지 확인

### 발송 실패
- 솔라피 잔액 확인: `/api/solapi/status`
- 발신번호 등록 여부 확인
- 수신자 번호 형식 확인 (하이픈 제거됨)

### 데이터베이스 오류
- Supabase 연결 확인
- `notification_history` 테이블 생성 확인
- RLS 정책 확인
