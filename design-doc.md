# Builder's Diary — V1 Design Doc (Final)

**작성**: 2026-09-03 | **상태**: 최종 확정 | **타겟 런칭**: 2026-09-08

---

## Executive Summary

빌더가 AI 도구(ChatGPT, Claude, Cursor)로 작업할 때, **스킬 한 번 호출로 기록을 자동 생성**한다. 기록은 **로컬 폴더에만 저장**되고, 웹사이트는 그 폴더를 읽어서 **3층 계층 구조로 시각화**한다.

**V1 철학:**
- **빌더 우선**: 모든 데이터는 빌더의 로컬 폴더에 있다 (완전 소유)
- **로그인 없음**: 폴더 선택만으로 시작 (간단함)
- **네트워크 독립**: 오프라인에서도 로컬 기록 가능
- **나중에 확장**: V2에서 공유/플랫폼화 추가

**V1 성공 기준:**
1. 빌더(당신)가 9월 8일 이후에도 **스킬을 계속 호출**하는가
2. **웹사이트를 자주 방문**해서 기록 확인하는가
3. 기록이 충분히 잘 보여서 **이력서에 넣고 싶어 하는가**

---

## Problem Statement

### Current Situation
- 빌더는 매일 AI로 작업하지만, 그 작업이 **휘발된다**
- 포트폴리오는 **3개월 전 상태로 멈춘다**
- AI 시대에 신기술을 빠르게 배우는 빌더의 **최신 역량이 보이지 않는다**

### Why This Matters
- **빌더**: 작업 기록이 없어서 나중에 "뭐 했더라"를 회상하는 비용이 크다
- **리크루터** (미래): 빌더의 최신 기술 스택과 판단 과정을 보고 싶다

### Verified Evidence
- 당신의 마스터 이력서(링크 있음)가 최적화된 이력서(링크 없음)보다 더 잘 먹혔다
- 당신이 손으로 쓴 기록들(에이전트 작성)이 이미 작동하고 있다
- 현재 문제: **자동화 없어서 매번 수작업으로 기록해야 한다**

---

## V1 Architecture

### High-Level Flow

```
┌─ Builder's Chat/IDE ─────────────────┐
│  (ChatGPT, Claude, Cursor)           │
│  작업 완료 → `/builders-diary` 호출  │
└──────────────┬──────────────────────┘
               │
               ↓
      ┌─ Skill/MCP ──────────────┐
      │ • LLM 발췌               │
      │ • 3층 구조 제안          │
      │ • 빌더 확인              │
      └──────────┬───────────────┘
                 │
                 ↓
      ┌─ Local Portfolio Folder ──┐
      │ (사용자가 선택한 경로)     │
      │ • content/                │
      │   ├─ projects/            │
      │   ├─ goals/               │
      │   └─ records/ (.md files) │
      └──────────┬────────────────┘
                 │
                 ↓ (링크 클릭)
      ┌─ Portfolio Website ────────────┐
      │ • 폴더 접근 (File System API)  │
      │ • 3층 계층 시각화              │
      │ • 마크다운 파싱 & 렌더링       │
      └────────────────────────────────┘
```

### Data Model (3-Layer Hierarchy)

| 계층 | 이름 | 예시 | 저장 단위 |
|------|------|------|---------|
| 대 | 프로젝트 | Builder's Diary | 폴더 |
| 중 | 목표/Epic | UI 개발 | 폴더 |
| 소 | 기록/Record | 오류 수정 및 성능 최적화 | 마크다운 파일 |

**특징:**
- 각 층에 고유 ID (불변)
- 각 층에 태그 (나중에 검색용)
- 각 층에 생성 날짜
- 계층 구조는 폴더 구조로 표현

---

## Skill Behavior

### 호출 시점
빌더가 작업을 마친 후, 작업 도구(ChatGPT/Claude/Cursor)에서 **수동으로** `/builders-diary` 호출

### 실행 흐름 (CLI처럼 순차 확인)

