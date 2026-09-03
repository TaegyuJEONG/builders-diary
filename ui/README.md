# 빌더스 다이어리 UI — 변형 3개

## 파일 구조

- data.json — 3층 구조 데이터 (프로젝트 > 편 > 장면)
- variant-a.html — 인사이트 우선 (dark)
- variant-b.html — 3행 동시 노출 (light, serif)
- variant-c.html — 판단 기준 우선 (warm dark, expand)
- README.md — 이 파일

## data.json 스키마

```
{
  tagCategories: {
    "마인드셋": [태그들],
    "도구": [태그들]
  },
  projects: [{
    id, name, description,
    entries: [{
      id, title, date, duration, tags, problem, takeaways, source,
      scenes: [{
        id, number, title, insight, tags,
        situation, criterion, action, result, wrong
      }]
    }]
  }]
}
```

### 3층 구조 설명

- **대분류 (project)**: 프로젝트 단위. 헤더 탭으로 전환.
- **중분류 (entry)**: 편 단위. FORMAT.md의 "한 편의 이야기". 이게 이력서의 불릿이다.
- **소분류 (scene)**: 장면 단위. entries/ 의 "## 장면 N" 하나에 대응. 카드 하나.

### 빈 상태 설계

- entries 배열이 비었을 때: 빈 상태 메시지 + 설명 텍스트
- scenes가 있으나 태그 필터로 전부 걸러진 경우: "이 태그에 해당하는 장면이 없습니다" + 필터 초기화 버튼
- data.json fetch 실패 시: 각 파일 내 EMBEDDED 상수로 폴백

## 변형 비교

### A: 인사이트 우선 (dark)

**가설**: 카드 앞면의 80%가 핵심 인사이트 한 문장이어야 한다.
빌더가 피드를 훑을 때 "이게 내 문제인가?" 한 줄로 판단한다.
나머지 맥락은 판단 이후에 꺼낸다.

- 앞면: insight 텍스트 + 태그
- 뒷면 (flip): 판단 기준 · 상황 · 한 것 · 결과 · 틀린 것
- 상호작용: 카드 클릭 = 3D flip

### B: 3행 동시 노출 (light, Georgia 폰트)

**가설**: 상황·결과·틀린것 3행을 앞면에 모두 노출하면 뒤집기 전에 판단 가능하다.
카드는 정보 컨테이너가 아니라 비교 도구다.
빌더는 여러 장면을 나란히 스캔하면서 "이 패턴이 내 것과 같은가" 본다.

- 앞면: 장면 번호 · 제목 + 상황 / 결과 / 틀린 것 3행 + 태그
- 뒷면 (flip): 판단 기준 · 한 것 · 인사이트
- 틀린 것은 빨간색으로 앞면에 노출

### C: 판단 기준 우선 (warm dark, expand)

**가설**: FORMAT.md의 핵심은 "판단 기준이 해자"라는 것이다.
카드 앞면이 판단 기준을 가장 크게 노출하고,
인사이트는 pull-quote로 처리. flip 대신 expand.

- 앞면 (collapsed): 제목 · 태그 + 판단 기준(녹색 강조) + 상황 + 전체 보기 버튼
- 펼침 (expanded): + 한 것 / 결과 / 틀린 것(적색) / 인사이트(amber pull-quote)
- flip 없이 세로 expand

## 확인 못 한 것

- 모바일 뷰 (가로 스크롤이 터치에서 자연스러운지)
- 카드 10개 이상일 때 성능
- 편이 여러 개일 때 세로 스크롤과의 충돌
- 키보드 접근성 (Tab, Enter로 카드 전환)
- data.json 기록이 없을 때 (projects 배열 빈 경우) 완전 빈 상태 처리
