---
date: 2026-09-04
attempt: 01
title: Builder's Diary V2 - Visual UI 3-Column Layout
tags: [variant-a-design, component-architecture, react-state-management, next-js, responsive-design]
duration: 40분
---

## 무엇이 문제였나

Builder's Diary 웹 애플리케이션의 시각적 UI가 완전하지 않았다. 온보딩 화면과 메인 콘텐츠 레이아웃이 미구현 상태였고, 필터링/카드 표시/상세 패널 기능도 없었다. 9월 8일 공개 목표를 앞두고 데스크톱-먼저 3단 레이아웃(좌측 필터 + 중앙 카드 스크롤 + 우측 상세)을 완성해야 했다.

## 장면 1: 컴포넌트 구조 설계 및 타입 검증

### 제목
OnboardingScreen + 3단 레이아웃 컴포넌트 5개 신규 작성

- **앞에 있던 것**
  - HomeContent: 폴더 선택 로직만, UI 미완성
  - 필터바/카드/상세패널 없음
  - 레이아웃: 좌측 트리 + 우측 상세만 있음 (2단)

- **기준**
  - mockData.ts: 3개 프로젝트, 각 3-4 목표, 각 6-8 카드 준비됨
  - types.ts: Project/Goal/Record 인터페이스 이미 정의됨
  - 기존 Header, ProjectTree, RecordDetail, TagFilter 컴포넌트 존재

- **한 것**
  - OnboardingScreen.tsx 작성: 3단계 가이드 + 폴더 선택 버튼
  - FilterBar.tsx 작성: 프로젝트/목표 드롭다운 + 검색 입력
  - CardScrollable.tsx 작성: 좌우 스크롤 카드, 제목만 표시
  - DetailPanel.tsx 작성: 우측 패널, 상세 정보 표시
  - HomeContent.tsx 완전 재작성: 3단 레이아웃 + 상태 관리

- **본 것**
  - 5개 컴포넌트, 총 696줄 코드 생성
  - DetailPanel에서 TypeScript Record 타입 충돌 발생 (내장 Record와 우리 Record 타입 이름 중복)
  - 빌드 실패: "Type error: Type 'Record' is not generic."

- **틀린 것**
  - DetailPanel.tsx 22줄에서 `Record<string, {...}>` 사용 → 우리 Record 타입과 충돌
  - 수정: `{ [key: string]: {...} }` 구문으로 변경

## 장면 2: 빌드 검증 및 타입 에러 수정

### 제목
TypeScript 컴파일 에러 해결

- **앞에 있던 것**
  - npm run build 실행 중 첫 번째 실패
  - DetailPanel.tsx의 statusColors 객체 타입 선언 문제

- **기준**
  - tsconfig.json: TypeScript 5.3.3 설정
  - next.config.js: 표준 Next.js 14.2 설정
  - 빌드 커맨드: `next build`

- **한 것**
  ```typescript
  // Before (에러)
  const statusColors: Record<string, { bg: string; text: string }> = {
  
  // After (수정)
  const statusColors: { [key: string]: { bg: string; text: string } } = {
  ```
  - mcp__patch로 DetailPanel.tsx 수정

- **본 것**
  ```
  ✓ Compiled successfully
  ✓ Generating static pages (4/4)
  Route (app)                              Size     First Load JS
  ┌ ○ /                                    5.73 kB          93 kB
  ```
  - 빌드 성공, TypeScript 에러 0
  - 첫 로드 JS 크기: 93 kB (최적화됨)

- **틀린 것**
  - 없음, 한 번에 수정 완료

## 장면 3: 로컬 개발 테스트 및 렌더링 검증

### 제목
npm run dev로 http://localhost:3002 렌더링 확인

- **앞에 있던 것**
  - 컴포넌트 5개 완성, 빌드 성공
  - 실제 렌더링 확인 필요

- **기준**
  - 로컬 Next.js 개발 서버
  - 포트 3000-3002 (다른 프로세스 충돌)

- **한 것**
  - `npm run dev` 실행 → 포트 3002에서 실행됨
  - `curl http://localhost:3002` 요청
  - HTML 응답 검증

- **본 것**
  ```html
  <h1 class="text-4xl font-bold text-slate-900 mb-3">Builder's Diary</h1>
  <p class="text-xl text-slate-600">Your portfolio visualization system</p>
  <div class="text-4xl mb-4">📁</div>
  <div class="text-4xl mb-4">📊</div>
  <div class="text-4xl mb-4">🚀</div>
  <button class="bg-gradient-to-r from-emerald-500 to-emerald-600 ...">
    Select Your Portfolio Folder
  </button>
  ```
  - OnboardingScreen 3단계 완벽 렌더링
  - Variant A 스타일 (emerald-500, emerald-600 그래디언트)
  - 제목, 설명, 버튼 모두 보임

- **틀린 것**
  - 없음, 온보딩 화면 정상 표시

## 장면 4: Vercel 프로덕션 배포

### 제목
vercel --prod로 프로덕션 빌드 및 배포

- **앞에 있던 것**
  - 로컬 개발 성공
  - 배포 설정 이미 준비됨 (.vercel 폴더 있음)

- **기준**
  - Vercel CLI 59.11.2
  - Node.js 22.14.0
  - 기존 deployment 캐시 있음

- **한 것**
  ```bash
  cd web
  git add -A
  git commit -m "feat: Implement visual UI with 3-column layout"
  vercel --prod
  ```
  - 5개 파일 변경 사항 커밋
  - Vercel 프로덕션 배포 실행

- **본 것**
  ```
  ✓ Compiled successfully
  ✓ Generating static pages (4/4)
  ...
  Build Completed in 16s
  Production      https://web-lko68fmu1-tjs-projects-c80c6a7d.vercel.app
  status: "ok"
  readyState: "READY"
  ```
  - 빌드 성공 (16초)
  - 프로덕션 URL 배포 완료
  - "READY" 상태 확인

- **틀린 것**
  - 없음, 배포 첫 번에 성공

## 남은 것

1. **다음 구현** (향후 에피소드):
   - Mock 데이터를 실제 폴더 스캔으로 전환 (FileSystem API 통합)
   - 카드 타이틀 클릭 시 우측 패널 업데이트 검증
   - 프로젝트/목표 필터 변경 시 카드 목록 갱신 검증
   - 모바일 반응형 테스트 (태블릿, 스마트폰)

2. **배포 확인 규칙**:
   - 다음 배포 전: `npm run build` 로컬 테스트 필수
   - TypeScript 에러 발생 시: 즉시 수정, 재배포
   - 프로덕션 URL 변경 시: 문서 업데이트

---
**태그 근거**
- variant-a-design — 장면 1, 2 (emerald 색상, 그래디언트 버튼 사용)
- component-architecture — 장면 1 (5개 컴포넌트 설계)
- react-state-management — 장면 1 (useState, 필터 상태 관리)
- next-js — 장면 2, 3, 4 (Next.js 14.2 빌드/배포)
- responsive-design — 장면 1 (모바일/테블릿/데스크톱 대응)