```
1. 스킬이 컨텍스트 윈도우 발췌
   → "이 작업의 핵심이 뭐냐"를 LLM이 판단

2. 대분류: 프로젝트 선택/신규 생성
   Q: 어느 프로젝트? 
   A: 기존 프로젝트 리스트 보여주고 선택 또는 신규 입력

3. 중분류: 목표 선택/신규 생성
   Q: 이 작업이 어떤 목표 아래인가?
   A: 해당 프로젝트의 목표 리스트 + LLM 상위 3개 추천
      사용자가 선택 또는 신규 입력

4. 소분류: 기록 제목 제안 + 수정
   LLM이 제목 제안 → 사용자가 확인/수정

5. 태그 제안 + 확인
   LLM이 200+ 기존 태그 중에서 자동 태깅
   사용자가 추가/제거 가능

6. 마크다운 파일 생성 (로컬 폴더에)
   • 폴더 구조에 따라 배치
   • Front matter에 메타데이터 저장
   • 기록 본문 작성

7. 스킬 종료 + URL 출력
   "✅ 완료!
    보기: https://builders-diary.com?folder_access=true
    로컬 폴더: ~/portfolio/projects/builders-diary/goals/ui-dev/records/"
```

### 의도적 한계
- **호출 까먹음**: 사용자 책임. 이게 필터다 (중요한 작업만 기록)
- **네트워크 필요 없음**: 모든 것이 로컬

---

## Portfolio Website

### 기술 스택
- **Frontend**: Next.js 14 + React 18
- **File Access**: File System Access API (W3C 표준)
- **Parsing**: 마크다운 파서 (front matter 포함)
- **Visualization**: 3층 트리뷰 UI
- **Storage**: localStorage (폴더 경로 저장)

### 사용 흐름

#### 첫 방문
```
1. 사용자가 https://builders-diary.com 방문
2. "폴더 선택" 버튼 클릭
3. 브라우저 파일 다이얼로그 열림
4. 사용자가 portfolio 폴더 선택
5. 브라우저가 권한 물음 (File System Access 허가)
6. 사용자 "허가" 클릭
7. URL 변경: https://builders-diary.com?folder_access=true
8. 사용자가 북마크 저장
```

#### 이후 방문
```
1. 북마크 클릭 또는 직접 방문
2. 브라우저가 저장된 폴더 권한 사용 (다시 물어보지 않음)
3. 자동으로 폴더 스캔
4. 3층 계층 구조 표시
```

### UI Layout

```
┌─────────────────────────────────────┐
│  Builder's Diary                    │
│  [Select Folder]  [Refresh]         │
├──────────────┬──────────────────────┤
│              │                      │
│ 프로젝트 트리 │   기록 목록/상세     │
│              │                      │
│ □ Builders   │ Builders Diary       │
│   □ Setup UI │   └─ UI Development  │
│     • OAuth  │       ├─ 20260903... │
│     • Style  │       │  OAuth 붙이기 │
│   □ Deploy   │       │              │
│ □ Project B  │       └─ 20260904... │
│              │          Router 수정  │
│              │                      │
└──────────────┴──────────────────────┘
```

### 각 기록 카드 표시
```
제목: "OAuth 붙이고 리다이렉트 버그 잡음"
생성: 2026-09-03 14:30
태그: oauth, debugging, auth
상태: completed

[상세 보기] → 마크다운 전체 렌더링
```

---

## File & Data Storage

### 폴더 구조

```
~/portfolio/ (사용자 선택)
├── _metadata/
│   ├── config.json           # 프로젝트 목록 (선택사항)
│   └── index.jsonl           # 빠른 검색용 인덱스 (선택사항)
│
└── content/
    ├── projects-{slug}/
    │   ├── project.yaml      # 프로젝트 메타데이터
    │   ├── goals/
    │   │   ├── {goal-slug}/
    │   │   │   ├── goal.yaml
    │   │   │   └── records/
    │   │   │       ├── 20260903-oauth-setup.md
    │   │   │       ├── 20260904-redirect-fix.md
    │   │   │       └── ...
```

### 마크다운 파일 스키마

각 기록 파일 (`.md`):

