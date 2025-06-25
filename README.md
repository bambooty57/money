# 크레딧-노트 (Credit-Note) 💰

구보다농기계 영암대리점 채권 관리 솔루션 - **고성능 & 타입 안전성 보장**

## ⚡ 성능 최적화 및 타입 안전성

이 프로젝트는 **고성능 웹사이트**와 **100% 타입 안전성**을 보장하는 최첨단 개발 규칙을 적용했습니다.

### 🚀 성능 최적화 기능
- **Next.js App Router**: SSG, Prefetching, Code Splitting 최적화
- **이미지 최적화**: WebP/AVIF 자동 변환, 30일 캐싱
- **번들 최적화**: Tree Shaking, Dynamic Import 적용
- **API 캐싱**: 5분 캐싱 + SWR 전략
- **CDN 최적화**: Gzip/Brotli 압축

### 🛡️ 타입 안전성 보장
- **Supabase 타입 자동 생성**: 데이터베이스 스키마 동기화
- **Zod 런타임 검증**: API 요청/응답 실시간 검증
- **TypeScript Strict 모드**: 100% 타입 안전성
- **스키마 변경 감지**: 자동 타입 재생성 알림

## 🛠️ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Validation**: Zod Runtime Schema Validation
- **Performance**: Sharp Image Optimization, Bundle Analyzer
- **Development**: ESLint, Prettier, GitHub Actions

## 📋 주요 기능

### 👥 고객 관리
- 고객 정보 등록/수정/삭제 (타입 안전)
- 실시간 검색 및 필터링
- 파일 업로드 및 관리

### 💸 거래 관리
- 거래 내역 추적 (런타임 검증)
- 결제 상태 관리
- 통계 및 차트 시각화

### ⚖️ 법적 조치
- 법적 조치 이력 관리
- 진행 상태 추적
- 문서 관리

### 📊 대시보드
- KPI 및 통계 (성능 최적화)
- SMS 발송 기능
- 접촉 기록 관리

## 🚀 시작하기

### 1. 프로젝트 클론 및 설치
```bash
git clone <repository-url>
cd money
npm install
```

### 2. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 개발 서버 실행
```bash
# 일반 개발 모드
npm run dev

# 터보 모드 (더 빠른 개발)
npm run dev:fast
```

### 4. 타입 안전성 체크
```bash
# 스키마 동기화 및 타입 체크
npm run db:sync

# 전체 시스템 체크
npm run schema:check
```

## 📊 성능 모니터링

### 성능 체크 명령어
```bash
# 번들 크기 분석
npm run analyze

# 성능 전체 체크
npm run perf:check

# 타입스크립트 체크
npm run test:types
```

### 자동 성능 목표
- **Performance Score**: 80점 이상
- **First Contentful Paint**: 2초 이하
- **Largest Contentful Paint**: 3초 이하
- **Cumulative Layout Shift**: 0.1 이하
- **Total Blocking Time**: 300ms 이하

## 🔧 개발 도구

### VS Code 확장 프로그램
자동으로 권장되는 확장 프로그램들:
- TypeScript & JavaScript Language Features
- Tailwind CSS IntelliSense
- Prettier Code Formatter
- ESLint
- Supabase VSCode Extension

### 자동화된 체크
- **GitHub Actions**: 매일 스키마 동기화 체크
- **Lighthouse CI**: PR마다 성능 체크
- **Type Check**: 모든 커밋마다 타입 안전성 검증

## 🛡️ 타입 안전성 규칙

### 자동 적용되는 검증
1. **데이터베이스 쿼리**: 모든 Supabase 쿼리는 타입 안전
2. **API 요청/응답**: Zod 스키마로 런타임 검증
3. **컴포넌트 Props**: TypeScript strict 모드 강제
4. **폼 데이터**: React Hook Form + Zod 검증

### 스키마 변경 프로세스
1. Supabase에서 스키마 변경
2. `npm run types:generate` 실행
3. 타입 불일치 자동 감지
4. 코드 수정 후 타입 체크 통과

## 📈 성능 최적화 전략

### 프론트엔드 최적화
- **Code Splitting**: 라우트별 자동 분할
- **Prefetching**: 중요 페이지 미리 로드
- **Image Optimization**: 자동 WebP/AVIF 변환
- **Bundle Analysis**: 번들 크기 모니터링

### 백엔드 최적화
- **Query Optimization**: 필요한 필드만 선택
- **Caching Strategy**: API 응답 캐싱
- **Storage Separation**: 큰 JSON 데이터 분리 저장
- **Connection Pooling**: DB 연결 최적화

## 🔍 개발 명령어

```bash
# 개발 관련
npm run dev              # 개발 서버 시작
npm run dev:fast         # 터보 모드 개발 서버
npm run build            # 프로덕션 빌드
npm run start            # 프로덕션 서버 시작

# 타입 및 스키마 관련
npm run types:generate   # Supabase 타입 생성
npm run types:check      # TypeScript 타입 체크
npm run db:sync          # 스키마 동기화
npm run schema:check     # 전체 스키마 체크

# 성능 관련
npm run analyze          # 번들 분석
npm run perf:check       # 성능 체크
npm run build:analyze    # 분석과 함께 빌드

# 테스트 및 린트
npm run lint             # ESLint 체크
npm run test:types       # 타입스크립트 테스트
```

## 🏗️ 아키텍처

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API Routes (타입 안전)
│   ├── customers/      # 고객 관리 페이지
│   ├── transactions/   # 거래 관리 페이지
│   └── legal-actions/  # 법적 조치 페이지
├── components/         # 재사용 컴포넌트
├── lib/
│   ├── supabase.ts    # 타입 안전한 Supabase 클라이언트
│   ├── schema-validators.ts # Zod 검증 스키마
│   └── utils.ts       # 유틸리티 함수
└── types/
    ├── supabase.ts    # 자동 생성된 Supabase 타입
    └── database.ts    # 커스텀 데이터베이스 타입
```

## 🚀 배포

### Vercel 배포 (권장)
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

### 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수를 설정하세요:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🤝 기여하기

1. 이 저장소를 포크하세요
2. 기능 브랜치를 생성하세요 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/amazing-feature`)
5. Pull Request를 열어주세요

### 기여 규칙
- 모든 PR은 타입 체크를 통과해야 합니다
- Lighthouse 성능 점수 80점 이상 유지
- 스키마 변경 시 `[schema]` 태그 포함

## 🆘 지원

문제가 발생하거나 질문이 있으시면:
1. `npm run schema:check`로 시스템 상태를 확인해주세요
2. 성능 문제는 `npm run perf:check`로 진단해주세요
3. [Issues](https://github.com/your-repo/issues)에 등록해주세요

---

**🚀 이 프로젝트는 웹페이지 성능 최적화와 타입 안전성을 극대화한 차세대 웹 애플리케이션입니다!**
