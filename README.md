# 크레딧-노트 (Credit-Note)

구보다농기계 영암대리점 채권 관리 솔루션

## 프로젝트 소개

Next.js와 TypeScript, Supabase를 활용한 채권 관리 SaaS 웹 애플리케이션입니다.

## 주요 기능

- 고객 관리 (등록, 조회, 수정)
- 거래 관리 (판매/입금 기록)
- 법적 조치 관리
- 대시보드 (KPI 및 통계)
- SMS 발송 기능
- 파일 관리
- 접촉 기록 관리

## 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Form**: React Hook Form + Zod
- **State**: Zustand
- **Charts**: Recharts

## 시작하기

1. 의존성 설치:
```bash
npm install
```

2. 환경 변수 설정:
`.env.local` 파일을 생성하고 Supabase 정보를 입력하세요.

3. 개발 서버 실행:
```bash
npm run dev
```

4. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 배포

Vercel Platform을 통해 쉽게 배포할 수 있습니다.
