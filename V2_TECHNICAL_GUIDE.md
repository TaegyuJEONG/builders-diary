# V2 UI 프로토타입 - 기술 스택 & 파일 가이드

## 📦 생성된 파일 목록

### 진입점
- **`web/src/app/v2/page.tsx`** (20줄)
  - V2 페이지 라우트
  - Suspense 경계로 로딩 상태 관리
  - `HomeContentV2` 컴포넌트 렌더링

### 데이터 계층
- **`web/src/lib/mockData.ts`** (502줄)
  - 3개 프로젝트의 임시 데이터 정의
  - 10개 목표와 47개 작업 카드
  - TypeScript 인터페이스: `CardData`, `GoalData`, `ProjectData`, `MockPortfolioV2`
  - 사용자 기존 태그셋 포함 (비용감각, 검증규율, 계측설계, 문서보다실행흔적, 자기오류교정)

### UI 컴포넌트 (총 631줄)

#### 1. `HomeContentV2.tsx` (162줄) - 메인 컨트롤러
```typescript
// 기능
- 뷰 모드 관리: onboarding ↔ main
- 상태 관리: selectedProject, selectedGoal, selectedCard, searchQuery
- 필터링 로직: 프로젝트 → 목표 → 카드 연쇄 갱신
- 검색 로직: 목표/카드 제목/설명/태그 검색
- 초기화: 프로젝트/목표 변경 시 자동 리셋
```

#### 2. `OnboardingScreen.tsx` (99줄) - 폴더 연결 전 화면
```typescript
// 요소
- 제목/설명
- 3단계 가이드 (폴더 연결 → 자동 스캔 → 시각화)
- 특징 4개 아이콘 박스
- CTA 버튼 ("시작하기")
- 주의 메시지 (V2 UI 프로토타입)

// 스타일
- 배경: from-slate-900 via-slate-800 to-slate-900 그래디언트
- 버튼: green-500 + 그림자 효과
```

#### 3. `FilterBar.tsx` (102줄) - 상단 필터 바
```typescript
// 요소
- 제목/부제목
- 프로젝트 드롭다운 (다중 선택)
- 키워드 검색 입력
- 통계 표시 (프로젝트 수, 목표 수)

// 동작
- 프로젝트 선택 시 드롭다운 자동 닫기
- 검색어 실시간 반영
```

#### 4. `GoalList.tsx` (50줄) - 좌측 목표 리스트
```typescript
// 요소
- 헤더 (목표 수)
- 목표 목록 (세로 스크롤)
- 각 목표: 제목 + 설명 + 카드 수

// 상태 표시
- 선택됨: green-500 좌측 보더 + bg-green-500/10
- 비선택: slate-600 좌측 보더 + hover 반응
```

#### 5. `CardListScrollable.tsx` (154줄) - 중앙 카드 스크롤
```typescript
// 기능
- 수평 스크롤 (smooth behavior)
- 좌/우 화살표 버튼
- 자동 스크롤 감지 (끝점 도달 시 화살표 숨김)
- 카드 제목만 표시

// 카드 상태
- 완료: green-500 보더 + 배경
- 진행 중: yellow-500 보더 + 배경
- 블로킹: red-500 보더 + 배경
- 선택됨: green-500 강조 + 그림자

// 스타일
- scrollbar 숨김 (CSS)
- gap-3 간격
```

#### 6. `CardDetailPanel.tsx` (104줄) - 우측 상세 패널
```typescript
// 요소
- 카드 제목 (2xl, bold)
- 상태 배지 (컬러 배경)
- ID (text-xs)
- 요약 (text-sm, 여러 줄)
- 태그 목록 (클릭 가능)
- 메타데이터 (생성일, 상태)
- 액션 버튼 2개

// 빈 상태
- "카드를 선택하세요" 메시지
```

---

## 🎨 스타일 시스템

### Tailwind CSS 사용
- 모든 컴포넌트에서 Tailwind 유틸리티 클래스 사용
- 다크 테마 기본 적용 (브라우저 `prefers-color-scheme: dark`)

### 컬러 팔레트
```
배경층:
- bg-slate-900  (메인 배경)
- bg-slate-800  (패널 배경)
- bg-slate-700  (인풋, 드롭다운)

텍스트층:
- text-slate-100  (주 제목)
- text-slate-200  (본문)
- text-slate-300  (라벨)
- text-slate-400  (약한 텍스트)
- text-slate-500  (플레이스홀더, 비활성)

액센트:
- green-500     (버튼, 선택)
- green-400     (호버)
- green-500/10  (배경)
- green-500/30  (상태 배지)

상태 색상:
- yellow-500/30 (진행 중)
- red-500/30    (블로킹)
- green-500/30  (완료)
```

