# 거래명세서 전자서명 및 모바일 열람 시스템 (ESIGN) PRD

## 1. 목적
기존 **[종이 출력 → 오프라인 서명 → 스캔/보관 → 수동 복사 발송]** 프로세스를
태블릿PC + 스마트폰 기반으로 100% 디지털화하고 법적 증빙 능력을 확보한다.

## 2. 전체 흐름

```
[태블릿 현장]
고객 검색 → [✍️ 서명 받기] → pending 문서 생성(문서번호 채번)
→ 개인정보 동의 체크(필수) → 서명패드 서명 → [서명 완료 및 저장]
→ 서명 PNG 선저장 → 서명 합성 PDF 생성 → SHA-256 해시 저장 → signed 전환
→ 고객 휴대폰으로 열람 링크 LMS 자동 1회 발송

[고객]
문자 링크 접속 → 생년월일 6자리(또는 전화번호 뒷 4자리) 인증 → PDF 열람/다운로드
```

## 3. 확정 사양

### 3.1 서명 및 동의 (태블릿)
- `signature_pad` 기반 Canvas 서명 패드 (터치/펜 지원, `touch-action: none`)
- 개인정보 수집·이용 동의 **체크박스 필수** (24px, 시니어 친화)
  - 미체크 시 서명 캔버스 비활성(회색) + "먼저 동의에 체크해 주세요" 안내
  - 완료 버튼 클릭 시 미체크 → 경고 + 동의 영역 빨간 테두리 2초 강조 + 스크롤
  - 서명 없이 완료 → 경고 + 캔버스 강조
- 동의 시각(`consent_agreed_at`)과 문구 버전(`consent_version`)을 DB에 기록
- 저장 실패 시 모달이 닫히지 않아 서명 유지 → 재시도 가능

### 3.2 저장 순서 (pending-first, 현장 실패 대응)
1. DB pending INSERT (문서번호 채번)
2. 서명 원본 PNG 선저장 (`/signature`)
3. 서명 합성 PDF 생성 (클라이언트, 기존 generateStatementPdf 확장)
4. PDF 저장 + SHA-256 해시 + signed 전환 + expires_at = +30일 (`/sign`)
5. SMS 자동 1회 발송 (`sms_sent_at`, `sms_to` 기록)

### 3.3 PDF 위변조 방지
- **전자간인**: 2페이지 이상이면 각 페이지 하단에
  `문서번호 | n / N 페이지 | 축소 서명 이미지` 인쇄 (마지막 페이지는 정식 서명란이므로 축소 서명 제외)
- **정식 서명란** (마지막 페이지): 동의 문구 + 성명 + 원본 서명 + 서명일시 + 문서번호
- **SHA-256 해시** (`file_hash`): 서버가 실제 저장 바이트 기준으로 계산, 위변조 검증용
- 전자본은 **주민번호 마스킹** (`680101-3******`)

### 3.4 고객 열람 인증
- 기본: **주민번호 앞 6자리(생년월일)** — 변경 불가, 기존 `customers.ssn` 재활용 (별도 저장 없음)
- 폴백: ssn 미등록 고객은 **휴대폰 뒷 4자리**
- 둘 다 없으면: 저장은 정상, 문자 스킵 + 경고
  `"고객 정보에 생년월일 그리고 휴대폰 번호를 등록해 주세요"`
- **5회 실패 시 10분 잠금** (`locked_until`), 성공 시 `viewed_at`/`view_count` 갱신
- 링크 30일 만료 (원본 PDF는 계속 보관, 링크만 만료)
- 만료/무효/잠금 시 대리점 연락처(010-2602-3276) 안내

### 3.5 문자 발송 정책
- 서명 완료 시 **자동 1회만** 발송 (중복 과금 방지)
- 추가 발송은 관리자 [재발송] 버튼으로만 (만료기한 30일 갱신 + `resend_count` 증가)

