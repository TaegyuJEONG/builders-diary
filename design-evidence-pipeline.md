# Evidence Pipeline — 설계 문서

날짜: 2026-09-05
상태: 초안 (승인 대기)
방향 결정: 증빙 파이프라인 우선 (A: 카드 리디자인, C: 통합 문서보다 먼저)

## 문제

카드가 텍스트 서술뿐이다. 2026 채용 시장에서 서술은 AI가 무한정 싸게 만들 수
있어 신뢰도가 없다. 리크루터가 믿는 것은 outcome evidence다.

기존 툴(DevBio, Shipfolio 등)은 작업이 끝난 뒤 GitHub/Stripe API를 붙이는
사후 연동이다. 빌더스다이어리는 작업이 일어나는 컨텍스트 창 안에서 실행된다 —
커밋, 테스트 출력, 실행 중인 로컬호스트가 카드 생성 시점에 눈앞에 있다.
증빙을 요구하지 않고 부산물로 포획할 수 있는 유일한 위치. 이것이 해자다.

## 원칙

1. 빌더에게 묻지 않는다. 흔적에 있는 것만 자동 수집한다.
2. 흔적에 없으면 없는 채로 둔다. 지어내지 않는다.
3. 증빙 없는 카드도 만들어진다. 다만 화면에서 구분된다 (강요 대신 인센티브).

## 증빙 소스 (컨텍스트 창 안에서)

| 타입 | 수집 대상 | 저장 형태 |
|------|-----------|-----------|
| commit | 세션에 등장한 커밋 해시·메시지 | URL + diff stat (+412 −80, 7 files) |
| output | 테스트/빌드 출력의 핵심 줄 | 인용 문자열 ("31 passed", "Ready in 1846ms") |
| screenshot | 실행 중인 로컬호스트/배포 URL | 이미지 파일 (호스트 AI에 캡처 도구 있을 때만) |
| link | PR, 배포 URL, 이슈 | URL |

스크린샷은 best-effort: 호스트 AI(Claude Code 등)가 브라우저/캡처 도구를
가진 경우에만. 없으면 조용히 건너뛴다.

## 스키마 변경

### 마크다운 frontmatter (entries/*.md)

```yaml
evidence:
  - type: commit
    label: "filter fix"
    url: https://github.com/.../commit/abc123
    meta: "+412 −80, 7 files"
  - type: output
    label: "type check"
    quote: "tsc --noEmit → 0 errors"
  - type: screenshot
    label: "timeline view"
    path: ./assets/2026-09-05-01-timeline.png
```

이미지는 엔트리 옆 `assets/` 폴더에 저장 (로컬 마크다운 원칙 유지).

### 웹 types.ts

기존 `Evidence {label, url, type}` 확장:
- type에 `commit | output | screenshot` 추가
- `meta?: string` (diff stat 등), `quote?: string` (출력 인용), `path?: string` (로컬 이미지)

parser.ts가 frontmatter evidence 블록을 읽어 Record.evidence로 매핑.

## 스킬 변경 (SKILL.md)

Step 1(추출)과 Step 5(작성) 사이에 증빙 수집 단계 추가:

> Step 4.5: 증빙 수집
> 카드마다 세션 흔적에서 다음을 찾는다. 찾은 것만 쓴다:
> - 커밋 해시 → remote URL 조합 가능하면 커밋 링크 + diff stat
> - 테스트/빌드/실행 출력에서 결과를 증명하는 줄 1~3개 (인용 그대로)
> - 로컬호스트가 떠 있고 캡처 도구가 있으면 스크린샷 1장 → assets/에 저장
> - 세션에 등장한 PR/배포/이슈 URL
> 없는 증빙을 만들지 마라. 빌더에게 요청하지도 마라.

드라이런 출력에도 카드별 증빙 예정 목록 표시.

## MCP 서버 변경

generate_record 입력 스키마에 `evidence: array` 추가. 서버는 검증·저장만
한다 (수집은 호스트 AI가 스킬 지시로 수행 — 서버는 컨텍스트 창을 못 보므로).

## 웹 표시 (최소, 카드 리디자인은 별도 작업)

- 카드: 증빙 개수 칩 (예: ● 3 evidence). 증빙 있는 카드 = verified 스타일
- 상세: Evidence 섹션에 타입별 렌더 (commit → 링크+diff stat, output → 인용 블록, screenshot → 이미지)

## 하지 않는 것

- GitHub API 폴링/사후 연동 (컨텍스트 포획 원칙 위배, 복잡도만 증가)
- 증빙 필수화 (빈 카드도 유효 — 화면 구분으로 충분)
- 증빙 진위 검증 (v1 범위 밖. verified 뱃지는 "증빙 첨부됨" 의미)

## 검증 계획

1. 이 세션(웹 필터 버그 수정 세션)으로 `--dry-run` 실행 → 증빙 목록이 실제
   흔적(tsc 출력, 커밋, localhost:3111)과 일치하는지 확인
2. 실행 모드로 카드 1개 생성 → frontmatter evidence 블록 형식 확인
3. 웹에서 해당 entries 폴더 연결 → 증빙 칩/상세 렌더 확인

## 열린 질문

- 스크린샷 파일 크기/개수 제한 (권장: 카드당 1장, 500KB 이하로 리사이즈)
- 커밋 URL 조합: remote가 private repo면 링크가 리크루터에게 안 열림 —
  diff stat 텍스트만으로도 가치 있으므로 링크는 optional로
