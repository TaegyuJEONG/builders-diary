# Builder's Diary V2 - 빠른 시작 가이드

## 🚀 30초 시작

### 1단계: 개발 서버 실행
```bash
cd /Users/taegyujeong/work/builders-diary/web
npm run dev
```

### 2단계: 브라우저에서 열기
```
http://localhost:3000/v2
```

### 3단계: 테스트
- "시작하기" 클릭 → 메인 UI 표시
- 프로젝트 선택 → 목표 리스트 갱신
- 목표 선택 → 카드 리스트 갱신
- 카드 클릭 → 우측 패널에 상세 정보 표시

---

## 📂 핵심 파일 5개

| 파일 | 역할 | 라인 수 |
|------|------|--------|
| `web/src/lib/mockData.ts` | 3프로젝트, 47카드 임시 데이터 | 502 |
| `web/src/components/HomeContentV2.tsx` | 상태 관리 및 필터링 | 162 |
| `web/src/components/OnboardingScreen.tsx` | 초기 안내 화면 | 99 |
| `web/src/components/FilterBar.tsx` | 프로젝트/검색 필터 | 102 |
| `web/src/components/CardListScrollable.tsx` | 카드 좌우 스크롤 | 154 |

추가: `GoalList.tsx` (50), `CardDetailPanel.tsx` (104), `v2/page.tsx` (20)

---

## 🎨 UI 레이아웃

```
┌──────────────────────────────────────────┐
│ FilterBar (프로젝트 선택 + 검색)         │
├─────────┬─────────────────┬──────────────┤
│ Goals   │ Cards Scroll    │ Card Detail  │
│ 256px   │ 1fr (flex)      │ 384px        │
└─────────┴─────────────────┴──────────────┘
```

---

## 💡 주요 기능

✅ **온보딩**: 3단계 가이드로 첫 사용자 안내  
✅ **필터링**: 프로젝트 → 목표 → 카드 연쇄 필터링  
✅ **검색**: 제목/설명/태그로 실시간 검색  
✅ **카드 스크롤**: 좌우 화살표로 카드 탐색  
✅ **상세 패널**: 선택 카드의 모든 정보 표시  
✅ **다크 스타일**: Variant A (슬레이트 + 그린)  
✅ **반응형**: 모바일/태블릿/데스크톱 최적화  

---

## 📊 데이터 규모

- **프로젝트**: 3개
- **목표**: 10개  
- **카드**: 47개
- **총 라인 수**: 1,193줄

### 프로젝트별 구성
1. **Builder's Diary V2** (14 카드)
2. **Supabase 비용 최적화** (15 카드)
3. **LLM 평가 및 최적화** (18 카드)

---

## 🔧 커스터마이즈

### 데이터 추가
```typescript
// web/src/lib/mockData.ts
export const mockPortfolioV2: MockPortfolioV2 = {
  projects: [
    {
      id: 'my-project',
      title: '새 프로젝트',
      description: '설명',
      goals: [/* ... */]
    }
  ]
};
```

### 색상 변경
```typescript
// web/src/components/*.tsx
// Tailwind 클래스 변경
// 예: bg-slate-900 → bg-gray-900
```

### 새 컴포넌트 추가
```typescript
// 1. web/src/components/NewComponent.tsx 생성
// 2. HomeContentV2.tsx에서 import
// 3. JSX에서 사용
```

---

## 🧪 테스트 체크리스트

- [ ] V2 페이지 로드 (온보딩 표시)
- [ ] "시작하기" 클릭 (메인 UI 표시)
- [ ] 프로젝트 선택 (드롭다운)
- [ ] 목표 선택 (좌측 리스트)
- [ ] 카드 스크롤 (화살표)
- [ ] 카드 선택 (우측 패널)
- [ ] 검색 입력 (필터링)
- [ ] 모바일 테스트 (반응형)

---

## 📚 문서

- **V2_IMPLEMENTATION_SUMMARY.md**: 전체 구현 요약
- **V2_TECHNICAL_GUIDE.md**: 기술 상세 가이드
- **V2_QUICK_START.md**: 이 파일 (빠른 시작)

---

## 🎯 다음 단계

### 즉시 가능
1. `web/src/lib/mockData.ts` 데이터 추가/수정
2. Tailwind 클래스로 스타일 커스터마이즈
3. 새 컴포넌트 추가 (필터, 내보내기 등)

### Phase 2 (2-3일)
1. localStorage에 선택 상태 저장
2. URL 쿼리 스트링 동기화
3. 태그 클릭 필터링 구현

### Phase 3 (1주일)
1. 실제 폴더 File System API 연동
2. 마크다운 렌더링
3. 카드 편집 기능

---

## 💬 질문?

모든 컴포넌트에 주석이 포함되어 있습니다.  
TypeScript 타입 정의도 명확하니 참고하세요.

**개발 서버 접근**: http://localhost:3000/v2

---

**상태**: ✅ 즉시 사용 가능  
**마지막 수정**: 2026-09-04  
**커밋**: `2cdebf6` (docs) + `94e1c3b` (feat)