### 3.6 관리 UI
- 거래명세서 페이지: **[✍️ 서명 받기]**, **[📋 서명 이력]** 버튼
- 서명 이력 모달: 열 때만 lazy fetch — 건별 [보기](관리자 무만료) [재발송] [무효처리]
- 고객 상세 카드: "서명된 명세서 N건 (최근: 날짜)" 요약 + 거래명세서 바로가기
- 무효(void) 처리: 문서 삭제 없이 상태 전환 + 사유 기록 (감사 추적)

## 4. 보안 설계 (anon 키만 사용하는 환경 고려)

| 계층 | 설계 |
|---|---|
| 테이블 RLS | `authenticated` 전체 접근, `anon` 직접 접근 차단 |
| 공개 열람 | security definer RPC 2개로만 수행 (`get_statement_public_info`, `verify_statement_access`) |
| 파일 저장 | Storage 대신 **테이블 bytea 컬럼** 저장 — anon 키가 공개된 환경에서 Storage anon SELECT 정책은 버킷 전체 목록 노출과 동일하므로 DB 저장 선택 |
| 인증 방어 | 추측 불가 UUID 토큰 + 생년월일 + 5회 잠금 + 열람 로그 |

## 5. 데이터베이스 스키마 (transaction_statements)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | 열람 토큰 겸용 |
| document_no | text UNIQUE | ST-2026-08-0001 (월별 일련) |
| customer_id | uuid FK | customers 참조 |
| pdf_data / pdf_size | bytea / int | 최종 서명본 PDF |
| signature_data | bytea | 서명 원본 PNG |
| file_hash | text | PDF SHA-256 |
| signer_name | text | 서명자명 |
| consent_agreed_at / consent_version | timestamptz / text | 동의 시각/문구 버전 |
| total_amount / total_paid / total_unpaid / transaction_count | numeric / int | 서명 시점 금액 스냅샷 |
| status | text | pending / signed / voided |
| signed_at / expires_at | timestamptz | 서명일시 / 링크 만료(+30일) |
| sms_sent_at / sms_to / resend_count | | 발송 기록 |
| viewed_at / view_count / view_failed_count / locked_until | | 열람 추적/잠금 |
| voided_at / void_reason | | 무효 감사 |
| created_by / created_at / updated_at | | |

## 6. 구현 파일 목록

| 구분 | 파일 |
|---|---|
| SQL | `sql/create_transaction_statements_table.sql` |
| 상수 | `src/lib/esign-constants.ts` (동의 문구 v1.0, 마스킹 등) |
| SMS 헬퍼 | `src/lib/sms.ts` |
| 서명 모달 | `src/components/signature-modal.tsx` |
| 이력 모달 | `src/components/signature-history-modal.tsx` |
| PDF 합성 | `src/components/statement-pdf.tsx` (확장) |
| 관리 API | `src/app/api/statements/route.ts`, `[id]/signature`, `[id]/sign`, `[id]/resend`, `[id]/void`, `[id]/file` |
| 공개 API | `src/app/api/public/statement/[id]/route.ts`, `[id]/verify` |
| 고객 뷰어 | `src/app/statement/view/[id]/page.tsx` (middleware 공개 경로 추가) |
| 연동 | `src/app/statement/page.tsx`, `src/app/customers/[id]/page.tsx` |

## 7. 배포/운영 체크리스트
- [ ] Supabase SQL Editor에서 `sql/create_transaction_statements_table.sql` 실행
- [ ] Vercel 배포 (도메인은 `NEXT_PUBLIC_APP_URL` 또는 자동 `VERCEL_URL` 사용)
- [ ] 태블릿에서 서명 → 문자 수신 → 생년월일 인증 → 열람 테스트
- [ ] 5회 실패 잠금 / 만료 / 무효 / 재발송 시나리오 테스트
- [ ] 개인정보처리방침에 수탁자(Solapi, Vercel) 및 Supabase 리전(국외이전) 기재 검토
