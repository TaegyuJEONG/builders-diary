# Issue #1: MCP Server - Core Tool: generate_record (Multiturn Record Generation)

## Context

Builder's Diary v1은 사용자가 AI 도구(ChatGPT, Claude, Cursor)에서 작업을 완료한 후 `@builders-diary` 호출로 기록을 **자동 생성**하는 시스템입니다.

**핵심 요구:**
- 일반 Claude 채팅에서도 호출 가능 (Claude Connector)
- 멀티턴 대화: 사용자 답변에 따라 프로젝트/목표 동적 결정
- 로컬 폴더에만 저장 (완전 사용자 소유)

이 Issue는 **MCP Server의 가장 중요한 Tool**: `generate_record`를 정의합니다.

---

## Current Situation

**지금:**
- 빌더가 기록을 수작업으로 만듦 (또는 호출 없음)
- 일관된 구조 없음
- 자동화 없음

**필요한 것:**
- MCP Tool 호출 → 멀티턴 대화 → 로컬 파일 생성

---

## Proposed Solution

### MCP Tool: `generate_record`

**목적:** 
사용자와의 멀티턴 대화를 통해 작업을 기록으로 저장합니다.

**워크플로우:**

```
Turn 1: 사용자가 context 제공
  → MCP가 LLM으로 분석
  → "이 작업은 'builders-diary' 프로젝트의 'ui-dev' 목표 같은데, 맞아?"
  → 사용자 답변 대기

Turn 2: 사용자 답변
  → "맞아" / "새 프로젝트" / "목표는 'auth'"
  → MCP가 프로젝트/목표 확정

Turn 3: 파일 생성
  → 로컬 폴더에 마크다운 파일 저장
  → "완료! 파일: ~/portfolio/content/projects-builders-diary/goals/ui-dev/records/20260903-000-oauth-setup.md"
```

---

## Implementation Details

### 1. MCP Tool Input Schema

```json
{
  "portfolio_path": {
    "type": "string",
    "description": "Portfolio root directory path (e.g., /Users/username/portfolio)",
    "required": true
  },
  "action": {
    "type": "string",
    "enum": ["step_1", "step_2", "step_3"],
    "description": "Current step in the multiturn flow",
    "required": true
  },
  "context": {
    "type": "string",
    "description": "Turn 1: Full conversation context; Turn 2: User response; Turn 3: Empty",
    "required": false
  },
  "state": {
    "type": "object",
    "description": "Persistent state from previous turn (project_id, goal_id, etc.)",
    "required": false
  }
}
```

### 2. MCP Tool Output Schema

**Step 1 Output:**
```json
{
  "step": 1,
  "status": "awaiting_confirmation",
  "proposal": {
    "project_slug": "builders-diary",
    "project_title": "Builder's Diary",
    "project_is_new": false,
    "goal_slug": "ui-dev",
    "goal_title": "UI Development",
    "goal_is_new": false,
    "record_title": "OAuth 붙이고 리다이렉트 버그 잡음",
    "tags": ["oauth", "auth", "debugging"]
  },
  "message": "이 내용이 맞나요?\n\n프로젝트: builders-diary\n목표: ui-dev\n제목: OAuth 붙이고 리다이렉트 버그 잡음\n태그: oauth, auth, debugging\n\n'맞아', '새 프로젝트', '목표 변경' 등으로 답변해주세요.",
  "state": { /* 다음 턴용 상태 저장 */ }
}
```

**Step 2 Output:**
```json
{
  "step": 2,
  "status": "confirmed",
  "confirmed_data": {
    "project_slug": "builders-diary",
    "project_title": "Builder's Diary",
    "goal_slug": "ui-dev",
    "goal_title": "UI Development",
    "record_title": "OAuth 붙이고 리다이렉트 버그 잡음",
    "tags": ["oauth", "auth", "debugging"]
  },
  "message": "좋아, 파일 생성 중...",
  "state": { /* 다음 턴용 상태 */ }
}
```

**Step 3 Output:**
```json
{
  "step": 3,
  "status": "completed",
  "file_created": {
    "path": "/Users/taegyujeong/portfolio/content/projects-builders-diary/goals/ui-dev/records/20260903-000-oauth-setup.md",
    "project_id": "proj-builders-diary",
    "goal_id": "goal-ui-dev",
    "record_id": "rec-20260903-000"
  },
  "message": "✅ 완료!\n저장 위치: ~/portfolio/content/projects-builders-diary/goals/ui-dev/records/20260903-000-oauth-setup.md\n\n웹에서 보기: https://builders-diary.com?folder_access=true"
}
```

### 3. Folder Structure (Auto-Created)

```
~/portfolio/
├── _metadata/
│   ├── config.json                    # portfolio 설정 저장
│   └── index.jsonl                    # 빠른 검색용 인덱스
└── content/
    ├── projects-builders-diary/       # 프로젝트 폴더
    │   ├── project.yaml               # 프로젝트 메타데이터
    │   └── goals/
    │       ├── ui-dev/                # 목표 폴더
    │       │   ├── goal.yaml
    │       │   └── records/
    │       │       ├── 20260903-000-oauth-setup.md
    │       │       ├── 20260903-001-redirect-fix.md
    │       │       └── 20260903-002-logout-flow.md
    │       └── auth/
    │           ├── goal.yaml
    │           └── records/
```