### 반응형 디자인
```
desktop (1024px+):
- 3단 레이아웃 (좌: 256px, 중: 1fr, 우: 384px)

tablet (768px~1023px):
- 2단 레이아웃 (우측 패널 숨김)
- 모바일에서 카드 선택 시 바텀 시트 표시

mobile (<768px):
- 세로 레이아웃
- FilterBar만 보이고 다른 요소들은 재배치
```

---

## 🔄 상태 흐름 다이어그램

```
┌─────────────────────────────────────────┐
│      HomeContentV2                      │
├─────────────────────────────────────────┤
│ viewMode: onboarding | main             │
│ selectedProjectId                       │
│ selectedGoalId                          │
│ selectedCardId                          │
│ searchQuery                             │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ↓          ↓          ↓
 viewMode   FilterBar  GoalList
            프로젝트      선택된
            변경시       프로젝트의
            cascading   목표 리스트
            reset       
                         │
                         ↓
                    CardListScrollable
                    선택 목표의
                    카드들
                    (search filtered)
                         │
                         ↓
                    CardDetailPanel
                    선택 카드의
                    상세 정보
```

---

## 📊 데이터 구조

### CardData
```typescript
{
  id: string
  title: string                 // "상단 필터 바 구현 (프로젝트/목표 선택)"
  summary: string               // "드롭다운과 키워드 검색을 통한 필터링 UI 개발"
  tags: string[]                // ["검증규율", "계측설계"]
  created_at: string            // "2026-09-04"
  status: 'in_progress' | ...   // 작업 상태
}
```

### GoalData
```typescript
{
  id: string
  title: string                 // "UI 레이아웃 재설계"
  description: string           // "2단 레이아웃으로 개선: 목표 리스트 + 작업 카드 + 상세 패널"
  cards: CardData[]             // 이 목표 소속 카드들
}
```

### ProjectData
```typescript
{
  id: string
  title: string                 // "Builder's Diary V2"
  description: string
  goals: GoalData[]             // 이 프로젝트 소속 목표들
}
```

---

## 🧪 테스트 시나리오

### 1. 초기 로드
```
1. http://localhost:3000/v2 방문
2. OnboardingScreen 표시
3. "시작하기" 버튼 클릭
```

### 2. 프로젝트 선택 흐름
```
1. FilterBar의 드롭다운 클릭
2. "Builder's Diary V2" 선택
3. GoalList 갱신 (3개 목표)
4. 첫 번째 목표 자동 선택
5. CardListScrollable 갱신 (6개 카드)
```

### 3. 검색 기능
```
1. FilterBar의 검색 입력: "파인튜닝"
2. GoalList 필터됨 (LLM 평가 프로젝트만)
3. CardListScrollable 필터됨 (관련 카드만)
4. 검색 초기화 시 전체 복구
```

### 4. 카드 상세 보기
```
1. CardListScrollable에서 카드 클릭
2. CardDetailPanel에 상세 정보 표시
3. 태그 클릭 시 필터링 (미구현, 향후 기능)
```

---

## 🚀 배포 및 설정

### 필요한 패키지
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^14.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.1"
  }
}
```
*(기존 프로젝트에 모두 설치되어 있음)*

### 실행 명령
```bash
# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버
npm start
```

---

## 📝 주의사항

1. **임시 데이터**: `mockData.ts`의 데이터는 예시이며, 실제 폴더 연결 시 대체됨
2. **로컬 스토리지**: 현재 구현에 포함되지 않음 (Phase 2에서 추가 예정)
3. **파일 시스템 API**: File System Access API 미적용 (폴더 선택 기능 아직 구현 안 됨)
4. **태그 필터**: 태그 클릭 시 필터링 기능은 향후 구현 (현재 UI만 준비됨)

---

## 🎓 개선 아이디어

### 즉시 구현 가능
- [ ] 선택 상태 localStorage 저장
- [ ] URL 쿼리 스트링 동기화
- [ ] 태그 클릭 시 필터 적용

### Phase 2 구현
- [ ] 카드 내용 마크다운 렌더링
- [ ] 카드 편집 모달
- [ ] 실시간 검색 디바운싱
- [ ] 가상 스크롤 (카드 많을 때)

### Phase 3 최적화
- [ ] 이미지 지연 로딩
- [ ] 캐싱 전략
- [ ] 번들 사이즈 분석
- [ ] SEO 최적화

---

## 📞 기술 지원

### 파일 수정 시
- React 컴포넌트는 TSX 확장자 사용
- Tailwind 클래스는 IDE 자동완성 활용
- 타입은 `@/lib/types`의 기존 타입 활용

### 디버깅
- `console.log()`로 상태 확인
- React DevTools 크롬 익스텐션 추천
- Next.js 개발 서버 자동 HMR

---

**작성일**: 2026-09-04  
**마지막 업데이트**: 커밋 `94e1c3b`  
**상태**: ✅ 완성 및 배포 준비 완료
