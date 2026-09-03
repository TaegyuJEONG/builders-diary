# Issue #2: Website - Portfolio Visualization & Tag Search

## Context

Builder's Diary의 웹사이트는 사용자가 로컬 폴더에 생성한 마크다운 기록들을 **계층적으로 시각화**합니다.

**핵심 요구:**
- 로컬 폴더 접근 (File System Access API)
- 3층 계층 표시 (프로젝트 → 목표 → 기록)
- 태그 기반 검색 (V1에 포함)
- 마크다운 파싱 및 렌더링
- 반응형 UI

---

## Current Situation

**지금:**
- 기록들이 로컬 폴더에만 존재
- 시각화가 없음
- 접근이 불편함

**필요한 것:**
- 웹사이트를 방문 → 폴더 선택 → 계층 시각화
- 태그로 필터링
- 기록 상세 보기

---

## Proposed Solution

### Architecture

```
User Visit
  ↓
Website (Next.js)
  ↓
File System Access API (브라우저)
  ↓
Local Portfolio Folder
  ↓
Render 3-Layer Tree + Records
```

**특징:**
- 로그인 불필요 (로컬 폴더 권한만)
- localStorage에 폴더 경로 저장
- 매번 방문할 때 자동 로드
- 오프라인 작동 가능 (캐시)

---

## Implementation Details

### 1. Technology Stack

- **Framework**: Next.js 14 + React 18
- **Styling**: Tailwind CSS
- **Markdown Parsing**: remark + rehype
- **File Access**: File System Access API (W3C)
- **Storage**: localStorage (폴더 경로)
- **Deployment**: Vercel

### 2. Page Structure

#### Home Page (`/`)

```
┌─────────────────────────────────────┐
│  Builder's Diary                    │
│  [Select Folder]  [Refresh]         │
├──────────────┬──────────────────────┤
│              │                      │
│ Project Tree │   Record Details     │
│              │                      │
│ □ Builders   │ Builders Diary       │
│   □ Setup UI │   └─ UI Development  │
│     • OAuth  │       ├─ 20260903... │
│     • Style  │       │  OAuth 붙이기 │
│   □ Deploy   │       │  [Full Record]│
│              │       │              │
│ ○ Search    │       └─ 20260904... │
│   [auth]     │          Router 수정  │
│   [oauth]    │                      │
│   [debug]    │                      │
│              │                      │
└──────────────┴──────────────────────┘
```

**좌측 패널 (Project Tree):**
- 프로젝트 리스트 (확장 가능)
- 각 프로젝트 아래 목표 (확장 가능)
- 각 목표 아래 기록 (링크)
- 태그 필터 섹션

**우측 패널 (Record Details):**
- 선택된 기록의 상세 보기
- 마크다운 렌더링 (heading, code, lists, etc.)
- "Resume Link 복사" 버튼

### 3. File System Access API Integration

#### 폴더 선택 (초기 방문)

```typescript
// 사용자가 "Select Folder" 클릭
const folderHandle = await window.showDirectoryPicker();

// 권한 요청
for await (const entry of folderHandle.values()) {
  if (entry.kind === 'file') {
    const file = await entry.getFile();
    // 파일 읽기
  }
}

// localStorage에 저장 (재방문 시 자동 로드)
localStorage.setItem('folderHandle', folderHandle);
```

#### 폴더 스캔 로직

```
폴더 구조 읽기:
content/
├── projects-builders-diary/
│   └── goals/
│       └── ui-dev/
│           └── records/
│               ├── 20260903-000-oauth-setup.md
│               └── 20260903-001-redirect-fix.md

파싱:
→ Project { id, title, goals: [...] }
  └─ Goal { id, title, records: [...] }
     └─ Record { id, title, tags, created_at, content }
```

### 4. Data Model (In-Memory)

```typescript
interface Portfolio {
  path: string;
  projects: Project[];
}

interface Project {
  id: string;
  slug: string;
  title: string;
  goals: Goal[];
}

interface Goal {
  id: string;
  slug: string;
  title: string;
  records: Record[];
}

interface Record {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
  content: string; // 마크다운
  file_path: string;
}
```

### 5. Markdown Parsing

**Input (마크다운 파일):**
```markdown
---
id: rec-20260903-000
project_id: proj-builders-diary
goal_id: goal-ui-dev
title: OAuth 붙이고 리다이렉트 버그 잡음
tags: [oauth, auth, debugging]
created_at: 2026-09-03T14:30:00Z
---

# 무엇을 했는가
...
```

**Output (HTML):**
```html
<div class="record">
  <h2>OAuth 붙이고 리다이렉트 버그 잡음</h2>
  <p class="meta">2026-09-03 | oauth, auth, debugging</p>
  <div class="content">
    <!-- 마크다운 렌더링 -->
  </div>
</div>
```

### 6. Tag Search

**기능:**
```
사용자가 태그 선택
  ↓
필터링 (해당 태그를 포함한 Record만)
  ↓
결과: Project → Goal → Record 계층 표시
      (빈 Project/Goal은 숨김)
```

**UI:**
```
Tag Search
[oauth] [auth] [debugging] [google]
[CLI] [deployment] [testing]

Selected: oauth, auth
결과: 
- builders-diary
  - ui-dev
    - 20260903-000-oauth-setup.md ✓
    - 20260903-001-redirect-fix.md ✓
  - auth
    - 20260905-000-password-reset.md ✓
```

### 7. Resume Link Generation

**각 레벨에서 "Resume Link" 버튼:**

```
Project Level:
https://builders-diary.com/p/builders-diary

Goal Level:
https://builders-diary.com/p/builders-diary/g/ui-dev

Record Level:
https://builders-diary.com/r/rec-20260903-000
```