**폴더 자동 생성 규칙:**
- 없으면 생성 (Obsidian 방식)
- 생성 시 각 레벨에 `.yaml` 메타데이터 파일 자동 생성

### 4. Markdown File Schema

**파일명:** `{date}-{seq}-{title}.md`
- `{date}`: YYYYMMDD (생성 날짜)
- `{seq}`: 000, 001, 002, ... (같은 날짜 같은 목표 내에서)
- `{title}`: 기록 제목 (kebab-case)

**예:** `20260903-000-oauth-setup.md`

**파일 내용:**
```markdown
---
id: rec-20260903-000
project_id: proj-builders-diary
project_slug: builders-diary
project_title: Builder's Diary
goal_id: goal-ui-dev
goal_slug: ui-dev
goal_title: UI Development

title: OAuth 붙이고 리다이렉트 버그 잡음
summary: OAuth 토큰 구현 후 콜백 URL 리다이렉트 수정
tags: [oauth, auth, debugging, google]

created_at: 2026-09-03T14:30:00Z
updated_at: 2026-09-03T14:30:00Z
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

### 5. Configuration Storage

**위치:** `~/.builders-diary/config.json`

```json
{
  "version": "1.0",
  "portfolio_path": "/Users/taegyujeong/portfolio",
  "user_id": "unique-id",
  "created_at": "2026-09-03T00:00:00Z"
}
```

**처음 설정:**
1. 사용자가 `@builders-diary setup /Users/taegyujeong/portfolio` 호출
2. MCP가 폴더 검증 + config.json 생성
3. 이후 호출에서 자동으로 포트폴리오 경로 사용

### 6. Error Handling (Industry Standard)

**에러 타입별 처리:**

| 에러 | 처리 |
|------|------|
| 폴더 경로 없음/권한 없음 | "포트폴리오 폴더를 다시 설정해줄래? `@builders-diary setup /path/to/folder`" |
| 파일 쓰기 실패 | "파일을 저장할 수 없어. 디스크 공간이나 권한을 확인해줄래?" |
| LLM API 실패 | "LLM이 응답하지 않아. 다시 시도해줄래?" (최대 3회 재시도) |
| 잘못된 입력 | 사용자에게 명확한 에러 메시지 + 가이드 |

---

## Acceptance Criteria

1. ✅ MCP Tool `generate_record` 구현
   - Input schema 준수
   - 3-step 멀티턴 흐름 동작

2. ✅ Step 1: 컨텍스트 분석
   - LLM이 프로젝트/목표/제목/태그 제안
   - 기존 vs 신규 판단 (사용자 최종 결정)

3. ✅ Step 2: 사용자 답변 처리
   - "맞아" → 그대로 진행
   - "새 프로젝트" → 신규 생성
   - "목표 변경" → 기존/신규 선택

4. ✅ Step 3: 파일 생성
   - 폴더 자동 생성 (Obsidian 방식)
   - 마크다운 파일 정확하게 생성
   - front matter + 본문 포함

5. ✅ Configuration Management
   - `~/.builders-diary/config.json` 생성/관리
   - 포트폴리오 경로 저장 및 재사용

6. ✅ Error Handling
   - 폴더 경로 오류 감지 + 가이드
   - 파일 쓰기 실패 처리
   - LLM API 실패 재시도

7. ✅ E2E Test
   - 한 번의 전체 3턴 워크플로우 성공
   - 파일이 올바른 위치에 생성됨
   - 파일 내용이 정확함

---

## Testing Plan

### Unit Tests
- LLM 프롬프트 검증
- 폴더 경로 검증
- 파일명 생성 로직
- YAML/마크다운 파싱

### Integration Tests
- Step 1 → Step 2 → Step 3 전체 흐름
- 각 step 간 상태 전달
- 파일 생성 결과 검증

### E2E Test
- Claude 채팅에서 `@builders-diary` 호출
- 멀티턴 대화 3회 왕복
- 파일이 정확한 위치에 생성
- 파일 내용 검증 (front matter, 본문)

---

## Timeline

- **Day 1-2:** MCP Server 스켈레톤 + `generate_record` Tool 구현
- **Day 3:** Step 1, 2, 3 완성 + 테스트
- **Day 4:** 배포 준비 (Claude Desktop 설정)

---

## Out of Scope (V1)

- 웹사이트 시각화 (별도 Issue #2)
- 공유 기능 (V2)
- 태그 검색 (웹사이트 Issue에서)
- 자동 감지/넛지 (V2)

---

## Notes

- **멀티턴 상태:** MCP가 각 턴 결과에 `state` 필드 포함 → Claude가 다음 Turn에서 자동 전달
- **기존 vs 신규:** Step 1에서 LLM이 제안 → Step 2에서 사용자가 최종 결정 (항상)
- **에러 처리:** 기본만 (엣지케이스는 V2)
- **성능:** 로컬 파일 I/O만 → 빠름