```markdown
---
id: rec-20260903-001
project_id: proj-builders-diary
project_slug: builders-diary
goal_id: goal-ui-dev
goal_slug: ui-dev
goal_title: UI Development

title: OAuth 붙이고 리다이렉트 버그 잡음
summary: OAuth 토큰 구현 후 콜백 URL 리다이렉트 수정
tags: [oauth, debugging, auth, google]

created_at: 2026-09-03T14:30:00Z
updated_at: 2026-09-03T15:45:00Z
status: completed
---

# 무엇을 했는가

Google OAuth 토큰 구현하고, 리다이렉트 버그를 수정했다.

## 과정

1. OAuth 설정
2. 토큰 검증
3. 리다이렉트 URL 수정

# 왜 했는가

사용자가 Google로 로그인 후 대시보드로 가야 하는데, 원래는 홈으로 간다.

# 배운 점

- OAuth flow에서 state 매개변수가 중요하다
- 토큰 검증 순서가 critical이다

# 다음은 무엇인가

GitHub 로그인 추가. 같은 패턴으로 구현 가능.
```

---

## Success Metrics (V1)

### 빌더 채택 (당신)
- **지표 1**: 9월 8일 이후 스킬을 호출하는 빈도
- **지표 2**: 생성된 기록 총 개수
- **지표 3**: 기록이 생성된 날짜 분포 (연속성)

→ **판정**: 9월 8일 이후 2주간 패턴으로 확인
→ **성공**: 주 2-3회 호출, 주 5개 이상 기록, 일관된 패턴

### 포트폴리오 가치 (당신의 판단)
- **지표**: "이력서에 넣을 수 있겠나?" 느껴지는가
- **V1 목표**: 링크 생성 가능한 상태까지

---

## Out of Scope (V1)

| 항목 | 이유 | 대상 |
|------|------|------|
| 공유 기능 | 로컬 폴더만으로 충분 | V2 |
| 다중 사용자 | 당신만 사용 | V2 |
| 리크루터 대시보드 | 불필요 (링크만 필요) | V3+ |
| 데이터 백엔드 DB | 모든 데이터 로컬 | V2 |
| 사용자 인증 | 로그인 불필요 | V2 |
| 플랫폼화 | 나중에 | V2+ |
| 고급 검색 | 태그는 나중에 | V2 |
| 자동 감지/넛지 | 수동 호출만 | V2 |

---

## Technical Decisions

| 선택 | 대안 | 이유 |
|------|------|------|
| 로컬 폴더만 | 중앙 DB | 당신이 소유, 오프라인 지원 |
| File System Access API | Electron | 웹 표준, 간단 |
| localStorage | IndexedDB | 폴더 경로만 저장 (간단) |
| URL 파라미터 | 세션 | 북마크 가능, 재방문 편함 |
| 로그인 없음 | OAuth | 당신만 사용하니 불필요 |
| 마크다운 | JSON | 버전 관리 친화적, 가독성 |

---

## Known Risks & Mitigations

| 리스크 | 영향 | 완화책 |
|--------|------|--------|
| 호출 까먹음 | 기록 손실 | 명시: 당신이 책임. 중요한 것만 기록 |
| 폴더 구조 복잡 | UI 렌더 실패 | 폴더 자동 생성 (스킬이) |
| File System API 브라우저 미지원 | 오래된 브라우저 사용 불가 | 필요시 polyfill, 또는 Electron |
| 로컬 파일 손상 | 기록 소실 | Git으로 백업 (선택사항) |
| 폴더 권한 만료 | 접근 불가 | 다시 폴더 선택 |

---

## Timeline & Build Order

### Critical Path (5-7일, 9월 8일까지 충분)

```
Day 1-2: Skill 개발
├─ LLM 발췌 로직
├─ CLI 흐름 구현
├─ 로컬 폴더 쓰기
└─ 마크다운 생성

Day 2-3: 웹사이트 기초
├─ File System API 통합
├─ 폴더 스캔 로직
├─ 마크다운 파싱
└─ 3층 트리뷰 UI

Day 4-5: 완성 + 테스트
├─ UI 포장
├─ E2E 검증
├─ 배포 (Vercel)
└─ 오픈소스 준비

Day 6: 여유 + 미세 조정
```