**Deep Link Handling:**
```typescript
// URL에 따라 자동으로 해당 항목 선택
useRouter를 통해:
- /p/:project_id → Project 펼치기
- /p/:project_id/g/:goal_id → Goal 펼치기
- /r/:record_id → Record 상세 표시
```

### 8. UI Components

**Tree Component:**
```typescript
<ProjectTree
  projects={projects}
  onSelectRecord={handleRecordSelect}
  tags={selectedTags}
/>
```

**Record Detail Component:**
```typescript
<RecordDetail
  record={selectedRecord}
  onCopyResumeLink={handleCopyLink}
/>
```

**Tag Filter Component:**
```typescript
<TagFilter
  allTags={extractAllTags(projects)}
  selectedTags={selectedTags}
  onTagChange={handleTagChange}
/>
```

### 9. Responsive Design

**Desktop (1200px+):**
- 좌측 패널: 30% (Tree)
- 우측 패널: 70% (Record Detail)
- 태그: 좌측 상단

**Tablet (768px-1199px):**
- Tree와 Detail 위아래
- 태그: 수평 스크롤

**Mobile (< 768px):**
- Tree는 아코디언
- Detail은 풀스크린
- 태그: 드롭다운

### 10. Error Handling

| 에러 | 처리 |
|------|------|
| 폴더 권한 없음 | "폴더 접근 권한을 다시 승인해주세요. [Select Folder]" |
| 마크다운 파싱 실패 | "기록을 표시할 수 없습니다. 파일이 손상되었을 수 있습니다." |
| 폴더 구조 오류 | "폴더 구조가 예상과 다릅니다. [자동 복구] 또는 [수동 설정]" |
| 파일 읽기 실패 | "파일을 읽을 수 없습니다. 권한을 확인해주세요." |

### 11. Performance Optimization

- **Lazy Loading**: Record Detail은 선택할 때만 렌더링
- **Caching**: 파일 내용을 메모리에 캐시
- **Virtualization**: 많은 기록이 있을 때 스크롤 최적화
- **Code Splitting**: 태그 필터 등 별도 번들

---

## Acceptance Criteria

1. ✅ File System Access API 통합
   - 폴더 선택 다이얼로그 작동
   - 권한 요청 및 저장

2. ✅ 3층 계층 시각화
   - Project → Goal → Record 트리뷰
   - 각 레벨에서 확장/축소 가능
   - 빈 레벨 숨김

3. ✅ 마크다운 파싱 및 렌더링
   - Front matter 파싱
   - 마크다운 → HTML 변환
   - 코드 블록 문법 강조

4. ✅ 태그 필터링
   - 모든 태그 추출 및 표시
   - 다중 선택 가능
   - 필터링 결과 반영

5. ✅ Resume Link 생성
   - 각 레벨에서 URL 복사 가능
   - Deep link 지원

6. ✅ 반응형 디자인
   - Desktop/Tablet/Mobile에서 작동
   - 터치 친화적 UI

7. ✅ 에러 처리
   - 폴더 권한 오류
   - 마크다운 파싱 오류
   - 파일 읽기 오류

8. ✅ 성능
   - 초기 로딩 < 2초
   - 폴더 스캔 < 1초
   - 평탄한 스크롤

---

## Testing Plan

### Unit Tests
- 마크다운 파싱 (remark/rehype)
- 태그 필터링 로직
- URL 생성 (deep links)
- 데이터 모델 변환

### Integration Tests
- 폴더 스캔 → Tree 렌더링
- 기록 선택 → Detail 표시
- 태그 선택 → 필터링 결과
- Deep link → 올바른 항목 선택

### E2E Tests
- 초기 방문: 폴더 선택 → Tree 표시
- 기록 클릭 → Detail 렌더링
- 태그 필터 → 결과 업데이트
- Resume Link 복사 및 방문

### Browser Compatibility
- ✅ Chrome/Edge (File System Access 지원)
- ⚠️ Firefox (제한적)
- ❌ Safari (미지원, V2에서 fallback)

---

## Timeline

- **Day 1-2**: 폴더 스캔 + Tree 컴포넌트
- **Day 2-3**: 마크다운 파싱 + Record Detail
- **Day 3**: 태그 필터 + Resume Link
- **Day 3-4**: 반응형 디자인 + 최적화
- **Day 4**: 배포 (Vercel)

---

## Out of Scope (V1)

- 공유 기능 (데이터 백엔드 필요 - V2)
- 고급 검색 (전문 검색 - V2)
- 태그 자동 제안 (AI - V2)
- 권한 관리 (팀 협업 - V2)
- 다크 모드 (미래)

---

## File Reference

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── ProjectTree.tsx       # Tree view
│   │   ├── RecordDetail.tsx      # Record detail
│   │   ├── TagFilter.tsx         # Tag search
│   │   └── Header.tsx            # Top bar
│   ├── lib/
│   │   ├── fileSystem.ts         # File System API wrapper
│   │   ├── parser.ts             # Markdown parser
│   │   ├── filter.ts             # Tag filtering
│   │   └── types.ts              # TypeScript types
│   └── utils/
│       ├── resumeLink.ts         # Deep link generation
│       └── cache.ts              # Caching logic
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## Notes

- **V1 Focus**: 로컬 폴더, 시각화, 검색만
- **Deployment**: Vercel (자동 배포)
- **Browser**: Chrome/Edge (File System Access 지원)
- **Performance**: localStorage + 메모리 캐시
- **UX**: 폴더 선택 한 번 → 자동 로드 (다음 방문 시)

