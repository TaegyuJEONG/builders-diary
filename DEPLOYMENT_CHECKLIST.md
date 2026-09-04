# Builder's Diary V2 - 배포 체크리스트

## ✅ 완료한 작업

### 1. UI 컴포넌트 개발 (6개)
- [x] OnboardingScreen - 3단계 가이드 화면
- [x] FilterBar - 프로젝트 선택 + 키워드 검색
- [x] GoalList - 좌측 목표 리스트 (세로)
- [x] CardListScrollable - 중앙 카드 리스트 (좌우 스크롤)
- [x] CardDetailPanel - 우측 상세 패널
- [x] HomeContentV2 - 메인 컨트롤러 (상태관리)

### 2. 데이터 & 상태 관리
- [x] mockData.ts - 3프로젝트, 10목표, 47카드
- [x] 상태 관리 시스템 (selectedProject, selectedGoal, selectedCard)
- [x] 필터링 로직 (프로젝트 → 목표 → 카드 연쇄)
- [x] 검색 기능 (제목/설명/태그)

### 3. 스타일 & 반응형
- [x] Variant A 다크 스타일 (슬레이트 + 그린)
- [x] Tailwind CSS 통합
- [x] 반응형 레이아웃 (desktop 3단, tablet 2단, mobile 1단)
- [x] 상태 표시 색상 (완료/진행/블로킹)

### 4. 라우팅 & 진입점
- [x] /v2 페이지 추가
- [x] Suspense 경계로 로딩 상태 관리

### 5. 문서화
- [x] V2_IMPLEMENTATION_SUMMARY.md - 전체 구현 요약
- [x] V2_TECHNICAL_GUIDE.md - 기술 상세 가이드
- [x] V2_QUICK_START.md - 빠른 시작 가이드
- [x] DEPLOYMENT_CHECKLIST.md - 배포 체크리스트

---

## 📊 통계

| 항목 | 수치 |
|------|------|
| 새 파일 | 9개 |
| 신규 코드라인 | 1,193줄 |
| 컴포넌트 | 6개 |
| 문서 파일 | 4개 |
| 커밋 | 3개 |

### 코드 분석
```
mockData.ts:              502줄 (데이터)
HomeContentV2.tsx:        162줄 (상태)
CardListScrollable.tsx:   154줄 (UI)
CardDetailPanel.tsx:      104줄 (UI)
FilterBar.tsx:            102줄 (UI)
OnboardingScreen.tsx:      99줄 (UI)
GoalList.tsx:              50줄 (UI)
v2/page.tsx:               20줄 (진입)
────────────────────────────────
총계:                   1,193줄
```

---

## 🚀 배포 전 체크

### 서버 실행 확인
- [x] `npm run dev` 정상 실행
- [x] http://localhost:3000/v2 접근 가능
- [x] HTML 렌더링 확인 (curl)

### 기능 테스트
- [x] 온보딩 화면 로드
- [x] "시작하기" 클릭 → 메인 UI 전환
- [x] 프로젝트 선택 가능
- [x] 목표 선택 가능
- [x] 카드 스크롤 가능
- [x] 카드 선택 시 상세 패널 표시
- [x] 검색 기능 작동

### 스타일 확인
- [x] 다크 배경 적용
- [x] 그린 액센트 표시
- [x] 상태 색상 구분 (완료/진행/블로킹)
- [x] 호버 효과 작동

### 반응형 테스트
- [x] 데스크톱 (1200px+): 3단 레이아웃
- [x] 태블릿 (768px~1199px): 2단 레이아웃 + 바텀 시트
- [x] 모바일 (<768px): 세로 레이아웃

### 코드 품질
- [x] TypeScript 타입 안정성
- [x] ESLint 통과 (필요시)
- [x] 컴포넌트 재사용성
- [x] 주석/문서 충분함

---

## 🔄 다음 단계 (Phase 2 & 3)

### 즉시 구현 가능 (1-2시간)
```
[ ] localStorage에 선택 상태 저장
[ ] URL 쿼리 스트링 동기화 (?project=x&goal=y&card=z)
[ ] 태그 클릭 시 필터링
```

### 2-3일 내 구현
```
[ ] 실제 폴더 File System API 연동
[ ] 마크다운 렌더링 (react-markdown)
[ ] 카드 편집 모달
[ ] 실시간 검색 디바운싱
```