---

## Implementation Plan

### Phase 1: Skill Development
1. ✅ 컨텍스트 발췌 로직 (LLM)
2. ✅ 3층 구조 제안 (LLM)
3. ✅ CLI 확인 흐름 (순차 프롬프트)
4. ✅ 마크다운 파일 생성 (로컬 폴더에)
5. ✅ 스킬 종료 + URL 출력

### Phase 2: Website Development
1. ✅ File System Access API 통합
2. ✅ 폴더 스캔 + 파일 목록
3. ✅ 마크다운 파싱 (front matter 포함)
4. ✅ 3층 트리뷰 렌더링
5. ✅ localStorage로 폴더 경로 저장
6. ✅ URL 파라미터 처리

### Phase 3: Testing & Launch
1. ✅ E2E 테스트 (스킬 호출 → 웹 표시)
2. ✅ 배포 (Vercel)
3. ✅ design-doc.md 완성
4. ✅ 오픈소스 레포 준비
5. ✅ LinkedIn + 포트폴리오 링크 추가

---

## Data Flow Example

### 사용자 시나리오: "OAuth 구현 기록"

```
1️⃣  ChatGPT에서 OAuth 구현 완료
    → `/builders-diary` 호출

2️⃣  스킬 실행
    Q: 프로젝트? → "builders-diary"
    Q: 목표? → "ui-dev" (추천됨)
    Q: 제목? → "OAuth 붙이고 리다이렉트 버그 잡음" (제안, 수정)
    Q: 태그? → [oauth, auth, debugging] (제안, 수정)

3️⃣  파일 생성
    ~/portfolio/content/
    └─ projects-builders-diary/
       └─ goals/ui-dev/
          └─ records/
             └─ 20260903-oauth-setup.md
    (front matter + 본문)

4️⃣  출력
    "✅ 완료!
     보기: https://builders-diary.com?folder_access=true"

5️⃣  사용자가 링크 클릭 (또는 북마크에서)
    웹사이트 방문 → 폴더 자동 로드
    → 3층 계층에 "OAuth 붙이고..." 기록 표시

6️⃣  사용자가 기록 카드 클릭
    → 마크다운 전체 렌더링
    → "이력서에 넣을 수 있을까?" 판단
```

---

## V1 vs V2 vs V3

| 기능 | V1 | V2 | V3+ |
|------|----|----|-----|
| 로컬 기록 생성 | ✅ | ✅ | ✅ |
| 3층 시각화 | ✅ | ✅ | ✅ |
| 태그 검색 | 🔲 | ✅ | ✅ |
| 공유 기능 | 🔲 | ✅ | ✅ |
| 다중 사용자 | 🔲 | 🔲 | ✅ |
| 리크루터 대시보드 | 🔲 | 🔲 | ✅ |
| 데이터 백업 (DB) | 🔲 | ✅ | ✅ |

---

## Next Steps

1. **지금**: 이 설계 확인 ✅
2. **내일**: 스킬 개발 시작
3. **이후**: 웹사이트 개발 (병렬)
4. **9월 7일**: 최종 테스트
5. **9월 8일**: 공개

---

## Appendix: Future Features (V2+)

### 공유 기능 (V2)
```
웹에서 "공유하기" 버튼
→ 해당 기록을 우리 서버로 업로드
→ 공개 링크 생성
→ 리크루터가 링크 클릭해서 봄
```

### 태그 검색 (V2)
```
웹에서 태그 필터링
"oauth", "debugging" 선택
→ 해당 태그의 기록만 표시
```

### 다중 사용자 (V2+)
```
다른 빌더들도 사용하고 싶으면
각자의 URL: https://builders-diary.com?user=alice
리크루터 대시보드 추가
```

---

## Questions for You

**이 최종 설계가 맞는가?**

1. ✅ 로컬 폴더만 저장
2. ✅ 웹에서 시각화
3. ✅ 로그인 없음 (File System API만)
4. ✅ 공유는 V2에서

준비됐습니까? 🚀
