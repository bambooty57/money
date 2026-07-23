# 솔라피(Solapi) 미수금 알림 시스템 PRD

## 1. 목적

월말 및 분기별로 미수금이 있는 고객에게 자동으로 SMS 알림을 발송하여 채권 회수를 용이하게 합니다.

## 2. 시스템 구조

```
src/
├── app/
│   └── api/
│       └── solapi/
│           ├── arrears/
│           │   └── route.ts       # 미수금 조회 및 발송 API
│           ├── scheduler/
│           │   ├── monthly/
│           │   │   └── route.ts   # 월말 자동 알림
│           │   └── quarterly/
│           │       └── route.ts   # 분기 자동 알림
│           ├── status/
│           │   └── route.ts       # API 상태 확인
│           └── webhook/
│               └── route.ts       # 발송 결과 웹훅
├── lib/
│   └── solapi/
│       ├── client.ts              # 솔라피 API 클라이언트
│       ├── service.ts             # 미수금 알림 서비스
│       └── database-schema.sql    # DB 스키마
├── types/
│   └── solapi.ts                  # 타입 정의
└── docs/
    └── SOLAPI_SETUP_GUIDE.md      # 설정 가이드
```

## 3. 주요 기능

### 3.1 미수금 조회
- Supabase에서 미수금이 있는 고객 조회
- 최소 금액 필터링 (기본 10만원)
- 고객별 미수금 집계

### 3.2 알림 발송
- 단일 고객 발송
- 일괄 발송 (최대 100건)
- SMS/LMS 자동 구분 (90자 기준)

### 3.3 자동 스케줄링
- 월말: 매월 25일 오전 9시
- 분기: 3, 6, 9, 12월 25일 오전 9시
- Vercel Cron Jobs 지원

### 3.4 발송 이력 관리
- 모든 발송 내역 저장
- 성공/실패 상태 추적
- 메시지 ID 기반 결과 조회

## 4. API 엔드포인트

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/solapi/arrears` | 미수금 고객 목록 |
| POST | `/api/solapi/arrears` | 알림 발송 |
| GET | `/api/solapi/status` | API 상태 확인 |
| POST | `/api/solapi/webhook` | 발송 결과 수신 |
| GET | `/api/solapi/scheduler/monthly` | 월말 자동 발송 |
| GET | `/api/solapi/scheduler/quarterly` | 분기 자동 발송 |

## 5. 메시지 템플릿

```
[{companyName}] {customerName}님, 미수금 {amount}원이 있습니다. 
입금 부탁드립니다. 문의: {contactNumber}
```

## 6. 보안

- API 키 기반 인증
- Webhook 서명 검증 (선택적)
- Cron Job Secret Key 검증
- RLS (Row Level Security) 적용

## 7. 알림 유형

| 유형 | 설명 | 자동 실행 |
|------|------|----------|
| monthly | 월말 알림 | 매월 25일 |
| quarterly | 분기 알림 | 분기 마지막 달 25일 |
| manual | 수동 발송 | 사용자 요청 시 |

## 8. 체크리스트

- [x] 솔라피 API 클라이언트 구현
- [x] 미수금 조회 로직
- [x] SMS 발송 기능
- [x] 일괄 발송 기능
- [x] 발송 이력 저장
- [x] 월말 자동 알림
- [x] 분기 자동 알림
- [x] API 상태 확인
- [x] 웹훅 처리
- [x] 데이터베이스 스키마
- [x] 설정 문서화