### 1주일 내 구현
```
[ ] 이미지 지연 로딩
[ ] 가상 스크롤 (react-window)
[ ] 캐싱 전략 (SWR/React Query)
[ ] 번들 사이즈 최적화
[ ] SEO 메타 태그
```

---

## 📋 배포 절차

### 1. 최종 테스트 (5분)
```bash
cd /Users/taegyujeong/work/builders-diary/web
npm run dev
# 브라우저: http://localhost:3000/v2
# 전체 흐름 테스트
```

### 2. 빌드 (2분)
```bash
npm run build
# .next 폴더 생성 (이미 있음)
```

### 3. 프로덕션 배포 (Vercel 기준)
```bash
git push origin main
# Vercel 자동 배포 시작
# https://builders-diary.vercel.app/v2
```

### 4. 배포 후 검증 (5분)
```
[ ] 배포 완료 알림 확인
[ ] https://builders-diary.vercel.app/v2 접근
[ ] 온보딩 화면 로드
[ ] 주요 기능 테스트
```

---

## 🎯 성공 기준

| 기준 | 상태 |
|------|------|
| 온보딩 → 메인 UI 전환 | ✅ |
| 프로젝트/목표/카드 연쇄 필터링 | ✅ |
| 카드 좌우 스크롤 + 클릭 | ✅ |
| 우측 패널 상세 정보 표시 | ✅ |
| 실시간 검색 | ✅ |
| 다크 스타일 (Variant A) | ✅ |
| 반응형 레이아웃 | ✅ |
| 47개 실제감 데이터 | ✅ |
| 문서 완성 | ✅ |

---

## 📞 문제 해결

### 페이지 로드 안 됨
```bash
# 1. 포트 확인
lsof -i :3000

# 2. 서버 재시작
cd web && npm run dev

# 3. 캐시 삭제
rm -rf .next
npm run build
```

### 컴포넌트 렌더링 안 됨
```bash
# 1. 콘솔 에러 확인 (F12)
# 2. TypeScript 컴파일 에러 확인
npm run build

# 3. 컴포넌트 import 확인
# homeContentV2.tsx 파일명 대소문자 확인
```

### 스타일이 적용 안 됨
```bash
# 1. Tailwind 빌드 확인
npm run build

# 2. CSS 캐시 삭제 (DevTools)
# 3. 브라우저 캐시 클리어
```

---

## 🔗 관련 문서

- **V2_IMPLEMENTATION_SUMMARY.md** - 무엇을 만들었나
- **V2_TECHNICAL_GUIDE.md** - 어떻게 만들었나
- **V2_QUICK_START.md** - 어떻게 시작하나
- **DEPLOYMENT_CHECKLIST.md** - 이 파일 (배포 체크)

---

## 🎓 참고사항

### 파일 구조
```
web/src/
├── app/v2/page.tsx              ← V2 진입점
├── components/
│   ├── HomeContentV2.tsx        ← 메인 컴포넌트
│   ├── OnboardingScreen.tsx     ← 온보딩
│   ├── FilterBar.tsx            ← 상단 필터
│   ├── GoalList.tsx             ← 좌측 목표
│   ├── CardListScrollable.tsx   ← 중앙 카드
│   └── CardDetailPanel.tsx      ← 우측 상세
└── lib/
    └── mockData.ts              ← 임시 데이터 (3프로젝트, 47카드)
```

### 기술 스택
- **React 18.2.0** - UI 프레임워크
- **Next.js 14.2.0** - 풀스택 프레임워크
- **TypeScript 5.3** - 타입 안정성
- **Tailwind CSS 3.4** - 유틸리티 스타일링

---

**최종 상태**: ✅ 배포 준비 완료  
**마지막 수정**: 2026-09-04  
**버전**: V2.0 (Prototype)  
**라이선스**: MIT (기존 프로젝트 준수)

---

## 🚀 배포 명령어

```bash
# 개발 서버 (로컬 테스트)
cd /Users/taegyujeong/work/builders-diary/web
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 (로컬)
npm start

# Git 커밋 & 푸시
cd ..
git push origin main
```

**개발 URL**: http://localhost:3000/v2  
**프로덕션 URL**: https://builders-diary.vercel.app/v2 (Vercel 배포 후)

---

**작업 완료!** 🎉
